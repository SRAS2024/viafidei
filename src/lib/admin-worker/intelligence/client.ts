/**
 * The bridge to the permanent Python intelligence brain.
 *
 * The brain is NOT a per-call sidecar: TypeScript holds a single long-lived
 * `python3 -m intelligence` process open for the lifetime of the worker (or
 * web) process and multiplexes every request over it by id. This makes the
 * brain a permanent, always-available intelligence core that is in play for
 * every meaningful decision — not a process that is spawned and thrown away.
 *
 * The process is started lazily on first use, auto-restarts if it dies, and
 * is shut down cleanly via {@link shutdownBrain}. If the brain is disabled,
 * Python is missing, a call times out, or the process crashes, `callBrain`
 * returns `null`. For the final-action decision a `null` puts the worker into
 * safe degraded mode (safe work only — never a TypeScript final-decision
 * fallback); supplementary callers simply skip that analysis. The brain is the
 * final decision brain whenever it is available, and resilient by design so an
 * outage degrades safely rather than crashing the worker.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BrainEnvelope, BrainEnvelopeSchema, BrainOp, PROTOCOL_VERSION } from "./contracts";

export interface CallOpts {
  /** Per-call timeout (ms). Defaults to INTELLIGENCE_TIMEOUT_MS or 8000. */
  timeoutMs?: number;
  /** If set, cache the envelope under this key. */
  cacheKey?: string;
  /** Cache TTL (ms). Defaults to 60_000. */
  cacheTtlMs?: number;
  /** Ignore the cached "down" status and try anyway. */
  force?: boolean;
}

type Status = "unknown" | "up" | "down";

let _status: Status = "unknown";
let _downReason: string | null = null;

let _proc: ChildProcessWithoutNullStreams | null = null;
const _pending = new Map<
  string,
  { settle: (value: unknown | null) => void; timer: ReturnType<typeof setTimeout> }
>();

// Restart throttle: don't thrash if the brain keeps dying.
let _restarts = 0;
let _restartWindowStart = 0;
const MAX_RESTARTS_PER_MIN = 5;

const _cache = new Map<string, { env: BrainEnvelope; expires: number }>();

function brainLog(level: "warn" | "info", msg: string): void {
  if (level === "info" && process.env.INTELLIGENCE_DEBUG !== "1") return;
  // eslint-disable-next-line no-console
  console[level](`[intelligence] ${msg}`);
}

/** Whether the brain is enabled by configuration. Default: on. */
export function isBrainEnabled(): boolean {
  const v = (process.env.INTELLIGENCE_BRAIN_ENABLED ?? "").toLowerCase();
  if (["0", "false", "off", "no"].includes(v)) return false;
  return true;
}

/** Locate the repo root that contains the `intelligence/` package. */
export function resolveBrainRoot(): string | null {
  const candidates: string[] = [];
  if (process.env.INTELLIGENCE_ROOT) candidates.push(process.env.INTELLIGENCE_ROOT);
  candidates.push(process.cwd());
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.resolve(here, "../../../.."));
  } catch {
    // import.meta unavailable (CJS shim) — process.cwd() covers the worker.
  }
  for (const c of candidates) {
    if (c && existsSync(path.join(c, "intelligence", "__init__.py"))) return c;
  }
  return null;
}

function pythonExe(): string {
  return process.env.INTELLIGENCE_PYTHON ?? "python3";
}

function markDown(reason: string): void {
  if (_status !== "down") brainLog("warn", `brain unavailable: ${reason}`);
  _status = "down";
  _downReason = reason;
}

export function brainStatus(): { status: Status; reason: string | null; running: boolean } {
  return { status: _status, reason: _downReason, running: !!_proc && _proc.exitCode === null };
}

function failAllPending(): void {
  for (const [, p] of _pending) {
    clearTimeout(p.timer);
    p.settle(null);
  }
  _pending.clear();
}

/** Stop the brain process and reject any in-flight calls. */
export function shutdownBrain(): void {
  failAllPending();
  if (_proc) {
    try {
      _proc.stdin.end();
    } catch {
      /* ignore */
    }
    try {
      _proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    _proc = null;
  }
}

/** Reset cached availability + memo cache + tear down the process (tests). */
export function resetBrainStatus(): void {
  shutdownBrain();
  _status = "unknown";
  _downReason = null;
  _restarts = 0;
  _restartWindowStart = 0;
  _cache.clear();
}

/** Ensure the long-lived brain process is running; returns it or null. */
function ensureProc(): ChildProcessWithoutNullStreams | null {
  if (_proc && _proc.exitCode === null && !_proc.killed) return _proc;

  const root = resolveBrainRoot();
  if (!root) {
    markDown("intelligence/ package not found");
    return null;
  }

  const nowMs = Date.now();
  if (nowMs - _restartWindowStart > 60_000) {
    _restartWindowStart = nowMs;
    _restarts = 0;
  }
  if (_restarts >= MAX_RESTARTS_PER_MIN) {
    markDown(`too many brain restarts (${_restarts}/min)`);
    return null;
  }

  try {
    const child = spawn(pythonExe(), ["-m", "intelligence"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONDONTWRITEBYTECODE: "1" },
    });

    // Per-child stdout buffer + handlers, all guarded by `_proc === child` so a
    // previously-killed process exiting late can never null the current one or
    // fail its in-flight calls (the lifecycle race).
    let buf = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (_proc !== child) return; // stale process — ignore
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // ignore non-JSON noise on stdout
        }
        const id = (parsed as { id?: string } | null)?.id;
        if (!id) continue;
        const p = _pending.get(id);
        if (p) {
          _pending.delete(id);
          clearTimeout(p.timer);
          p.settle(parsed);
        }
      }
    });
    child.stderr.on("data", (d) => brainLog("info", `stderr: ${String(d).slice(0, 200)}`));

    const handleGone = (code: number | null, signal: string | null) => {
      if (_proc !== child) return; // a previous process exiting — ignore
      _proc = null;
      if (_pending.size > 0) {
        brainLog(
          "warn",
          `brain process exited (code=${code} signal=${signal}); failing ${_pending.size} pending call(s)`,
        );
        failAllPending();
      }
    };
    child.on("exit", handleGone);
    child.on("error", (e) => {
      markDown(`spawn error: ${e.message}`);
      handleGone(null, null);
    });
    child.stdin.on("error", () => undefined); // swallow EPIPE on a dying child

    _proc = child;
    _restarts += 1;
    return child;
  } catch (e) {
    markDown(`failed to start brain: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Warm the brain up front (called by the worker on boot). */
export function ensureBrainStarted(): boolean {
  if (!isBrainEnabled()) return false;
  return ensureProc() != null;
}

function cacheGet(key: string): BrainEnvelope | null {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    _cache.delete(key);
    return null;
  }
  return hit.env;
}

function cacheSet(key: string, env: BrainEnvelope, ttl: number): void {
  _cache.set(key, { env, expires: Date.now() + ttl });
  if (_cache.size > 500) {
    const oldest = _cache.keys().next().value;
    if (oldest) _cache.delete(oldest);
  }
}

/**
 * Call a brain op over the persistent process. Returns the validated
 * envelope, or `null` when the brain is unavailable for any reason.
 */
export async function callBrain<T = unknown>(
  op: BrainOp,
  payload: unknown,
  opts: CallOpts = {},
): Promise<BrainEnvelope<T> | null> {
  if (!isBrainEnabled()) return null;
  if (_status === "down" && !opts.force) return null;

  if (opts.cacheKey) {
    const hit = cacheGet(opts.cacheKey);
    if (hit) return hit as BrainEnvelope<T>;
  }

  const proc = ensureProc();
  if (!proc) return null;

  const id = randomUUID();
  const timeoutMs = opts.timeoutMs ?? Number(process.env.INTELLIGENCE_TIMEOUT_MS ?? 8000);

  const raw = await new Promise<unknown | null>((resolve) => {
    const timer = setTimeout(() => {
      _pending.delete(id);
      brainLog("warn", `callBrain(${op}) timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
    _pending.set(id, { settle: resolve, timer });
    try {
      proc.stdin.write(`${JSON.stringify({ id, op, payload: payload ?? {} })}\n`);
    } catch (e) {
      _pending.delete(id);
      clearTimeout(timer);
      brainLog(
        "warn",
        `callBrain(${op}) write failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      resolve(null);
    }
  });

  if (raw == null) return null;

  const result = BrainEnvelopeSchema.safeParse(raw);
  if (!result.success) {
    brainLog("warn", `callBrain(${op}) envelope failed validation: ${result.error.message}`);
    return null;
  }
  const env = result.data;
  if (env.protocolVersion && env.protocolVersion !== PROTOCOL_VERSION) {
    markDown(`protocol mismatch: brain v${env.protocolVersion} vs expected v${PROTOCOL_VERSION}`);
    return null;
  }

  _status = "up";
  _downReason = null;
  if (opts.cacheKey) cacheSet(opts.cacheKey, env, opts.cacheTtlMs ?? 60_000);
  return env as BrainEnvelope<T>;
}

/**
 * Health probe: list the brain's ops + protocol version via a short one-shot
 * (`--list-ops`). Independent of the persistent process so it gives an
 * accurate capability list for the admin dashboard.
 */
export async function probeBrain(
  timeoutMs = 5000,
): Promise<{ protocolVersion: number; ops: string[] } | null> {
  const root = resolveBrainRoot();
  if (!root) {
    markDown("intelligence/ package not found");
    return null;
  }
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(pythonExe(), ["-m", "intelligence", "--list-ops"], { cwd: root });
      let buf = "";
      let errBuf = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("probe timed out"));
      }, timeoutMs);
      child.stdout.on("data", (d) => (buf += d.toString()));
      child.stderr.on("data", (d) => (errBuf += d.toString()));
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(buf);
        else reject(new Error(errBuf || `exit ${code}`));
      });
    });
    const parsed = JSON.parse(out) as { protocol_version: number; ops: string[] };
    return { protocolVersion: parsed.protocol_version, ops: parsed.ops };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOENT/.test(msg)) markDown(`python executable not found (${pythonExe()})`);
    brainLog("warn", `probeBrain failed: ${msg}`);
    return null;
  }
}

// Best-effort cleanup so a persistent child never blocks process exit.
for (const sig of ["exit", "SIGINT", "SIGTERM"] as const) {
  process.once(sig, () => shutdownBrain());
}

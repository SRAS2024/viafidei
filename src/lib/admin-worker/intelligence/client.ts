/**
 * The bridge that calls the Python intelligence brain from TypeScript.
 *
 * Transport: one-shot subprocess per call — `python3 -m intelligence --once`
 * with a JSON request on stdin and a JSON envelope on stdout. This needs no
 * long-running service and no network. Per the spec, the brain is consulted
 * for *meaningful decisions*, not every tiny DB write, so the spawn cost is
 * acceptable; an in-memory cache avoids repeating expensive analysis.
 *
 * Safety: the brain is always optional. If it's disabled, Python is missing,
 * the package can't be found, it times out, crashes, returns malformed JSON,
 * or reports a mismatched protocol version, `callBrain` returns `null` and the
 * caller falls back to its existing deterministic heuristics. Nothing breaks.
 */

import { spawn } from "node:child_process";
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

const _cache = new Map<string, { env: BrainEnvelope; expires: number }>();

function brainLog(level: "warn" | "info", msg: string): void {
  if (level === "info" && process.env.INTELLIGENCE_DEBUG !== "1") return;
  // Low-volume, worker-side diagnostics. Kept on console so the bridge has no
  // dependency on the app logger (it runs in the worker process).
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
    // import.meta unavailable (e.g. CJS shim) — process.cwd() covers the worker.
  }
  for (const c of candidates) {
    if (c && existsSync(path.join(c, "intelligence", "__init__.py"))) return c;
  }
  return null;
}

function markDown(reason: string): void {
  if (_status !== "down") brainLog("warn", `brain disabled for this process: ${reason}`);
  _status = "down";
  _downReason = reason;
}

export function brainStatus(): { status: Status; reason: string | null } {
  return { status: _status, reason: _downReason };
}

/** Reset cached availability + memo cache. Intended for tests. */
export function resetBrainStatus(): void {
  _status = "unknown";
  _downReason = null;
  _cache.clear();
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
  // Bound the cache so a long-lived worker can't grow it without limit.
  if (_cache.size > 500) {
    const oldest = _cache.keys().next().value;
    if (oldest) _cache.delete(oldest);
  }
}

function spawnOnce(
  root: string,
  py: string,
  requestJson: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(py, ["-m", "intelligence", "--once"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONDONTWRITEBYTECODE: "1" },
    });
    let out = "";
    let err = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error(`brain timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => finish(() => reject(e)));
    child.on("close", (code) =>
      finish(() =>
        code === 0
          ? resolve(out)
          : reject(new Error(`brain exited ${code}: ${err.slice(0, 500) || "(no stderr)"}`)),
      ),
    );
    // The child may exit before we finish writing; swallow EPIPE.
    child.stdin.on("error", () => undefined);
    child.stdin.write(requestJson);
    child.stdin.end();
  });
}

/**
 * Call a brain op. Returns the validated envelope, or `null` when the brain is
 * unavailable for any reason (caller should fall back to its heuristics).
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

  const root = resolveBrainRoot();
  if (!root) {
    markDown("intelligence/ package not found");
    return null;
  }

  const py = process.env.INTELLIGENCE_PYTHON ?? "python3";
  const timeoutMs = opts.timeoutMs ?? Number(process.env.INTELLIGENCE_TIMEOUT_MS ?? 8000);
  const request = JSON.stringify({ id: randomUUID(), op, payload: payload ?? {} });

  let raw: string;
  try {
    raw = await spawnOnce(root, py, request, timeoutMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOENT/.test(msg)) markDown(`python executable not found (${py})`);
    brainLog("warn", `callBrain(${op}) failed: ${msg}`);
    return null;
  }

  const line = raw.trim().split(/\r?\n/).filter(Boolean).pop();
  if (!line) {
    brainLog("warn", `callBrain(${op}) returned no output`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    brainLog("warn", `callBrain(${op}) returned invalid JSON`);
    return null;
  }

  const result = BrainEnvelopeSchema.safeParse(parsed);
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
 * Probe the brain once (lists ops) to confirm it's reachable. Returns the op
 * list on success, or null. Useful for the admin "is the brain online?" panel.
 */
export async function probeBrain(
  timeoutMs = 5000,
): Promise<{ protocolVersion: number; ops: string[] } | null> {
  const root = resolveBrainRoot();
  if (!root) {
    markDown("intelligence/ package not found");
    return null;
  }
  const py = process.env.INTELLIGENCE_PYTHON ?? "python3";
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(py, ["-m", "intelligence", "--list-ops"], { cwd: root });
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
        code === 0 ? resolve(buf) : reject(new Error(errBuf || `exit ${code}`));
      });
    });
    const parsed = JSON.parse(out) as { protocol_version: number; ops: string[] };
    _status = "up";
    _downReason = null;
    return { protocolVersion: parsed.protocol_version, ops: parsed.ops };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOENT/.test(msg)) markDown(`python executable not found (${py})`);
    brainLog("warn", `probeBrain failed: ${msg}`);
    return null;
  }
}

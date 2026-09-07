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

import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BrainEnvelope, BrainEnvelopeSchema, BrainOp, PROTOCOL_VERSION } from "./contracts";
import { workerExecutionAllowed, workerExecutionOrigin } from "../execution-context";

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
let _downAt = 0;

// A "down" brain must NOT be latched down for the whole process lifetime. A
// transient crash-loop, timeout, or protocol skew would otherwise pin the
// worker in safe-degraded mode forever (→ nothing publishes) until a restart.
// After this cooldown we re-arm to "unknown" so the next call re-probes and the
// brain can self-heal. Overridable for tests via INTELLIGENCE_DOWN_RETRY_MS.
const DOWN_RETRY_COOLDOWN_MS = 60_000;

function downRetryCooldownMs(): number {
  const raw = (process.env.INTELLIGENCE_DOWN_RETRY_MS ?? "").trim();
  if (!raw) return DOWN_RETRY_COOLDOWN_MS; // unset — Number("") is 0, so guard first
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DOWN_RETRY_COOLDOWN_MS;
}

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

// Consecutive per-call timeouts on the resident process (see noteTimeout).
let _consecutiveTimeouts = 0;
// One-shot guard for the INTELLIGENCE_TIMEOUT_MS warning (see defaultTimeoutMs).
let _timeoutEnvWarned = false;

function brainLog(level: "warn" | "info", msg: string): void {
  if (level === "info" && process.env.INTELLIGENCE_DEBUG !== "1") return;
  // eslint-disable-next-line no-console
  console[level](`[intelligence] ${msg}`);
}

/**
 * Whether the brain is enabled *here*. Default: on — but never inside the
 * production web service. The Python intelligence brain is Admin Worker
 * computation and belongs to the local (MacBook) runtime (spec §1, §7); the
 * Railway web process must not hold a resident Python process.
 */
export function isBrainEnabled(): boolean {
  if (!workerExecutionAllowed()) return false;
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

/**
 * Interpreter candidates, in order. The package needs Python >= 3.10
 * (`@dataclass(slots=True)`, `match`), but on a stock Mac `python3` is Apple's
 * 3.9 — which crashes at import, so every spawn died in ~30ms, the restart
 * throttle latched "down", and the worker sat in permanent safe-degraded mode
 * with every content lane skipped ("worker ON, nothing grows"). The only thing
 * that made it work was the gitignored `.env` naming python3.11 explicitly.
 * Resolve the interpreter here instead so a fresh checkout / a launcher that
 * does not set INTELLIGENCE_PYTHON still finds a usable Python.
 */
const PYTHON_CANDIDATES: readonly string[] = [
  "/opt/homebrew/opt/python@3.11/bin/python3.11",
  "/opt/homebrew/opt/python@3.12/bin/python3.12",
  "/opt/homebrew/bin/python3",
  "python3.12",
  "python3.11",
  "python3",
];
const PYTHON_VERSION_CHECK = "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)";

let _resolvedPython: string | null = null;
// The env value the cache was computed for; a test that swaps
// INTELLIGENCE_PYTHON between cases must not be served a stale answer.
let _resolvedPythonFor: string | undefined;

/** Does this interpreter exist and run Python >= 3.10? Synchronous on purpose:
 * it runs once per process (cached) and `ensureProc` is synchronous. */
function pythonUsable(exe: string): boolean {
  try {
    const r = spawnSync(exe, ["-c", PYTHON_VERSION_CHECK], { stdio: "ignore", timeout: 5000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

function pythonExe(): string {
  const explicit = (process.env.INTELLIGENCE_PYTHON ?? "").trim();
  if (_resolvedPython && _resolvedPythonFor === explicit) return _resolvedPython;
  _resolvedPythonFor = explicit;
  // An explicit setting is the operator's decision and is used verbatim — the
  // boot probe (ensureBrainStarted) reports loudly if it turns out to be
  // broken, rather than silently substituting a different interpreter.
  if (explicit) {
    _resolvedPython = explicit;
    return explicit;
  }
  const found = PYTHON_CANDIDATES.find(pythonUsable);
  if (!found) {
    // Nothing usable: fall back to `python3` so the failure surfaces as a
    // concrete spawn/import error naming the interpreter, not as a silent skip.
    brainLog("warn", "no Python >= 3.10 found among the known candidates; using python3");
  }
  _resolvedPython = found ?? "python3";
  return _resolvedPython;
}

/** The interpreter the bridge is using (for boot logs + diagnostics). */
export function resolvedPythonExe(): string {
  return pythonExe();
}

// Tail of the most recent child's stderr. A Python that dies at import (wrong
// interpreter version, missing module) says exactly why on stderr, but that
// text was previously dropped unless INTELLIGENCE_DEBUG=1 — the audit trail
// only ever showed "exited (code=1)". Keep the last ~1KB so it can be attached
// to the down reason + startup report.
let _lastStderr = "";
const STDERR_TAIL_CHARS = 1024;

function stderrTail(): string {
  const t = _lastStderr.trim().replace(/\s+/g, " ");
  return t ? ` — stderr: ${t.slice(-300)}` : "";
}

function markDown(reason: string): void {
  if (_status !== "down") brainLog("warn", `brain unavailable: ${reason}`);
  _status = "down";
  _downReason = reason;
  _downAt = Date.now();
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
  _downAt = 0;
  _restarts = 0;
  _restartWindowStart = 0;
  _consecutiveTimeouts = 0;
  _lastStderr = "";
  _resolvedPython = null;
  _resolvedPythonFor = undefined;
  _timeoutEnvWarned = false;
  _cache.clear();
}

/**
 * Test-only accessor for the live brain child process. Lets a resilience test
 * assert that the stdio pipes carry an 'error' listener (so an EPIPE/EIO from a
 * dying brain can never crash the worker) without exposing the process to
 * production callers.
 */
export function __getBrainProcForTest(): ChildProcessWithoutNullStreams | null {
  return _proc;
}

/** Ensure the long-lived brain process is running; returns it or null. */
function ensureProc(): ChildProcessWithoutNullStreams | null {
  if (_proc && _proc.exitCode === null && !_proc.killed) return _proc;

  // Hard boundary: only a permitted worker runtime may spawn Python.
  if (!workerExecutionAllowed()) {
    markDown(`brain not available in the ${workerExecutionOrigin()} runtime`);
    return null;
  }

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
    markDown(`too many brain restarts (${_restarts}/min) using ${pythonExe()}${stderrTail()}`);
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
    _lastStderr = "";
    child.stderr.on("data", (d) => {
      const text = String(d);
      brainLog("info", `stderr: ${text.slice(0, 200)}`);
      if (_proc === child || _proc === null) {
        _lastStderr = (_lastStderr + text).slice(-STDERR_TAIL_CHARS);
      }
    });

    const handleGone = (code: number | null, signal: string | null) => {
      if (_proc !== child) return; // a previous process exiting — ignore
      _proc = null;
      // A non-zero exit is a real failure (import error, crash): say why,
      // regardless of INTELLIGENCE_DEBUG, so the cause is never invisible.
      if (code !== null && code !== 0) {
        brainLog("warn", `brain process exited (code=${code} signal=${signal})${stderrTail()}`);
      }
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
      markDown(`spawn error: ${e.message} (${pythonExe()})`);
      handleGone(null, null);
    });
    // Swallow pipe errors on ALL THREE stdio streams. A Node stream that emits
    // 'error' with no listener THROWS, and in a bare worker process (no
    // uncaughtException net — instrumentation.ts is gated to the Next runtime)
    // that terminates the whole worker, "cleanly between passes," with no
    // catchable error and no restart. When the Python brain dies abruptly the
    // OS pipe backing stdout/stderr can emit EPIPE/EIO — previously only stdin
    // was guarded, so a stdout/stderr error killed the worker. `handleGone`
    // (child 'exit'/'error') already fails pending calls and clears `_proc` so
    // the next call respawns; these listeners just stop the dying pipe from
    // crashing the process.
    child.stdin.on("error", () => undefined);
    child.stdout.on("error", () => undefined);
    child.stderr.on("error", () => undefined);

    _proc = child;
    _restarts += 1;
    return child;
  } catch (e) {
    markDown(`failed to start brain: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export interface BrainStartup {
  /** True only when the brain answered a real request with a valid envelope. */
  online: boolean;
  /** The interpreter the bridge resolved (for the audit log). */
  python: string;
  /** Why it is not online (null when online). */
  reason: string | null;
  protocolVersion: number | null;
}

/**
 * Warm the brain up front (called by the worker on boot) and VERIFY it. The
 * old version returned true the instant `spawn()` succeeded — before an
 * ENOENT or an import-time TypeError could arrive — so the audit log said
 * "Python brain online" while the child was already dead. Now the process is
 * started and a cheap real op must round-trip within `timeoutMs`; anything
 * else reports offline with the concrete reason (interpreter, stderr tail).
 */
export async function ensureBrainStarted(timeoutMs = 5000): Promise<BrainStartup> {
  const python = pythonExe();
  if (!isBrainEnabled()) {
    return {
      online: false,
      python,
      reason: "brain disabled in this runtime",
      protocolVersion: null,
    };
  }
  if (!ensureProc()) {
    return {
      online: false,
      python,
      reason: _downReason ?? "brain process could not be started",
      protocolVersion: null,
    };
  }
  const env = await callBrain("iq_metrics", { stats: {} }, { timeoutMs, force: true });
  if (env && env.ok) {
    return { online: true, python, reason: null, protocolVersion: env.protocolVersion ?? null };
  }
  const reason =
    _downReason ??
    `${env ? `probe op returned error: ${env.error ?? "unknown"}` : `no envelope from probe within ${timeoutMs}ms`}${stderrTail()}`;
  return { online: false, python, reason, protocolVersion: env?.protocolVersion ?? null };
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
  if (_status === "down" && !opts.force) {
    // Latched down — but re-probe once the cooldown elapses so a transient
    // failure can't disable the brain (and thus publishing) forever.
    if (Date.now() - _downAt < downRetryCooldownMs()) return null;
    _status = "unknown";
    _restarts = 0; // give the restart budget a fresh window on recovery
  }

  if (opts.cacheKey) {
    const hit = cacheGet(opts.cacheKey);
    if (hit) return hit as BrainEnvelope<T>;
  }

  const proc = ensureProc();
  if (!proc) return null;

  const id = randomUUID();
  const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs();

  const raw = await new Promise<unknown | null>((resolve) => {
    const timer = setTimeout(() => {
      _pending.delete(id);
      brainLog("warn", `callBrain(${op}) timed out after ${timeoutMs}ms`);
      noteTimeout(proc, op, timeoutMs);
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
  _consecutiveTimeouts = 0;
  if (opts.cacheKey) cacheSet(opts.cacheKey, env, opts.cacheTtlMs ?? 60_000);
  return env as BrainEnvelope<T>;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * INTELLIGENCE_TIMEOUT_MS, parsed defensively: `Number("")` is 0 and
 * `Number("abc")` is NaN, either of which made EVERY call fail instantly (a
 * blank variable left in a hosting dashboard was enough to pin the worker in
 * degraded mode). Anything not a finite number >= 1000 falls back to the
 * default, with one warning.
 */
function defaultTimeoutMs(): number {
  const raw = (process.env.INTELLIGENCE_TIMEOUT_MS ?? "").trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1000) return n;
  if (!_timeoutEnvWarned) {
    _timeoutEnvWarned = true;
    brainLog(
      "warn",
      `ignoring INTELLIGENCE_TIMEOUT_MS=${JSON.stringify(raw)} (need a number >= 1000); using ${DEFAULT_TIMEOUT_MS}`,
    );
  }
  return DEFAULT_TIMEOUT_MS;
}

// A brain that is ALIVE but not answering used to stay hung for the life of
// the worker: a timeout only resolved null, never touched the process, so
// every later call timed out too (verified: 4 timeouts, same pid). Recycle
// the child after consecutive timeouts so the next call gets a fresh process;
// a hang-LOOP then trips the existing restart throttle → down → cooldown.
const TIMEOUTS_BEFORE_RECYCLE = 2;

function noteTimeout(proc: ChildProcessWithoutNullStreams, op: string, timeoutMs: number): void {
  if (_proc !== proc) return; // already replaced — nothing to recycle
  _consecutiveTimeouts += 1;
  if (_consecutiveTimeouts < TIMEOUTS_BEFORE_RECYCLE) return;
  _consecutiveTimeouts = 0;
  brainLog(
    "warn",
    `brain unresponsive: ${op} exceeded ${timeoutMs}ms twice in a row; recycling the process`,
  );
  _proc = null; // detach first so this child's late 'exit' is ignored
  failAllPending();
  try {
    proc.kill("SIGKILL");
  } catch {
    /* already gone */
  }
}

/**
 * Health probe: list the brain's ops + protocol version via a short one-shot
 * (`--list-ops`). Independent of the persistent process so it gives an
 * accurate capability list for the admin dashboard.
 */
export async function probeBrain(
  timeoutMs = 5000,
): Promise<{ protocolVersion: number; ops: string[] } | null> {
  if (!workerExecutionAllowed()) {
    markDown(`brain not available in the ${workerExecutionOrigin()} runtime`);
    return null;
  }
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
      // Guard the stdio pipes too (see ensureProc): an unhandled stream
      // 'error' on the probe child would otherwise crash the worker.
      child.stdout.on("error", () => undefined);
      child.stderr.on("error", () => undefined);
      if (child.stdin) child.stdin.on("error", () => undefined);
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
    brainLog("warn", `probeBrain failed (${pythonExe()}): ${msg.slice(0, 300)}`);
    return null;
  }
}

// Best-effort cleanup so a persistent child never blocks process exit.
for (const sig of ["exit", "SIGINT", "SIGTERM"] as const) {
  process.once(sig, () => shutdownBrain());
}

/**
 * Worker crash-resilience primitives.
 *
 * These are extracted from `scripts/run-worker.ts` so the exact self-heal
 * behaviour that keeps the Admin Worker alive is unit-tested — it is the
 * mechanism that would have prevented the ~28h silent outage in the
 * 2026-07-12 audit (the worker process died "cleanly between passes" and never
 * restarted).
 *
 * Two layers, both effect-injected so they can be driven deterministically in
 * tests without real timers, a real Prisma client, or a real process:
 *
 *   1. installProcessSafetyNet — converts a process-level `uncaughtException`/
 *      `unhandledRejection` (e.g. an `'error'` event on the resident Python
 *      brain's stdio, or a stray fire-and-forget rejection) from a FATAL,
 *      SILENT exit into a loud, survivable event: log, audit, throttled email —
 *      then KEEP THE PROCESS ALIVE. Safe because every pass re-reads all state
 *      from Postgres and is independently isolated; there is no in-memory
 *      invariant a single stray throw can corrupt across passes.
 *
 *   2. runLoopSupervised — in continuous mode, RE-ENTERS the loop after a
 *      bounded backoff if the loop machinery itself throws, so the worker
 *      self-heals in-process rather than exiting the container (whose restart
 *      policy may back off or give up). One-shot / bounded runs (tests + manual
 *      triggers) run exactly once and propagate as before.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProcessSafetyEvent = "unhandledRejection" | "uncaughtException";

export interface SafetyNetOptions {
  workerId: string;
  /** Register a process-level handler (wraps `process.on` in production). */
  register: (event: ProcessSafetyEvent, handler: (arg: unknown) => void) => void;
  /** Best-effort audit write for every caught event. */
  onEvent: (kind: string, detail: string) => void | Promise<void>;
  /** Throttled developer alert (email) for caught events. */
  onAlert: (kind: string, detail: string) => void | Promise<void>;
  /** Console error sink (injected in tests). */
  errorLog?: (msg: string) => void;
  /** Clock (injected in tests to exercise the throttle deterministically). */
  now?: () => number;
  /** Minimum gap between alert emails. Default 15 minutes. */
  alertThrottleMs?: number;
}

/**
 * Install the process-level safety net. The worker is a bare `tsx` process, NOT
 * the Next runtime, so the handlers in `src/instrumentation.ts` (gated to
 * `NEXT_RUNTIME === "nodejs"`) never load here. Without our own net, ANY
 * process-level throw terminates the worker by Node's default with no catchable
 * error and no auto-restart — exactly how the service went dark for ~28h.
 */
export function installProcessSafetyNet(opts: SafetyNetOptions): void {
  // Logging is owned by the composition root (run-worker.ts, in scripts/);
  // default to a no-op so this module stays free of direct console use.
  const errorLog = opts.errorLog ?? (() => undefined);
  const now = opts.now ?? (() => Date.now());
  const throttleMs = opts.alertThrottleMs ?? 15 * 60 * 1000;
  let lastAlertMs = 0;

  const handle = (kind: string, err: unknown) => {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    errorLog(`[admin-worker:${opts.workerId}] ${kind} — kept alive:\n${detail}`);
    void Promise.resolve(opts.onEvent(kind, detail)).catch(() => undefined);
    const t = now();
    if (t - lastAlertMs > throttleMs) {
      lastAlertMs = t;
      void Promise.resolve(opts.onAlert(kind, detail)).catch(() => undefined);
    }
  };

  opts.register("unhandledRejection", (reason) => handle("unhandled_rejection", reason));
  opts.register("uncaughtException", (err) => handle("uncaught_exception", err));
}

export interface SupervisedLoopOptions {
  workerId: string;
  oneShot: boolean;
  maxPasses: number;
  /** Run one full loop (bounded or continuous). Injected so tests need no DB.
   * A result carrying `stopReason` (switch OFF / lease lost) is an INTENDED
   * stop — the supervisor returns instead of restarting. */
  runLoop: () => Promise<unknown>;
  /** Stop signal (SIGINT/SIGTERM latch). */
  isShuttingDown: () => boolean;
  /** Best-effort audit write when the loop throws and is restarted. */
  onLoopRestart?: (detail: string) => void | Promise<void>;
  /** Sleep impl (injected in tests to avoid real backoff waits). */
  sleepImpl?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
  errorLog?: (msg: string) => void;
  /** Backoff cap. Default 60s. */
  backoffCapMs?: number;
  /**
   * Safety valve so a test (or a pathologically hard-failing loop) can't spin
   * forever. Default Infinity — production relies on the shutdown latch.
   */
  maxRestarts?: number;
}

/**
 * Supervise the main loop. One-shot / bounded (`--max-jobs`) runs execute
 * exactly once and propagate errors. Continuous mode re-enters the loop after a
 * bounded exponential backoff whenever the loop machinery throws or returns
 * unexpectedly, until a shutdown is signalled.
 */
export interface SupervisedLoopResult {
  /** Why the loop stopped on purpose (`null` for a shutdown signal / bounded run). */
  stopReason: string | null;
}

/** Extract an intended-stop reason from a loop result, if it carries one. */
export function loopStopReason(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const reason = (result as { stopReason?: unknown }).stopReason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

export async function runLoopSupervised(
  opts: SupervisedLoopOptions,
): Promise<SupervisedLoopResult> {
  // Logging is owned by the composition root (run-worker.ts, in scripts/);
  // default to no-ops so this module stays free of direct console use.
  const log = opts.log ?? (() => undefined);
  const errorLog = opts.errorLog ?? (() => undefined);
  const sleepImpl = opts.sleepImpl ?? sleep;
  const backoffCapMs = opts.backoffCapMs ?? 60_000;
  const maxRestarts = opts.maxRestarts ?? Infinity;

  if (opts.oneShot || Number.isFinite(opts.maxPasses)) {
    const result = await opts.runLoop();
    log(`[admin-worker:${opts.workerId}] result: ${safeStringify(result)}`);
    return { stopReason: loopStopReason(result) };
  }

  let restarts = 0;
  while (!opts.isShuttingDown() && restarts <= maxRestarts) {
    try {
      const result = await opts.runLoop();
      // "Switch OFF" / "lease lost" are DEFINITIVE answers from Postgres, not
      // crashes. Restarting here (as before) kept the process — and its resident
      // Python brain — alive forever, re-checking the switch and writing an
      // audit row every <=60s: OFF did not mean OFF. Return so the caller can
      // release the lease, stop the brain and exit; the host only relaunches
      // when the switch is ON again.
      const stopReason = loopStopReason(result);
      if (stopReason) {
        log(
          `[admin-worker:${opts.workerId}] loop stopped on purpose (${stopReason}); not restarting.`,
        );
        return { stopReason };
      }
      // A continuous loop returning at all is unexpected (it should run until
      // signalled); treat it as something to recover from, not a clean stop.
      if (opts.isShuttingDown()) break;
      errorLog(`[admin-worker:${opts.workerId}] loop returned unexpectedly; restarting.`);
    } catch (err) {
      const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
      errorLog(`[admin-worker:${opts.workerId}] loop threw; restarting:\n${detail}`);
      await Promise.resolve(opts.onLoopRestart?.(detail)).catch(() => undefined);
    }
    if (opts.isShuttingDown()) break;
    restarts += 1;
    // Bounded exponential backoff so a hard-failing loop can't hot-spin the
    // CPU/DB, capped so recovery stays timely.
    await sleepImpl(Math.min(backoffCapMs, 2_000 * restarts));
  }
  return { stopReason: null };
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

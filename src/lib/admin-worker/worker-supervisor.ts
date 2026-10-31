/**
 * Worker crash-resilience primitives.
 *
 * These are extracted from `scripts/run-worker.ts` so the exact self-heal
 * behaviour that keeps the Admin Worker alive is unit-tested — it is the
 * mechanism that would have prevented the ~28h silent outage in the
 * 2026-07-12 audit (the worker process died "cleanly between passes" and never
 * restarted).
 *
 * Three layers, all effect-injected so they can be driven deterministically in
 * tests without real timers, a real Prisma client, or a real process:
 *
 *   1. installProcessSafetyNet — converts a process-level `uncaughtException`/
 *      `unhandledRejection` (e.g. an `'error'` event on the resident Python
 *      brain's stdio, or a stray fire-and-forget rejection) from a FATAL,
 *      SILENT exit into a loud, survivable event: log, audit (deduplicated),
 *      throttled email — then KEEP THE PROCESS ALIVE. Safe because every pass
 *      re-reads all state from Postgres and is independently isolated; there is
 *      no in-memory invariant a single stray throw can corrupt across passes.
 *      The one error it never keeps alive on is a broken log pipe: that means
 *      the host is gone, and logging it is what used to loop.
 *
 *   2. runLoopSupervised — in continuous mode, RE-ENTERS the loop after a
 *      bounded backoff if the loop machinery itself throws, so the worker
 *      self-heals in-process rather than exiting the container (whose restart
 *      policy may back off or give up). One-shot / bounded runs (tests + manual
 *      triggers) run exactly once and propagate as before.
 *
 *   3. watchSupervisingHost — the child's parent watchdog: when the local host
 *      that supervises it is gone, the worker stops instead of running on as
 *      an orphan nobody can switch off.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProcessSafetyEvent = "unhandledRejection" | "uncaughtException";

/** How many identical events were folded into one audited event. */
export interface SafetyEventRepeats {
  /** Identical events (same signature) inside the dedupe window that were not re-logged. */
  repeats: number;
  /** Events of any signature dropped by the per-window cap since the last logged one. */
  overCap: number;
}

export interface SafetyNetOptions {
  workerId: string;
  /** Register a process-level handler (wraps `process.on` in production). */
  register: (event: ProcessSafetyEvent, handler: (arg: unknown) => void) => void;
  /** Best-effort audit write for every caught event that is not a repeat. */
  onEvent: (kind: string, detail: string, repeats: SafetyEventRepeats) => void | Promise<void>;
  /** Throttled developer alert (email) for caught events. */
  onAlert: (kind: string, detail: string) => void | Promise<void>;
  /** Console error sink (injected in tests). */
  errorLog?: (msg: string) => void;
  /** Clock (injected in tests to exercise the throttle deterministically). */
  now?: () => number;
  /** Minimum gap between alert emails. Default 15 minutes. */
  alertThrottleMs?: number;
  /**
   * True when the error means the worker's own log pipe is gone (EPIPE /
   * ERR_STREAM_DESTROYED on stdout/stderr). Such an error is never logged:
   * logging it writes to the same dead pipe, which raises it again — the loop
   * that once spun a supervisor at 100% CPU for 8 days.
   */
  isBrokenPipe?: (err: unknown) => boolean;
  /** Called once, instead of logging, the first time a broken log pipe reaches the net. */
  onBrokenPipe?: (kind: string) => void;
  /**
   * An event with the same signature (kind, error code, first message line)
   * inside this window is counted, not logged again. Default 60 s.
   */
  dedupeWindowMs?: number;
  /** At most this many events are logged per window across all signatures. Default 20. */
  maxEventsPerWindow?: number;
}

/**
 * What makes two process-level events "the same": the kind, the error code and
 * the first line of the message with every digit run collapsed, so a storm of
 * one failure that differs only in ports, pids or counters folds into one row.
 * Exported for the tests.
 */
export function errorSignature(kind: string, err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  const firstLine = (message.split("\n").find((line) => line.trim() !== "") ?? "").trim();
  return `${kind}|${typeof code === "string" ? code : ""}|${firstLine.replace(/\d+/g, "#").slice(0, 200)}`;
}

/**
 * Install the process-level safety net. The worker is a bare `tsx` process, NOT
 * the Next runtime, so the handlers in `src/instrumentation.ts` (gated to
 * `NEXT_RUNTIME === "nodejs"`) never load here. Without our own net, ANY
 * process-level throw terminates the worker by Node's default with no catchable
 * error and no auto-restart — exactly how the service went dark for ~28h.
 *
 * Every event is still audited, but not every OCCURRENCE: before this, each
 * one wrote an unsampled ERROR row, so a failure that repeats in a tight loop
 * (a reproduced closed-pipe storm made 213,085 handler calls in 3 s) became a
 * flood of identical production rows. Identical events inside the dedupe
 * window are counted and the count rides on the next row of that signature,
 * and a per-window cap bounds the total.
 */
export function installProcessSafetyNet(opts: SafetyNetOptions): void {
  // Logging is owned by the composition root (run-worker.ts, in scripts/);
  // default to a no-op so this module stays free of direct console use.
  const errorLog = opts.errorLog ?? (() => undefined);
  const now = opts.now ?? (() => Date.now());
  const throttleMs = opts.alertThrottleMs ?? 15 * 60 * 1000;
  const windowMs = opts.dedupeWindowMs ?? 60_000;
  const maxPerWindow = opts.maxEventsPerWindow ?? 20;
  let lastAlertMs = 0;
  let brokenPipeSeen = false;
  const lastLogged = new Map<string, { at: number; repeats: number }>();
  let windowStart = Number.NEGATIVE_INFINITY;
  let windowCount = 0;
  let overCap = 0;

  const handle = (kind: string, err: unknown) => {
    if (opts.isBrokenPipe?.(err)) {
      if (!brokenPipeSeen) {
        brokenPipeSeen = true;
        opts.onBrokenPipe?.(kind);
      }
      return;
    }
    const t = now();
    const signature = errorSignature(kind, err);
    const previous = lastLogged.get(signature);
    if (previous && t - previous.at < windowMs) {
      previous.repeats += 1;
      return;
    }
    if (t - windowStart >= windowMs) {
      windowStart = t;
      windowCount = 0;
    }
    if (windowCount >= maxPerWindow) {
      overCap += 1;
      return;
    }
    windowCount += 1;
    const repeats = { repeats: previous?.repeats ?? 0, overCap };
    overCap = 0;
    lastLogged.set(signature, { at: t, repeats: 0 });
    if (lastLogged.size > 500) {
      for (const [key, entry] of lastLogged) {
        if (t - entry.at >= windowMs) lastLogged.delete(key);
      }
    }

    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    const folded =
      repeats.repeats + repeats.overCap > 0
        ? ` (${repeats.repeats} identical and ${repeats.overCap} other event(s) since the last logged one were not logged)`
        : "";
    errorLog(`[admin-worker:${opts.workerId}] ${kind} — kept alive${folded}:\n${detail}`);
    void Promise.resolve(opts.onEvent(kind, detail, repeats)).catch(() => undefined);
    if (t - lastAlertMs > throttleMs) {
      lastAlertMs = t;
      void Promise.resolve(opts.onAlert(kind, detail)).catch(() => undefined);
    }
  };

  opts.register("unhandledRejection", (reason) => handle("unhandled_rejection", reason));
  opts.register("uncaughtException", (err) => handle("uncaught_exception", err));
}

export interface SupervisingHostWatchOptions {
  /** The local host's pid, handed to the child as VIAFIDEI_HOST_PID. */
  hostPid: number;
  /** True while a process with this pid exists (`process.kill(pid, 0)` in production). */
  isAlive: (pid: number) => boolean;
  /** This process's current parent pid (`process.ppid` in production). */
  parentPid: () => number;
  /** Called once, with the reason, when the host is found gone. */
  onGone: (reason: string) => void;
  /** Check cadence. Default 5 s. */
  intervalMs?: number;
  /** Timer impl (injected in tests). Must return something `clearInterval` accepts. */
  setIntervalImpl?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
}

/**
 * The worker child's parent watchdog. The host spawns the worker detached, in
 * its own process group, through the tsx launcher — so when the host dies
 * (SIGKILL, native crash, the app's kill path) nothing tells the worker: its
 * own parent is the tsx wrapper, which outlives the host, and under the host
 * the worker neither renews nor checks the lease. An orphan kept working
 * (and, once a relaunched host's lease landed, double-executing) until its
 * first log write failed — or forever if it stayed quiet. This polls for the
 * host pid itself and for adoption by launchd (ppid 1), and reports the first
 * miss. Returns a function that stops the watch.
 */
export function watchSupervisingHost(opts: SupervisingHostWatchOptions): () => void {
  const every = opts.setIntervalImpl ?? ((fn, ms) => setInterval(fn, ms));
  let reported = false;
  const timer = every(() => {
    if (reported) return;
    let reason: string | null = null;
    if (!opts.isAlive(opts.hostPid)) {
      reason = `the supervising host (pid ${opts.hostPid}) is gone`;
    } else if (opts.parentPid() === 1) {
      reason = "adopted by launchd (parent pid 1): the supervising host is gone";
    }
    if (reason) {
      reported = true;
      clearInterval(timer);
      opts.onGone(reason);
    }
  }, opts.intervalMs ?? 5_000);
  (timer as { unref?: () => void }).unref?.();
  return () => clearInterval(timer);
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

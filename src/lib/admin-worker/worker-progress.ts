/**
 * Progress beacons from the worker child to the local host, and the host's
 * rule for "this worker is hung".
 *
 * Liveness used to be timer-based only: the host writes the heartbeat on its
 * 7 s tick whenever a child process EXISTS, and the loop writes one from a
 * 20 s interval. A pass stuck on a query over a half-open connection (the Mac
 * slept, Wi-Fi changed) or on a promise that never settles kept every liveness
 * signal green while nothing moved, and nothing ever recovered it — only the
 * dispatch and the lanes have watchdogs, and a watchdog cannot cancel a
 * promise anyway.
 *
 * So the worker reports PROGRESS at the boundaries a healthy loop always
 * crosses — pass start, dispatch done, each lane finished, pass complete — as
 * one tagged JSON line on stdout, which the host already reads. The host keeps
 * the time of the last one, and when none has arrived for the progress timeout
 * (default 25 min; passes normally take 2-10, and the longest lane watchdog is
 * 10) it stops the worker's process group and lets the restart path bring up a
 * fresh one. A process restart is the only real cancellation of a hung
 * promise, and the check is purely local, so it works with the database hung.
 *
 * Library code never writes to the console here: the composition root
 * (scripts/run-worker.ts) installs the sink, and without a host there is none.
 */

export const PROGRESS_LINE_TAG = "viafideiWorkerProgress";

export interface WorkerProgress {
  /** Which boundary was crossed, e.g. "pass_start", "lane_done". */
  phase: string;
  /** ISO time the worker crossed it. */
  at: string;
  /** Optional short context: a lane name, a stage. */
  detail?: string;
}

let sink: ((progress: WorkerProgress) => void) | null = null;

/** Route progress beacons (the worker child, under a host); null turns them off. */
export function setProgressSink(fn: ((progress: WorkerProgress) => void) | null): void {
  sink = fn;
}

/** Report that the loop crossed a boundary. Never throws; a no-op without a sink. */
export function reportProgress(phase: string, detail?: string): void {
  if (!sink) return;
  try {
    sink({
      phase,
      at: new Date().toISOString(),
      ...(detail ? { detail: detail.slice(0, 120) } : {}),
    });
  } catch {
    // progress is a liveness hint; it must never break the work it describes
  }
}

/** The one line the worker writes for a beacon. */
export function formatProgressLine(progress: WorkerProgress): string {
  return JSON.stringify({ [PROGRESS_LINE_TAG]: progress });
}

/** The beacon in a worker output line, or null for an ordinary log line. */
export function parseProgressLine(line: string): WorkerProgress | null {
  const text = line.trim();
  if (!text.startsWith(`{"${PROGRESS_LINE_TAG}":`)) return null;
  try {
    const value = (JSON.parse(text) as Record<string, unknown>)[PROGRESS_LINE_TAG];
    if (!value || typeof value !== "object") return null;
    const rec = value as Record<string, unknown>;
    if (typeof rec.phase !== "string" || typeof rec.at !== "string") return null;
    return {
      phase: rec.phase,
      at: rec.at,
      ...(typeof rec.detail === "string" ? { detail: rec.detail } : {}),
    };
  } catch {
    return null;
  }
}

/** Default: no progress for this long means the worker is hung. */
export const WORKER_PROGRESS_TIMEOUT_MS = 25 * 60_000;
/**
 * Never below this, whatever the environment says: the longest lane watchdog
 * is 10 minutes, and a timeout shorter than a legitimately slow lane would
 * restart healthy passes.
 */
export const WORKER_PROGRESS_TIMEOUT_FLOOR_MS = 12 * 60_000;

/** VIAFIDEI_WORKER_PROGRESS_TIMEOUT_MS, defaulted when unset or invalid, floored. */
export function progressTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = (env.VIAFIDEI_WORKER_PROGRESS_TIMEOUT_MS ?? "").trim();
  const n = raw === "" ? NaN : Number(raw);
  const chosen = Number.isFinite(n) && n > 0 ? n : WORKER_PROGRESS_TIMEOUT_MS;
  return Math.max(WORKER_PROGRESS_TIMEOUT_FLOOR_MS, Math.round(chosen));
}

/**
 * How long a running worker has gone without progress, once that exceeds the
 * timeout — or null while it is healthy (or not running at all).
 */
export function workerStalledForMs(input: {
  now: number;
  running: boolean;
  /** The last beacon, or the spawn time before the first one. */
  lastProgressAt: number | null;
  timeoutMs: number;
}): number | null {
  if (!input.running || input.lastProgressAt === null) return null;
  const silent = input.now - input.lastProgressAt;
  return silent > input.timeoutMs ? silent : null;
}

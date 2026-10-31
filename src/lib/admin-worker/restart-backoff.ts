/**
 * How the local host restarts a worker child that keeps exiting.
 *
 * It used to give up: the sixth consecutive crash — after 2, 4, 6, 8 and 10 s
 * of backoff, so about 30 s of trouble — set the runtime to "failed", and a
 * switch that was merely still ON never restarted a failed runtime. A fault
 * that outlived half a minute (a database blip after the Mac wakes, a Python
 * path change mid-install, a proxy hiccup) stopped all content work until an
 * operator noticed, while the phone and the site showed the switch ON.
 *
 * Now the host keeps retrying for as long as the durable switch is ON, with
 * capped exponential backoff (2 s doubling to 5 min by default), so a worker
 * that dies on every launch costs one attempt every few minutes rather than a
 * hot loop. Past the old give-up point the runtime reports itself DEGRADED
 * instead — loudly, on every surface — and an OFF issued during a backoff
 * cancels the pending restart.
 *
 * Pure; scripts/local-worker-host.ts applies it.
 */

/** First retry delay after a crash. */
export const RESTART_BACKOFF_BASE_MS = 2_000;
/** Longest wait between two attempts, however long the streak. */
export const RESTART_BACKOFF_MAX_MS = 5 * 60_000;
/** A worker that stays up this long has recovered: the streak starts over. */
export const RESTART_HEALTHY_UPTIME_MS = 2 * 60_000;
/**
 * After this many consecutive restarts the runtime is DEGRADED (where it used
 * to give up): it still retries, and says so on every surface.
 */
export const RESTART_DEGRADED_AFTER = 5;

export interface RestartBackoff {
  baseMs: number;
  maxMs: number;
  healthyUptimeMs: number;
}

/** A positive integer from the environment, or the fallback (unset, blank, 0, junk). */
function positiveMs(raw: string | undefined, fallback: number): number {
  const text = (raw ?? "").trim();
  if (text === "") return fallback;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

/**
 * The backoff in force, tunable with VIAFIDEI_WORKER_RESTART_BASE_MS,
 * VIAFIDEI_WORKER_RESTART_MAX_MS and VIAFIDEI_WORKER_HEALTHY_UPTIME_MS.
 */
export function restartBackoffFromEnv(env: NodeJS.ProcessEnv = process.env): RestartBackoff {
  const baseMs = positiveMs(env.VIAFIDEI_WORKER_RESTART_BASE_MS, RESTART_BACKOFF_BASE_MS);
  return {
    baseMs,
    maxMs: Math.max(baseMs, positiveMs(env.VIAFIDEI_WORKER_RESTART_MAX_MS, RESTART_BACKOFF_MAX_MS)),
    healthyUptimeMs: positiveMs(env.VIAFIDEI_WORKER_HEALTHY_UPTIME_MS, RESTART_HEALTHY_UPTIME_MS),
  };
}

/**
 * Delay before restart number `consecutive` (1 for the first restart of a
 * streak): base, 2×base, 4×base … capped at maxMs.
 */
export function restartDelayMs(consecutive: number, backoff: RestartBackoff): number {
  const n = Math.max(1, Math.floor(consecutive));
  // 2^30 already dwarfs any cap; the clamp keeps the arithmetic finite.
  const factor = 2 ** Math.min(n - 1, 30);
  return Math.min(backoff.maxMs, backoff.baseMs * factor);
}

/** Past the old give-up point: still retrying, and every surface should say so. */
export function restartDegraded(consecutive: number): boolean {
  return consecutive > RESTART_DEGRADED_AFTER;
}

/** "45s", "4 min" — for operator-facing lines. */
export function formatDelay(ms: number): string {
  if (ms < 90_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  return `${Math.round(ms / 60_000)} min`;
}

/** The sentence every surface shows while a degraded runtime keeps retrying. */
export function degradedReason(input: {
  consecutive: number;
  code: number | null;
  signal: string | null;
  nextDelayMs: number;
  logHint?: string | null;
}): string {
  return (
    `The local Admin Worker has exited ${input.consecutive} times in a row ` +
    `(last: code=${input.code ?? "null"}, signal=${input.signal ?? "none"}). ` +
    `It keeps retrying while the switch is ON — next attempt in ${formatDelay(input.nextDelayMs)}.` +
    (input.logHint ? ` The runtime log is at ${input.logHint}.` : "")
  );
}

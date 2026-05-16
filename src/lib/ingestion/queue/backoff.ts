/**
 * Exponential backoff schedule for ingestion job retries. Mirrors the
 * shape of the HTTP retry helper but is sized for source-level outages
 * (minutes to hours, not milliseconds) so a temporarily slow upstream
 * does not stall the queue and a permanently flaky source eventually
 * stops pounding itself.
 *
 * Defaults:
 *   - 30s base
 *   - cap at 6h so a permanently failing source still gets retried
 *     a few times per day
 *   - 25% jitter so multiple workers don't thunder back at once
 */

export const DEFAULT_BACKOFF_BASE_MS = 30 * 1000;
export const DEFAULT_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_BACKOFF_JITTER = 0.25;

export type BackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  jitter?: number;
};

/**
 * Compute the delay (in ms) before the next attempt. `attempt` is the
 * 0-indexed attempt that just failed — i.e. delay before attempt
 * `attempt + 1`. The result is bounded by [baseMs, maxMs] and includes
 * symmetric ±jitter (so two workers retrying the same source diverge).
 */
export function backoffDelayForAttempt(attempt: number, options: BackoffOptions = {}): number {
  const baseMs = options.baseMs ?? DEFAULT_BACKOFF_BASE_MS;
  const maxMs = options.maxMs ?? DEFAULT_BACKOFF_MAX_MS;
  const jitter = options.jitter ?? DEFAULT_BACKOFF_JITTER;
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt)));
  const spread = exp * jitter;
  const rnd = (Math.random() * 2 - 1) * spread;
  return Math.max(baseMs, Math.round(exp + rnd));
}

/** Compute the absolute `runAt` timestamp for the next retry. */
export function calculateRunAt(
  attempt: number,
  options: BackoffOptions = {},
  now = new Date(),
): Date {
  return new Date(now.getTime() + backoffDelayForAttempt(attempt, options));
}

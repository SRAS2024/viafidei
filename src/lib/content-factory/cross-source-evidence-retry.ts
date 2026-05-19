/**
 * Validation source retry with backoff (spec §17).
 *
 * Wraps the validation-source loader with exponential backoff so a
 * temporary outage on a validator does not turn into a
 * "validation_evidence_missing" rejection. Each attempt waits
 * (base * 2^attempt) ms — capped at maxDelayMs — before retrying.
 *
 * If every attempt fails, the wrapper returns a structured "failure"
 * record the caller can use to fail the package with a clear reason
 * (rather than leaving it stuck in a half-validated state).
 */

export type LoaderAttemptResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; attempts: number };

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Sleep function — overridable in tests so they don't actually wait. */
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "sleep">> & {
  sleep: NonNullable<RetryOptions["sleep"]>;
} = {
  maxAttempts: 4,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Run an async loader with exponential backoff retry. Each
 * attempt's delay is `min(maxDelayMs, baseDelayMs * 2^attempt)`.
 *
 * The loader is considered successful when it returns a non-null
 * value. A null return is treated the same as a thrown error so
 * tests can simulate "validator unavailable" cleanly.
 */
export async function withRetryBackoff<T>(
  loader: () => Promise<T | null>,
  options: RetryOptions = {},
): Promise<LoaderAttemptResult<T>> {
  const cfg = { ...DEFAULT_OPTIONS, ...options };
  let lastError = "loader never ran";
  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(cfg.maxDelayMs, cfg.baseDelayMs * Math.pow(2, attempt - 1));
      await cfg.sleep(delay);
    }
    try {
      const value = await loader();
      if (value !== null && value !== undefined) {
        return { ok: true, value };
      }
      lastError = "loader returned null";
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: lastError, attempts: cfg.maxAttempts };
}

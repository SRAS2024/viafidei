export type RetryPolicy = {
  attempts: number;
  /** Base backoff in ms (multiplied by 2^attemptIndex). */
  baseDelayMs: number;
  maxDelayMs: number;
  retryStatuses: number[];
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  retryStatuses: [408, 425, 429, 500, 502, 503, 504],
};

export function backoffDelay(attemptIndex: number, policy: RetryPolicy): number {
  const base = policy.baseDelayMs * Math.pow(2, attemptIndex);
  const jitter = Math.random() * (policy.baseDelayMs / 2);
  return Math.min(policy.maxDelayMs, Math.floor(base + jitter));
}

export function shouldRetry(status: number, policy: RetryPolicy): boolean {
  return policy.retryStatuses.includes(status);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

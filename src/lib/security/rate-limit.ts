type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RatePolicy = {
  windowMs: number;
  max: number;
};

export const RATE_POLICIES = {
  publicRead: { windowMs: 60_000, max: 120 },
  search: { windowMs: 60_000, max: 30 },
  login: { windowMs: 15 * 60_000, max: 5 },
  register: { windowMs: 60 * 60_000, max: 5 },
  passwordReset: { windowMs: 60 * 60_000, max: 3 },
  adminLogin: { windowMs: 15 * 60_000, max: 10 },
  userWrite: { windowMs: 60_000, max: 30 },
} as const;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(key: string, policy: RatePolicy): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
    return { ok: true, remaining: policy.max - 1, resetAt: now + policy.windowMs };
  }
  if (bucket.count >= policy.max) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { ok: true, remaining: policy.max - bucket.count, resetAt: bucket.resetAt };
}

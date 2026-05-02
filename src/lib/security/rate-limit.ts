import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

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
  emailVerification: { windowMs: 60 * 60_000, max: 5 },
  adminLogin: { windowMs: 15 * 60_000, max: 10 },
  userWrite: { windowMs: 60_000, max: 30 },
  savedItem: { windowMs: 60_000, max: 60 },
  goalWrite: { windowMs: 60_000, max: 60 },
  profileWrite: { windowMs: 60_000, max: 20 },
  mediaUpload: { windowMs: 60_000, max: 10 },
  adminWrite: { windowMs: 60_000, max: 60 },
  ingestionTrigger: { windowMs: 60 * 60_000, max: 12 },
} as const satisfies Record<string, RatePolicy>;

export type RatePolicyName = keyof typeof RATE_POLICIES;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimitContext = {
  ipAddress?: string | null;
  userId?: string | null;
};

function policyNameOf(policy: RatePolicy): string {
  for (const [name, def] of Object.entries(RATE_POLICIES)) {
    if (def === policy) return name;
  }
  return "custom";
}

// In-memory fallback used only when the database is unreachable so a transient
// DB blip does not take down user-facing routes. The persistent table remains
// the source of truth across restarts and instances.
type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

function memoryRateLimit(key: string, policy: RatePolicy): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + policy.windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: policy.max - 1, resetAt };
  }
  if (bucket.count >= policy.max) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { ok: true, remaining: policy.max - bucket.count, resetAt: bucket.resetAt };
}

// Probabilistic background pruning so the table self-cleans even if the cron
// pruner is delayed. ~0.5% of writes trigger a cheap delete.
const PRUNE_PROBABILITY = 0.005;

function maybePruneInBackground(now: Date): void {
  if (Math.random() >= PRUNE_PROBABILITY) return;
  void prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => {});
}

export async function rateLimit(
  key: string,
  policy: RatePolicy,
  context: RateLimitContext = {},
): Promise<RateLimitResult> {
  const now = new Date();
  const newResetAt = new Date(now.getTime() + policy.windowMs);
  const policyName = policyNameOf(policy);
  const ipAddress = context.ipAddress ?? null;
  const userId = context.userId ?? null;
  const id = crypto.randomUUID();

  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>(Prisma.sql`
      INSERT INTO "RateLimitBucket" (
        "id", "bucketKey", "policy", "count", "resetAt",
        "ipAddress", "userId", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${key}, ${policyName}, 1, ${newResetAt},
        ${ipAddress}, ${userId}, ${now}, ${now}
      )
      ON CONFLICT ("bucketKey") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" < ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" < ${now} THEN ${newResetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "policy" = ${policyName},
        "ipAddress" = COALESCE(${ipAddress}, "RateLimitBucket"."ipAddress"),
        "userId" = COALESCE(${userId}, "RateLimitBucket"."userId"),
        "updatedAt" = ${now}
      RETURNING "count", "resetAt"
    `);

    const row = rows[0];
    if (!row) {
      return memoryRateLimit(key, policy);
    }

    maybePruneInBackground(now);

    if (row.count > policy.max) {
      return { ok: false, remaining: 0, resetAt: row.resetAt.getTime() };
    }
    return {
      ok: true,
      remaining: Math.max(0, policy.max - row.count),
      resetAt: row.resetAt.getTime(),
    };
  } catch {
    return memoryRateLimit(key, policy);
  }
}

export async function pruneExpiredRateLimits(now: Date = new Date()): Promise<number> {
  try {
    const result = await prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: now } },
    });
    return result.count;
  } catch {
    return 0;
  }
}

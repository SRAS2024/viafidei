/**
 * Per-method strategy memory + adaptive selection (adaptive-worker Phase C/D).
 *
 * The worker already has strong PER-SOURCE adaptivity (reputation + host memory)
 * and two fixed fallback chains (fetch: static → dynamic → archive; extraction:
 * deterministic → AI). What it lacked was memory of which concrete METHOD works
 * — so it could never learn "for content-type X, discovery method M works best"
 * and switch strategy accordingly.
 *
 * This module records per-(dimension, method, contentType) outcomes to
 * AdminWorkerStrategyStat, ranks methods by a recency-weighted success rate
 * (EWMA), and chooses among candidate methods with an EXPLORE/EXPLOIT policy so
 * the worker mostly uses the current best method but occasionally trials an
 * alternative to keep learning (avoiding lock-in to a stale winner). The
 * innovation lab (innovation-lab.ts) consumes these stats to run bounded A/B
 * experiments and remember the winner.
 *
 *   dimension ∈ fetch | discovery | extraction | verification | quality | repair
 *               | publishing
 */

import type { PrismaClient } from "@prisma/client";

/** Content-type-agnostic aggregate sentinel (unique key stays non-null). */
export const ANY_CONTENT_TYPE = "*";

/** EWMA weight for the newest outcome (higher = more reactive). */
const EWMA_ALPHA = 0.25;

/** Default exploration probability (env-tunable). */
function defaultEpsilon(): number {
  const raw = Number((process.env.ADMIN_WORKER_STRATEGY_EPSILON ?? "").trim());
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.15;
}

export interface MethodOutcomeInput {
  dimension: string;
  method: string;
  contentType?: string | null;
  ok: boolean;
  reason?: string;
}

/**
 * Record one method outcome, updating attempts/successes/failures and the EWMA
 * success rate. Fail-open — a learning-signal write never breaks the caller.
 */
export async function recordMethodOutcome(
  prisma: PrismaClient,
  input: MethodOutcomeInput,
): Promise<void> {
  const contentType = input.contentType?.trim() || ANY_CONTENT_TYPE;
  const signal = input.ok ? 1 : 0;
  try {
    const existing = await prisma.adminWorkerStrategyStat.findUnique({
      where: {
        dimension_method_contentType: {
          dimension: input.dimension,
          method: input.method,
          contentType,
        },
      },
    });
    const priorEwma = existing?.ewma ?? 0.5;
    const ewma = existing ? priorEwma + EWMA_ALPHA * (signal - priorEwma) : signal;
    await prisma.adminWorkerStrategyStat.upsert({
      where: {
        dimension_method_contentType: {
          dimension: input.dimension,
          method: input.method,
          contentType,
        },
      },
      update: {
        attempts: { increment: 1 },
        successes: { increment: input.ok ? 1 : 0 },
        failures: { increment: input.ok ? 0 : 1 },
        ewma,
        lastOutcome: input.ok ? "success" : "failure",
        lastReason: input.reason ?? null,
        lastUsedAt: new Date(),
      },
      create: {
        dimension: input.dimension,
        method: input.method,
        contentType,
        attempts: 1,
        successes: input.ok ? 1 : 0,
        failures: input.ok ? 0 : 1,
        ewma,
        lastOutcome: input.ok ? "success" : "failure",
        lastReason: input.reason ?? null,
        lastUsedAt: new Date(),
      },
    });
  } catch {
    // learning signal only — never block the caller
  }
}

export interface RankedMethod {
  method: string;
  ewma: number;
  attempts: number;
  successes: number;
  contentType: string;
  /** True when this row is the content-type-agnostic fallback aggregate. */
  fromAggregate: boolean;
}

/**
 * Rank the recorded methods for a dimension, preferring content-type-specific
 * rows and falling back to the "*" aggregate for methods with no type-specific
 * data. Sorted by EWMA descending, then attempts descending (confidence tiebreak).
 */
export async function rankMethods(
  prisma: PrismaClient,
  opts: { dimension: string; contentType?: string | null },
): Promise<RankedMethod[]> {
  const contentType = opts.contentType?.trim() || ANY_CONTENT_TYPE;
  let rows: Array<{
    method: string;
    ewma: number;
    attempts: number;
    successes: number;
    contentType: string;
  }> = [];
  try {
    rows = await prisma.adminWorkerStrategyStat.findMany({
      where: { dimension: opts.dimension, contentType: { in: [contentType, ANY_CONTENT_TYPE] } },
      select: { method: true, ewma: true, attempts: true, successes: true, contentType: true },
    });
  } catch {
    return [];
  }
  // Prefer the content-type-specific row for a method; else the aggregate.
  const byMethod = new Map<string, RankedMethod>();
  for (const r of rows) {
    const specific = r.contentType === contentType && contentType !== ANY_CONTENT_TYPE;
    const existing = byMethod.get(r.method);
    if (!existing || (specific && !isSpecific(existing, contentType))) {
      byMethod.set(r.method, {
        method: r.method,
        ewma: r.ewma,
        attempts: r.attempts,
        successes: r.successes,
        contentType: r.contentType,
        fromAggregate: r.contentType === ANY_CONTENT_TYPE,
      });
    }
  }
  return [...byMethod.values()].sort((a, b) => b.ewma - a.ewma || b.attempts - a.attempts);
}

function isSpecific(r: RankedMethod, contentType: string): boolean {
  return r.contentType === contentType && contentType !== ANY_CONTENT_TYPE;
}

export interface MethodChoice {
  method: string;
  mode: "explore" | "exploit";
  reason: string;
}

/**
 * Choose one method from `candidates` using an ε-greedy explore/exploit policy:
 * with probability ε trial a non-best candidate (explore, to keep learning),
 * otherwise pick the best-ranked known method (exploit). Unseen candidates are
 * treated as optimistic (worth exploring). `rand` is injectable for tests.
 */
export async function chooseMethodWithExploration(
  prisma: PrismaClient,
  opts: {
    dimension: string;
    contentType?: string | null;
    candidates: string[];
    epsilon?: number;
    rand?: () => number;
  },
): Promise<MethodChoice> {
  const candidates = [...new Set(opts.candidates)].filter(Boolean);
  if (candidates.length === 0) {
    return { method: "", mode: "exploit", reason: "no candidates" };
  }
  if (candidates.length === 1) {
    return { method: candidates[0], mode: "exploit", reason: "only candidate" };
  }
  const epsilon = opts.epsilon ?? defaultEpsilon();
  const rand = opts.rand ?? Math.random;

  const ranked = await rankMethods(prisma, {
    dimension: opts.dimension,
    contentType: opts.contentType,
  });
  const rankByMethod = new Map(ranked.map((r) => [r.method, r]));

  // Unseen candidates are optimistic → always worth an exploration pass.
  const unseen = candidates.filter((c) => !rankByMethod.has(c));
  if (unseen.length > 0 && rand() < Math.max(epsilon, 0.5)) {
    const pick = unseen[Math.floor(rand() * unseen.length) % unseen.length];
    return { method: pick, mode: "explore", reason: "trialling an unseen method" };
  }

  // Best known candidate (exploit) vs a random other candidate (explore).
  const best = candidates
    .map((c) => ({ c, ewma: rankByMethod.get(c)?.ewma ?? 0.5 }))
    .sort((a, b) => b.ewma - a.ewma)[0].c;

  if (rand() < epsilon) {
    const others = candidates.filter((c) => c !== best);
    if (others.length > 0) {
      const pick = others[Math.floor(rand() * others.length) % others.length];
      return { method: pick, mode: "explore", reason: `ε-greedy explore (ε=${epsilon})` };
    }
  }
  return {
    method: best,
    mode: "exploit",
    reason: `best known method (ewma ${(rankByMethod.get(best)?.ewma ?? 0.5).toFixed(2)})`,
  };
}

/** Read-view: all strategy stats for a dimension (dashboard / diagnostics). */
export async function listStrategyStats(prisma: PrismaClient, dimension?: string) {
  return prisma.adminWorkerStrategyStat
    .findMany({
      where: dimension ? { dimension } : undefined,
      orderBy: [{ dimension: "asc" }, { ewma: "desc" }],
      take: 200,
    })
    .catch(() => []);
}

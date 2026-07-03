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
 * AdminWorkerStrategyStat and ranks methods by a recency-weighted success rate
 * (EWMA). It is an OBSERVABILITY + research signal: the innovation lab
 * (innovation-lab.ts) consumes these stats to run bounded, measure-only A/B
 * experiments and remember the more productive method, and the operational
 * summary + diagnostics surface the best method per dimension.
 *
 * Deliberately NOT used to disable a live method: for a coverage-maximising
 * worker, "a method surfaced nothing this pass" is the normal steady state of a
 * source that is caught up — not a failure — so acting on it would stop the
 * worker polling healthy sources. Genuinely-bad SOURCES are handled separately
 * by the reputation/host layer; the fetch/extraction fallback chains already
 * switch method on hard failure.
 *
 *   dimension ∈ fetch | discovery | extraction | verification | quality | repair
 *               | publishing
 */

import type { PrismaClient } from "@prisma/client";

/** Content-type-agnostic aggregate sentinel (unique key stays non-null). */
export const ANY_CONTENT_TYPE = "*";

/** EWMA weight for the newest outcome (higher = more reactive). */
const EWMA_ALPHA = 0.25;

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

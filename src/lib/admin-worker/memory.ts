/**
 * Admin Worker learning memory. A small, deterministic key/value store
 * the worker writes outcomes to. The learning loop reads from it to
 * adjust priorities, retry timing, and source selection — never to
 * invent content. Every row carries a confidence score derived from
 * success/failure counts.
 *
 * Hard rule (spec section 4): the learning system NEVER bypasses QA,
 * NEVER invents facts, and NEVER creates content without source
 * evidence. It only nudges the planner.
 */

import type { AdminWorkerMemoryType, Prisma, PrismaClient } from "@prisma/client";

export interface MemoryWriteInput {
  memoryType: AdminWorkerMemoryType;
  memoryKey: string;
  memoryValue: Prisma.InputJsonValue;
  outcome: "success" | "failure" | "neutral";
}

/**
 * Confidence formula: success_count / (success_count + failure_count),
 * with a Laplace smoothing of +1/+1 so a brand-new row starts at 0.5.
 * This is the only formula the learning loop uses for confidence — it
 * is deliberately simple so the operator can reason about it.
 */
export function computeConfidence(successCount: number, failureCount: number): number {
  const total = successCount + failureCount + 2;
  return (successCount + 1) / total;
}

export async function rememberOutcome(
  prisma: PrismaClient,
  input: MemoryWriteInput,
): Promise<void> {
  const existing = await prisma.adminWorkerMemory.findUnique({
    where: {
      memoryType_memoryKey: {
        memoryType: input.memoryType,
        memoryKey: input.memoryKey,
      },
    },
    select: { successCount: true, failureCount: true },
  });

  const successCount = (existing?.successCount ?? 0) + (input.outcome === "success" ? 1 : 0);
  const failureCount = (existing?.failureCount ?? 0) + (input.outcome === "failure" ? 1 : 0);
  const confidence = computeConfidence(successCount, failureCount);

  await prisma.adminWorkerMemory.upsert({
    where: {
      memoryType_memoryKey: {
        memoryType: input.memoryType,
        memoryKey: input.memoryKey,
      },
    },
    create: {
      memoryType: input.memoryType,
      memoryKey: input.memoryKey,
      memoryValue: input.memoryValue,
      successCount,
      failureCount,
      confidence,
      lastUsedAt: new Date(),
    },
    update: {
      memoryValue: input.memoryValue,
      successCount,
      failureCount,
      confidence,
      lastUsedAt: new Date(),
    },
  });
}

export async function recallMemory(
  prisma: PrismaClient,
  memoryType: AdminWorkerMemoryType,
  memoryKey: string,
) {
  return prisma.adminWorkerMemory.findUnique({
    where: { memoryType_memoryKey: { memoryType, memoryKey } },
  });
}

export async function listMemoryByType(
  prisma: PrismaClient,
  memoryType: AdminWorkerMemoryType,
  opts: { minConfidence?: number; limit?: number } = {},
) {
  return prisma.adminWorkerMemory.findMany({
    where: {
      memoryType,
      ...(opts.minConfidence != null ? { confidence: { gte: opts.minConfidence } } : {}),
    },
    orderBy: [{ confidence: "desc" }, { lastUsedAt: "desc" }],
    take: opts.limit ?? 50,
  });
}

// ── Active memory hooks (spec §15) ───────────────────────────────────
//
// Memory is consulted during planning, source ranking, classification,
// extraction, and validation. It NEVER invents facts and NEVER
// bypasses strict QA — it only nudges priorities.

export interface RankedHost {
  host: string;
  confidence: number;
  successCount: number;
  failureCount: number;
}

/**
 * Rank hosts by memory confidence. The brain + mission planner consult
 * this when several candidate sources are available for the same
 * content type — the highest-confidence host wins first.
 */
export async function rankHostsByMemory(
  prisma: PrismaClient,
  candidateHosts: ReadonlyArray<string>,
): Promise<RankedHost[]> {
  if (candidateHosts.length === 0) return [];
  const rows = await prisma.adminWorkerMemory.findMany({
    where: {
      memoryType: "SOURCE_PRIORITY",
      memoryKey: { in: [...candidateHosts] },
    },
  });
  const byHost = new Map(rows.map((row) => [row.memoryKey, row]));
  return candidateHosts
    .map((host) => {
      const row = byHost.get(host);
      return {
        host,
        confidence: row?.confidence ?? 0.5, // Laplace-smoothed default
        successCount: row?.successCount ?? 0,
        failureCount: row?.failureCount ?? 0,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Record the outcome of an extractor run so future passes can rank
 * the (host, contentType) pair.
 */
export async function recordExtractorOutcome(
  prisma: PrismaClient,
  input: {
    host: string;
    contentType: string;
    fatal: boolean;
    confidenceScore: number;
    missingFields: string[];
  },
): Promise<void> {
  await rememberOutcome(prisma, {
    memoryType: "BUILDER_PRIORITY",
    memoryKey: `${input.host}|${input.contentType}`,
    memoryValue: {
      lastConfidence: input.confidenceScore,
      lastMissingFields: input.missingFields,
    },
    outcome: input.fatal ? "failure" : input.confidenceScore >= 0.75 ? "success" : "neutral",
  });
}

/**
 * Pull the per-(host, contentType) extractor memory so the brain can
 * skip hosts that have repeatedly produced incomplete packages.
 */
export async function recallExtractorMemory(
  prisma: PrismaClient,
  host: string,
  contentType: string,
) {
  return recallMemory(prisma, "BUILDER_PRIORITY", `${host}|${contentType}`);
}

/**
 * Record a failure pattern (`FAILURE_PATTERN` memory type). Used by the
 * brain after a pass fails so the next pass can avoid the same input.
 */
export async function rememberFailurePattern(
  prisma: PrismaClient,
  input: { patternKey: string; details: Prisma.InputJsonValue },
): Promise<void> {
  await rememberOutcome(prisma, {
    memoryType: "FAILURE_PATTERN",
    memoryKey: input.patternKey,
    memoryValue: input.details,
    outcome: "failure",
  });
}

// ── Memory decay (spec §15) ──────────────────────────────────────────
//
// Old outcomes should matter less than recent ones. We apply a half-
// life decay: every `MEMORY_HALF_LIFE_DAYS` days that pass without
// `lastUsedAt` being updated halve the successCount and failureCount.
// The confidence rederives from the decayed counts so a stale row
// gradually drifts back to 0.5 (the Laplace-smoothed neutral).

const MEMORY_HALF_LIFE_DAYS = 30;

/**
 * Decay-adjusted confidence calculator. Returns the confidence we
 * would assign to this memory row right now given its lastUsedAt
 * age. Used by the brain at read time so we don't have to mutate
 * the DB on every read.
 */
export function decayedConfidence(opts: {
  successCount: number;
  failureCount: number;
  lastUsedAt: Date | null;
  now?: Date;
}): { confidence: number; effectiveSuccess: number; effectiveFailure: number; ageDays: number } {
  const now = (opts.now ?? new Date()).getTime();
  const last = (opts.lastUsedAt ?? new Date(now)).getTime();
  const ageDays = Math.max(0, (now - last) / (24 * 60 * 60 * 1000));
  const decay = Math.pow(0.5, ageDays / MEMORY_HALF_LIFE_DAYS);
  const effectiveSuccess = opts.successCount * decay;
  const effectiveFailure = opts.failureCount * decay;
  return {
    confidence: computeConfidence(effectiveSuccess, effectiveFailure),
    effectiveSuccess,
    effectiveFailure,
    ageDays,
  };
}

/**
 * Walk every memory row and persist the decayed counts. Run this
 * weekly so stale rows fade rather than persist forever. Spec §15:
 * "Add memory decay so old outcomes matter less than recent
 * outcomes."
 */
export async function decayMemory(
  prisma: PrismaClient,
  opts: { now?: Date } = {},
): Promise<{ decayed: number; pruned: number }> {
  const now = opts.now ?? new Date();
  const rows = await prisma.adminWorkerMemory.findMany({
    select: {
      id: true,
      successCount: true,
      failureCount: true,
      lastUsedAt: true,
      confidence: true,
    },
  });
  let decayed = 0;
  let pruned = 0;
  for (const row of rows) {
    const d = decayedConfidence({
      successCount: row.successCount,
      failureCount: row.failureCount,
      lastUsedAt: row.lastUsedAt,
      now,
    });
    // Prune rows that have completely decayed AND have no
    // significant signal — they would only add noise to future
    // confidence calculations.
    if (d.ageDays > 180 && d.effectiveSuccess + d.effectiveFailure < 0.25) {
      await prisma.adminWorkerMemory.delete({ where: { id: row.id } }).catch(() => undefined);
      pruned += 1;
      continue;
    }
    if (d.ageDays > 7) {
      await prisma.adminWorkerMemory
        .update({
          where: { id: row.id },
          data: {
            successCount: Math.round(d.effectiveSuccess),
            failureCount: Math.round(d.effectiveFailure),
            confidence: d.confidence,
          },
        })
        .catch(() => undefined);
      decayed += 1;
    }
  }
  return { decayed, pruned };
}

/**
 * Audit-view helper: list every memory row with its current decayed
 * confidence + age, sorted by most-recently-used. Used by the
 * admin "what the worker learned recently" panel.
 */
export async function listMemoryAudit(
  prisma: PrismaClient,
  opts: { limit?: number; memoryType?: AdminWorkerMemoryType } = {},
): Promise<
  Array<{
    id: string;
    memoryType: AdminWorkerMemoryType;
    memoryKey: string;
    storedConfidence: number;
    decayedConfidence: number;
    successCount: number;
    failureCount: number;
    ageDays: number;
    lastUsedAt: Date | null;
  }>
> {
  const rows = await prisma.adminWorkerMemory.findMany({
    where: opts.memoryType ? { memoryType: opts.memoryType } : undefined,
    orderBy: [{ lastUsedAt: "desc" }, { confidence: "desc" }],
    take: opts.limit ?? 50,
  });
  return rows.map((r) => {
    const d = decayedConfidence({
      successCount: r.successCount,
      failureCount: r.failureCount,
      lastUsedAt: r.lastUsedAt,
    });
    return {
      id: r.id,
      memoryType: r.memoryType,
      memoryKey: r.memoryKey,
      storedConfidence: r.confidence,
      decayedConfidence: d.confidence,
      successCount: r.successCount,
      failureCount: r.failureCount,
      ageDays: d.ageDays,
      lastUsedAt: r.lastUsedAt,
    };
  });
}

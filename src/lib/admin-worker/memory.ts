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

// ── Phase 10: active memory hooks (spec §15) ─────────────────────────
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

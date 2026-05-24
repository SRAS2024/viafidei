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

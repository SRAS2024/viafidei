/**
 * Batch-level progress tracking for large ingestion runs.
 *
 * Each batch corresponds to one "unit of pulling content from a
 * single source" — e.g. one page of parishes, one feed of saints,
 * one paginated API page. The row tracks per-batch counts so the
 * admin can answer "how much of the catalog actually came from this
 * source vs got rejected vs deduped?".
 */

import { prisma } from "../db/client";

export type BatchStatus = "in_progress" | "completed" | "failed" | "partial";

export type StartBatchInput = {
  sourceId?: string | null;
  adapterKey: string;
  contentType: string;
  batchKey: string;
  metadata?: Record<string, unknown>;
};

export type BatchCounters = {
  discovered: number;
  created: number;
  updated: number;
  skipped: number;
  rejected: number;
  archived: number;
  failed: number;
  deduped: number;
};

export async function startBatch(input: StartBatchInput): Promise<string> {
  const row = await prisma.ingestionBatch.create({
    data: {
      sourceId: input.sourceId ?? null,
      adapterKey: input.adapterKey,
      contentType: input.contentType,
      batchKey: input.batchKey,
      metadata: (input.metadata as never) ?? undefined,
    },
  });
  return row.id;
}

export async function recordBatchCounts(
  batchId: string,
  counts: Partial<BatchCounters>,
): Promise<void> {
  await prisma.ingestionBatch.update({
    where: { id: batchId },
    data: {
      discovered: { increment: counts.discovered ?? 0 },
      created: { increment: counts.created ?? 0 },
      updated: { increment: counts.updated ?? 0 },
      skipped: { increment: counts.skipped ?? 0 },
      rejected: { increment: counts.rejected ?? 0 },
      archived: { increment: counts.archived ?? 0 },
      failed: { increment: counts.failed ?? 0 },
      deduped: { increment: counts.deduped ?? 0 },
    },
  });
}

export async function finishBatch(batchId: string, status: BatchStatus): Promise<void> {
  await prisma.ingestionBatch.update({
    where: { id: batchId },
    data: {
      status,
      finishedAt: new Date(),
    },
  });
}

export async function listRecentBatches(
  contentType: string,
  take = 20,
): Promise<
  Array<{
    id: string;
    sourceId: string | null;
    adapterKey: string;
    contentType: string;
    batchKey: string;
    discovered: number;
    created: number;
    updated: number;
    skipped: number;
    rejected: number;
    archived: number;
    failed: number;
    deduped: number;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
  }>
> {
  return prisma.ingestionBatch.findMany({
    where: { contentType },
    orderBy: { startedAt: "desc" },
    take: Math.max(1, Math.min(take, 100)),
  });
}

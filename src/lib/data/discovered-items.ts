/**
 * Helper for the `DiscoveredSourceItem` table. Adapters write
 * discovered URLs / feed entries / API records here BEFORE the
 * processing step. Each row tracks its own status through the
 * pending → processing → ingested/skipped/rejected/duplicate/failed
 * lifecycle so ingestion is resumable at the individual item level.
 *
 * Decouples discovery (find what's out there) from processing
 * (turn it into a row).
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type DiscoveredItemStatus =
  | "pending"
  | "processing"
  | "ingested"
  | "skipped"
  | "rejected"
  | "duplicate"
  | "failed"
  | "archived";

export type RecordDiscoveryInput = {
  sourceId: string;
  adapterKey: string;
  contentType?: string | null;
  externalKey: string;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Idempotent insert — re-discovering the same `(sourceId, externalKey)`
 * pair updates `discoveredAt` instead of creating a duplicate row.
 */
export async function recordDiscoveredItem(input: RecordDiscoveryInput): Promise<string> {
  try {
    const row = await prisma.discoveredSourceItem.upsert({
      where: {
        sourceId_externalKey: {
          sourceId: input.sourceId,
          externalKey: input.externalKey,
        },
      },
      create: {
        sourceId: input.sourceId,
        adapterKey: input.adapterKey,
        contentType: input.contentType ?? null,
        externalKey: input.externalKey,
        sourceUrl: input.sourceUrl ?? null,
        metadata: (input.metadata as never) ?? undefined,
      },
      update: {
        discoveredAt: new Date(),
        sourceUrl: input.sourceUrl ?? undefined,
      },
    });
    return row.id;
  } catch (e) {
    logger.warn("discovered_item.record_failed", {
      sourceId: input.sourceId,
      externalKey: input.externalKey,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export async function markDiscoveredItemStatus(
  id: string,
  status: DiscoveredItemStatus,
  options: {
    contentRef?: string | null;
    failureReason?: string | null;
  } = {},
): Promise<void> {
  try {
    await prisma.discoveredSourceItem.update({
      where: { id },
      data: {
        status,
        processedAt: status !== "pending" && status !== "processing" ? new Date() : undefined,
        contentRef: options.contentRef ?? undefined,
        failureReason: options.failureReason ?? undefined,
        attempts: status === "failed" || status === "processing" ? { increment: 1 } : undefined,
      },
    });
  } catch (e) {
    logger.warn("discovered_item.mark_status_failed", {
      id,
      status,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Find the next batch of pending discovered items for an adapter to
 * process. Bounded `take`. Items currently in `processing` status
 * are excluded so two workers don't claim the same item.
 */
export async function leaseDiscoveredItems(
  sourceId: string,
  take = 50,
): Promise<
  Array<{
    id: string;
    externalKey: string;
    sourceUrl: string | null;
    contentType: string | null;
    attempts: number;
    maxAttempts: number;
    metadata: Record<string, unknown> | null;
  }>
> {
  const rows = await prisma.discoveredSourceItem.findMany({
    where: { sourceId, status: "pending" },
    orderBy: { discoveredAt: "asc" },
    take: Math.min(Math.max(take, 1), 500),
  });
  return rows.map((r) => ({
    id: r.id,
    externalKey: r.externalKey,
    sourceUrl: r.sourceUrl,
    contentType: r.contentType,
    attempts: r.attempts,
    maxAttempts: r.maxAttempts,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
  }));
}

/** Item-level retry: reset status to pending so the next lease picks it up. */
export async function retryDiscoveredItem(id: string): Promise<boolean> {
  const row = await prisma.discoveredSourceItem.findUnique({ where: { id } });
  if (!row) return false;
  if (row.attempts >= row.maxAttempts) return false;
  await prisma.discoveredSourceItem.update({
    where: { id },
    data: {
      status: "pending",
      failureReason: null,
    },
  });
  return true;
}

/** Coverage summary used by the source health dashboard. */
export async function getCoverageBySource(sourceId: string): Promise<{
  discovered: number;
  ingested: number;
  skipped: number;
  rejected: number;
  failed: number;
  duplicate: number;
  pending: number;
}> {
  const rows = await prisma.discoveredSourceItem.groupBy({
    by: ["status"],
    where: { sourceId },
    _count: { _all: true },
  });
  const out = {
    discovered: 0,
    ingested: 0,
    skipped: 0,
    rejected: 0,
    failed: 0,
    duplicate: 0,
    pending: 0,
  };
  for (const r of rows) {
    out.discovered += r._count._all;
    if (r.status in out) {
      (out as Record<string, number>)[r.status] = r._count._all;
    }
  }
  return out;
}

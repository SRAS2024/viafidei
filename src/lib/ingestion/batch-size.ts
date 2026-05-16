/**
 * Batch size enforcement for very large sources. When an
 * `IngestionJob.batchSizeLimit` is set, the runner truncates the
 * adapter's returned items to that cap so a single tick never
 * processes a huge batch. The remainder is left for the next tick —
 * cursors ensure the run picks up where it left off.
 */

import { prisma } from "../db/client";
import type { IngestedItem } from "./types";

const DEFAULT_HARD_LIMIT = 5_000;

export async function applyBatchSizeLimit(
  jobId: string | null,
  items: IngestedItem[],
): Promise<{ items: IngestedItem[]; truncated: boolean; cap: number }> {
  if (items.length === 0) return { items, truncated: false, cap: items.length };
  let cap = DEFAULT_HARD_LIMIT;
  if (jobId) {
    const job = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
      select: { batchSizeLimit: true },
    });
    if (job?.batchSizeLimit && job.batchSizeLimit > 0) {
      cap = job.batchSizeLimit;
    }
  }
  if (items.length <= cap) return { items, truncated: false, cap };
  return { items: items.slice(0, cap), truncated: true, cap };
}

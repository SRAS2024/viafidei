/**
 * Per-candidate extraction outcome writer (Section 9). The runner /
 * adapter pipeline calls these helpers once per candidate so the
 * extraction monitor can distinguish:
 *
 *   - discovered            — candidate found on a source page
 *   - extracted_complete    — every required field parsed
 *   - extracted_partial     — some fields parsed
 *   - failed_extraction     — could not produce a package at all
 *
 * Validation outcomes (failed_validation / deleted_wrong_content /
 * saved_valid_package) come from the strict pipeline + persisters
 * + RejectedContentLog. This module records the *extraction* leg.
 *
 * Writes go to DataManagementLog with `action = EXTRACT_*` so the
 * existing aggregators (extraction-monitor.ts, biweekly report) can
 * read both kinds of outcome without a schema migration.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import type { ExtractionFailureReason } from "./extraction-monitor";

export type ExtractionOutcomeWrite = {
  contentType: string;
  /** Adapter / source identifier — for the per-source rollup. */
  sourceHost?: string | null;
  workerJobId?: string | null;
  ingestionBatchId?: string | null;
  outcome: "discovered" | "extracted_complete" | "extracted_partial" | "failed_extraction";
  /** Required when outcome = failed_extraction. */
  failureReason?: ExtractionFailureReason;
  /** Optional candidate identifier — slug / URL / external key. */
  candidateRef?: string | null;
};

/**
 * Single-row write. Fire-and-forget by callers; failures are logged
 * but never raised.
 */
export async function recordExtractionOutcome(input: ExtractionOutcomeWrite): Promise<void> {
  try {
    await prisma.dataManagementLog.create({
      data: {
        action: actionFromOutcome(input.outcome),
        contentType: input.contentType,
        contentRef: input.candidateRef ?? null,
        reason: [
          input.outcome,
          input.failureReason,
          input.sourceHost ? `host=${input.sourceHost}` : null,
          input.workerJobId ? `worker=${input.workerJobId}` : null,
          input.ingestionBatchId ? `batch=${input.ingestionBatchId}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        triggeredBy: "automatic",
      },
    });
  } catch (err) {
    logger.warn("extraction.outcome_write_failed", {
      outcome: input.outcome,
      contentType: input.contentType,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

function actionFromOutcome(outcome: ExtractionOutcomeWrite["outcome"]): string {
  switch (outcome) {
    case "discovered":
      return "EXTRACT_DISCOVERED";
    case "extracted_complete":
      return "EXTRACT_COMPLETE";
    case "extracted_partial":
      return "EXTRACT_PARTIAL";
    case "failed_extraction":
      return "EXTRACT_FAILED";
  }
}

/**
 * Batched writer for runs that process many candidates.
 */
export async function recordExtractionOutcomeBatch(
  inputs: ReadonlyArray<ExtractionOutcomeWrite>,
): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await prisma.dataManagementLog.createMany({
      data: inputs.map((input) => ({
        action: actionFromOutcome(input.outcome),
        contentType: input.contentType,
        contentRef: input.candidateRef ?? null,
        reason: [
          input.outcome,
          input.failureReason,
          input.sourceHost ? `host=${input.sourceHost}` : null,
          input.workerJobId ? `worker=${input.workerJobId}` : null,
          input.ingestionBatchId ? `batch=${input.ingestionBatchId}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        triggeredBy: "automatic",
      })),
    });
  } catch (err) {
    logger.warn("extraction.outcome_batch_write_failed", {
      count: inputs.length,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Aggregate extraction outcomes over a window. Distinct from
 * `extraction-monitor.getExtractionStats` (which counts
 * RejectedContentLog rows). This counts the *extraction* leg only.
 */
export async function getExtractionLegStats(
  args: {
    windowDays?: number;
  } = {},
): Promise<{
  discovered: number;
  extractedComplete: number;
  extractedPartial: number;
  failedExtraction: number;
  byContentType: Record<string, Record<string, number>>;
}> {
  const windowDays = args.windowDays ?? 7;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  try {
    const rows = await prisma.dataManagementLog.groupBy({
      by: ["action", "contentType"],
      where: {
        action: {
          in: ["EXTRACT_DISCOVERED", "EXTRACT_COMPLETE", "EXTRACT_PARTIAL", "EXTRACT_FAILED"],
        },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    });
    let discovered = 0;
    let extractedComplete = 0;
    let extractedPartial = 0;
    let failedExtraction = 0;
    const byContentType: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const n = row._count?._all ?? 0;
      const ct = byContentType[row.contentType] ?? {};
      ct[row.action] = (ct[row.action] ?? 0) + n;
      byContentType[row.contentType] = ct;
      if (row.action === "EXTRACT_DISCOVERED") discovered += n;
      else if (row.action === "EXTRACT_COMPLETE") extractedComplete += n;
      else if (row.action === "EXTRACT_PARTIAL") extractedPartial += n;
      else if (row.action === "EXTRACT_FAILED") failedExtraction += n;
    }
    return { discovered, extractedComplete, extractedPartial, failedExtraction, byContentType };
  } catch (err) {
    logger.warn("extraction.leg_stats_failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return {
      discovered: 0,
      extractedComplete: 0,
      extractedPartial: 0,
      failedExtraction: 0,
      byContentType: {},
    };
  }
}

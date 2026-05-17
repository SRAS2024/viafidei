/**
 * RejectedContentLog writer + reader. Every reject or delete decision
 * made by the strict content QA pipeline writes one row here so the
 * operator has a forensic record per item.
 *
 * Each row carries enough provenance to prove WHY a row was removed
 * from the catalog:
 *
 *   - content type, slug, original title
 *   - source URL + source host
 *   - failed contract name + failed fields
 *   - rejection reason text
 *   - original checksum
 *   - worker job id + ingestion batch id (where the row came from)
 *   - triggered-by (automatic system run or admin)
 *   - deleted timestamp
 *   - package version
 *   - validation decision verbatim (`delete` / `reject` / ...)
 *   - failure category (`wrong_content`, `missing_required_field`,
 *     `source_purpose_mismatch`, ...)
 *   - cleanup mode (`public_only` | `all_catalog_rows`)
 *   - sweep reason (`scheduled`, `post_ingestion`, `manual`,
 *     `render_gate`, ...)
 *   - original status (PUBLISHED / REVIEW / DRAFT / ARCHIVED)
 */

import { prisma } from "../db/client";
import type { ContractDecision, ContentTypeKey } from "./types";

export type RejectedContentLogInput = {
  contentType: ContentTypeKey;
  slug?: string | null;
  originalTitle?: string | null;
  sourceUrl?: string | null;
  sourceHost?: string | null;
  rejectionReason: string;
  failedContractName?: string | null;
  failedFields?: ReadonlyArray<string>;
  originalChecksum?: string | null;
  /** Subset of decisions that produce a log row. */
  decision: Extract<ContractDecision, "reject" | "delete" | "archive">;
  triggeredBy?: "automatic" | "manual";
  actorUsername?: string | null;
  /** IngestionJobQueue row id that produced this candidate, if known. */
  workerJobId?: string | null;
  /** IngestionBatch id this candidate was part of, if known. */
  ingestionBatchId?: string | null;
  /** Contract version that ran (e.g. "1.1.0"). */
  packageVersion?: string | null;
  /** Final validation decision verbatim. */
  validationDecision?: string | null;
  /** Dashboard bucket the failure falls into. */
  failureCategory?: string | null;
  /** Cleanup mode that produced the deletion. */
  cleanupMode?: string | null;
  /** Short description of what kind of sweep triggered the deletion. */
  sweepReason?: string | null;
  /** Status the row carried before deletion. */
  originalStatus?: string | null;
};

function toCreateData(input: RejectedContentLogInput): Record<string, unknown> {
  return {
    contentType: input.contentType,
    slug: input.slug ?? null,
    originalTitle: input.originalTitle ?? null,
    sourceUrl: input.sourceUrl ?? null,
    sourceHost: input.sourceHost ?? null,
    rejectionReason: input.rejectionReason.slice(0, 1000),
    failedContractName: input.failedContractName ?? null,
    failedFields: input.failedFields ? [...input.failedFields] : [],
    originalChecksum: input.originalChecksum ?? null,
    decision: input.decision,
    triggeredBy: input.triggeredBy ?? "automatic",
    actorUsername: input.actorUsername ?? null,
    workerJobId: input.workerJobId ?? null,
    ingestionBatchId: input.ingestionBatchId ?? null,
    packageVersion: input.packageVersion ?? null,
    validationDecision: input.validationDecision ?? null,
    failureCategory: input.failureCategory ?? null,
    cleanupMode: input.cleanupMode ?? null,
    sweepReason: input.sweepReason ?? null,
    originalStatus: input.originalStatus ?? null,
  };
}

export async function recordRejectedContent(input: RejectedContentLogInput): Promise<void> {
  await prisma.rejectedContentLog.create({
    data: toCreateData(input) as never,
  });
}

/**
 * Batched writer — used by the runner and the cleanup job, both of
 * which can produce many log entries in one pass.
 */
export async function recordRejectedContentBatch(
  inputs: ReadonlyArray<RejectedContentLogInput>,
): Promise<void> {
  if (inputs.length === 0) return;
  await prisma.rejectedContentLog.createMany({
    data: inputs.map(toCreateData) as never,
  });
}

export type RejectedContentSummary = {
  total: number;
  byContentType: Record<string, number>;
  byDecision: Record<string, number>;
  byHost: Record<string, number>;
  byFailureCategory: Record<string, number>;
};

/**
 * Aggregate counts for the admin dashboard. `windowStart` and
 * `windowEnd` are optional; when omitted, counts are lifetime.
 */
export async function summarizeRejectedContent(
  windowStart?: Date,
  windowEnd?: Date,
): Promise<RejectedContentSummary> {
  const where =
    windowStart && windowEnd
      ? { deletedAt: { gte: windowStart, lt: windowEnd } }
      : windowStart
        ? { deletedAt: { gte: windowStart } }
        : {};
  const [total, byType, byDecision, byHostRows, byCategoryRows] = await Promise.all([
    prisma.rejectedContentLog.count({ where }),
    prisma.rejectedContentLog.groupBy({
      by: ["contentType"],
      where,
      _count: { _all: true },
    }),
    prisma.rejectedContentLog.groupBy({
      by: ["decision"],
      where,
      _count: { _all: true },
    }),
    prisma.rejectedContentLog.groupBy({
      by: ["sourceHost"],
      where,
      _count: { _all: true },
    }),
    prisma.rejectedContentLog
      .groupBy({
        by: ["failureCategory"],
        where,
        _count: { _all: true },
      })
      .catch(() => [] as Array<{ failureCategory: string | null; _count?: { _all: number } }>),
  ]);
  const byContentType: Record<string, number> = {};
  for (const row of byType) byContentType[row.contentType] = row._count?._all ?? 0;
  const byDecisionMap: Record<string, number> = {};
  for (const row of byDecision) byDecisionMap[row.decision] = row._count?._all ?? 0;
  const byHost: Record<string, number> = {};
  for (const row of byHostRows) {
    const key = row.sourceHost ?? "(unknown)";
    byHost[key] = row._count?._all ?? 0;
  }
  const byFailureCategory: Record<string, number> = {};
  for (const row of byCategoryRows) {
    const key = row.failureCategory ?? "(unknown)";
    byFailureCategory[key] = row._count?._all ?? 0;
  }
  return { total, byContentType, byDecision: byDecisionMap, byHost, byFailureCategory };
}

/**
 * List recent rejected-content rows for the admin dashboard.
 */
export function listRecentRejectedContent(limit = 50) {
  return prisma.rejectedContentLog.findMany({
    orderBy: { deletedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
  });
}

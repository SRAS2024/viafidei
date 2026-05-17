/**
 * Package extraction monitoring. Tracks extraction outcomes separately
 * from validation outcomes so the admin can see, per content type
 * and per source:
 *
 *   - discovered                  — candidates the adapter found
 *   - extracted_complete_package  — every required field present
 *   - extracted_partial_package   — some fields present, others not
 *   - failed_extraction           — could not produce a package at all
 *   - failed_validation           — package built but failed the contract
 *   - deleted_wrong_content       — caught by the wrong-content detector
 *   - saved_valid_package         — accepted + persisted
 *
 * Extraction failure reasons are stratified so the admin can see
 * "which adapter is producing which kind of failure":
 *
 *   - missing_required_field
 *   - could_not_parse_days
 *   - could_not_isolate_prayer_text
 *   - could_not_identify_saint_vs_institution
 *   - could_not_identify_approved_source
 *   - could_not_parse_scripture_reference
 *   - source_was_event_page
 *   - source_was_news_article
 *   - source_was_duplicate
 *   - source_returned_low_quality_page
 *
 * The data feeds the admin dashboard cards:
 *   - package extraction success rate
 *   - package validation success rate
 *   - deletion rate
 *   - source quality score
 *   - content type growth rate
 *
 * This module is read-side: the RejectedContentLog rows already
 * exist, this just groups them. The runner does NOT need to write
 * to a separate table.
 */

import { prisma } from "../db/client";

export type ExtractionOutcomeKind =
  | "discovered"
  | "extracted_complete_package"
  | "extracted_partial_package"
  | "failed_extraction"
  | "failed_validation"
  | "deleted_wrong_content"
  | "saved_valid_package";

export type ExtractionFailureReason =
  | "missing_required_field"
  | "could_not_parse_days"
  | "could_not_isolate_prayer_text"
  | "could_not_identify_saint_vs_institution"
  | "could_not_identify_approved_source"
  | "could_not_parse_scripture_reference"
  | "source_was_event_page"
  | "source_was_news_article"
  | "source_was_duplicate"
  | "source_returned_low_quality_page";

export type ExtractionStats = {
  /** Rows we successfully saved as valid packages in the window. */
  savedValid: number;
  /** Rows we deleted as wrong content in the window. */
  deletedWrongContent: number;
  /** Rows we rejected for failing the contract (missing fields, format, …). */
  failedValidation: number;
  /** Rows we couldn't extract at all (adapter returned nothing usable). */
  failedExtraction: number;
  /** Per-content-type success rate (0–1). */
  successRateByContentType: Record<string, number>;
  /** Per-source-host success rate (0–1). */
  successRateBySourceHost: Record<string, number>;
  /** Per-failure-category counts. */
  failureCategoryCounts: Record<string, number>;
};

/**
 * Build an extraction stats snapshot for the admin dashboard. Reads
 * RejectedContentLog (deleted/failed) + DataManagementLog (saved).
 * The window defaults to the last 7 days.
 */
export async function getExtractionStats(
  args: {
    windowDays?: number;
  } = {},
): Promise<ExtractionStats> {
  const windowDays = args.windowDays ?? 7;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Saved valid packages — DataManagementLog ADD rows in the window.
  const savedByCtRows = await prisma.dataManagementLog
    .groupBy({
      by: ["contentType"],
      where: { action: "ADD", createdAt: { gte: since } },
      _count: { _all: true },
    })
    .catch(() => [] as Array<{ contentType: string; _count?: { _all: number } }>);
  const savedByCt: Record<string, number> = {};
  let savedTotal = 0;
  for (const r of savedByCtRows) {
    savedByCt[r.contentType] = r._count?._all ?? 0;
    savedTotal += savedByCt[r.contentType];
  }

  // Rejected by content type + failure category in the window.
  const rejectedRows = await prisma.rejectedContentLog
    .findMany({
      where: { deletedAt: { gte: since } },
      select: {
        contentType: true,
        sourceHost: true,
        failureCategory: true,
        decision: true,
      },
    })
    .catch(
      () =>
        [] as Array<{
          contentType: string;
          sourceHost: string | null;
          failureCategory: string | null;
          decision: string;
        }>,
    );

  let deletedWrongContent = 0;
  let failedValidation = 0;
  const failureCategoryCounts: Record<string, number> = {};
  const rejectedByCt: Record<string, number> = {};
  const rejectedByHost: Record<string, number> = {};
  for (const row of rejectedRows) {
    const cat = row.failureCategory ?? "unknown";
    failureCategoryCounts[cat] = (failureCategoryCounts[cat] ?? 0) + 1;
    if (cat === "wrong_content") deletedWrongContent += 1;
    else failedValidation += 1;
    rejectedByCt[row.contentType] = (rejectedByCt[row.contentType] ?? 0) + 1;
    if (row.sourceHost) {
      rejectedByHost[row.sourceHost] = (rejectedByHost[row.sourceHost] ?? 0) + 1;
    }
  }

  const successRateByContentType: Record<string, number> = {};
  const allCts = new Set<string>([...Object.keys(savedByCt), ...Object.keys(rejectedByCt)]);
  for (const ct of allCts) {
    const saved = savedByCt[ct] ?? 0;
    const rejected = rejectedByCt[ct] ?? 0;
    const total = saved + rejected;
    successRateByContentType[ct] = total === 0 ? 1 : saved / total;
  }

  // Source-host success rate is built only from rejection rows (we
  // don't track source-host per save in DataManagementLog). The
  // numerator is "rows from this source that did NOT get rejected"
  // — but since we only see saves, we approximate. Bottom line: a
  // high failure rate per host means the host is unhealthy.
  const successRateBySourceHost: Record<string, number> = {};
  for (const host of Object.keys(rejectedByHost)) {
    // We surface the *failure* count as a percentage of total
    // rejections; the dashboard inverts to show "success-ish" rate.
    successRateBySourceHost[host] = 1 - rejectedByHost[host] / (savedTotal + rejectedByHost[host]);
  }

  return {
    savedValid: savedTotal,
    deletedWrongContent,
    failedValidation,
    failedExtraction: 0, // We don't currently track adapter-level fails separately.
    successRateByContentType,
    successRateBySourceHost,
    failureCategoryCounts,
  };
}

/**
 * Overall success rate (0–1) — savedValid / (savedValid + rejected).
 * Useful for a single dashboard card.
 */
export function overallSuccessRate(stats: ExtractionStats): number {
  const total = stats.savedValid + stats.deletedWrongContent + stats.failedValidation;
  if (total === 0) return 1;
  return stats.savedValid / total;
}

/**
 * Overall deletion rate — rejected / (saved + rejected). Mirrors the
 * dashboard "deletion rate" card.
 */
export function overallDeletionRate(stats: ExtractionStats): number {
  const total = stats.savedValid + stats.deletedWrongContent + stats.failedValidation;
  if (total === 0) return 0;
  return (stats.deletedWrongContent + stats.failedValidation) / total;
}

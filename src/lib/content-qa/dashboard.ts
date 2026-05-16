/**
 * Content QA admin dashboard data. Powers the operator pages that show:
 *
 *   - Valid packages by content type.
 *   - Invalid deleted rows by content type.
 *   - Rejected rows by content type.
 *   - Rows removed from public view (publicRenderReady = false but
 *     status = PUBLISHED → the row exists but is hidden).
 *   - Rows failing source-purpose / render-readiness / wrong-content
 *     detection.
 *   - Threshold-eligible count.
 *   - Raw row count.
 *
 * Also exposes:
 *   - listDeletedInvalidContent(): rows from RejectedContentLog for
 *     the "Deleted Invalid Content Log" admin page.
 *   - getContentQAReportFragment(): per-content-type counts inserted
 *     into the biweekly admin report.
 */

import { prisma } from "../db/client";
import { getStrictThresholdDashboard } from "./thresholds";
import { listRecentRejectedContent, summarizeRejectedContent } from "./rejected-log";

export type ContentQADashboardRow = {
  contentType: string;
  rawRows: number;
  validPackages: number;
  publicPackages: number;
  thresholdEligible: number;
  reviewRows: number;
  rejectedPackages: number;
  deletedInvalidRows: number;
  removedFromPublicView: number;
  failingSourcePurpose: number;
  failingRenderReadiness: number;
  failingWrongContent: number;
  failingPackageCompleteness: number;
};

/**
 * Build the full Content QA dashboard. Counts every required metric
 * for every catalog content type so the admin can see at a glance
 * which buckets are healthy.
 */
export async function getContentQADashboard(): Promise<ContentQADashboardRow[]> {
  const base = await getStrictThresholdDashboard();
  const rows: ContentQADashboardRow[] = [];

  // Helper: count rows that are status=PUBLISHED but failed package
  // validation (publicRenderReady=false). These are rows that exist
  // in the table but should not appear to the public.
  const removedQuery = async (model: keyof typeof prisma): Promise<number> => {
    // Use a runtime-typed accessor so we don't need a giant switch.
    const accessor = prisma[model as keyof typeof prisma] as unknown as {
      count: (args: { where: Record<string, unknown> }) => Promise<number>;
    };
    if (!accessor || typeof accessor.count !== "function") return 0;
    try {
      return await accessor.count({
        where: { status: "PUBLISHED", publicRenderReady: false },
      });
    } catch {
      return 0;
    }
  };

  // Per-content-type failure tallies. The breakdowns come from the
  // RejectedContentLog rows (failedContractName + decision pairs).
  type FailureBuckets = {
    sourcePurpose: number;
    renderReadiness: number;
    wrongContent: number;
    packageCompleteness: number;
  };
  const failureByType = new Map<string, FailureBuckets>();
  try {
    const logs = await prisma.rejectedContentLog.findMany({
      select: { contentType: true, rejectionReason: true, failedContractName: true },
      take: 10_000,
    });
    for (const row of logs) {
      const key = row.contentType;
      const bucket =
        failureByType.get(key) ??
        ({
          sourcePurpose: 0,
          renderReadiness: 0,
          wrongContent: 0,
          packageCompleteness: 0,
        } as FailureBuckets);
      const reason = (row.rejectionReason ?? "").toLowerCase();
      if (reason.includes("not approved to ingest")) bucket.sourcePurpose += 1;
      else if (
        reason.includes("livestream") ||
        reason.includes("event") ||
        reason.includes("bulletin") ||
        reason.includes("news") ||
        reason.includes("watch live") ||
        reason.includes("press release")
      ) {
        bucket.wrongContent += 1;
      } else if (
        reason.includes("render-ready") ||
        reason.includes("missing required field") ||
        reason.includes("cannot render")
      ) {
        bucket.renderReadiness += 1;
      } else {
        bucket.packageCompleteness += 1;
      }
      failureByType.set(key, bucket);
    }
  } catch {
    // best-effort — no logs / DB error just yields empty buckets
  }

  // Map base rows → dashboard rows enriched with per-bucket failure
  // counts and "removed from public view" counts.
  for (const row of base) {
    const removed = await removedQuery(
      row.contentType === "Prayer"
        ? ("prayer" as const)
        : row.contentType === "Saint"
          ? ("saint" as const)
          : row.contentType === "MarianApparition"
            ? ("marianApparition" as const)
            : row.contentType === "Devotion"
              ? ("devotion" as const)
              : row.contentType === "SpiritualLifeGuide"
                ? ("spiritualLifeGuide" as const)
                : row.contentType === "LiturgyEntry"
                  ? ("liturgyEntry" as const)
                  : row.contentType === "Parish"
                    ? ("parish" as const)
                    : ("prayer" as const),
    );

    const buckets =
      failureByType.get(row.contentType) ??
      ({
        sourcePurpose: 0,
        renderReadiness: 0,
        wrongContent: 0,
        packageCompleteness: 0,
      } as FailureBuckets);

    rows.push({
      contentType: row.contentType,
      rawRows: row.rawRows,
      validPackages: row.validPackages,
      publicPackages: row.publicPackages,
      thresholdEligible: row.thresholdEligible,
      reviewRows: row.reviewRows,
      rejectedPackages: row.rejectedPackages,
      deletedInvalidRows: row.deletedInvalidRows,
      removedFromPublicView: removed,
      failingSourcePurpose: buckets.sourcePurpose,
      failingRenderReadiness: buckets.renderReadiness,
      failingWrongContent: buckets.wrongContent,
      failingPackageCompleteness: buckets.packageCompleteness,
    });
  }

  return rows;
}

/**
 * Deleted Invalid Content Log — surfaces RejectedContentLog rows for
 * the admin page. Returns title, content type attempted, source,
 * delete reason, failed fields, date.
 */
export function listDeletedInvalidContent(limit = 200) {
  return listRecentRejectedContent(limit);
}

/**
 * Content QA section for the biweekly admin report. Returns aggregate
 * counts for the report window so the email body can render:
 *
 *   - Content added (created in window).
 *   - Content edited (updated in window).
 *   - Content deleted (rejected/delete in window).
 *   - Content archived (status flipped to ARCHIVED in window).
 *   - Content rejected (reject decisions in window).
 *   - Invalid public rows deleted (delete decisions in window).
 *   - Threshold-eligible counts (current snapshot).
 *   - Content-type completeness percentages.
 */
export type ContentQAReportFragment = {
  added: Record<string, number>;
  edited: Record<string, number>;
  deleted: Record<string, number>;
  archived: Record<string, number>;
  rejected: Record<string, number>;
  invalidPublicRowsDeleted: Record<string, number>;
  thresholdEligible: Record<string, number>;
  completenessPercent: Record<string, number>;
};

const REPORTED_TYPES = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Devotion",
  "SpiritualLifeGuide",
  "LiturgyEntry",
  "Parish",
] as const;

export async function getContentQAReportFragment(
  windowStart: Date,
  windowEnd: Date,
): Promise<ContentQAReportFragment> {
  const baseDashboard = await getStrictThresholdDashboard();
  const inWindow = { gte: windowStart, lt: windowEnd };

  const [added, edited, deletedAction, rejectedAction, archivedAction] = await Promise.all([
    prisma.dataManagementLog.groupBy({
      by: ["contentType"],
      where: { action: "ADD", createdAt: inWindow },
      _count: { _all: true },
    }),
    prisma.dataManagementLog.groupBy({
      by: ["contentType"],
      where: { action: "UPDATE", createdAt: inWindow },
      _count: { _all: true },
    }),
    prisma.rejectedContentLog.groupBy({
      by: ["contentType"],
      where: { decision: "delete", deletedAt: inWindow },
      _count: { _all: true },
    }),
    prisma.rejectedContentLog.groupBy({
      by: ["contentType"],
      where: { decision: "reject", deletedAt: inWindow },
      _count: { _all: true },
    }),
    prisma.dataManagementLog.groupBy({
      by: ["contentType"],
      where: { action: "CLEANUP", createdAt: inWindow },
      _count: { _all: true },
    }),
  ]);

  const groupByCount = (
    rows: ReadonlyArray<{ contentType: string; _count?: { _all: number } | null }>,
  ): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const t of REPORTED_TYPES) out[t] = 0;
    for (const r of rows) out[r.contentType] = r._count?._all ?? 0;
    return out;
  };

  const thresholdEligible: Record<string, number> = {};
  const completenessPercent: Record<string, number> = {};
  for (const row of baseDashboard) {
    thresholdEligible[row.contentType] = row.thresholdEligible;
    const denom = row.rawRows || 1;
    completenessPercent[row.contentType] = Math.round((row.validPackages / denom) * 100);
  }

  return {
    added: groupByCount(added),
    edited: groupByCount(edited),
    deleted: groupByCount(deletedAction),
    archived: groupByCount(archivedAction),
    rejected: groupByCount(rejectedAction),
    invalidPublicRowsDeleted: groupByCount(deletedAction),
    thresholdEligible,
    completenessPercent,
  };
}

export { summarizeRejectedContent };

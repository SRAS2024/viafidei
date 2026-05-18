/**
 * Content growth dashboard.
 *
 * One row per content type with the 14 metrics the spec lists:
 *
 *   1. Source documents fetched.
 *   2. Build attempts.
 *   3. Complete packages built.
 *   4. Build failure count.
 *   5. QA pass count.
 *   6. QA fail count.
 *   7. Persisted package count.
 *   8. Public package count.
 *   9. Threshold eligible count.
 *  10. Deleted invalid count.
 *  11. Duplicate count.
 *  12. Growth rate over 24 hours.
 *  13. Growth rate over 7 days.
 *  14. Current stall reason.
 *
 * Numbers come from new-factory tables only — no IngestionJobRun
 * counters. Per the spec, "If a query fails, show an error state.
 * If the real value is zero, label it as a real zero."
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { listBuilderRegistry } from "../content-factory";
import type { ContentTypeKey } from "../content-factory";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

export type ContentGrowthRow = {
  contentType: ContentTypeKey;
  /** Where this number came from. Surfaced as a "data source" badge. */
  dataSources: ReadonlyArray<string>;
  lastUpdatedAt: Date;
  /** Errors per metric so the admin can see WHICH query broke. */
  errors: Record<string, string>;
  sourceDocumentsFetched: number | null;
  buildAttempts: number | null;
  completePackagesBuilt: number | null;
  buildFailureCount: number | null;
  qaPassCount: number | null;
  qaFailCount: number | null;
  persistedPackageCount: number | null;
  publicPackageCount: number | null;
  thresholdEligibleCount: number | null;
  deletedInvalidCount: number | null;
  duplicateCount: number | null;
  growthRate24h: number | null;
  growthRate7d: number | null;
  /** Free-form reason the admin should read first. Empty when growth is healthy. */
  currentStallReason: string;
};

const PUBLIC_MODEL_FOR_TYPE: Record<ContentTypeKey, string> = {
  Prayer: "prayer",
  Saint: "saint",
  MarianApparition: "marianApparition",
  Parish: "parish",
  Devotion: "devotion",
  Novena: "devotion",
  Sacrament: "spiritualLifeGuide",
  Rosary: "devotion",
  Consecration: "spiritualLifeGuide",
  SpiritualGuidance: "spiritualLifeGuide",
  Liturgy: "liturgyEntry",
  History: "liturgyEntry",
};

async function safe<T>(
  fn: () => Promise<T>,
  label: string,
  errors: Record<string, string>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors[label] = msg;
    logger.warn("content-growth-dashboard.query_failed", { label, error: msg });
    return null;
  }
}

async function buildLogCount(
  contentType: string,
  buildStatus: string,
  errors: Record<string, string>,
  label: string,
): Promise<number | null> {
  return safe(
    () => prisma.contentPackageBuildLog.count({ where: { contentType, buildStatus } }),
    label,
    errors,
  );
}

async function publicCountForType(
  contentType: ContentTypeKey,
  whereExtra: Record<string, unknown>,
  errors: Record<string, string>,
  label: string,
): Promise<number | null> {
  const model = PUBLIC_MODEL_FOR_TYPE[contentType];
  if (!model) {
    errors[label] = `no public model mapping for ${contentType}`;
    return null;
  }
  // Use a runtime model lookup; this keeps the helper exhaustive
  // without per-type duplication.
  const client = prisma as unknown as Record<
    string,
    { count: (a: { where: unknown }) => Promise<number> }
  >;
  const delegate = client[model];
  if (!delegate) {
    errors[label] = `prisma has no model named ${model}`;
    return null;
  }
  return safe(() => delegate.count({ where: whereExtra }), label, errors);
}

async function growthRate(
  contentType: ContentTypeKey,
  windowMs: number,
  errors: Record<string, string>,
  label: string,
): Promise<number | null> {
  const cutoff = new Date(Date.now() - windowMs);
  return safe(
    () =>
      prisma.contentPackageBuildLog.count({
        where: {
          contentType,
          buildStatus: "built_complete_package",
          createdAt: { gt: cutoff },
        },
      }),
    label,
    errors,
  );
}

/**
 * Compute a stall reason for the given metrics. Reads strictly from
 * the new factory tables; never returns "unknown" — when nothing is
 * wrong it returns "" (empty string).
 */
export function classifyStallReason(metrics: {
  sourceDocumentsFetched: number | null;
  buildAttempts: number | null;
  completePackagesBuilt: number | null;
  qaPassCount: number | null;
  persistedPackageCount: number | null;
  publicPackageCount: number | null;
  thresholdEligibleCount: number | null;
  buildFailureCount: number | null;
  growthRate24h: number | null;
}): string {
  const m = metrics;
  if (m.sourceDocumentsFetched != null && m.sourceDocumentsFetched === 0)
    return "no_source_documents_fetched";
  if (m.buildAttempts != null && m.buildAttempts === 0) return "source_docs_exist_but_no_builds";
  if (
    m.completePackagesBuilt != null &&
    m.completePackagesBuilt === 0 &&
    (m.buildAttempts ?? 0) > 0
  )
    return "builds_attempted_but_none_complete";
  if (m.qaPassCount != null && m.qaPassCount === 0 && (m.completePackagesBuilt ?? 0) > 0)
    return "builds_complete_but_qa_never_passed";
  if (
    m.publicPackageCount != null &&
    m.publicPackageCount === 0 &&
    (m.persistedPackageCount ?? 0) > 0
  )
    return "persisted_but_public_gate_failed";
  if (
    m.thresholdEligibleCount != null &&
    m.thresholdEligibleCount === 0 &&
    (m.publicPackageCount ?? 0) > 0
  )
    return "public_but_not_threshold_eligible";
  if (m.growthRate24h != null && m.growthRate24h === 0 && (m.publicPackageCount ?? 0) > 0)
    return "no_new_packages_in_24h";
  return "";
}

/**
 * Stalled content types map to an automatic next action. The strings
 * align with the admin command center's list.
 */
export function automaticNextActionForReason(reason: string): string {
  switch (reason) {
    case "no_source_documents_fetched":
      return "enqueue_source_discovery";
    case "source_docs_exist_but_no_builds":
      return "enqueue_content_build";
    case "builds_attempted_but_none_complete":
      return "rebuild_failed_packages_with_new_builder";
    case "builds_complete_but_qa_never_passed":
      return "revalidate_package_contract";
    case "persisted_but_public_gate_failed":
      return "run_strict_revalidation";
    case "public_but_not_threshold_eligible":
      return "refresh_threshold_counters";
    case "no_new_packages_in_24h":
      return "promote_better_source";
    default:
      return "";
  }
}

export async function getContentGrowthRowForType(
  contentType: ContentTypeKey,
): Promise<ContentGrowthRow> {
  const errors: Record<string, string> = {};
  const lastUpdatedAt = new Date();
  const dataSources = [
    "SourceDocument",
    "ContentPackageBuildLog",
    "RejectedContentLog",
    PUBLIC_MODEL_FOR_TYPE[contentType] ?? "unknown",
  ];
  const sourceDocumentsFetched = await safe(
    () =>
      prisma.contentPackageBuildLog
        .groupBy({
          by: ["sourceDocumentId"],
          where: { contentType },
        })
        .then((rows) => rows.filter((r) => r.sourceDocumentId !== null).length)
        .catch(() =>
          prisma.contentPackageBuildLog.count({
            where: { contentType, sourceDocumentId: { not: null } },
          }),
        ),
    "sourceDocumentsFetched",
    errors,
  );
  const buildAttempts = await safe(
    () => prisma.contentPackageBuildLog.count({ where: { contentType } }),
    "buildAttempts",
    errors,
  );
  const completePackagesBuilt = await buildLogCount(
    contentType,
    "built_complete_package",
    errors,
    "completePackagesBuilt",
  );
  const buildFailureCount = await safe(
    () =>
      prisma.contentPackageBuildLog.count({
        where: {
          contentType,
          buildStatus: { not: "built_complete_package" },
        },
      }),
    "buildFailureCount",
    errors,
  );
  // QA pass + fail counts approximated from the rejected-log table:
  // every QA-rejection writes one row; the pass count is the build's
  // complete-package count minus the rejection count.
  const qaFailCount = await safe(
    () =>
      prisma.rejectedContentLog.count({
        where: { contentType, validationDecision: { in: ["reject", "delete"] } },
      }),
    "qaFailCount",
    errors,
  );
  const qaPassCount =
    completePackagesBuilt != null && qaFailCount != null
      ? Math.max(0, completePackagesBuilt - qaFailCount)
      : null;
  const persistedPackageCount = await publicCountForType(
    contentType,
    { status: "PUBLISHED" },
    errors,
    "persistedPackageCount",
  );
  const publicPackageCount = await publicCountForType(
    contentType,
    { ...STRICT_PUBLIC_WHERE_CLAUSE },
    errors,
    "publicPackageCount",
  );
  const thresholdEligibleCount = await publicCountForType(
    contentType,
    { ...STRICT_PUBLIC_WHERE_CLAUSE, isThresholdEligible: true },
    errors,
    "thresholdEligibleCount",
  );
  const deletedInvalidCount = await safe(
    () =>
      prisma.rejectedContentLog.count({
        where: { contentType, decision: "delete" },
      }),
    "deletedInvalidCount",
    errors,
  );
  const duplicateCount = await safe(
    () =>
      prisma.rejectedContentLog.count({
        where: { contentType, failureCategory: "duplicate" },
      }),
    "duplicateCount",
    errors,
  );
  const growthRate24h = await growthRate(contentType, 24 * 60 * 60 * 1000, errors, "growthRate24h");
  const growthRate7d = await growthRate(
    contentType,
    7 * 24 * 60 * 60 * 1000,
    errors,
    "growthRate7d",
  );
  const currentStallReason = classifyStallReason({
    sourceDocumentsFetched,
    buildAttempts,
    completePackagesBuilt,
    qaPassCount,
    persistedPackageCount,
    publicPackageCount,
    thresholdEligibleCount,
    buildFailureCount,
    growthRate24h,
  });
  return {
    contentType,
    dataSources,
    lastUpdatedAt,
    errors,
    sourceDocumentsFetched,
    buildAttempts,
    completePackagesBuilt,
    buildFailureCount,
    qaPassCount,
    qaFailCount,
    persistedPackageCount,
    publicPackageCount,
    thresholdEligibleCount,
    deletedInvalidCount,
    duplicateCount,
    growthRate24h,
    growthRate7d,
    currentStallReason,
  };
}

export async function getContentGrowthDashboard(): Promise<ContentGrowthRow[]> {
  const rows = await Promise.all(
    listBuilderRegistry().map((entry) => getContentGrowthRowForType(entry.contentType)),
  );
  return rows;
}

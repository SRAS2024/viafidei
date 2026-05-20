/**
 * Per-content-type production readiness.
 *
 * Production readiness must verify every major public tab — not just
 * Prayer. For each of the twelve content types this report proves the
 * source -> public pipeline is intact:
 *
 *   - sourceConfigured  — at least one factory-ready source exists
 *                         (so a source can be discovered + fetched +
 *                         turned into a source document).
 *   - canaryBuild       — a known-good fixture builds + passes QA
 *                         through the real builder chain.
 *   - publicDisplay     — the strict public query the live tab, search
 *                         and sitemap all read from can LOAD (the
 *                         query does not throw) and how many strict
 *                         valid packages it returns.
 *   - cacheTag          — the content type has a revalidation tag, so
 *                         cache tags can be revalidated for it.
 *
 * Readiness FAILS when any major content type has no factory-ready
 * source, no successful canary build, or a public tab whose strict
 * query cannot load.
 *
 * Read-side only. A failed query is reported as an explicit `fail`
 * with the error message — never a silent pass.
 */

import { logger } from "../observability/logger";
import { buildSourcePlanReport } from "../ingestion/sources/source-plan";
import { runCanaryBuilds } from "../content-factory/canary-fixtures";
import { CONTENT_TYPE_TO_TAB } from "../cache/tags";
import {
  countStrictPrayers,
  countStrictSaints,
  countStrictParishes,
  countStrictApparitions,
  countStrictDevotions,
  countStrictNovenas,
  countStrictSacraments,
  countStrictRosary,
  countStrictConsecrations,
  countStrictSpiritualGuidance,
  countStrictLiturgy,
  countStrictHistory,
} from "../content-qa/thresholds";

export type ReadinessCheck = "pass" | "warn" | "fail" | "na";
export type ReadinessSeverity = "pass" | "warn" | "fail" | "error";

/** The twelve major public tabs production readiness must verify. */
export const READINESS_CONTENT_TYPES = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Devotion",
  "Novena",
  "Rosary",
  "Consecration",
  "Sacrament",
  "Liturgy",
  "History",
  "Parish",
  "SpiritualGuidance",
] as const;

export type ReadinessContentType = (typeof READINESS_CONTENT_TYPES)[number];

export type ContentTypeReadinessRow = {
  contentType: ReadinessContentType;
  /** Public tab the type appears under. */
  tab: string;
  checks: {
    sourceConfigured: ReadinessCheck;
    canaryBuild: ReadinessCheck;
    publicDisplay: ReadinessCheck;
    cacheTag: ReadinessCheck;
  };
  /** Factory-ready source count from the source plan. */
  factoryReadySources: number;
  /** Strict valid public packages the tab query returned; null = query failed. */
  strictPublicCount: number | null;
  /** Worst check severity for the row. */
  severity: ReadinessSeverity;
  /** Human-readable notes the admin reads first. */
  notes: string[];
};

export type ContentTypeReadinessReport = {
  generatedAt: Date;
  rows: ContentTypeReadinessRow[];
  worst: ReadinessSeverity;
  /** Content types whose public tab query threw — "cannot load". */
  tabsCannotLoad: number;
  /** Content types with zero factory-ready sources. */
  typesWithNoSource: number;
  /** Content types with no successful canary build. */
  typesWithNoCanary: number;
  /** Content types with zero strict valid public packages. */
  typesWithNoContent: number;
};

const STRICT_COUNT: Record<ReadinessContentType, () => Promise<number>> = {
  Prayer: countStrictPrayers,
  Saint: countStrictSaints,
  MarianApparition: countStrictApparitions,
  Devotion: countStrictDevotions,
  Novena: countStrictNovenas,
  Rosary: countStrictRosary,
  Consecration: countStrictConsecrations,
  Sacrament: countStrictSacraments,
  Liturgy: countStrictLiturgy,
  History: countStrictHistory,
  Parish: countStrictParishes,
  SpiritualGuidance: countStrictSpiritualGuidance,
};

const SEVERITY_RANK: Record<ReadinessSeverity, number> = {
  pass: 0,
  warn: 1,
  fail: 2,
  error: 3,
};

function worstOf(severities: ReadinessSeverity[]): ReadinessSeverity {
  return severities.reduce<ReadinessSeverity>(
    (acc, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[acc] ? s : acc),
    "pass",
  );
}

/** A row's severity is the worst of its non-`na` checks. */
function rowSeverity(checks: ContentTypeReadinessRow["checks"]): ReadinessSeverity {
  const order: ReadinessCheck[] = [
    checks.sourceConfigured,
    checks.canaryBuild,
    checks.publicDisplay,
    checks.cacheTag,
  ];
  if (order.includes("fail")) return "fail";
  if (order.includes("warn")) return "warn";
  return "pass";
}

/**
 * Build the per-content-type production readiness report. Aggregates
 * the source plan, the canary builds, and the strict public-tab
 * query — one row per major content type.
 */
export async function getContentTypeReadinessReport(): Promise<ContentTypeReadinessReport> {
  const generatedAt = new Date();

  const sourcePlan = await buildSourcePlanReport().catch((e) => {
    logger.warn("content-type-readiness.source_plan_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  });

  let canary: ReturnType<typeof runCanaryBuilds> | null = null;
  try {
    canary = runCanaryBuilds();
  } catch (e) {
    logger.warn("content-type-readiness.canary_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const rows: ContentTypeReadinessRow[] = [];
  let tabsCannotLoad = 0;
  let typesWithNoSource = 0;
  let typesWithNoCanary = 0;
  let typesWithNoContent = 0;

  for (const contentType of READINESS_CONTENT_TYPES) {
    const notes: string[] = [];

    // --- Source configured.
    const planRow = sourcePlan?.rows.find((r) => r.contentType === contentType);
    const factoryReadySources = planRow?.factoryReady ?? 0;
    let sourceConfigured: ReadinessCheck;
    if (!sourcePlan) {
      sourceConfigured = "na";
      notes.push("Source plan unavailable.");
    } else if (factoryReadySources > 0) {
      sourceConfigured = "pass";
    } else if ((planRow?.configured ?? 0) > 0) {
      sourceConfigured = "warn";
      notes.push("Sources are configured but none are factory-ready.");
    } else {
      sourceConfigured = "fail";
      typesWithNoSource += 1;
      notes.push("No factory-ready source is configured.");
    }

    // --- Canary build (fixture builds + passes the builder chain).
    const canaryResult = canary?.results.find((r) => r.contentType === contentType);
    let canaryBuild: ReadinessCheck;
    if (!canary) {
      canaryBuild = "na";
      notes.push("Canary runner unavailable.");
    } else if (!canaryResult) {
      canaryBuild = "warn";
      typesWithNoCanary += 1;
      notes.push("No canary fixture is configured for this content type.");
    } else if (canaryResult.passed) {
      canaryBuild = "pass";
    } else {
      canaryBuild = "fail";
      typesWithNoCanary += 1;
      notes.push(`Canary build failed: ${canaryResult.failureReason ?? canaryResult.outcome}.`);
    }

    // --- Public display: the strict query the tab/search/sitemap read.
    let strictPublicCount: number | null = null;
    let publicDisplay: ReadinessCheck;
    try {
      strictPublicCount = await STRICT_COUNT[contentType]();
      if (strictPublicCount > 0) {
        publicDisplay = "pass";
      } else {
        publicDisplay = "warn";
        typesWithNoContent += 1;
        notes.push("Public tab loads, but has no strict valid packages yet.");
      }
    } catch (e) {
      publicDisplay = "fail";
      tabsCannotLoad += 1;
      notes.push(`Public tab query cannot load: ${e instanceof Error ? e.message : String(e)}.`);
    }

    // --- Cache tag: the type must have a revalidation tag.
    const tab = CONTENT_TYPE_TO_TAB[contentType as keyof typeof CONTENT_TYPE_TO_TAB];
    const cacheTag: ReadinessCheck = tab ? "pass" : "fail";
    if (!tab) notes.push("No cache revalidation tag mapped for this content type.");

    const checks = { sourceConfigured, canaryBuild, publicDisplay, cacheTag };
    rows.push({
      contentType,
      tab: tab ?? "—",
      checks,
      factoryReadySources,
      strictPublicCount,
      severity: rowSeverity(checks),
      notes,
    });
  }

  return {
    generatedAt,
    rows,
    worst: worstOf(rows.map((r) => r.severity)),
    tabsCannotLoad,
    typesWithNoSource,
    typesWithNoCanary,
    typesWithNoContent,
  };
}

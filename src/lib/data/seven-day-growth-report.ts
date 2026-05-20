/**
 * Seven-day production content growth report.
 *
 * Proves live production content growth: one row per content-factory
 * content type, scoped to a rolling seven-day window, with the
 * spec-listed pipeline metrics:
 *
 *   1.  Source documents fetched.
 *   2.  Build attempts.
 *   3.  Complete packages built.
 *   4.  Cross-source validation passes.
 *   5.  Strict QA passes.
 *   6.  Persisted packages.
 *   7.  Public packages.
 *   8.  Search-visible packages.
 *   9.  Sitemap-visible packages.
 *  10.  Deleted invalid packages.
 *  11.  Duplicate packages.
 *  12.  Net public growth (public packages created − deleted invalid).
 *
 * Plus, per content type:
 *   - A daily growth target (from `appConfig.ingestion.dailyGrowthTargets`)
 *     and the derived seven-day target.
 *   - A 24-hour growth warning and a stronger seven-day growth warning.
 *   - A production content growth score (0–100) computed from REAL
 *     public packages created — never raw rows — that penalises every
 *     break in the source → public pipeline.
 *
 * Plus four admin charts (daily series):
 *   - Daily public package growth by content type.
 *   - Daily QA pass rate by content type.
 *   - Daily source success rate by source.
 *   - Daily builder success rate by builder.
 *
 * Read-side only. Per the codebase rule, a failed query records an
 * `errors` entry rather than displaying a silent / false zero.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { appConfig } from "../config";
import { listBuilderRegistry } from "../content-factory";
import type { ContentTypeKey } from "../content-factory";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";
import { SACRAMENT_KEYS } from "../content-qa/sacrament-normalize";
import { VALID_HISTORY_TYPES } from "../content-qa/contracts/history";

const MS_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;
const COMPLETE_BUILD_STATUS = "built_complete_package";
/** RejectedContentLog decisions that count as a strict-QA failure. */
const QA_FAIL_DECISIONS = ["reject", "delete"];
/** ContentValidationEvidence decisions that count as an evidence failure. */
const EVIDENCE_FAIL_DECISIONS = ["fail", "insufficient_evidence"];
/** Cap the source chart so it stays readable on a wide range of hosts. */
const SOURCE_CHART_LIMIT = 8;

export type GrowthWarningLevel = "none" | "no_growth_24h" | "no_growth_7d";

export type GrowthScorePenalty = {
  /** Stable machine id — also the spec penalty name. */
  id: string;
  /** Points subtracted from the 100-point starting score. */
  amount: number;
  /** Human-readable reason the admin reads. */
  reason: string;
};

/** The twelve spec-listed seven-day metrics. `null` means the query failed. */
export type SevenDayGrowthMetrics = {
  sourceDocumentsFetched: number | null;
  buildAttempts: number | null;
  completePackagesBuilt: number | null;
  crossSourceValidationPasses: number | null;
  strictQaPasses: number | null;
  persistedPackages: number | null;
  publicPackages: number | null;
  searchVisiblePackages: number | null;
  sitemapVisiblePackages: number | null;
  deletedInvalidPackages: number | null;
  duplicatePackages: number | null;
  netPublicGrowth: number | null;
};

export type SevenDayGrowthRow = {
  contentType: ContentTypeKey;
  metrics: SevenDayGrowthMetrics;
  /** Expected new public packages per day for this content type. */
  dailyTarget: number;
  /** `dailyTarget × 7`. */
  sevenDayTarget: number;
  /** True when public packages created in the window met the 7-day target. */
  metTarget: boolean;
  /** Strict-public packages created in the last 24 hours. */
  publicGrowth24h: number | null;
  /** Strict-public packages created in the last 7 days. */
  publicGrowth7d: number | null;
  warning: GrowthWarningLevel;
  warningMessage: string;
  /** 0–100 production content growth score. */
  growthScore: number;
  scorePenalties: GrowthScorePenalty[];
  /** Per-query failures so the admin sees WHICH query broke. */
  errors: Record<string, string>;
};

export type DailySeries = {
  label: string;
  /** One value per window day, oldest first. `null` = no data that day. */
  values: ReadonlyArray<number | null>;
  /** Trailing summary string ("12" for counts, "83%" for rates). */
  summary: string;
};

export type DailySeriesChartData = {
  title: string;
  description: string;
  /** "count" scales bars to the chart max; "rate" scales 0–100. */
  mode: "count" | "rate";
  /** Day labels, oldest first. */
  dayLabels: ReadonlyArray<string>;
  series: ReadonlyArray<DailySeries>;
};

export type SevenDayGrowthReport = {
  generatedAt: Date;
  windowDays: number;
  windowStart: Date;
  dayLabels: ReadonlyArray<string>;
  rows: SevenDayGrowthRow[];
  /** Average of every content type's growth score, rounded. */
  overallGrowthScore: number;
  /** Content types whose 24h or 7d warning is active. */
  warningCount: number;
  charts: {
    dailyPublicGrowthByType: DailySeriesChartData;
    dailyQaPassRateByType: DailySeriesChartData;
    dailySourceSuccessRateBySource: DailySeriesChartData;
    dailyBuilderSuccessRateByBuilder: DailySeriesChartData;
  };
};

/** Public Prisma model + subtype filter for each content-factory type. */
const PUBLIC_MODEL: Record<ContentTypeKey, { model: string; subtype: Record<string, unknown> }> = {
  Prayer: { model: "prayer", subtype: {} },
  Saint: { model: "saint", subtype: {} },
  MarianApparition: { model: "marianApparition", subtype: {} },
  Parish: { model: "parish", subtype: {} },
  Devotion: { model: "devotion", subtype: { subtype: null } },
  Novena: { model: "devotion", subtype: { subtype: "Novena" } },
  Sacrament: {
    model: "spiritualLifeGuide",
    subtype: { sacramentKey: { in: [...SACRAMENT_KEYS] } },
  },
  Rosary: { model: "spiritualLifeGuide", subtype: { subtype: "Rosary" } },
  Consecration: { model: "spiritualLifeGuide", subtype: { subtype: "Consecration" } },
  SpiritualGuidance: {
    model: "spiritualLifeGuide",
    subtype: { sacramentKey: null, subtype: { notIn: ["Rosary", "Consecration"] } },
  },
  Liturgy: { model: "liturgyEntry", subtype: { historyType: null } },
  History: {
    model: "liturgyEntry",
    subtype: { historyType: { in: [...VALID_HISTORY_TYPES] } },
  },
};

type BuildLogLite = {
  contentType: string;
  sourceHost: string;
  builderName: string;
  buildStatus: string;
  sourceDocumentId: string | null;
  createdAt: Date;
};

type RejectedLite = {
  contentType: string;
  decision: string;
  failureCategory: string | null;
  validationDecision: string | null;
  deletedAt: Date;
};

type EvidenceLite = {
  contentType: string;
  validationDecision: string;
  packageId: string | null;
  candidateSlug: string | null;
};

type PublicRowLite = {
  createdAt: Date;
  publicRenderReady: boolean;
  isThresholdEligible: boolean;
  archivedAt: Date | null;
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
    logger.warn("seven-day-growth-report.query_failed", { label, error: msg });
    return null;
  }
}

/**
 * Seven contiguous day buckets ending at `now`. `indexOf` maps any
 * Date inside the window to its bucket (clamped at the edges).
 */
function dayBuckets(sinceMs: number): {
  labels: string[];
  indexOf: (d: Date) => number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric" });
  const labels: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    labels.push(fmt.format(new Date(sinceMs + i * MS_DAY)));
  }
  const indexOf = (d: Date): number => {
    const idx = Math.floor((d.getTime() - sinceMs) / MS_DAY);
    if (idx < 0) return 0;
    if (idx > WINDOW_DAYS - 1) return WINDOW_DAYS - 1;
    return idx;
  };
  return { labels, indexOf };
}

function emptyDays(): number[] {
  return new Array(WINDOW_DAYS).fill(0) as number[];
}

/**
 * Production content growth score.
 *
 * Starts at 100 and subtracts every spec-listed penalty. The score is
 * grounded in REAL public packages created (`publicPackages`), not raw
 * rows: a content type with thousands of build attempts but zero public
 * packages cascades through penalties 3–7 and scores near zero, while a
 * content type that quietly produces public, indexed packages stays
 * near 100.
 *
 * Penalties (spec §1):
 *   1.  No fetches.
 *   2.  No build attempts.
 *   3.  No QA passes.
 *   4.  QA passes with no persistence.
 *   5.  Persistence with no public display.
 *   6.  Public display with no search visibility.
 *   7.  Public display with no sitemap visibility.
 *   8.  Repeated duplicate saturation.
 *   9.  Repeated validation evidence failures.
 *  10.  Repeated builder failures.
 */
export function computeProductionGrowthScore(input: {
  sourceDocumentsFetched: number;
  buildAttempts: number;
  completePackagesBuilt: number;
  buildFailures: number;
  strictQaPasses: number;
  persistedPackages: number;
  publicPackages: number;
  searchVisiblePackages: number;
  sitemapVisiblePackages: number;
  duplicatePackages: number;
  validationEvidenceFailures: number;
}): { score: number; penalties: GrowthScorePenalty[] } {
  const penalties: GrowthScorePenalty[] = [];
  let score = 100;
  const penalise = (id: string, amount: number, reason: string): void => {
    penalties.push({ id, amount, reason });
    score -= amount;
  };

  // 1. No fetches — nothing entered the pipeline.
  if (input.sourceDocumentsFetched === 0) {
    penalise("no_fetches", 30, "No source documents fetched in the last 7 days");
  }
  // 2. No build attempts — fetched documents were never built.
  if (input.buildAttempts === 0) {
    penalise("no_build_attempts", 30, "No build attempts in the last 7 days");
  }
  // 3. No QA passes — nothing cleared strict QA.
  if (input.strictQaPasses === 0) {
    penalise(
      "no_qa_passes",
      40,
      input.completePackagesBuilt > 0
        ? `${input.completePackagesBuilt} package(s) built but none passed strict QA`
        : "No package passed strict QA in the last 7 days",
    );
  }
  // 4. QA passes with no persistence.
  if (input.strictQaPasses > 0 && input.persistedPackages === 0) {
    penalise(
      "qa_without_persistence",
      35,
      `${input.strictQaPasses} strict QA pass(es) but 0 packages persisted`,
    );
  }
  // 5. Persistence with no public display.
  if (input.persistedPackages > 0 && input.publicPackages === 0) {
    penalise(
      "persistence_without_public",
      35,
      `${input.persistedPackages} package(s) persisted but 0 reached public display`,
    );
  }
  // 6. Public display with no search visibility.
  if (input.publicPackages > 0 && input.searchVisiblePackages === 0) {
    penalise(
      "public_without_search",
      20,
      `${input.publicPackages} public package(s) but 0 visible in search`,
    );
  }
  // 7. Public display with no sitemap visibility.
  if (input.publicPackages > 0 && input.sitemapVisiblePackages === 0) {
    penalise(
      "public_without_sitemap",
      20,
      `${input.publicPackages} public package(s) but 0 visible in the sitemap`,
    );
  }
  // 8. Repeated duplicate saturation — duplicates outnumber real builds.
  if (
    input.duplicatePackages >= 5 &&
    input.duplicatePackages >= Math.max(1, input.completePackagesBuilt)
  ) {
    penalise(
      "duplicate_saturation",
      15,
      `${input.duplicatePackages} duplicate rejection(s) vs ${input.completePackagesBuilt} complete build(s)`,
    );
  }
  // 9. Repeated validation evidence failures.
  if (input.validationEvidenceFailures >= 5) {
    penalise(
      "validation_evidence_failures",
      15,
      `${input.validationEvidenceFailures} cross-source validation evidence failure(s) in the last 7 days`,
    );
  }
  // 10. Repeated builder failures — build failures dominate attempts.
  if (input.buildFailures >= 5 && input.buildFailures > input.completePackagesBuilt) {
    penalise(
      "builder_failures",
      20,
      `${input.buildFailures} build failure(s) vs ${input.completePackagesBuilt} complete build(s)`,
    );
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score, penalties };
}

/** Resolve a content type's daily growth target from config. */
export function dailyGrowthTargetFor(contentType: ContentTypeKey): number {
  const targets = appConfig.ingestion.dailyGrowthTargets;
  const value = targets[contentType];
  return typeof value === "number" && value >= 0 ? value : 0;
}

function classifyWarning(
  publicGrowth24h: number | null,
  publicGrowth7d: number | null,
): { warning: GrowthWarningLevel; warningMessage: string } {
  if (publicGrowth7d === 0) {
    return {
      warning: "no_growth_7d",
      warningMessage:
        "No valid public package growth in the last 7 days — this content type is stalled.",
    };
  }
  if (publicGrowth24h === 0) {
    return {
      warning: "no_growth_24h",
      warningMessage: "No valid public package growth in the last 24 hours.",
    };
  }
  return { warning: "none", warningMessage: "" };
}

function isStrict(row: PublicRowLite): boolean {
  return row.publicRenderReady && row.isThresholdEligible && row.archivedAt == null;
}

async function buildRow(
  contentType: ContentTypeKey,
  ctx: {
    buildLogs: BuildLogLite[];
    rejected: RejectedLite[];
    evidence: EvidenceLite[];
    since24h: Date;
    since7d: Date;
    buckets: ReturnType<typeof dayBuckets>;
    buildLogsFailed: boolean;
    rejectedFailed: boolean;
    evidenceFailed: boolean;
  },
): Promise<{ row: SevenDayGrowthRow; publicDaily: number[] }> {
  const errors: Record<string, string> = {};
  const { model, subtype } = PUBLIC_MODEL[contentType];

  // --- Build-log derived metrics (filtered from the window-wide scan).
  // When the scan failed, the dependent metrics resolve to `null` (an
  // explicit error state surfaced to the admin) rather than a false 0.
  const typeBuilds = ctx.buildLogs.filter((b) => b.contentType === contentType);
  const buildAttempts = ctx.buildLogsFailed ? null : typeBuilds.length;
  const completePackagesBuilt = ctx.buildLogsFailed
    ? null
    : typeBuilds.filter((b) => b.buildStatus === COMPLETE_BUILD_STATUS).length;
  const sourceDocumentsFetched = ctx.buildLogsFailed
    ? null
    : new Set(typeBuilds.map((b) => b.sourceDocumentId).filter((id): id is string => id != null))
        .size;
  const buildFailures =
    buildAttempts != null && completePackagesBuilt != null
      ? buildAttempts - completePackagesBuilt
      : null;

  // --- Rejected-log derived metrics.
  const typeRejected = ctx.rejected.filter((r) => r.contentType === contentType);
  const qaFails = ctx.rejectedFailed
    ? null
    : typeRejected.filter(
        (r) => r.validationDecision != null && QA_FAIL_DECISIONS.includes(r.validationDecision),
      ).length;
  const deletedInvalidPackages = ctx.rejectedFailed
    ? null
    : typeRejected.filter((r) => r.decision === "delete").length;
  const duplicatePackages = ctx.rejectedFailed
    ? null
    : typeRejected.filter((r) => r.failureCategory === "duplicate").length;
  const strictQaPasses =
    completePackagesBuilt != null && qaFails != null
      ? Math.max(0, completePackagesBuilt - qaFails)
      : null;

  // --- Cross-source validation evidence.
  const typeEvidence = ctx.evidence.filter((e) => e.contentType === contentType);
  const crossSourceValidationPasses = ctx.evidenceFailed
    ? null
    : new Set(
        typeEvidence
          .filter((e) => e.validationDecision === "pass")
          .map((e) => e.packageId ?? e.candidateSlug ?? "")
          .filter((key) => key !== ""),
      ).size;
  const validationEvidenceFailures = ctx.evidenceFailed
    ? 0
    : typeEvidence.filter((e) => EVIDENCE_FAIL_DECISIONS.includes(e.validationDecision)).length;

  // --- Public-side metrics: one findMany, then strict-filter in JS.
  const client = prisma as unknown as Record<
    string,
    {
      findMany: (a: { where: unknown; select?: unknown }) => Promise<PublicRowLite[]>;
      count: (a: { where: unknown }) => Promise<number>;
    }
  >;
  const delegate = client[model];

  let persistedPackages: number | null = null;
  let publicPackages: number | null = null;
  let publicGrowth24h: number | null = null;
  const publicDaily = emptyDays();

  if (!delegate) {
    errors.publicModel = `prisma has no model named ${model}`;
  } else {
    const persistedRows = await safe(
      () =>
        delegate.findMany({
          where: { status: "PUBLISHED", ...subtype, createdAt: { gte: ctx.since7d } },
          select: {
            createdAt: true,
            publicRenderReady: true,
            isThresholdEligible: true,
            archivedAt: true,
          },
        }),
      "persistedPackages",
      errors,
    );
    if (persistedRows) {
      persistedPackages = persistedRows.length;
      const strictRows = persistedRows.filter(isStrict);
      publicPackages = strictRows.length;
      publicGrowth24h = strictRows.filter((r) => r.createdAt >= ctx.since24h).length;
      for (const r of strictRows) {
        publicDaily[ctx.buckets.indexOf(r.createdAt)] += 1;
      }
    }
  }

  // --- Search + sitemap visibility: independent re-counts through the
  // strict gate the search index and sitemap query both read from.
  let searchVisiblePackages: number | null = null;
  let sitemapVisiblePackages: number | null = null;
  if (delegate) {
    searchVisiblePackages = await safe(
      () =>
        delegate.count({
          where: { ...STRICT_PUBLIC_WHERE_CLAUSE, ...subtype, createdAt: { gte: ctx.since7d } },
        }),
      "searchVisiblePackages",
      errors,
    );
    sitemapVisiblePackages = await safe(
      () =>
        delegate.count({
          where: { ...STRICT_PUBLIC_WHERE_CLAUSE, ...subtype, createdAt: { gte: ctx.since7d } },
        }),
      "sitemapVisiblePackages",
      errors,
    );
  }

  const netPublicGrowth =
    publicPackages != null && deletedInvalidPackages != null
      ? publicPackages - deletedInvalidPackages
      : null;
  const publicGrowth7d = publicPackages;

  const { warning, warningMessage } = classifyWarning(publicGrowth24h, publicGrowth7d);

  const { score, penalties } = computeProductionGrowthScore({
    sourceDocumentsFetched: sourceDocumentsFetched ?? 0,
    buildAttempts: buildAttempts ?? 0,
    completePackagesBuilt: completePackagesBuilt ?? 0,
    buildFailures: buildFailures ?? 0,
    strictQaPasses: strictQaPasses ?? 0,
    persistedPackages: persistedPackages ?? 0,
    publicPackages: publicPackages ?? 0,
    searchVisiblePackages: searchVisiblePackages ?? 0,
    sitemapVisiblePackages: sitemapVisiblePackages ?? 0,
    duplicatePackages: duplicatePackages ?? 0,
    validationEvidenceFailures,
  });

  const dailyTarget = dailyGrowthTargetFor(contentType);
  const sevenDayTarget = dailyTarget * WINDOW_DAYS;

  const row: SevenDayGrowthRow = {
    contentType,
    metrics: {
      sourceDocumentsFetched,
      buildAttempts,
      completePackagesBuilt,
      crossSourceValidationPasses,
      strictQaPasses,
      persistedPackages,
      publicPackages,
      searchVisiblePackages,
      sitemapVisiblePackages,
      deletedInvalidPackages,
      duplicatePackages,
      netPublicGrowth,
    },
    dailyTarget,
    sevenDayTarget,
    metTarget: sevenDayTarget > 0 && (publicPackages ?? 0) >= sevenDayTarget,
    publicGrowth24h,
    publicGrowth7d,
    warning,
    warningMessage,
    growthScore: score,
    scorePenalties: penalties,
    errors,
  };
  return { row, publicDaily };
}

function countSeries(label: string, daily: number[]): DailySeries {
  return {
    label,
    values: daily,
    summary: String(daily.reduce((a, b) => a + b, 0)),
  };
}

function rateSeries(
  label: string,
  daily: ReadonlyArray<{ num: number; den: number }>,
): DailySeries {
  const values = daily.map((d) => (d.den > 0 ? Math.round((d.num / d.den) * 100) : null));
  const totalNum = daily.reduce((a, d) => a + d.num, 0);
  const totalDen = daily.reduce((a, d) => a + d.den, 0);
  return {
    label,
    values,
    summary: totalDen > 0 ? `${Math.round((totalNum / totalDen) * 100)}%` : "—",
  };
}

/**
 * Build the complete seven-day production content growth report.
 */
export async function getSevenDayGrowthReport(): Promise<SevenDayGrowthReport> {
  const now = Date.now();
  const since7d = new Date(now - WINDOW_DAYS * MS_DAY);
  const since24h = new Date(now - MS_DAY);
  const buckets = dayBuckets(now - WINDOW_DAYS * MS_DAY);
  const scanErrors: Record<string, string> = {};

  // Three window-wide scans feed every per-type metric and every chart.
  const [buildLogs, rejected, evidence] = await Promise.all([
    safe(
      () =>
        prisma.contentPackageBuildLog.findMany({
          where: { createdAt: { gte: since7d } },
          select: {
            contentType: true,
            sourceHost: true,
            builderName: true,
            buildStatus: true,
            sourceDocumentId: true,
            createdAt: true,
          },
        }) as Promise<BuildLogLite[]>,
      "buildLogs",
      scanErrors,
    ),
    safe(
      () =>
        prisma.rejectedContentLog.findMany({
          where: { deletedAt: { gte: since7d } },
          select: {
            contentType: true,
            decision: true,
            failureCategory: true,
            validationDecision: true,
            deletedAt: true,
          },
        }) as Promise<RejectedLite[]>,
      "rejectedLogs",
      scanErrors,
    ),
    safe(
      () =>
        prisma.contentValidationEvidence.findMany({
          where: { createdAt: { gte: since7d } },
          select: {
            contentType: true,
            validationDecision: true,
            packageId: true,
            candidateSlug: true,
          },
        }) as Promise<EvidenceLite[]>,
      "validationEvidence",
      scanErrors,
    ),
  ]);

  const ctx = {
    buildLogs: buildLogs ?? [],
    rejected: rejected ?? [],
    evidence: evidence ?? [],
    since24h,
    since7d,
    buckets,
    // When a window-wide scan fails, the dependent per-type metrics
    // resolve to `null` (an explicit error state) rather than a false 0.
    buildLogsFailed: buildLogs == null,
    rejectedFailed: rejected == null,
    evidenceFailed: evidence == null,
  };

  const contentTypes = listBuilderRegistry().map((e) => e.contentType);
  const built = await Promise.all(contentTypes.map((ct) => buildRow(ct, ctx)));
  const rows = built.map((b) => {
    // Propagate the scan-level failures into every row's errors map.
    for (const [k, v] of Object.entries(scanErrors)) b.row.errors[k] = v;
    return b.row;
  });

  const overallGrowthScore = rows.length
    ? Math.round(rows.reduce((a, r) => a + r.growthScore, 0) / rows.length)
    : 100;
  const warningCount = rows.filter((r) => r.warning !== "none").length;

  // --- Chart 1: daily public package growth by content type.
  const dailyPublicGrowthByType: DailySeriesChartData = {
    title: "Daily public package growth by content type",
    description: "New strict-public packages created each day, per content type.",
    mode: "count",
    dayLabels: buckets.labels,
    series: contentTypes.map((ct, i) => countSeries(ct, built[i].publicDaily)),
  };

  // --- Chart 2: daily QA pass rate by content type.
  const qaPassRateSeries = contentTypes.map((ct) => {
    const complete = emptyDays();
    const fails = emptyDays();
    for (const b of ctx.buildLogs) {
      if (b.contentType === ct && b.buildStatus === COMPLETE_BUILD_STATUS) {
        complete[buckets.indexOf(b.createdAt)] += 1;
      }
    }
    for (const r of ctx.rejected) {
      if (
        r.contentType === ct &&
        r.validationDecision != null &&
        QA_FAIL_DECISIONS.includes(r.validationDecision)
      ) {
        fails[buckets.indexOf(r.deletedAt)] += 1;
      }
    }
    return rateSeries(
      ct,
      complete.map((c, d) => ({ num: Math.max(0, c - fails[d]), den: c })),
    );
  });
  const dailyQaPassRateByType: DailySeriesChartData = {
    title: "Daily QA pass rate by content type",
    description: "Share of complete builds that cleared strict QA each day.",
    mode: "rate",
    dayLabels: buckets.labels,
    series: qaPassRateSeries,
  };

  // --- Chart 3: daily source success rate by source.
  const byHost = new Map<string, { complete: number[]; total: number[] }>();
  for (const b of ctx.buildLogs) {
    let entry = byHost.get(b.sourceHost);
    if (!entry) {
      entry = { complete: emptyDays(), total: emptyDays() };
      byHost.set(b.sourceHost, entry);
    }
    const d = buckets.indexOf(b.createdAt);
    entry.total[d] += 1;
    if (b.buildStatus === COMPLETE_BUILD_STATUS) entry.complete[d] += 1;
  }
  const sourceSeries = [...byHost.entries()]
    .sort((a, b) => sum(b[1].total) - sum(a[1].total))
    .slice(0, SOURCE_CHART_LIMIT)
    .map(([host, e]) =>
      rateSeries(
        host,
        e.total.map((t, d) => ({ num: e.complete[d], den: t })),
      ),
    );
  const dailySourceSuccessRateBySource: DailySeriesChartData = {
    title: "Daily source success rate by source",
    description: "Share of each source's build attempts that produced a complete package.",
    mode: "rate",
    dayLabels: buckets.labels,
    series: sourceSeries,
  };

  // --- Chart 4: daily builder success rate by builder.
  const byBuilder = new Map<string, { complete: number[]; total: number[] }>();
  for (const b of ctx.buildLogs) {
    let entry = byBuilder.get(b.builderName);
    if (!entry) {
      entry = { complete: emptyDays(), total: emptyDays() };
      byBuilder.set(b.builderName, entry);
    }
    const d = buckets.indexOf(b.createdAt);
    entry.total[d] += 1;
    if (b.buildStatus === COMPLETE_BUILD_STATUS) entry.complete[d] += 1;
  }
  const builderSeries = [...byBuilder.entries()]
    .sort((a, b) => sum(b[1].total) - sum(a[1].total))
    .map(([name, e]) =>
      rateSeries(
        name,
        e.total.map((t, d) => ({ num: e.complete[d], den: t })),
      ),
    );
  const dailyBuilderSuccessRateByBuilder: DailySeriesChartData = {
    title: "Daily builder success rate by builder",
    description: "Share of each builder's attempts that produced a complete package.",
    mode: "rate",
    dayLabels: buckets.labels,
    series: builderSeries,
  };

  return {
    generatedAt: new Date(),
    windowDays: WINDOW_DAYS,
    windowStart: since7d,
    dayLabels: buckets.labels,
    rows,
    overallGrowthScore,
    warningCount,
    charts: {
      dailyPublicGrowthByType,
      dailyQaPassRateByType,
      dailySourceSuccessRateBySource,
      dailyBuilderSuccessRateByBuilder,
    },
  };
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

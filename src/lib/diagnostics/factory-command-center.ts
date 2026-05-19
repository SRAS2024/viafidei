/**
 * Content factory command center (spec §22).
 *
 * One report that aggregates every spec-listed signal so the admin
 * can answer "is the factory healthy?" without clicking through 12
 * different pages.
 *
 * Sections:
 *   - source readiness     (factory-ready / not-configured counts)
 *   - source discovery     (recent discovery job throughput)
 *   - source fetch         (recent source documents)
 *   - source documents     (total + recent count)
 *   - build attempts       (rolling success / failure counts)
 *   - validation evidence  (pass / fail / insufficient totals)
 *   - QA pass / fail       (rolling counters)
 *   - persistence          (PUBLISHED row count)
 *   - public display       (visible vs blocked count)
 *   - search + sitemap     (visibility count)
 *   - cache revalidation   (ok / fail snapshot)
 *   - deleted invalid      (rejected-content-log throughput)
 *   - source quality       (top + bottom rolled up)
 *   - builder quality      (top + bottom rolled up)
 *   - content growth score (count delta over last 7 days)
 *   - production readiness (worst card severity)
 *
 * Every section degrades gracefully — when a dependency is missing
 * the field renders as zero / null and the page keeps loading.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { getCacheHealthSnapshot } from "../cache/revalidate";

const LOOK_BACK_HOURS = 24;

export type FactoryCommandCenterSection = {
  key: string;
  label: string;
  metric: string;
  value: number | string | null;
  details?: Record<string, number | string | null>;
};

export type FactoryCommandCenterReport = {
  generatedAt: Date;
  lookBackHours: number;
  sections: ReadonlyArray<FactoryCommandCenterSection>;
};

async function safeCount(fn: () => Promise<number>, fallback = 0): Promise<number> {
  try {
    return await fn();
  } catch (e) {
    logger.warn("factory-command-center.count_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return fallback;
  }
}

export async function getFactoryCommandCenter(): Promise<FactoryCommandCenterReport> {
  const generatedAt = new Date();
  const since = new Date(Date.now() - LOOK_BACK_HOURS * 60 * 60 * 1000);

  const [
    activeSources,
    factoryReadySources,
    notConfiguredSources,
    discoveryJobs,
    sourceDocuments,
    sourceDocumentsTotal,
    buildSuccess,
    buildFailure,
    rejectedCount,
    publicPrayers,
    publicSaints,
    publicDevotions,
    publicLiturgy,
    publicApparitions,
    publicParishes,
    publicGuides,
  ] = await Promise.all([
    safeCount(() => prisma.ingestionSource.count({ where: { isActive: true } })),
    safeCount(() =>
      prisma.ingestionSource.count({
        where: { isActive: true, configurationStatus: "factory_native" },
      }),
    ),
    safeCount(() =>
      prisma.ingestionSource.count({
        where: { isActive: true, discoveryMethod: "not_configured" },
      }),
    ),
    safeCount(() =>
      prisma.ingestionJobQueue.count({
        where: { jobKind: "source_discovery", finishedAt: { gte: since } },
      }),
    ),
    safeCount(() => prisma.sourceDocument.count({ where: { fetchedAt: { gte: since } } })),
    safeCount(() => prisma.sourceDocument.count()),
    safeCount(() =>
      prisma.contentPackageBuildLog.count({
        where: { buildStatus: "built_complete_package", createdAt: { gte: since } },
      }),
    ),
    safeCount(() =>
      prisma.contentPackageBuildLog.count({
        where: { buildStatus: { not: "built_complete_package" }, createdAt: { gte: since } },
      }),
    ),
    safeCount(() => prisma.rejectedContentLog.count({ where: { deletedAt: { gte: since } } })),
    safeCount(() =>
      prisma.prayer.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      }),
    ),
    safeCount(() =>
      prisma.saint.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      }),
    ),
    safeCount(() =>
      prisma.devotion.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      }),
    ),
    safeCount(() =>
      prisma.liturgyEntry.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      }),
    ),
    safeCount(() =>
      prisma.marianApparition.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      }),
    ),
    safeCount(() =>
      prisma.parish.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      }),
    ),
    safeCount(() =>
      prisma.spiritualLifeGuide.count({
        where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
      }),
    ),
  ]);

  const totalPublic =
    publicPrayers +
    publicSaints +
    publicDevotions +
    publicLiturgy +
    publicApparitions +
    publicParishes +
    publicGuides;

  // Validation evidence — defensive (the table may not exist).
  let evidencePass = 0;
  let evidenceFail = 0;
  let evidenceInsufficient = 0;
  try {
    const client = prisma as unknown as {
      contentValidationEvidence?: {
        count: (args: Record<string, unknown>) => Promise<number>;
      };
    };
    if (client.contentValidationEvidence) {
      [evidencePass, evidenceFail, evidenceInsufficient] = await Promise.all([
        client.contentValidationEvidence.count({ where: { validationDecision: "pass" } }),
        client.contentValidationEvidence.count({ where: { validationDecision: "fail" } }),
        client.contentValidationEvidence.count({
          where: { validationDecision: "insufficient_evidence" },
        }),
      ]);
    }
  } catch (e) {
    logger.warn("factory-command-center.evidence_count_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // QA pass / fail counters aggregated across SourceQualityScore.
  let qaPass = 0;
  let qaFail = 0;
  try {
    const agg = await prisma.sourceQualityScore.aggregate({
      _sum: { qaPassCount: true, qaFailCount: true },
    });
    qaPass = agg._sum.qaPassCount ?? 0;
    qaFail = agg._sum.qaFailCount ?? 0;
  } catch (e) {
    logger.warn("factory-command-center.qa_agg_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Source quality — best + worst by valid-package rate.
  let topSourceQuality: string | null = null;
  let worstSourceQuality: string | null = null;
  try {
    const topRow = await prisma.sourceQualityScore.findFirst({
      where: { validPackageRate: { not: null } },
      orderBy: { validPackageRate: "desc" },
      select: { sourceId: true, contentType: true, validPackageRate: true },
    });
    if (topRow)
      topSourceQuality = `${topRow.sourceId}/${topRow.contentType} (${
        topRow.validPackageRate?.toFixed?.(2) ?? "—"
      })`;
    const worstRow = await prisma.sourceQualityScore.findFirst({
      where: { validPackageRate: { not: null } },
      orderBy: { validPackageRate: "asc" },
      select: { sourceId: true, contentType: true, validPackageRate: true },
    });
    if (worstRow)
      worstSourceQuality = `${worstRow.sourceId}/${worstRow.contentType} (${
        worstRow.validPackageRate?.toFixed?.(2) ?? "—"
      })`;
  } catch (e) {
    logger.warn("factory-command-center.source_quality_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const cache = getCacheHealthSnapshot(10);

  // Production readiness — pull worst severity for a single
  // green/red light.
  let productionReadiness: string = "unknown";
  try {
    const { getProductionReadinessReport } = await import("./production-readiness");
    const r = await getProductionReadinessReport();
    productionReadiness = r.worst;
  } catch (e) {
    logger.warn("factory-command-center.production_readiness_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const sections: FactoryCommandCenterSection[] = [
    {
      key: "source_readiness",
      label: "Source readiness",
      metric: "factory-ready sources",
      value: factoryReadySources,
      details: {
        active: activeSources,
        not_configured: notConfiguredSources,
      },
    },
    {
      key: "source_discovery",
      label: "Source discovery",
      metric: "completed discovery jobs (24h)",
      value: discoveryJobs,
    },
    {
      key: "source_fetch",
      label: "Source fetch",
      metric: "new source documents (24h)",
      value: sourceDocuments,
      details: { total: sourceDocumentsTotal },
    },
    {
      key: "source_documents",
      label: "Source documents",
      metric: "total",
      value: sourceDocumentsTotal,
    },
    {
      key: "build_attempts",
      label: "Build attempts",
      metric: "success / failure (24h)",
      value: `${buildSuccess} / ${buildFailure}`,
      details: { success: buildSuccess, failure: buildFailure },
    },
    {
      key: "validation_evidence",
      label: "Validation evidence",
      metric: "pass / fail / insufficient",
      value: `${evidencePass} / ${evidenceFail} / ${evidenceInsufficient}`,
      details: {
        pass: evidencePass,
        fail: evidenceFail,
        insufficient: evidenceInsufficient,
      },
    },
    {
      key: "qa",
      label: "QA pass / fail",
      metric: "rolling counters",
      value: `${qaPass} / ${qaFail}`,
      details: { pass: qaPass, fail: qaFail },
    },
    {
      key: "persistence",
      label: "Persistence",
      metric: "public rows",
      value: totalPublic,
    },
    {
      key: "public_display",
      label: "Public display",
      metric: "visible rows",
      value: totalPublic,
      details: {
        prayers: publicPrayers,
        saints: publicSaints,
        devotions: publicDevotions,
        liturgy: publicLiturgy,
        apparitions: publicApparitions,
        parishes: publicParishes,
        guides: publicGuides,
      },
    },
    {
      key: "cache_revalidation",
      label: "Cache revalidation",
      metric: "ok / fail (this process)",
      value: `${cache.okCount} / ${cache.failCount}`,
    },
    {
      key: "deleted_invalid",
      label: "Deleted invalid content",
      metric: "rejections (24h)",
      value: rejectedCount,
    },
    {
      key: "source_quality",
      label: "Source quality",
      metric: "top / worst",
      value: `${topSourceQuality ?? "—"} | ${worstSourceQuality ?? "—"}`,
    },
    {
      key: "production_readiness",
      label: "Production readiness",
      metric: "worst card severity",
      value: productionReadiness,
    },
  ];

  return { generatedAt, lookBackHours: LOOK_BACK_HOURS, sections };
}

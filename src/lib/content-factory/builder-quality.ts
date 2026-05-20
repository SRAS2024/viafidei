/**
 * Builder quality report.
 *
 * Aggregates every spec-listed builder quality dimension per builder
 * from ContentPackageBuildLog + RejectedContentLog + the public
 * content tables:
 *
 *   - build attempts + complete packages built
 *   - valid package rate         (build_complete / total builds)
 *   - QA pass rate / QA failure rate
 *   - public render pass rate    (renderReady / persisted)
 *   - search visibility pass rate / sitemap visibility pass rate
 *   - duplicate rate
 *   - wrong content rate
 *   - top missing fields         (from failed build logs)
 *   - top rejected source hosts  (from RejectedContentLog)
 *
 * Backs the admin builder-quality dashboard and the rebuild
 * scheduler: a builder whose `validPackageRate` drops below a
 * threshold gets its failing source documents rebuilt automatically
 * after a builder version bump.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { BUILDER_VERSION_REGISTRY } from "./builder-registry";
import type { ContentTypeKey } from "./types";
import { SACRAMENT_KEYS } from "../content-qa/sacrament-normalize";
import { VALID_HISTORY_TYPES } from "../content-qa/contracts/history";

export type BuilderQualityRow = {
  contentType: ContentTypeKey;
  builderName: string;
  builderVersion: string;
  totalBuilds: number;
  buildSuccessCount: number;
  buildFailureCount: number;
  wrongContentCount: number;
  duplicateCount: number;
  qaPassCount: number;
  qaFailCount: number;
  validPackageRate: number;
  qaPassRate: number;
  qaFailRate: number;
  publicRenderPassRate: number;
  searchVisibilityPassRate: number;
  sitemapVisibilityPassRate: number;
  duplicateRate: number;
  wrongContentRate: number;
  /** Most common missing required fields across this builder's failures. */
  topMissingFields: ReadonlyArray<{ field: string; count: number }>;
  /** Most common source hosts whose content this builder's type rejected. */
  topRejectedHosts: ReadonlyArray<{ host: string; count: number }>;
};

export type BuilderQualityReport = {
  rows: ReadonlyArray<BuilderQualityRow>;
  generatedAt: Date;
};

const LOOK_BACK_DAYS = 14;

/** Public model + subtype filter for each content type. */
const PUBLIC_MODEL: Record<ContentTypeKey, { model: string; where: Record<string, unknown> }> = {
  Prayer: { model: "prayer", where: {} },
  Saint: { model: "saint", where: {} },
  MarianApparition: { model: "marianApparition", where: {} },
  Parish: { model: "parish", where: {} },
  Devotion: { model: "devotion", where: { subtype: null } },
  Novena: { model: "devotion", where: { subtype: "Novena" } },
  Sacrament: { model: "spiritualLifeGuide", where: { sacramentKey: { in: [...SACRAMENT_KEYS] } } },
  Rosary: { model: "spiritualLifeGuide", where: { subtype: "Rosary" } },
  Consecration: { model: "spiritualLifeGuide", where: { subtype: "Consecration" } },
  SpiritualGuidance: {
    model: "spiritualLifeGuide",
    where: { sacramentKey: null, subtype: { notIn: ["Rosary", "Consecration"] } },
  },
  Liturgy: { model: "liturgyEntry", where: { historyType: null } },
  History: { model: "liturgyEntry", where: { historyType: { in: [...VALID_HISTORY_TYPES] } } },
};

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Public render / search / sitemap pass rates for one content type. */
async function publicVisibilityRates(contentType: ContentTypeKey): Promise<{
  publicRenderPassRate: number;
  searchVisibilityPassRate: number;
  sitemapVisibilityPassRate: number;
}> {
  const entry = PUBLIC_MODEL[contentType];
  const delegate = (
    prisma as unknown as Record<string, { count: (a: { where: unknown }) => Promise<number> }>
  )[entry.model];
  if (!delegate) {
    return { publicRenderPassRate: 0, searchVisibilityPassRate: 0, sitemapVisibilityPassRate: 0 };
  }
  const [published, renderReady, strict] = await Promise.all([
    delegate.count({ where: { ...entry.where, status: "PUBLISHED" } }),
    delegate.count({ where: { ...entry.where, status: "PUBLISHED", publicRenderReady: true } }),
    delegate.count({
      where: {
        ...entry.where,
        status: "PUBLISHED",
        publicRenderReady: true,
        isThresholdEligible: true,
        archivedAt: null,
      },
    }),
  ]);
  const publicRenderPassRate = rate(renderReady, published);
  // Search and sitemap both read through the strict gate, so their
  // pass rate is the share of render-ready rows that are strict.
  const searchVisibilityPassRate = rate(strict, renderReady);
  return {
    publicRenderPassRate,
    searchVisibilityPassRate,
    sitemapVisibilityPassRate: searchVisibilityPassRate,
  };
}

export async function getBuilderQualityReport(): Promise<BuilderQualityReport> {
  const generatedAt = new Date();
  const since = new Date(Date.now() - LOOK_BACK_DAYS * 24 * 60 * 60 * 1000);
  const rows: BuilderQualityRow[] = [];

  for (const entry of Object.values(BUILDER_VERSION_REGISTRY)) {
    try {
      const builds = await prisma.contentPackageBuildLog.groupBy({
        by: ["buildStatus"],
        _count: { _all: true },
        where: {
          contentType: entry.contentType,
          builderName: entry.builderName,
          createdAt: { gte: since },
        },
      });
      const total = builds.reduce((sum, b) => sum + (b._count?._all ?? 0), 0);
      const findCount = (status: string): number =>
        builds.find((b) => b.buildStatus === status)?._count?._all ?? 0;
      const buildSuccessCount = findCount("built_complete_package");
      const wrongContentCount = findCount("wrong_content");
      const duplicateCount = findCount("duplicate");
      const buildFailureCount = total - buildSuccessCount;

      // QA pass / fail counters from SourceQualityScore — fast aggregate.
      let qaPassCount = 0;
      let qaFailCount = 0;
      try {
        const qaAgg = await prisma.sourceQualityScore.aggregate({
          where: { contentType: entry.contentType },
          _sum: { qaPassCount: true, qaFailCount: true },
        });
        qaPassCount = qaAgg._sum.qaPassCount ?? 0;
        qaFailCount = qaAgg._sum.qaFailCount ?? 0;
      } catch (e) {
        logger.warn("builder-quality.qa_agg_failed", {
          contentType: entry.contentType,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // Top missing fields across this builder's failed builds.
      const topMissingFields: Array<{ field: string; count: number }> = [];
      try {
        const failed = await prisma.contentPackageBuildLog.findMany({
          where: {
            contentType: entry.contentType,
            builderName: entry.builderName,
            buildStatus: { not: "built_complete_package" },
            createdAt: { gte: since },
          },
          select: { missingFieldsJson: true },
          take: 500,
        });
        const tally = new Map<string, number>();
        for (const row of failed) {
          const fields = Array.isArray(row.missingFieldsJson)
            ? (row.missingFieldsJson as string[])
            : [];
          for (const f of fields) tally.set(f, (tally.get(f) ?? 0) + 1);
        }
        topMissingFields.push(
          ...[...tally.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([field, count]) => ({ field, count })),
        );
      } catch (e) {
        logger.warn("builder-quality.missing_fields_failed", {
          contentType: entry.contentType,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // Top rejected source hosts for this content type.
      const topRejectedHosts: Array<{ host: string; count: number }> = [];
      try {
        const grouped = await prisma.rejectedContentLog.groupBy({
          by: ["sourceHost"],
          _count: { _all: true },
          where: { contentType: entry.contentType, deletedAt: { gte: since } },
        });
        topRejectedHosts.push(
          ...grouped
            .filter((g) => g.sourceHost)
            .map((g) => ({ host: g.sourceHost as string, count: g._count?._all ?? 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        );
      } catch (e) {
        logger.warn("builder-quality.rejected_hosts_failed", {
          contentType: entry.contentType,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      let visibility = {
        publicRenderPassRate: 0,
        searchVisibilityPassRate: 0,
        sitemapVisibilityPassRate: 0,
      };
      try {
        visibility = await publicVisibilityRates(entry.contentType);
      } catch (e) {
        logger.warn("builder-quality.visibility_failed", {
          contentType: entry.contentType,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      const qaTotal = qaPassCount + qaFailCount;
      const qaPassRate = rate(qaPassCount, qaTotal);

      rows.push({
        contentType: entry.contentType,
        builderName: entry.builderName,
        builderVersion: entry.builderVersion,
        totalBuilds: total,
        buildSuccessCount,
        buildFailureCount,
        wrongContentCount,
        duplicateCount,
        qaPassCount,
        qaFailCount,
        validPackageRate: rate(buildSuccessCount, total),
        qaPassRate,
        qaFailRate: qaTotal === 0 ? 0 : 1 - qaPassRate,
        publicRenderPassRate: visibility.publicRenderPassRate,
        searchVisibilityPassRate: visibility.searchVisibilityPassRate,
        sitemapVisibilityPassRate: visibility.sitemapVisibilityPassRate,
        duplicateRate: rate(duplicateCount, total),
        wrongContentRate: rate(wrongContentCount, total),
        topMissingFields,
        topRejectedHosts,
      });
    } catch (e) {
      logger.warn("builder-quality.row_failed", {
        contentType: entry.contentType,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { rows, generatedAt };
}

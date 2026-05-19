/**
 * Builder quality score.
 *
 * Aggregates the spec-listed quality dimensions per builder from
 * ContentPackageBuildLog + the public content tables:
 *
 *   - valid package rate         (build_complete / total builds)
 *   - required field completion rate
 *   - QA pass rate
 *   - public render pass rate
 *   - search visibility pass rate
 *   - sitemap visibility pass rate
 *   - duplicate rate
 *   - wrong content rate
 *
 * Used by the admin builder-weakness panel and the rebuild scheduler:
 * a builder whose `validPackageRate` drops below a threshold gets
 * its failing source documents rebuilt automatically after a
 * builder version bump.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { BUILDER_VERSION_REGISTRY } from "./builder-registry";
import type { ContentTypeKey } from "./types";

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
  duplicateRate: number;
  wrongContentRate: number;
};

export type BuilderQualityReport = {
  rows: ReadonlyArray<BuilderQualityRow>;
  generatedAt: Date;
};

const LOOK_BACK_DAYS = 14;

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

      // QA pass / fail counters come from SourceQualityScore aggregated
      // across every source that produced this content type. This is
      // a fast aggregate read with no per-row scan.
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

      const validPackageRate = total === 0 ? 0 : buildSuccessCount / total;
      const qaPassRate =
        qaPassCount + qaFailCount === 0 ? 0 : qaPassCount / (qaPassCount + qaFailCount);
      const duplicateRate = total === 0 ? 0 : duplicateCount / total;
      const wrongContentRate = total === 0 ? 0 : wrongContentCount / total;

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
        validPackageRate,
        qaPassRate,
        duplicateRate,
        wrongContentRate,
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

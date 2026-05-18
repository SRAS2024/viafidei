/**
 * Rebuild stale packages scheduled job.
 *
 * Finds SourceDocuments whose most recent ContentPackageBuildLog was
 * produced at an OLDER builderVersion than the current one and
 * enqueues a fresh content_build job for each (sourceDocumentId,
 * contentType) pair.
 *
 * This is the automatic mechanism the spec calls for when a builder
 * version is bumped — failed or stale builds should be retried
 * without admin intervention.
 *
 * The rebuild enqueue is gated by the same `buildEligibility`
 * predicate as the normal source_fetch → content_build chain, so a
 * second pass after a bump cannot re-enqueue duplicate work.
 */

import { logger } from "../../observability/logger";
import { prisma } from "../../db/client";
import { BUILDER_REGISTRY } from "../../content-factory";
import type { ContentTypeKey } from "../../content-factory";
import { enqueueContentBuildsForSourceDocument } from "./build-enqueue";

export type RebuildStalePackagesReport = {
  scanned: number;
  rebuildsEnqueued: number;
  skipped: number;
  errors: string[];
};

/**
 * Per-content-type max number of build logs to inspect each run. The
 * job is intentionally bounded so a deploy after a builder bump
 * doesn't enqueue thousands of jobs in one tick — subsequent runs
 * pick up the rest.
 */
const DEFAULT_PER_TYPE_LIMIT = 200;

export type RebuildOptions = {
  /** Override the scan window for testing. Defaults to last 30 days. */
  windowMs?: number;
  /** Cap on logs scanned per content type per run. */
  perTypeLimit?: number;
};

export async function runRebuildStalePackages(
  options: RebuildOptions = {},
): Promise<RebuildStalePackagesReport> {
  const windowMs = options.windowMs ?? 30 * 24 * 60 * 60 * 1000;
  const perTypeLimit = options.perTypeLimit ?? DEFAULT_PER_TYPE_LIMIT;
  const cutoff = new Date(Date.now() - windowMs);
  const report: RebuildStalePackagesReport = {
    scanned: 0,
    rebuildsEnqueued: 0,
    skipped: 0,
    errors: [],
  };

  for (const [contentType, builder] of Object.entries(BUILDER_REGISTRY) as Array<
    [ContentTypeKey, (typeof BUILDER_REGISTRY)[ContentTypeKey]]
  >) {
    const currentVersion = builder.builderVersion;
    const logs = await prisma.contentPackageBuildLog
      .findMany({
        where: {
          contentType,
          createdAt: { gt: cutoff },
          // We're looking at the latest log per source doc; the
          // dedupe happens at enqueue time so we can be liberal here.
          NOT: { sourceDocumentId: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          sourceDocumentId: true,
          sourceUrl: true,
          sourceHost: true,
          builderVersion: true,
        },
        take: perTypeLimit,
      })
      .catch((e) => {
        report.errors.push(`build log read failed: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      });
    const seen = new Set<string>();
    for (const row of logs) {
      if (!row.sourceDocumentId) continue;
      if (seen.has(row.sourceDocumentId)) continue;
      seen.add(row.sourceDocumentId);
      report.scanned += 1;
      // Only rebuild when the builder version has changed.
      if (row.builderVersion === currentVersion) {
        report.skipped += 1;
        continue;
      }
      // Read the SourceDocument and its source for build eligibility.
      const doc = await prisma.sourceDocument
        .findUnique({
          where: { id: row.sourceDocumentId },
          select: {
            id: true,
            sourceUrl: true,
            sourceHost: true,
            contentChecksum: true,
            sourceId: true,
          },
        })
        .catch(() => null);
      if (!doc) {
        report.skipped += 1;
        continue;
      }
      const source = doc.sourceId
        ? await prisma.ingestionSource.findUnique({ where: { id: doc.sourceId } }).catch(() => null)
        : null;
      try {
        const result = await enqueueContentBuildsForSourceDocument({
          sourceDocumentId: doc.id,
          sourceUrl: doc.sourceUrl,
          sourceHost: doc.sourceHost,
          contentChecksum: doc.contentChecksum ?? null,
          source: source
            ? {
                id: source.id,
                canIngestPrayers: source.canIngestPrayers,
                canIngestSaints: source.canIngestSaints,
                canIngestApparitions: source.canIngestApparitions,
                canIngestParishes: source.canIngestParishes,
                canIngestDevotions: source.canIngestDevotions,
                canIngestNovenas: source.canIngestNovenas,
                canIngestSacraments: source.canIngestSacraments,
                canIngestRosaryGuides: source.canIngestRosaryGuides,
                canIngestConsecrations: source.canIngestConsecrations,
                canIngestSpiritualGuides: source.canIngestSpiritualGuides,
                canIngestLiturgy: source.canIngestLiturgy,
                canIngestHistory: source.canIngestHistory,
                canProvideScriptureText: source.canProvideScriptureText,
              }
            : null,
          requestedContentType: contentType,
          triggeredBy: "automatic",
        });
        report.rebuildsEnqueued += result.enqueuedCount;
      } catch (e) {
        report.errors.push(
          `rebuild enqueue failed for ${contentType}/${doc.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
  logger.info("rebuild-stale-packages.completed", {
    scanned: report.scanned,
    rebuildsEnqueued: report.rebuildsEnqueued,
    skipped: report.skipped,
    errors: report.errors.length,
  });
  return report;
}

/**
 * Source job repair.
 *
 * Many factory-ready sources can sit with zero active queue jobs —
 * nothing discovers their URLs, so the whole pipeline starves. This
 * repair scans factory-ready sources and enqueues a missing
 * `source_discovery` job for any source that has no active queue
 * work.
 *
 * It respects paused / not_configured sources and per-source daily
 * caps, and is idempotent: a source that already has an active job
 * is skipped, and a stable dedupe key prevents a double enqueue.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { enqueueJob } from "./queue";

export type SourceJobRepairReport = {
  generatedAt: Date;
  factoryReadySources: number;
  sourcesWithActiveJobs: number;
  sourcesWithZeroJobs: number;
  discoveryJobsCreated: number;
  skippedPaused: number;
  skippedNotConfigured: number;
  skippedDailyCapReached: number;
  errors: string[];
};

const ACTIVE_QUEUE_STATUSES = ["pending", "retrying", "running"];

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function runSourceJobRepair(
  options: { limit?: number; triggeredBy?: "automatic" | "manual" } = {},
): Promise<SourceJobRepairReport> {
  const report: SourceJobRepairReport = {
    generatedAt: new Date(),
    factoryReadySources: 0,
    sourcesWithActiveJobs: 0,
    sourcesWithZeroJobs: 0,
    discoveryJobsCreated: 0,
    skippedPaused: 0,
    skippedNotConfigured: 0,
    skippedDailyCapReached: 0,
    errors: [],
  };
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const triggeredBy = options.triggeredBy ?? "automatic";

  type SourceRow = {
    id: string;
    host: string;
    pausedAt: Date | null;
    configurationStatus: string | null;
    discoveryFeedUrl: string | null;
    dailyCap: number | null;
    role: string;
    buildLimitPerRun: number | null;
    canIngestPrayers: boolean;
    canIngestSaints: boolean;
    canIngestApparitions: boolean;
    canIngestParishes: boolean;
    canIngestDevotions: boolean;
    canIngestNovenas: boolean;
    canIngestSacraments: boolean;
    canIngestRosaryGuides: boolean;
    canIngestConsecrations: boolean;
    canIngestLiturgy: boolean;
    canIngestHistory: boolean;
  };
  let sources: SourceRow[] = [];
  try {
    sources = (await prisma.ingestionSource.findMany({
      where: {
        isActive: true,
        // Source-job-repair only enqueues discovery for primary content
        // sources (spec #6). Validation / enrichment / discovery-only
        // sources are used inside cross-source evidence and must not
        // be repaired into the primary build pipeline.
        role: "primary_content_source",
      },
      select: {
        id: true,
        host: true,
        pausedAt: true,
        configurationStatus: true,
        discoveryFeedUrl: true,
        dailyCap: true,
        role: true,
        buildLimitPerRun: true,
        canIngestPrayers: true,
        canIngestSaints: true,
        canIngestApparitions: true,
        canIngestParishes: true,
        canIngestDevotions: true,
        canIngestNovenas: true,
        canIngestSacraments: true,
        canIngestRosaryGuides: true,
        canIngestConsecrations: true,
        canIngestLiturgy: true,
        canIngestHistory: true,
      },
      take: 1000,
    })) as unknown as SourceRow[];
  } catch (e) {
    report.errors.push(`source read: ${e instanceof Error ? e.message : String(e)}`);
    return report;
  }

  const dayStart = startOfUtcDay(report.generatedAt);
  // Mapping from source purpose flag → ContentTypeKey. Per-content-type
  // discovery jobs let the build router use the type as a strong
  // signal AND let the dedupe key separate one source's parallel
  // discoveries instead of collapsing them.
  const PURPOSE_TO_CONTENT_TYPE: ReadonlyArray<{ flag: keyof SourceRow; type: string }> = [
    { flag: "canIngestPrayers", type: "Prayer" },
    { flag: "canIngestSaints", type: "Saint" },
    { flag: "canIngestApparitions", type: "MarianApparition" },
    { flag: "canIngestParishes", type: "Parish" },
    { flag: "canIngestDevotions", type: "Devotion" },
    { flag: "canIngestNovenas", type: "Novena" },
    { flag: "canIngestSacraments", type: "Sacrament" },
    { flag: "canIngestRosaryGuides", type: "Rosary" },
    { flag: "canIngestConsecrations", type: "Consecration" },
    { flag: "canIngestLiturgy", type: "Liturgy" },
    { flag: "canIngestHistory", type: "History" },
  ];

  for (const source of sources) {
    // Respect paused sources.
    if (source.pausedAt) {
      report.skippedPaused += 1;
      continue;
    }
    // Respect not_configured sources / sources with no discovery feed —
    // `runSourceDiscovery` hard-fails without a discoveryFeedUrl.
    if (source.configurationStatus === "not_configured" || !source.discoveryFeedUrl) {
      report.skippedNotConfigured += 1;
      continue;
    }
    // Spec #6: a source with buildLimitPerRun === 0 cannot produce
    // primary content — skip even though the registry might still
    // label it primary_content_source. (Belt-and-braces; the source
    // query already filters by role.)
    if (source.buildLimitPerRun === 0) {
      report.skippedNotConfigured += 1;
      continue;
    }
    report.factoryReadySources += 1;

    let activeJobCount = 0;
    try {
      activeJobCount = await prisma.ingestionJobQueue.count({
        where: { sourceId: source.id, status: { in: ACTIVE_QUEUE_STATUSES } },
      });
    } catch (e) {
      report.errors.push(
        `active job count ${source.host}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    if (activeJobCount > 0) {
      report.sourcesWithActiveJobs += 1;
      continue;
    }
    report.sourcesWithZeroJobs += 1;

    // Respect per-source daily caps.
    if (source.dailyCap != null) {
      try {
        const counter = await prisma.dailyIngestionCounter.findFirst({
          where: { sourceId: source.id, contentType: null, day: { gte: dayStart } },
          select: { enqueued: true },
        });
        if (counter && counter.enqueued >= source.dailyCap) {
          report.skippedDailyCapReached += 1;
          continue;
        }
      } catch {
        // A daily-cap read failure must not block the repair.
      }
    }

    // Enqueue one discovery job per supported primary content type
    // rather than one untyped job. This:
    //   - lets the dispatcher pass the content type into
    //     factory-native discovery (positive URL rules)
    //   - lets build-enqueue use the content type as a strong signal
    //   - separates dedupe keys so a source with three content types
    //     gets three concurrent discoveries, not one that crowds out
    //     the others.
    const supportedTypes: string[] = [];
    for (const { flag, type } of PURPOSE_TO_CONTENT_TYPE) {
      if (source[flag] === true) supportedTypes.push(type);
    }
    if (supportedTypes.length === 0) {
      // Primary source with no purpose flags — treat as misconfigured.
      report.skippedNotConfigured += 1;
      continue;
    }

    for (const contentType of supportedTypes) {
      if (report.discoveryJobsCreated >= limit) break;
      try {
        await enqueueJob({
          jobName: `source-job-repair:${source.host}:${contentType}`,
          jobKind: "source_discovery",
          dedupeKey: `source_job_repair:${source.id}:${contentType}`,
          sourceId: source.id,
          contentType,
          payload: {
            sourceId: source.id,
            adapterKey: `factory-native:${source.host}`,
            contentType,
            mode: "constant",
          },
          triggeredBy,
        });
        report.discoveryJobsCreated += 1;
        logger.info("source-job-repair.discovery_job_created", {
          sourceId: source.id,
          host: source.host,
          contentType,
        });
      } catch (e) {
        report.errors.push(
          `enqueue ${source.host}:${contentType}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  logger.info("source-job-repair.completed", {
    factoryReadySources: report.factoryReadySources,
    sourcesWithZeroJobs: report.sourcesWithZeroJobs,
    discoveryJobsCreated: report.discoveryJobsCreated,
    skippedPaused: report.skippedPaused,
    skippedNotConfigured: report.skippedNotConfigured,
    skippedDailyCapReached: report.skippedDailyCapReached,
    errors: report.errors.length,
  });
  return report;
}

export type SourceJobCoverage = {
  factoryReadySources: number;
  sourcesWithZeroJobs: number;
  /** Fraction (0..1) of factory-ready sources with no active queue job. */
  zeroJobRatio: number;
};

/**
 * Read-only coverage check: how many factory-ready sources currently
 * have zero active queue jobs. Used by production readiness to warn
 * when source job coverage has degraded — never enqueues anything.
 */
export async function getSourceJobCoverage(): Promise<SourceJobCoverage> {
  try {
    const sources = await prisma.ingestionSource.findMany({
      where: {
        isActive: true,
        pausedAt: null,
        discoveryFeedUrl: { not: null },
        configurationStatus: { not: "not_configured" },
      },
      select: { id: true },
      take: 1000,
    });
    const activeGroups = await prisma.ingestionJobQueue.groupBy({
      by: ["sourceId"],
      where: { status: { in: ACTIVE_QUEUE_STATUSES }, sourceId: { not: null } },
    });
    const withActiveJobs = new Set(
      activeGroups.map((g) => g.sourceId).filter((id): id is string => typeof id === "string"),
    );
    const zeroJob = sources.filter((s) => !withActiveJobs.has(s.id)).length;
    return {
      factoryReadySources: sources.length,
      sourcesWithZeroJobs: zeroJob,
      zeroJobRatio: sources.length > 0 ? zeroJob / sources.length : 0,
    };
  } catch (e) {
    logger.warn("source-job-repair.coverage_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { factoryReadySources: 0, sourcesWithZeroJobs: 0, zeroJobRatio: 0 };
  }
}

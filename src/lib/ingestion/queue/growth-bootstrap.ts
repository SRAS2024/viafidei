/**
 * Content growth bootstrap.
 *
 * When the catalog has little or no public content, the bootstrap
 * kicks the pipeline awake: it enqueues a first wave of
 * `source_discovery` jobs for the priority content types, best
 * configured sources first.
 *
 * It is deliberately conservative — it caps the number of jobs it
 * enqueues per run so it can never flood the queue, skips any
 * content type that already has active discovery flow, and never
 * activates the same source twice in one run.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { enqueueJob, countQueueByStatus } from "./queue";

/** Priority order — Prayers first, Parishes last. */
const PRIORITY_CONTENT_TYPES: ReadonlyArray<{ contentType: string; flag: string }> = [
  { contentType: "Prayer", flag: "canIngestPrayers" },
  { contentType: "Saint", flag: "canIngestSaints" },
  { contentType: "Sacrament", flag: "canIngestSacraments" },
  { contentType: "Devotion", flag: "canIngestDevotions" },
  { contentType: "Novena", flag: "canIngestNovenas" },
  { contentType: "Rosary", flag: "canIngestRosaryGuides" },
  { contentType: "Consecration", flag: "canIngestConsecrations" },
  { contentType: "Liturgy", flag: "canIngestLiturgy" },
  { contentType: "History", flag: "canIngestHistory" },
  { contentType: "Parish", flag: "canIngestParishes" },
];

const DEFAULT_MAX_JOBS = 30;
const MAX_SOURCES_PER_TYPE = 3;
const QUEUE_OVERLOAD_THRESHOLD = 500;
const ACTIVE_QUEUE_STATUSES = ["pending", "retrying", "running"];

type BootstrapSource = {
  id: string;
  host: string;
  tier: number;
  reliabilityScore: number | null;
  flags: Record<string, boolean>;
};

export type GrowthBootstrapReport = {
  generatedAt: Date;
  ranBootstrap: boolean;
  skippedReason: string | null;
  contentTypesProcessed: string[];
  discoveryJobsCreated: number;
  sourcesActivated: Array<{ contentType: string; sourceId: string; host: string }>;
  errors: string[];
};

export async function runGrowthBootstrap(
  options: { maxJobs?: number; triggeredBy?: "automatic" | "manual"; jobQueueId?: string } = {},
): Promise<GrowthBootstrapReport> {
  const report: GrowthBootstrapReport = {
    generatedAt: new Date(),
    ranBootstrap: false,
    skippedReason: null,
    contentTypesProcessed: [],
    discoveryJobsCreated: 0,
    sourcesActivated: [],
    errors: [],
  };
  const maxJobs = Math.max(1, Math.min(options.maxJobs ?? DEFAULT_MAX_JOBS, 200));
  const triggeredBy = options.triggeredBy ?? "automatic";

  // Never flood an already-busy queue.
  try {
    const counts = await countQueueByStatus();
    if (counts.pending + counts.retrying > QUEUE_OVERLOAD_THRESHOLD) {
      report.skippedReason = "queue_overloaded";
      logger.info("growth-bootstrap.skipped", { reason: "queue_overloaded" });
      return report;
    }
  } catch (e) {
    report.errors.push(`queue count: ${e instanceof Error ? e.message : String(e)}`);
  }

  let sources: BootstrapSource[] = [];
  try {
    const rows = await prisma.ingestionSource.findMany({
      where: {
        isActive: true,
        pausedAt: null,
        discoveryFeedUrl: { not: null },
        configurationStatus: { not: "not_configured" },
      },
      select: {
        id: true,
        host: true,
        tier: true,
        reliabilityScore: true,
        canIngestPrayers: true,
        canIngestSaints: true,
        canIngestSacraments: true,
        canIngestDevotions: true,
        canIngestNovenas: true,
        canIngestRosaryGuides: true,
        canIngestConsecrations: true,
        canIngestLiturgy: true,
        canIngestHistory: true,
        canIngestParishes: true,
      },
      take: 1000,
    });
    sources = rows.map((r) => ({
      id: r.id,
      host: r.host,
      tier: r.tier,
      reliabilityScore: r.reliabilityScore,
      flags: {
        canIngestPrayers: r.canIngestPrayers,
        canIngestSaints: r.canIngestSaints,
        canIngestSacraments: r.canIngestSacraments,
        canIngestDevotions: r.canIngestDevotions,
        canIngestNovenas: r.canIngestNovenas,
        canIngestRosaryGuides: r.canIngestRosaryGuides,
        canIngestConsecrations: r.canIngestConsecrations,
        canIngestLiturgy: r.canIngestLiturgy,
        canIngestHistory: r.canIngestHistory,
        canIngestParishes: r.canIngestParishes,
      },
    }));
  } catch (e) {
    report.errors.push(`source read: ${e instanceof Error ? e.message : String(e)}`);
    return report;
  }

  if (sources.length === 0) {
    report.skippedReason = "no_configured_sources";
    return report;
  }

  // Best sources first: lowest tier number, then highest reliability.
  sources.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0);
  });

  report.ranBootstrap = true;
  const activatedSourceIds = new Set<string>();

  for (const { contentType, flag } of PRIORITY_CONTENT_TYPES) {
    if (report.discoveryJobsCreated >= maxJobs) break;
    report.contentTypesProcessed.push(contentType);

    // Skip a content type that already has active discovery flow.
    let activeForType = 0;
    try {
      activeForType = await prisma.ingestionJobQueue.count({
        where: { contentType, status: { in: ACTIVE_QUEUE_STATUSES } },
      });
    } catch {
      // Treat a count failure as "no active flow" and proceed.
    }
    if (activeForType > 0) continue;

    const candidates = sources.filter(
      (s) => s.flags[flag] === true && !activatedSourceIds.has(s.id),
    );
    let activatedForType = 0;
    for (const source of candidates) {
      if (activatedForType >= MAX_SOURCES_PER_TYPE) break;
      if (report.discoveryJobsCreated >= maxJobs) break;

      // Skip a source that already has an active queue job.
      let activeJobCount = 0;
      try {
        activeJobCount = await prisma.ingestionJobQueue.count({
          where: { sourceId: source.id, status: { in: ACTIVE_QUEUE_STATUSES } },
        });
      } catch {
        // Treat a count failure as "no active job" and proceed.
      }
      if (activeJobCount > 0) {
        activatedSourceIds.add(source.id);
        continue;
      }

      try {
        await enqueueJob({
          jobName: `growth-bootstrap:${source.host}`,
          jobKind: "source_discovery",
          dedupeKey: `growth_bootstrap:${source.id}`,
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
        activatedSourceIds.add(source.id);
        activatedForType += 1;
        report.discoveryJobsCreated += 1;
        report.sourcesActivated.push({ contentType, sourceId: source.id, host: source.host });
        logger.info("growth-bootstrap.source_activated", {
          contentType,
          sourceId: source.id,
          host: source.host,
        });
      } catch (e) {
        report.errors.push(`enqueue ${source.host}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  logger.info("growth-bootstrap.completed", {
    jobQueueId: options.jobQueueId ?? null,
    discoveryJobsCreated: report.discoveryJobsCreated,
    contentTypesProcessed: report.contentTypesProcessed.length,
    errors: report.errors.length,
  });
  return report;
}

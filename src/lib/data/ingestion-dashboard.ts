/**
 * Read-side helpers powering the admin dashboards:
 *
 *   - Source Health  — active / stale / failing / blocked / exhausted /
 *                       low quality counts and per-source detail rows.
 *   - Content Type Progress — current count vs target, percent
 *                              complete, last successful ingestion,
 *                              last update, failed source count,
 *                              review queue count.
 *   - Queue Health  — pending / running / completed / failed / skipped /
 *                      retrying counts and the most recent failures.
 *
 * These functions are pure SELECTs and safe to call from server-only
 * page handlers. None of them mutate state.
 */

import { prisma } from "../db/client";
import { appConfig } from "../config";
import {
  CHURCH_DOCUMENT_SLUG_PREFIXES,
  CONSECRATION_SLUG_PREFIXES,
  SACRAMENT_SLUG_PREFIXES,
} from "../ingestion/backlog-prefixes";
import { countQueueByStatus, type QueueStatus } from "../ingestion/queue/queue";

function buildPrefixWhere(prefixes: readonly string[]) {
  return { OR: prefixes.map((p) => ({ slug: { startsWith: p } })) };
}

export type ContentProgressRow = {
  key: string;
  label: string;
  currentCount: number;
  target: number;
  percentComplete: number;
  lastSuccessfulIngestion: Date | null;
  lastContentUpdate: Date | null;
  failedSourceCount: number;
  reviewQueueCount: number;
};

export async function getContentProgressDashboard(): Promise<ContentProgressRow[]> {
  const targets = appConfig.ingestion.targets;
  const [prayers, saints, parishes, churchDocs, sacraments, consecrations] = await Promise.all([
    prisma.prayer.count(),
    prisma.saint.count(),
    prisma.parish.count(),
    prisma.liturgyEntry.count({ where: buildPrefixWhere(CHURCH_DOCUMENT_SLUG_PREFIXES) }),
    prisma.spiritualLifeGuide.count({ where: buildPrefixWhere(SACRAMENT_SLUG_PREFIXES) }),
    prisma.spiritualLifeGuide.count({ where: buildPrefixWhere(CONSECRATION_SLUG_PREFIXES) }),
  ]);

  // For each content type, find the most recent successful ingestion run
  // and the most recent detected upstream update (lastContentUpdateAt
  // on the source).
  const lastSuccessfulRuns = await prisma.ingestionJobRun.groupBy({
    by: ["jobId"],
    where: { status: "SUCCESS" },
    _max: { finishedAt: true },
  });
  const mostRecentRunPerJob = new Map(lastSuccessfulRuns.map((r) => [r.jobId, r._max.finishedAt]));

  const jobs = await prisma.ingestionJob.findMany({
    include: { source: true },
  });

  // Match jobs to content buckets via the targetEntity column.
  function lastRunForEntity(entity: string): Date | null {
    let latest: Date | null = null;
    for (const j of jobs) {
      if (j.targetEntity !== entity) continue;
      const runFinished = mostRecentRunPerJob.get(j.id);
      if (runFinished && (!latest || runFinished > latest)) latest = runFinished;
    }
    return latest;
  }
  function lastContentUpdateForEntity(entity: string): Date | null {
    let latest: Date | null = null;
    for (const j of jobs) {
      if (j.targetEntity !== entity) continue;
      const updateTs = j.source.lastContentUpdateAt;
      if (updateTs && (!latest || updateTs > latest)) latest = updateTs;
    }
    return latest;
  }
  function failedSourceCountForEntity(entity: string): number {
    return jobs.filter(
      (j) =>
        j.targetEntity === entity &&
        (j.source.healthState === "failing" || j.source.healthState === "blocked"),
    ).length;
  }

  const [
    reviewPrayers,
    reviewSaints,
    reviewParishes,
    reviewChurchDocs,
    reviewSacraments,
    reviewConsecrations,
  ] = await Promise.all([
    prisma.prayer.count({ where: { status: "REVIEW" } }),
    prisma.saint.count({ where: { status: "REVIEW" } }),
    prisma.parish.count({ where: { status: "REVIEW" } }),
    prisma.liturgyEntry.count({
      where: { status: "REVIEW", ...buildPrefixWhere(CHURCH_DOCUMENT_SLUG_PREFIXES) },
    }),
    prisma.spiritualLifeGuide.count({
      where: { status: "REVIEW", ...buildPrefixWhere(SACRAMENT_SLUG_PREFIXES) },
    }),
    prisma.spiritualLifeGuide.count({
      where: { status: "REVIEW", ...buildPrefixWhere(CONSECRATION_SLUG_PREFIXES) },
    }),
  ]);

  function row(
    key: string,
    label: string,
    currentCount: number,
    target: number,
    entity: string,
    reviewQueueCount: number,
  ): ContentProgressRow {
    return {
      key,
      label,
      currentCount,
      target,
      percentComplete: target > 0 ? Math.round((currentCount / target) * 1000) / 10 : 0,
      lastSuccessfulIngestion: lastRunForEntity(entity),
      lastContentUpdate: lastContentUpdateForEntity(entity),
      failedSourceCount: failedSourceCountForEntity(entity),
      reviewQueueCount,
    };
  }

  return [
    row("prayers", "Prayers", prayers, targets.prayers, "Prayer", reviewPrayers),
    row("saints", "Saints", saints, targets.saints, "Saint", reviewSaints),
    row("parishes", "Parishes", parishes, targets.parishes, "Parish", reviewParishes),
    row(
      "churchDocuments",
      "Church Documents",
      churchDocs,
      targets.churchDocuments,
      "LiturgyEntry",
      reviewChurchDocs,
    ),
    row(
      "sacraments",
      "Sacraments",
      sacraments,
      targets.sacraments,
      "SpiritualLifeGuide",
      reviewSacraments,
    ),
    row(
      "consecrations",
      "Consecrations",
      consecrations,
      targets.consecrations,
      "SpiritualLifeGuide",
      reviewConsecrations,
    ),
  ];
}

export type QueueDashboard = {
  counts: Record<QueueStatus, number>;
  failedNeedingReview: Array<{
    id: string;
    jobName: string;
    contentType: string | null;
    attempts: number;
    maxAttempts: number;
    errorMessage: string | null;
    sentToReviewAt: Date | null;
    finishedAt: Date | null;
  }>;
  recentRetrying: Array<{
    id: string;
    jobName: string;
    runAt: Date;
    attempts: number;
    lastError: string | null;
  }>;
};

export async function getQueueDashboard(): Promise<QueueDashboard> {
  const counts = await countQueueByStatus();
  const failed = await prisma.ingestionJobQueue.findMany({
    where: { status: "failed", sentToReviewAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    take: 25,
  });
  const retrying = await prisma.ingestionJobQueue.findMany({
    where: { status: "retrying" },
    orderBy: { runAt: "asc" },
    take: 25,
  });
  return {
    counts,
    failedNeedingReview: failed.map((f) => ({
      id: f.id,
      jobName: f.jobName,
      contentType: f.contentType,
      attempts: f.attempts,
      maxAttempts: f.maxAttempts,
      errorMessage: f.errorMessage,
      sentToReviewAt: f.sentToReviewAt,
      finishedAt: f.finishedAt,
    })),
    recentRetrying: retrying.map((r) => ({
      id: r.id,
      jobName: r.jobName,
      runAt: r.runAt,
      attempts: r.attempts,
      lastError: r.lastError,
    })),
  };
}

export type ModeDashboard = {
  mode: "constant" | "maintenance";
  dbError: boolean;
  reason: string;
  errorMessage?: string;
};

/**
 * Single source of truth for the admin "constant vs maintenance" badge.
 * The dashboard route consumes this. We deliberately do not call
 * `getBacklogProgress` here — that lives in the ingestion subgraph
 * which pulls node:crypto into the bundle through the runner. We
 * inline the same shape so admin pages remain decoupled.
 */
export async function getSchedulerModeStatus(): Promise<ModeDashboard> {
  const targets = appConfig.ingestion.targets;
  try {
    const [prayers, saints, parishes, churchDocs, sacraments, consecrations] = await Promise.all([
      prisma.prayer.count(),
      prisma.saint.count(),
      prisma.parish.count(),
      prisma.liturgyEntry.count({ where: buildPrefixWhere(CHURCH_DOCUMENT_SLUG_PREFIXES) }),
      prisma.spiritualLifeGuide.count({ where: buildPrefixWhere(SACRAMENT_SLUG_PREFIXES) }),
      prisma.spiritualLifeGuide.count({ where: buildPrefixWhere(CONSECRATION_SLUG_PREFIXES) }),
    ]);
    const metAll =
      prayers >= targets.prayers &&
      saints >= targets.saints &&
      parishes >= targets.parishes &&
      churchDocs >= targets.churchDocuments &&
      sacraments >= targets.sacraments &&
      consecrations >= targets.consecrations;
    return {
      mode: metAll ? "maintenance" : "constant",
      dbError: false,
      reason: metAll ? "All content targets met" : "At least one content target unmet",
    };
  } catch (e) {
    return {
      mode: "constant",
      dbError: true,
      reason: "Database error while checking content totals — staying in CONSTANT mode",
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

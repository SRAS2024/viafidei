import { appConfig } from "../config";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { getAdapter } from "./registry";
import { runAdapter, type RunnerOptions } from "./runner";
import type { IngestionRunSummary } from "./types";
import {
  CHURCH_DOCUMENT_SLUG_PREFIXES,
  CONSECRATION_SLUG_PREFIXES,
  SACRAMENT_SLUG_PREFIXES,
} from "./backlog-prefixes";

// Re-export so existing call sites that depend on these constants
// being available from the scheduler module continue to work. The
// admin notifications dispatcher imports them from
// `./backlog-prefixes` directly because the scheduler module pulls
// `node:crypto` into the bundle through the runner.
export { CHURCH_DOCUMENT_SLUG_PREFIXES, SACRAMENT_SLUG_PREFIXES, CONSECRATION_SLUG_PREFIXES };

export type BacklogCounts = {
  prayers: number;
  saints: number;
  parishes: number;
  churchDocuments: number;
  sacraments: number;
  consecrations: number;
};

export type SchedulerMode = "constant" | "maintenance";

function buildPrefixWhere(prefixes: readonly string[]) {
  return { OR: prefixes.map((p) => ({ slug: { startsWith: p } })) };
}

async function countChurchDocuments(): Promise<number> {
  return prisma.liturgyEntry.count({
    where: buildPrefixWhere(CHURCH_DOCUMENT_SLUG_PREFIXES),
  });
}

async function countSacraments(): Promise<number> {
  return prisma.spiritualLifeGuide.count({
    where: buildPrefixWhere(SACRAMENT_SLUG_PREFIXES),
  });
}

async function countConsecrations(): Promise<number> {
  return prisma.spiritualLifeGuide.count({
    where: buildPrefixWhere(CONSECRATION_SLUG_PREFIXES),
  });
}

/**
 * Compute backlog progress with explicit error handling. When ANY
 * count throws (database unavailable, broken connection pool,
 * migration in progress), the scheduler MUST stay in constant mode
 * — entering maintenance on a DB error would silently let the
 * catalog go cold. The `dbError` flag tells the caller why the
 * decision was made so the admin notification path can fire a
 * "thresholds could not be checked" warning.
 */
export type BacklogProgressResult = {
  counts: BacklogCounts | null;
  targets: BacklogCounts;
  metAll: boolean;
  mode: SchedulerMode;
  dbError: boolean;
  errorMessage?: string;
};

/**
 * Returns the current content counts versus the configured ingestion
 * backlog targets, and the scheduler mode that should follow.
 *
 * - mode `constant`  → at least one target is unmet; keep ticking aggressively.
 * - mode `maintenance` → all minimums met; ingest only twice per week.
 *
 * Used internally to decide both whether to keep ticking and how to size
 * the next interval. Public pages never expose these numbers.
 */
export async function getBacklogProgress(): Promise<BacklogProgressResult> {
  const targets = appConfig.ingestion.targets;
  try {
    const [prayers, saints, parishes, churchDocuments, sacraments, consecrations] =
      await Promise.all([
        prisma.prayer.count(),
        prisma.saint.count(),
        prisma.parish.count(),
        countChurchDocuments(),
        countSacraments(),
        countConsecrations(),
      ]);
    const counts: BacklogCounts = {
      prayers,
      saints,
      parishes,
      churchDocuments,
      sacraments,
      consecrations,
    };
    const metAll =
      prayers >= targets.prayers &&
      saints >= targets.saints &&
      parishes >= targets.parishes &&
      churchDocuments >= targets.churchDocuments &&
      sacraments >= targets.sacraments &&
      consecrations >= targets.consecrations;
    const mode: SchedulerMode = metAll ? "maintenance" : "constant";
    return { counts, targets, metAll, mode, dbError: false };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    // We deliberately do NOT assume the catalog is full when counts
    // fail. A database error MUST keep the scheduler in constant mode
    // so an outage cannot silently turn ingestion off.
    logger.warn("ingestion.scheduler.backlog_progress_db_error", { errorMessage });
    return {
      counts: null,
      targets,
      metAll: false,
      mode: "constant",
      dbError: true,
      errorMessage,
    };
  }
}

export type SchedulerJobResult = {
  jobId: string;
  jobName: string;
  sourceHost: string;
  adapterFound: boolean;
  summary: IngestionRunSummary;
};

export type SchedulerSummary = {
  totalJobs: number;
  runs: SchedulerJobResult[];
};

export async function runAllActiveJobs(options: RunnerOptions = {}): Promise<SchedulerSummary> {
  const jobs = await prisma.ingestionJob.findMany({
    where: { isActive: true },
    include: { source: true },
  });

  logger.info("ingestion.scheduler.start", { totalJobs: jobs.length });

  const runs: SchedulerJobResult[] = [];
  for (const job of jobs) {
    const adapter = getAdapter(job.jobName);
    if (!adapter) {
      logger.warn("ingestion.scheduler.adapter_missing", {
        jobId: job.id,
        jobName: job.jobName,
        sourceHost: job.source.host,
      });
      runs.push({
        jobId: job.id,
        jobName: job.jobName,
        sourceHost: job.source.host,
        adapterFound: false,
        summary: {
          recordsSeen: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
          recordsReviewRequired: 0,
          errorMessage: `No registered adapter for job '${job.jobName}'`,
        },
      });
      continue;
    }
    const summary = await runAdapter(adapter, job.id, job.source.host, options);
    runs.push({
      jobId: job.id,
      jobName: job.jobName,
      sourceHost: job.source.host,
      adapterFound: true,
      summary,
    });
  }

  const totals = runs.reduce(
    (acc, r) => {
      acc.seen += r.summary.recordsSeen;
      acc.created += r.summary.recordsCreated;
      acc.updated += r.summary.recordsUpdated;
      acc.skipped += r.summary.recordsSkipped;
      acc.failed += r.summary.recordsFailed;
      acc.reviewRequired += r.summary.recordsReviewRequired;
      return acc;
    },
    { seen: 0, created: 0, updated: 0, skipped: 0, failed: 0, reviewRequired: 0 },
  );
  const progress = await getBacklogProgress().catch(() => null);
  logger.info("ingestion.scheduler.completed", {
    totalJobs: jobs.length,
    ...totals,
    backlog: progress,
    mode: progress?.mode ?? "constant",
    dbError: progress?.dbError ?? false,
  });

  return { totalJobs: jobs.length, runs };
}

export async function runJobByName(
  jobName: string,
  options: RunnerOptions = {},
): Promise<SchedulerJobResult | null> {
  const job = await prisma.ingestionJob.findFirst({
    where: { jobName, isActive: true },
    include: { source: true },
  });
  if (!job) {
    logger.warn("ingestion.scheduler.job_not_found", { jobName });
    return null;
  }

  const adapter = getAdapter(jobName);
  if (!adapter) {
    logger.warn("ingestion.scheduler.adapter_missing", {
      jobId: job.id,
      jobName,
      sourceHost: job.source.host,
    });
    return {
      jobId: job.id,
      jobName,
      sourceHost: job.source.host,
      adapterFound: false,
      summary: {
        recordsSeen: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 0,
        recordsReviewRequired: 0,
        errorMessage: `No registered adapter for job '${jobName}'`,
      },
    };
  }

  const summary = await runAdapter(adapter, job.id, job.source.host, options);
  return {
    jobId: job.id,
    jobName,
    sourceHost: job.source.host,
    adapterFound: true,
    summary,
  };
}

import { appConfig } from "../config";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { getAdapter } from "./registry";
import { runAdapter, type RunnerOptions } from "./runner";
import type { IngestionRunSummary } from "./types";

export type BacklogCounts = {
  prayers: number;
  saints: number;
  parishes: number;
  churchDocuments: number;
  sacraments: number;
  consecrations: number;
};

export type SchedulerMode = "constant" | "maintenance";

/**
 * Slug prefixes that identify a LiturgyEntry as a "church document" —
 * encyclicals, Catechism sections, Code of Canon Law books, and
 * Vatican Council documents. The encyclical seeds use `encyclical-`;
 * CCC seeds use `catechism-`; Canon Law seeds use `code-of-canon-law-`;
 * the Eastern Code is its own row; ingestion-produced Council documents
 * use `council-` (a slug the history crawler already emits).
 */
export const CHURCH_DOCUMENT_SLUG_PREFIXES = [
  "encyclical-",
  "catechism-",
  "code-of-canon-law-",
  "code-of-canons-of-the-eastern-churches",
  "council-",
  "vatican-council-",
  "synod-",
];

/**
 * Slug prefix for the seven Catholic sacraments — Baptism, Confirmation,
 * Eucharist, Reconciliation, Anointing of the Sick, Holy Orders,
 * Matrimony. Counted as its own bucket because the Catholic Church
 * teaches that there are exactly seven; including the consecrations
 * would inflate the count above the doctrinal number.
 */
export const SACRAMENT_SLUG_PREFIXES = ["sacrament-"];

/**
 * Slug prefix for personal consecrations (Marian, St Joseph, Holy
 * Family, Sacred Heart). Tracked as a separate bucket so the doctrinal
 * "seven sacraments" remains exact.
 */
export const CONSECRATION_SLUG_PREFIXES = ["consecration-"];

function buildPrefixWhere(prefixes: string[]) {
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
 * Returns the current content counts versus the configured ingestion
 * backlog targets, and the scheduler mode that should follow.
 *
 * - mode `constant`  → at least one target is unmet; keep ticking aggressively.
 * - mode `maintenance` → all minimums met; ingest only twice per week.
 *
 * Used internally to decide both whether to keep ticking and how to size
 * the next interval. Public pages never expose these numbers.
 */
export async function getBacklogProgress(): Promise<{
  counts: BacklogCounts;
  targets: BacklogCounts;
  metAll: boolean;
  mode: SchedulerMode;
}> {
  const targets = appConfig.ingestion.targets;
  const [prayers, saints, parishes, churchDocuments, sacraments, consecrations] = await Promise.all(
    [
      prisma.prayer.count(),
      prisma.saint.count(),
      prisma.parish.count(),
      countChurchDocuments(),
      countSacraments(),
      countConsecrations(),
    ],
  );
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
  return { counts, targets, metAll, mode };
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

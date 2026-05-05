import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { getAdapter } from "./registry";
import { runAdapter, type RunnerOptions } from "./runner";
import type { IngestionRunSummary } from "./types";

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
  logger.info("ingestion.scheduler.completed", {
    totalJobs: jobs.length,
    ...totals,
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

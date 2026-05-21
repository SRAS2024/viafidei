/**
 * Queue repair.
 *
 * A manual / startup-triggered pass that unsticks the durable queue:
 *
 *   - recovers stale running jobs whose lease has expired;
 *   - releases expired leases back to `pending`;
 *   - requeues retryable failed jobs (resets the attempt counter);
 *   - leaves permanently-failed jobs (bad payload / removed job kind)
 *     alone so they stay visible for the operator.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { recoverStaleJobs } from "./queue";
import { recordQueueAudit } from "./audit";

export type QueueRepairReport = {
  generatedAt: Date;
  staleRunningJobsRecovered: number;
  retryableFailedRequeued: number;
  permanentlyFailedLeftAlone: number;
  errors: string[];
};

/** `lastError` patterns that mean a job can never succeed on retry. */
const PERMANENT_FAILURE_PATTERNS: RegExp[] = [
  /invalid payload/i,
  /removed job kind/i,
  /unknown job kind/i,
  /unhandled job kind/i,
];

export function isPermanentQueueFailure(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  return PERMANENT_FAILURE_PATTERNS.some((re) => re.test(lastError));
}

export async function runQueueRepair(): Promise<QueueRepairReport> {
  const report: QueueRepairReport = {
    generatedAt: new Date(),
    staleRunningJobsRecovered: 0,
    retryableFailedRequeued: 0,
    permanentlyFailedLeftAlone: 0,
    errors: [],
  };

  // Recover stale running jobs / release expired leases. graceMs 0 →
  // any lease already past its expiry is released immediately.
  try {
    report.staleRunningJobsRecovered = await recoverStaleJobs({ graceMs: 0 });
  } catch (e) {
    report.errors.push(`stale recovery: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Requeue retryable failed jobs; leave permanently-failed ones.
  try {
    const failedJobs = await prisma.ingestionJobQueue.findMany({
      where: { status: "failed" },
      select: { id: true, lastError: true },
      take: 1000,
    });
    const retryableIds: string[] = [];
    for (const j of failedJobs) {
      if (isPermanentQueueFailure(j.lastError)) report.permanentlyFailedLeftAlone += 1;
      else retryableIds.push(j.id);
    }
    if (retryableIds.length > 0) {
      const result = await prisma.ingestionJobQueue.updateMany({
        where: { id: { in: retryableIds } },
        data: {
          status: "pending",
          attempts: 0,
          runAt: new Date(),
          leaseExpiresAt: null,
          leasedBy: null,
          errorMessage: null,
          finishedAt: null,
          sentToReviewAt: null,
        },
      });
      report.retryableFailedRequeued = result.count;
    }
  } catch (e) {
    report.errors.push(`failed requeue: ${e instanceof Error ? e.message : String(e)}`);
  }

  await recordQueueAudit({
    jobQueueId: null,
    event: "stale_recovered",
    reason: `Queue repair: ${report.staleRunningJobsRecovered} stale recovered, ${report.retryableFailedRequeued} failed requeued`,
    metadata: {
      staleRunningJobsRecovered: report.staleRunningJobsRecovered,
      retryableFailedRequeued: report.retryableFailedRequeued,
      permanentlyFailedLeftAlone: report.permanentlyFailedLeftAlone,
    },
  }).catch(() => undefined);

  logger.info("queue-repair.completed", {
    staleRunningJobsRecovered: report.staleRunningJobsRecovered,
    retryableFailedRequeued: report.retryableFailedRequeued,
    permanentlyFailedLeftAlone: report.permanentlyFailedLeftAlone,
    errors: report.errors.length,
  });
  return report;
}

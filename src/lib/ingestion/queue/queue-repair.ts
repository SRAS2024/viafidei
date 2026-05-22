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
 *
 * Spec #25/#26: also supports archiving terminal content rejections
 * — failed rows whose lastError indicates a correct QA decision
 * (wrong_content, source_not_allowed, qa_rejected) are marked
 * reviewed so they stop tripping queue health forever. The actual
 * row is kept for forensics; only its `sentToReviewAt` flag flips.
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
  terminalRejectionsArchived: number;
  errors: string[];
};

/** `lastError` patterns that mean a job can never succeed on retry. */
const PERMANENT_FAILURE_PATTERNS: RegExp[] = [
  /invalid payload/i,
  /removed job kind/i,
  /unknown job kind/i,
  /unhandled job kind/i,
];

/**
 * `lastError` patterns that mean the failure is a CORRECT factory
 * decision (terminal content rejection) rather than an infra error.
 * These rows can be archived — keeping them in `failed` perpetually
 * trips queue health for outcomes that are actually fine.
 *
 * Note: under the new dispatcher (spec #12), terminal QA rejections
 * complete the queue row successfully, so this archiving path mostly
 * applies to LEGACY rows enqueued before the dispatcher change.
 */
const TERMINAL_REJECTION_PATTERNS: RegExp[] = [
  /factory decision=qa-rejected/i,
  /factory decision=qa-deleted/i,
  /factory decision=build-incomplete/i,
  /factory decision=duplicate/i,
  /wrong_content/i,
  /source_not_allowed/i,
  /router_rejected/i,
  /router_hard_negative/i,
  /not_supported_by_source/i,
];

export function isPermanentQueueFailure(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  return PERMANENT_FAILURE_PATTERNS.some((re) => re.test(lastError));
}

export function isTerminalRejection(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  return TERMINAL_REJECTION_PATTERNS.some((re) => re.test(lastError));
}

export async function runQueueRepair(
  options: { archiveTerminalRejections?: boolean } = {},
): Promise<QueueRepairReport> {
  const report: QueueRepairReport = {
    generatedAt: new Date(),
    staleRunningJobsRecovered: 0,
    retryableFailedRequeued: 0,
    permanentlyFailedLeftAlone: 0,
    terminalRejectionsArchived: 0,
    errors: [],
  };
  const archiveTerminal = options.archiveTerminalRejections !== false;

  // Recover stale running jobs / release expired leases. graceMs 0 →
  // any lease already past its expiry is released immediately.
  try {
    report.staleRunningJobsRecovered = await recoverStaleJobs({ graceMs: 0 });
  } catch (e) {
    report.errors.push(`stale recovery: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Requeue retryable failed jobs; leave permanently-failed ones;
  // archive terminal-rejection failed rows so they stop counting
  // against queue health forever.
  try {
    const failedJobs = await prisma.ingestionJobQueue.findMany({
      where: { status: "failed" },
      select: { id: true, lastError: true, errorMessage: true, sentToReviewAt: true },
      take: 1000,
    });
    const retryableIds: string[] = [];
    const terminalIds: string[] = [];
    for (const j of failedJobs) {
      // errorMessage is the user-facing summary; lastError is the raw
      // exception text. Either may carry the terminal-rejection marker.
      const composite = `${j.lastError ?? ""} ${j.errorMessage ?? ""}`;
      if (isPermanentQueueFailure(j.lastError)) {
        report.permanentlyFailedLeftAlone += 1;
        continue;
      }
      if (archiveTerminal && isTerminalRejection(composite)) {
        // Already reviewed → leave alone so we don't churn the row.
        if (!j.sentToReviewAt) {
          terminalIds.push(j.id);
        }
        continue;
      }
      retryableIds.push(j.id);
    }
    if (terminalIds.length > 0) {
      const result = await prisma.ingestionJobQueue.updateMany({
        where: { id: { in: terminalIds } },
        data: {
          // Mark as reviewed so queue health stops counting these as
          // ongoing production breakage. The row stays in `failed`
          // status for forensic traceability — only sentToReviewAt
          // changes.
          sentToReviewAt: new Date(),
        },
      });
      report.terminalRejectionsArchived = result.count;
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
    reason: `Queue repair: ${report.staleRunningJobsRecovered} stale recovered, ${report.retryableFailedRequeued} failed requeued, ${report.terminalRejectionsArchived} terminal rejections archived`,
    metadata: {
      staleRunningJobsRecovered: report.staleRunningJobsRecovered,
      retryableFailedRequeued: report.retryableFailedRequeued,
      permanentlyFailedLeftAlone: report.permanentlyFailedLeftAlone,
      terminalRejectionsArchived: report.terminalRejectionsArchived,
    },
  }).catch(() => undefined);

  logger.info("queue-repair.completed", {
    staleRunningJobsRecovered: report.staleRunningJobsRecovered,
    retryableFailedRequeued: report.retryableFailedRequeued,
    permanentlyFailedLeftAlone: report.permanentlyFailedLeftAlone,
    terminalRejectionsArchived: report.terminalRejectionsArchived,
    errors: report.errors.length,
  });
  return report;
}

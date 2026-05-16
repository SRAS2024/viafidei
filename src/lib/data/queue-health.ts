/**
 * Queue health snapshot — used by the admin dashboard, the biweekly
 * report, and the safe sanitized public health endpoint.
 */

import { countQueueByStatus, queueLatencySnapshot } from "../ingestion/queue/queue";
import { hasHealthyWorker, listWorkerHealth } from "../ingestion/queue/heartbeat";
import { appConfig } from "../config";

export type QueueHealthSummary = {
  counts: Awaited<ReturnType<typeof countQueueByStatus>>;
  oldestPendingAgeMs: number | null;
  oldestRetryingAgeMs: number | null;
  avgWaitMs: number | null;
  workersAlive: number;
  workersStale: number;
  hasHealthyWorker: boolean;
  pendingJobsButNoWorker: boolean;
  oldestPendingExceedsThreshold: boolean;
};

export async function getQueueHealthSummary(): Promise<QueueHealthSummary> {
  const [counts, latency, workers, healthy] = await Promise.all([
    countQueueByStatus(),
    queueLatencySnapshot(),
    listWorkerHealth(),
    hasHealthyWorker(),
  ]);
  const workersAlive = workers.filter((w) => !w.isStale).length;
  const workersStale = workers.filter((w) => w.isStale).length;
  const pendingJobsButNoWorker = counts.pending + counts.retrying > 0 && !healthy;
  const oldestPendingExceedsThreshold =
    !!latency.oldestPendingAgeMs &&
    latency.oldestPendingAgeMs > appConfig.ingestionQueue.oldestPendingWarnAfterMs;
  return {
    counts,
    oldestPendingAgeMs: latency.oldestPendingAgeMs,
    oldestRetryingAgeMs: latency.oldestRetryingAgeMs,
    avgWaitMs: latency.avgWaitMs,
    workersAlive,
    workersStale,
    hasHealthyWorker: healthy,
    pendingJobsButNoWorker,
    oldestPendingExceedsThreshold,
  };
}

/**
 * Safe public view — used by /api/health. Returns only summary
 * counters, never payload bodies or sensitive fields.
 */
export async function getPublicQueueHealth(): Promise<{
  pending: number;
  running: number;
  failed: number;
  retrying: number;
  workersAlive: number;
}> {
  const counts = await countQueueByStatus().catch(() => ({
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    retrying: 0,
  }));
  let workersAlive = 0;
  try {
    const workers = await listWorkerHealth();
    workersAlive = workers.filter((w) => !w.isStale).length;
  } catch {
    /* swallow */
  }
  return {
    pending: counts.pending,
    running: counts.running,
    failed: counts.failed,
    retrying: counts.retrying,
    workersAlive,
  };
}

/**
 * Stall-detector helper — different signal classes. Returns which (if
 * any) stall categories are currently true. The cron route consumes
 * this and fires distinct admin alerts per type.
 */
export async function detectStallSignals(args: {
  contentTypesBelowTarget: string[];
  pendingCount: number;
  workerHealthy: boolean;
  completionsLastHourCount: number;
  contentGrowthLastHour: number;
}): Promise<{
  contentBelowTargetButNoJobs: boolean;
  jobsEnqueuedButNotProcessed: boolean;
  jobsCompletedButContentNotGrowing: boolean;
}> {
  return {
    contentBelowTargetButNoJobs:
      args.contentTypesBelowTarget.length > 0 && args.pendingCount === 0 && args.workerHealthy,
    jobsEnqueuedButNotProcessed: args.pendingCount > 0 && !args.workerHealthy,
    jobsCompletedButContentNotGrowing:
      args.completionsLastHourCount > 0 &&
      args.contentGrowthLastHour === 0 &&
      args.contentTypesBelowTarget.length > 0,
  };
}

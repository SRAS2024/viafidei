import { randomUUID } from "node:crypto";
import os from "node:os";
import { logger } from "../../observability/logger";
import type { RunnerOptions } from "../runner";
import { recordSourceFreshness } from "../../data/source-health";
import { isContentTypePaused } from "../../data/content-type-pause";
import {
  completeJob,
  countQueueByStatus,
  failJob,
  isCancelRequested,
  leaseNextJob,
  queueLatencySnapshot,
  recoverStaleJobs,
  releaseLease,
  skipJob,
  type QueueJobRow,
} from "./queue";
import { recordQueueAudit } from "./audit";
import { writeHeartbeat, removeHeartbeat } from "./heartbeat";
import { runJobByKind } from "./dispatch";
import { prisma } from "../../db/client";

export type WorkerOptions = {
  /** Stable identifier for this worker process — included in lease bookkeeping. */
  workerId?: string;
  /** Lease duration override (ms). */
  leaseDurationMs?: number;
  /** How long to wait between empty-queue polls (ms). Defaults to 5s. */
  idleSleepMs?: number;
  /** Maximum number of jobs to process before exiting. */
  maxJobs?: number;
  /** When set, the worker exits as soon as the queue is empty. */
  oneShot?: boolean;
  /** Override runner options (used by tests). */
  runnerOptions?: RunnerOptions;
};

const DEFAULT_IDLE_SLEEP_MS = 5_000;

/**
 * Snapshot the queue for the periodic idle log so an operator can
 * see — straight from the worker logs — whether the queue is empty,
 * backed up, or stuck. Cheap enough to run once every few idle
 * cycles.
 */
async function gatherIdleStats(): Promise<{
  pending: number;
  running: number;
  failed: number;
  oldestPendingAgeMs: number | null;
  nextRunnableAt: string | null;
}> {
  const [counts, latency, nextJob] = await Promise.all([
    countQueueByStatus(),
    queueLatencySnapshot(),
    prisma.ingestionJobQueue.findFirst({
      where: { status: { in: ["pending", "retrying"] } },
      orderBy: { runAt: "asc" },
      select: { runAt: true },
    }),
  ]);
  return {
    pending: counts.pending,
    running: counts.running,
    failed: counts.failed,
    oldestPendingAgeMs: latency.oldestPendingAgeMs,
    nextRunnableAt: nextJob?.runAt.toISOString() ?? null,
  };
}

/**
 * Execute a single leased job. Returns the resolved status so the
 * worker loop can log it. Pure transport — all retry/backoff
 * decisions live inside `queue.ts`.
 */
export async function processNextJob(
  workerId: string,
  options: WorkerOptions = {},
): Promise<
  | { processed: false }
  | { processed: true; job: QueueJobRow; result: "completed" | "failed" | "skipped" | "retrying" }
> {
  const job = await leaseNextJob({
    workerId,
    leaseDurationMs: options.leaseDurationMs,
  });
  if (!job) return { processed: false };

  // Source paused → skip without consuming a retry.
  if (job.sourceId) {
    const source = await prisma.ingestionSource.findUnique({ where: { id: job.sourceId } });
    if (source?.pausedAt) {
      await skipJob(
        job.id,
        `Source paused at ${source.pausedAt.toISOString()}: ${source.pausedReason ?? "no reason"}`,
      );
      logger.info("ingestion.worker.skipped_paused_source", {
        jobQueueId: job.id,
        sourceId: job.sourceId,
      });
      return { processed: true, job, result: "skipped" };
    }
  }
  // Job-level pause → skip too.
  if (job.jobId) {
    const ingestionJob = await prisma.ingestionJob.findUnique({ where: { id: job.jobId } });
    if (ingestionJob?.pausedAt) {
      await skipJob(
        job.id,
        `Job paused at ${ingestionJob.pausedAt.toISOString()}: ${ingestionJob.pausedReason ?? "no reason"}`,
      );
      logger.info("ingestion.worker.skipped_paused_job", {
        jobQueueId: job.id,
        jobId: job.jobId,
      });
      return { processed: true, job, result: "skipped" };
    }
  }
  // Content-type pause → skip without consuming a retry. The admin
  // can pause every Saint ingestion across all sources via a single
  // toggle without disabling each job.
  const ctPause = await isContentTypePaused(job.contentType);
  if (ctPause.paused) {
    await skipJob(
      job.id,
      `Content type ${job.contentType} paused at ${ctPause.pausedAt?.toISOString() ?? "?"}: ${ctPause.reason ?? "no reason"}`,
    );
    logger.info("ingestion.worker.skipped_paused_content_type", {
      jobQueueId: job.id,
      contentType: job.contentType,
    });
    return { processed: true, job, result: "skipped" };
  }

  // Cooperative cancellation check immediately after lease.
  if (await isCancelRequested(job.id)) {
    await skipJob(job.id, "Canceled by admin before processing");
    await recordQueueAudit({
      jobQueueId: job.id,
      event: "canceled",
      fromStatus: "running",
      toStatus: "skipped",
      reason: "cancel requested",
    });
    return { processed: true, job, result: "skipped" };
  }

  // Dispatch by jobKind. The dispatcher handles every typed job
  // kind — source_discovery, source_fetch, source_freshness,
  // content_build (single combined factory stage),
  // source_config_repair, content_revalidate, etc.
  try {
    const result = await runJobByKind(job);
    if (!result.ok) {
      const outcome = await failJob(
        job.id,
        result.errorMessage ?? "job dispatcher returned not-ok",
      );
      return {
        processed: true,
        job,
        result: outcome.status === "failed" ? "failed" : "retrying",
      };
    }
    await completeJob(job.id, result.errorMessage ?? undefined);
    return { processed: true, job, result: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const outcome = await failJob(job.id, message);
    if (job.sourceId) {
      await recordSourceFreshness(job.sourceId, {
        ok: false,
        errorMessage: message,
      }).catch(() => undefined);
    }
    logger.error("ingestion.worker.job_threw", {
      jobQueueId: job.id,
      jobName: job.jobName,
      jobKind: job.jobKind,
      errorMessage: message,
      outcome: outcome.status,
    });
    return { processed: true, job, result: outcome.status === "failed" ? "failed" : "retrying" };
  }
}

/**
 * Long-running worker loop. Suitable for a dedicated worker process
 * spawned by the deploy script. The loop:
 *
 *   1. Recovers any stale leases (covers crashes of other workers).
 *   2. Leases the next job (FIFO by priority then runAt).
 *   3. Runs the adapter and marks the job done / retrying / failed.
 *   4. Sleeps `idleSleepMs` only when the queue is empty.
 *
 * The loop terminates when `oneShot` is true and the queue is empty,
 * or after `maxJobs` jobs have been processed. Otherwise it runs
 * forever until the process is killed.
 */
export async function runWorkerLoop(
  options: WorkerOptions = {},
): Promise<{ processed: number; durationMs: number }> {
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const idleSleep = options.idleSleepMs ?? DEFAULT_IDLE_SLEEP_MS;
  const started = Date.now();
  const startedAt = new Date(started);
  let processed = 0;
  let failedCount = 0;
  let retryCount = 0;
  const hostname = os.hostname();
  logger.info("ingestion.worker.start", {
    workerId,
    oneShot: !!options.oneShot,
    maxJobs: options.maxJobs ?? null,
    hostname,
  });
  // The first heartbeat must succeed. If the worker cannot write its
  // heartbeat it is effectively dead — the dashboard will never see
  // it — so fail loudly and let the process exit non-zero so Railway
  // restarts it, rather than spinning in a loop nobody can observe.
  try {
    await writeHeartbeat({
      workerId,
      startedAt,
      processedCount: 0,
      failedCount: 0,
      retryCount: 0,
      status: "idle",
      hostname,
      version: process.env.npm_package_version,
      processType: "worker",
    });

    logger.info("ingestion.worker.heartbeat_written", {
      workerId,
      status: "idle",
    });
  } catch (error) {
    logger.error("ingestion.worker.heartbeat_write_failed", {
      workerId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }

  logger.info("ingestion.worker.loop_alive", {
    workerId,
    idleSleepMs: idleSleep,
    oneShot: !!options.oneShot,
    maxJobs: options.maxJobs ?? null,
    hostname,
    processType: "worker",
  });

  let consecutiveEmpty = 0;
  while (true) {
    if (options.maxJobs && processed >= options.maxJobs) break;
    // Stale recovery runs cheaply on every iteration so a crashed
    // sibling worker's jobs return to the queue within one tick.
    await recoverStaleJobs().catch((e) => {
      logger.warn("ingestion.worker.stale_recovery_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    });
    const outcome = await processNextJob(workerId, options);
    if (outcome.processed) {
      consecutiveEmpty = 0;
      processed += 1;
      if (outcome.result === "failed") failedCount += 1;
      if (outcome.result === "retrying") retryCount += 1;
      logger.info("ingestion.worker.processed", {
        workerId,
        jobQueueId: outcome.job.id,
        jobKind: outcome.job.jobKind,
        jobName: outcome.job.jobName,
        result: outcome.result,
        attempts: outcome.job.attempts,
        sourceId: outcome.job.sourceId,
        contentType: outcome.job.contentType,
        priority: outcome.job.priority,
      });
      await writeHeartbeat({
        workerId,
        startedAt,
        processedCount: processed,
        failedCount,
        retryCount,
        currentJobId: null,
        status: "running",
        hostname,
        processType: "worker",
      }).catch((error) => {
        logger.warn("ingestion.worker.heartbeat_write_failed", {
          workerId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      continue;
    }
    if (options.oneShot) break;
    consecutiveEmpty += 1;
    if (consecutiveEmpty >= 5) {
      const stats = await gatherIdleStats().catch(() => null);
      logger.info("ingestion.worker.idle", {
        workerId,
        idleSleepMs: idleSleep,
        pendingJobs: stats?.pending ?? null,
        runningJobs: stats?.running ?? null,
        failedJobs: stats?.failed ?? null,
        oldestPendingAgeMs: stats?.oldestPendingAgeMs ?? null,
        nextRunnableAt: stats?.nextRunnableAt ?? null,
      });
      consecutiveEmpty = 0;
    }
    await writeHeartbeat({
      workerId,
      startedAt,
      processedCount: processed,
      failedCount,
      retryCount,
      status: "idle",
      hostname,
      processType: "worker",
    }).catch((error) => {
      logger.warn("ingestion.worker.heartbeat_write_failed", {
        workerId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    // Idle sleep. This timer is intentionally NOT `unref()`-ed: the
    // worker is a long-running process whose entire job is to keep
    // polling. An `unref()`-ed timer lets Node exit the moment the
    // event loop has nothing else pending — which is exactly how the
    // worker was silently dying while waiting for the next job.
    await new Promise((resolve) => {
      setTimeout(resolve, idleSleep);
    });
  }
  await writeHeartbeat({
    workerId,
    startedAt,
    processedCount: processed,
    failedCount,
    retryCount,
    status: "stopped",
    hostname,
    processType: "worker",
  }).catch((error) => {
    logger.warn("ingestion.worker.heartbeat_write_failed", {
      workerId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  // Best-effort heartbeat removal so the dashboard doesn't show a
  // permanently-stale worker after a clean shutdown.
  await removeHeartbeat(workerId).catch(() => undefined);
  const durationMs = Date.now() - started;
  logger.info("ingestion.worker.stop", { workerId, processed, durationMs });
  return { processed, durationMs };
}

/** Release the active lease on shutdown so the next worker can claim quickly. */
export async function releaseActiveLeases(workerId: string): Promise<number> {
  const rows = await prisma.ingestionJobQueue.findMany({
    where: { status: "running", leasedBy: workerId },
    select: { id: true },
  });
  for (const r of rows) await releaseLease(r.id);
  return rows.length;
}

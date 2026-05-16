import { randomUUID } from "node:crypto";
import os from "node:os";
import { logger } from "../../observability/logger";
import type { RunnerOptions } from "../runner";
import { recordSourceFreshness } from "../../data/source-health";
import { isContentTypePaused } from "../../data/content-type-pause";
import {
  completeJob,
  failJob,
  isCancelRequested,
  leaseNextJob,
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
  // kind — source_ingest, source_freshness, archive_cleanup, etc.
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
  await writeHeartbeat({
    workerId,
    startedAt,
    processedCount: 0,
    failedCount: 0,
    retryCount: 0,
    status: "idle",
    hostname,
    version: process.env.npm_package_version,
  }).catch(() => undefined);

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
        jobName: outcome.job.jobName,
        jobKind: outcome.job.jobKind,
        jobQueueId: outcome.job.id,
        result: outcome.result,
        attempts: outcome.job.attempts,
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
      }).catch(() => undefined);
      continue;
    }
    if (options.oneShot) break;
    consecutiveEmpty += 1;
    if (consecutiveEmpty >= 5) {
      logger.info("ingestion.worker.idle", { workerId, idleSleepMs: idleSleep });
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
    }).catch(() => undefined);
    await new Promise((r) => {
      const t = setTimeout(r, idleSleep);
      if (typeof t.unref === "function") t.unref();
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
  }).catch(() => undefined);
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

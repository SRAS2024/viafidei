import { randomUUID } from "node:crypto";
import { logger } from "../../observability/logger";
import { getAdapter } from "../registry";
import { runAdapter, type RunnerOptions } from "../runner";
import { recordSourceFreshness } from "../../data/source-health";
import { isContentTypePaused } from "../../data/content-type-pause";
import {
  completeJob,
  failJob,
  leaseNextJob,
  recoverStaleJobs,
  releaseLease,
  skipJob,
  type QueueJobRow,
} from "./queue";
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

  const adapter = getAdapter(job.jobName);
  if (!adapter) {
    await skipJob(job.id, `No registered adapter for job '${job.jobName}'`);
    logger.warn("ingestion.worker.adapter_missing", {
      jobQueueId: job.id,
      jobName: job.jobName,
    });
    return { processed: true, job, result: "skipped" };
  }

  // Resolve the source host the runner expects. Falls back to the
  // adapter's first entityKind tag when the job row has no source.
  const sourceHost = job.sourceId
    ? ((await prisma.ingestionSource.findUnique({ where: { id: job.sourceId } }))?.host ??
      job.jobName)
    : job.jobName;

  try {
    const summary = await runAdapter(adapter, job.jobId, sourceHost, {
      ...options.runnerOptions,
      triggeredBy: job.triggeredBy === "manual" ? "manual" : "automatic",
      actorUsername: job.actorUsername ?? null,
    });
    if (summary.recordsFailed > 0 && summary.recordsSeen === 0) {
      // Total fetch failure (upstream returned nothing) — treat as retryable.
      const err = summary.errorMessage ?? "Upstream returned no records and recorded a failure";
      const outcome = await failJob(job.id, err);
      await recordSourceFreshness(job.sourceId, {
        ok: false,
        errorMessage: err,
      }).catch(() => undefined);
      return { processed: true, job, result: outcome.status === "failed" ? "failed" : "retrying" };
    }
    await completeJob(job.id, summary.errorMessage ?? undefined);
    await recordSourceFreshness(job.sourceId, {
      ok: true,
    }).catch(() => undefined);
    return { processed: true, job, result: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const outcome = await failJob(job.id, message);
    await recordSourceFreshness(job.sourceId, {
      ok: false,
      errorMessage: message,
    }).catch(() => undefined);
    logger.error("ingestion.worker.job_threw", {
      jobQueueId: job.id,
      jobName: job.jobName,
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
  let processed = 0;
  logger.info("ingestion.worker.start", {
    workerId,
    oneShot: !!options.oneShot,
    maxJobs: options.maxJobs ?? null,
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
      logger.info("ingestion.worker.processed", {
        workerId,
        jobName: outcome.job.jobName,
        jobQueueId: outcome.job.id,
        result: outcome.result,
        attempts: outcome.job.attempts,
        priority: outcome.job.priority,
      });
      continue;
    }
    if (options.oneShot) break;
    consecutiveEmpty += 1;
    if (consecutiveEmpty >= 5) {
      logger.info("ingestion.worker.idle", { workerId, idleSleepMs: idleSleep });
      consecutiveEmpty = 0;
    }
    await new Promise((r) => {
      const t = setTimeout(r, idleSleep);
      if (typeof t.unref === "function") t.unref();
    });
  }
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

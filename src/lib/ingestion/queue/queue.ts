import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { recordDataManagementLogs } from "../../data/data-management-log";
import { backoffDelayForAttempt, calculateRunAt } from "./backoff";

/**
 * Queue status values, kept as lowercase strings so they match the
 * Postgres column shape directly. Defined as a TypeScript union (not
 * a Prisma enum) so the worker can introduce new states without a
 * schema migration.
 */
export type QueueStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "retrying";

export const QUEUE_STATUSES: ReadonlyArray<QueueStatus> = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "retrying",
];

/**
 * Priority bands. Lower numbers run first.
 *
 *   10  — content-threshold unmet, top of queue (constant mode).
 *   100 — normal scheduled ingestion (default).
 *   200 — maintenance refresh (all thresholds met).
 *   500 — janitor / housekeeping work.
 */
export const PRIORITY_CONTENT_THRESHOLD_UNMET = 10;
export const PRIORITY_NORMAL = 100;
export const PRIORITY_MAINTENANCE = 200;
export const PRIORITY_HOUSEKEEPING = 500;

/** Default lease — 10 min is enough for the largest current adapter run. */
export const DEFAULT_LEASE_DURATION_MS = 10 * 60 * 1000;
/**
 * A job whose lease expired this long ago is considered stale. The
 * grace window absorbs clock skew between workers and prevents racing
 * with a worker that is just about to send its keep-alive.
 */
export const DEFAULT_STALE_LEASE_GRACE_MS = 60 * 1000;

const DEFAULT_MAX_ATTEMPTS = 5;

export type EnqueueJobInput = {
  jobName: string;
  sourceId?: string | null;
  jobId?: string | null;
  contentType?: string | null;
  priority?: number;
  maxAttempts?: number;
  runAt?: Date;
  payload?: Record<string, unknown>;
  triggeredBy?: "automatic" | "manual";
  actorUsername?: string | null;
};

export type QueueJobRow = {
  id: string;
  sourceId: string | null;
  jobId: string | null;
  jobName: string;
  contentType: string | null;
  status: QueueStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  leaseExpiresAt: Date | null;
  leasedBy: string | null;
  errorMessage: string | null;
  lastError: string | null;
  payload: Record<string, unknown> | null;
  triggeredBy: string;
  actorUsername: string | null;
  sentToReviewAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LeaseOptions = {
  workerId: string;
  leaseDurationMs?: number;
  now?: Date;
};

function rowToJob(row: {
  id: string;
  sourceId: string | null;
  jobId: string | null;
  jobName: string;
  contentType: string | null;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  leaseExpiresAt: Date | null;
  leasedBy: string | null;
  errorMessage: string | null;
  lastError: string | null;
  payload: unknown;
  triggeredBy: string;
  actorUsername: string | null;
  sentToReviewAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): QueueJobRow {
  return {
    ...row,
    status: row.status as QueueStatus,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Enqueue a single job. If a pending/retrying job with the same
 * `jobName` already exists for the same `contentType`, the existing
 * row is updated (priority lowered, runAt advanced) rather than a
 * duplicate created — so re-enqueuing the same scheduled task during
 * a constant-mode burst doesn't blow up the queue.
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<QueueJobRow> {
  const priority = input.priority ?? PRIORITY_NORMAL;
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const runAt = input.runAt ?? new Date();
  const existing = await prisma.ingestionJobQueue.findFirst({
    where: {
      jobName: input.jobName,
      contentType: input.contentType ?? null,
      status: { in: ["pending", "retrying"] },
    },
    orderBy: { runAt: "asc" },
  });
  if (existing) {
    const updated = await prisma.ingestionJobQueue.update({
      where: { id: existing.id },
      data: {
        priority: Math.min(existing.priority, priority),
        runAt: existing.runAt < runAt ? existing.runAt : runAt,
        // Prisma Json input requires `never` cast (the union type is too
        // wide for direct assignment from `Record<string, unknown>`).
        payload: input.payload ? (input.payload as never) : undefined,
        triggeredBy: input.triggeredBy ?? existing.triggeredBy,
        actorUsername: input.actorUsername ?? existing.actorUsername,
        sourceId: input.sourceId ?? existing.sourceId,
        jobId: input.jobId ?? existing.jobId,
      },
    });
    return rowToJob(updated);
  }
  const created = await prisma.ingestionJobQueue.create({
    data: {
      jobName: input.jobName,
      sourceId: input.sourceId ?? null,
      jobId: input.jobId ?? null,
      contentType: input.contentType ?? null,
      priority,
      maxAttempts,
      runAt,
      payload: input.payload ? (input.payload as never) : undefined,
      triggeredBy: input.triggeredBy ?? "automatic",
      actorUsername: input.actorUsername ?? null,
      status: "pending",
    },
  });
  return rowToJob(created);
}

export async function enqueueJobs(inputs: EnqueueJobInput[]): Promise<QueueJobRow[]> {
  const rows: QueueJobRow[] = [];
  for (const input of inputs) {
    rows.push(await enqueueJob(input));
  }
  return rows;
}

/**
 * Lease the next pending job (or stale-lease running job). Uses a
 * raw SQL UPDATE with `FOR UPDATE SKIP LOCKED` so multiple workers
 * never lease the same row.
 */
export async function leaseNextJob(options: LeaseOptions): Promise<QueueJobRow | null> {
  const now = options.now ?? new Date();
  const leaseExpires = new Date(
    now.getTime() + (options.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS),
  );

  // Atomic claim via CTE: SELECT FOR UPDATE SKIP LOCKED gives us the
  // strongest worker-safety guarantee Postgres offers, and the
  // single-statement UPDATE means a crash mid-claim leaves the row in
  // its prior state (no half-claimed jobs).
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      sourceId: string | null;
      jobId: string | null;
      jobName: string;
      contentType: string | null;
      status: string;
      priority: number;
      attempts: number;
      maxAttempts: number;
      runAt: Date;
      startedAt: Date | null;
      finishedAt: Date | null;
      leaseExpiresAt: Date | null;
      leasedBy: string | null;
      errorMessage: string | null;
      lastError: string | null;
      payload: unknown;
      triggeredBy: string;
      actorUsername: string | null;
      sentToReviewAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    `
    UPDATE "IngestionJobQueue" q
    SET "status" = 'running',
        "startedAt" = $1,
        "leaseExpiresAt" = $2,
        "leasedBy" = $3,
        "attempts" = q."attempts" + 1,
        "updatedAt" = $1
    FROM (
      SELECT "id"
        FROM "IngestionJobQueue"
       WHERE ("status" IN ('pending', 'retrying') AND "runAt" <= $1)
          OR ("status" = 'running' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" < $1)
       ORDER BY "priority" ASC, "runAt" ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
    ) AS candidate
    WHERE q."id" = candidate."id"
    RETURNING q.*
    `,
    now,
    leaseExpires,
    options.workerId,
  );
  if (!rows[0]) return null;
  return rowToJob(rows[0]);
}

/** Release a lease without changing the job's status (e.g. shutdown). */
export async function releaseLease(jobQueueId: string): Promise<void> {
  await prisma.ingestionJobQueue.updateMany({
    where: { id: jobQueueId, status: "running" },
    data: {
      status: "pending",
      leaseExpiresAt: null,
      leasedBy: null,
    },
  });
}

export async function completeJob(jobQueueId: string, summary?: string): Promise<void> {
  await prisma.ingestionJobQueue.update({
    where: { id: jobQueueId },
    data: {
      status: "completed",
      finishedAt: new Date(),
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: summary ?? null,
      lastError: null,
    },
  });
}

/**
 * Mark a job as failed after a recoverable error. If the attempt
 * count is below `maxAttempts`, the row goes back to `retrying`
 * with a backoff-delayed `runAt`. When it reaches `maxAttempts`
 * the row stays in `failed` and is sent to admin review (the row
 * carries the `sentToReviewAt` timestamp; the cron route picks up
 * those rows and emits a DataManagementLog entry).
 */
export async function failJob(
  jobQueueId: string,
  errorMessage: string,
  options: { backoffBaseMs?: number; backoffMaxMs?: number; now?: Date } = {},
): Promise<{ status: QueueStatus; nextRunAt: Date | null; attempts: number; maxAttempts: number }> {
  const now = options.now ?? new Date();
  const existing = await prisma.ingestionJobQueue.findUnique({ where: { id: jobQueueId } });
  if (!existing) {
    return { status: "failed", nextRunAt: null, attempts: 0, maxAttempts: 0 };
  }
  const attempts = existing.attempts;
  const maxAttempts = existing.maxAttempts;
  if (attempts >= maxAttempts) {
    const updated = await prisma.ingestionJobQueue.update({
      where: { id: jobQueueId },
      data: {
        status: "failed",
        finishedAt: now,
        leaseExpiresAt: null,
        leasedBy: null,
        errorMessage,
        lastError: errorMessage,
        sentToReviewAt: now,
      },
    });
    // Write an admin-review log row so the admin sees the failed job
    // in /admin/logs/data-management with full context.
    await recordDataManagementLogs([
      {
        action: "FAIL",
        contentType: existing.contentType ?? "IngestionJob",
        contentRef: existing.jobName,
        reason: `Reached max retries (${maxAttempts}). Last error: ${errorMessage.slice(0, 240)}`,
        triggeredBy: existing.triggeredBy === "manual" ? "manual" : "automatic",
        actorUsername: existing.actorUsername,
      },
    ]).catch((e) => {
      logger.warn("ingestion.queue.fail_log_failed", {
        jobQueueId,
        error: e instanceof Error ? e.message : String(e),
      });
    });
    return {
      status: "failed",
      nextRunAt: null,
      attempts: updated.attempts,
      maxAttempts: updated.maxAttempts,
    };
  }
  const nextRunAt = calculateRunAt(
    attempts,
    {
      baseMs: options.backoffBaseMs,
      maxMs: options.backoffMaxMs,
    },
    now,
  );
  const updated = await prisma.ingestionJobQueue.update({
    where: { id: jobQueueId },
    data: {
      status: "retrying",
      runAt: nextRunAt,
      leaseExpiresAt: null,
      leasedBy: null,
      finishedAt: null,
      lastError: errorMessage,
      errorMessage,
    },
  });
  return {
    status: "retrying",
    nextRunAt: updated.runAt,
    attempts: updated.attempts,
    maxAttempts: updated.maxAttempts,
  };
}

export async function skipJob(jobQueueId: string, reason: string): Promise<void> {
  await prisma.ingestionJobQueue.update({
    where: { id: jobQueueId },
    data: {
      status: "skipped",
      finishedAt: new Date(),
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: reason,
    },
  });
}

/**
 * Find jobs whose lease has expired and return them to `pending` so
 * another worker can pick them up. Called from the worker loop and
 * from the cron route on every tick.
 */
export async function recoverStaleJobs(
  options: { graceMs?: number; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const grace = options.graceMs ?? DEFAULT_STALE_LEASE_GRACE_MS;
  const cutoff = new Date(now.getTime() - grace);
  const result = await prisma.ingestionJobQueue.updateMany({
    where: {
      status: "running",
      leaseExpiresAt: { lt: cutoff },
    },
    data: {
      status: "pending",
      leaseExpiresAt: null,
      leasedBy: null,
    },
  });
  if (result.count > 0) {
    logger.warn("ingestion.queue.stale_recovered", { count: result.count });
  }
  return result.count;
}

export async function countQueueByStatus(): Promise<Record<QueueStatus, number>> {
  const rows = await prisma.ingestionJobQueue.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<QueueStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    retrying: 0,
  };
  for (const row of rows) {
    if (row.status in out) {
      out[row.status as QueueStatus] = row._count._all;
    }
  }
  return out;
}

export async function listQueueJobs(filter: {
  status?: QueueStatus | QueueStatus[];
  sourceId?: string;
  contentType?: string;
  needsReview?: boolean;
  take?: number;
}): Promise<QueueJobRow[]> {
  const take = Math.min(Math.max(filter.take ?? 50, 1), 500);
  const statusFilter = filter.status
    ? Array.isArray(filter.status)
      ? { in: filter.status }
      : filter.status
    : undefined;
  const rows = await prisma.ingestionJobQueue.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filter.sourceId ? { sourceId: filter.sourceId } : {}),
      ...(filter.contentType ? { contentType: filter.contentType } : {}),
      ...(filter.needsReview ? { sentToReviewAt: { not: null } } : {}),
    },
    orderBy: [{ priority: "asc" }, { runAt: "asc" }],
    take,
  });
  return rows.map(rowToJob);
}

/**
 * Re-enqueue a previously-failed job (manual admin action). Resets the
 * attempt counter to 0 and the status to pending; lease bookkeeping
 * is cleared.
 */
export async function retryFailedJob(
  jobQueueId: string,
  actorUsername?: string | null,
): Promise<QueueJobRow | null> {
  const row = await prisma.ingestionJobQueue.findUnique({ where: { id: jobQueueId } });
  if (!row || row.status !== "failed") return null;
  const updated = await prisma.ingestionJobQueue.update({
    where: { id: jobQueueId },
    data: {
      status: "pending",
      attempts: 0,
      runAt: new Date(),
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: null,
      finishedAt: null,
      sentToReviewAt: null,
      triggeredBy: "manual",
      actorUsername: actorUsername ?? row.actorUsername ?? null,
    },
  });
  return rowToJob(updated);
}

export async function countFailedNeedingReview(): Promise<number> {
  return prisma.ingestionJobQueue.count({
    where: { status: "failed", sentToReviewAt: { not: null } },
  });
}

/**
 * Compute the next retry delay without scheduling — useful for tests
 * and the admin dashboard "next retry at" column.
 */
export function previewBackoffMs(attempt: number): number {
  return backoffDelayForAttempt(attempt);
}

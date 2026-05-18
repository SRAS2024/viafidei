import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { recordDataManagementLogs } from "../../data/data-management-log";
import { backoffDelayForAttempt, calculateRunAt } from "./backoff";
import { recordQueueAudit } from "./audit";
import { validatePayload } from "./job-kinds";

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
  /** Typed job kind from `job-kinds.ts`. Defaults to "source_discovery". */
  jobKind?: string;
  /** Stable dedupe key. Active rows are unique by this key. */
  dedupeKey?: string;
  sourceId?: string | null;
  jobId?: string | null;
  contentType?: string | null;
  priority?: number;
  maxAttempts?: number;
  runAt?: Date;
  payload?: Record<string, unknown>;
  triggeredBy?: "automatic" | "manual";
  actorUsername?: string | null;
  /** Skip payload validation (only for internal callers that know better). */
  skipValidation?: boolean;
};

export type QueueJobRow = {
  id: string;
  sourceId: string | null;
  jobId: string | null;
  jobName: string;
  jobKind: string;
  dedupeKey: string | null;
  contentType: string | null;
  status: QueueStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  leaseExpiresAt: Date | null;
  leasedBy: string | null;
  errorMessage: string | null;
  lastError: string | null;
  payload: Record<string, unknown> | null;
  triggeredBy: string;
  actorUsername: string | null;
  sentToReviewAt: Date | null;
  cancelRequestedAt: Date | null;
  cancelReason: string | null;
  canceledAt: Date | null;
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
  jobKind?: string | null;
  dedupeKey?: string | null;
  contentType: string | null;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs?: number | null;
  leaseExpiresAt: Date | null;
  leasedBy: string | null;
  errorMessage: string | null;
  lastError: string | null;
  payload: unknown;
  triggeredBy: string;
  actorUsername: string | null;
  sentToReviewAt: Date | null;
  cancelRequestedAt?: Date | null;
  cancelReason?: string | null;
  canceledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): QueueJobRow {
  return {
    id: row.id,
    sourceId: row.sourceId,
    jobId: row.jobId,
    jobName: row.jobName,
    jobKind: row.jobKind ?? "source_discovery",
    dedupeKey: row.dedupeKey ?? null,
    contentType: row.contentType,
    status: row.status as QueueStatus,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs ?? null,
    leaseExpiresAt: row.leaseExpiresAt,
    leasedBy: row.leasedBy,
    errorMessage: row.errorMessage,
    lastError: row.lastError,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    triggeredBy: row.triggeredBy,
    actorUsername: row.actorUsername,
    sentToReviewAt: row.sentToReviewAt,
    cancelRequestedAt: row.cancelRequestedAt ?? null,
    cancelReason: row.cancelReason ?? null,
    canceledAt: row.canceledAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
  const jobKind = input.jobKind ?? "source_discovery";

  // Strict payload validation (rejects unknown job kinds + malformed
  // payloads at the boundary). Caller can opt out with skipValidation
  // for internal callers that already validated.
  if (!input.skipValidation) {
    const validation = validatePayload(jobKind, input.payload ?? {});
    if (!validation.ok) {
      throw new Error(`Queue enqueue rejected: ${validation.error}`);
    }
  }

  // First check by dedupeKey when provided — active rows are unique.
  if (input.dedupeKey) {
    const existing = await prisma.ingestionJobQueue.findFirst({
      where: {
        dedupeKey: input.dedupeKey,
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
          payload: input.payload ? (input.payload as never) : undefined,
          triggeredBy: input.triggeredBy ?? existing.triggeredBy,
          actorUsername: input.actorUsername ?? existing.actorUsername,
          sourceId: input.sourceId ?? existing.sourceId,
          jobId: input.jobId ?? existing.jobId,
        },
      });
      return rowToJob(updated);
    }
  } else {
    // Fall back to the legacy (jobName + contentType) dedupe path for
    // callers that haven't migrated to dedupeKey yet.
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
          payload: input.payload ? (input.payload as never) : undefined,
          triggeredBy: input.triggeredBy ?? existing.triggeredBy,
          actorUsername: input.actorUsername ?? existing.actorUsername,
          sourceId: input.sourceId ?? existing.sourceId,
          jobId: input.jobId ?? existing.jobId,
        },
      });
      return rowToJob(updated);
    }
  }

  const created = await prisma.ingestionJobQueue.create({
    data: {
      jobName: input.jobName,
      jobKind,
      dedupeKey: input.dedupeKey ?? null,
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
  await recordQueueAudit({
    jobQueueId: created.id,
    event: "enqueued",
    toStatus: "pending",
    actorUsername: input.actorUsername ?? null,
    reason: `Enqueued as ${jobKind} (priority ${priority})`,
    metadata: { jobName: input.jobName, contentType: input.contentType ?? null },
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
  const now = new Date();
  const row = await prisma.ingestionJobQueue.findUnique({ where: { id: jobQueueId } });
  const durationMs = row?.startedAt ? now.getTime() - row.startedAt.getTime() : null;
  await prisma.ingestionJobQueue.update({
    where: { id: jobQueueId },
    data: {
      status: "completed",
      finishedAt: now,
      durationMs,
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: summary ?? null,
      lastError: null,
    },
  });
  await recordQueueAudit({
    jobQueueId,
    event: "completed",
    fromStatus: "running",
    toStatus: "completed",
    workerId: row?.leasedBy ?? null,
    reason: summary ?? null,
    metadata: { durationMs },
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
    await recordQueueAudit({
      jobQueueId,
      event: "failed",
      fromStatus: "running",
      toStatus: "failed",
      reason: errorMessage,
      metadata: { attempts: updated.attempts, maxAttempts: updated.maxAttempts },
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
  await recordQueueAudit({
    jobQueueId,
    event: "retrying",
    fromStatus: "running",
    toStatus: "retrying",
    reason: errorMessage,
    metadata: { nextRunAt: nextRunAt.toISOString(), attempts: updated.attempts },
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
  await recordQueueAudit({
    jobQueueId,
    event: "skipped",
    toStatus: "skipped",
    reason,
  });
}

/**
 * Cancellation. Pending / retrying rows are canceled immediately
 * (`canceled` status). Running rows have `cancelRequestedAt` set so
 * the worker stops between batches and releases the lease.
 */
export async function cancelJob(
  jobQueueId: string,
  reason: string,
  actorUsername: string | null = null,
): Promise<{ ok: boolean; status: string }> {
  const row = await prisma.ingestionJobQueue.findUnique({ where: { id: jobQueueId } });
  if (!row) return { ok: false, status: "not_found" };
  if (row.status === "completed") return { ok: false, status: "completed" };
  const now = new Date();
  if (row.status === "running") {
    // Cooperative cancellation — worker checks cancelRequestedAt
    // between batches.
    await prisma.ingestionJobQueue.update({
      where: { id: jobQueueId },
      data: { cancelRequestedAt: now, cancelReason: reason },
    });
    await recordQueueAudit({
      jobQueueId,
      event: "cancel_requested",
      fromStatus: "running",
      toStatus: "running",
      actorUsername,
      reason,
    });
    return { ok: true, status: "cancel_requested" };
  }
  // pending / retrying / skipped / failed — flip to skipped with cancel flags.
  await prisma.ingestionJobQueue.update({
    where: { id: jobQueueId },
    data: {
      status: "skipped",
      finishedAt: now,
      canceledAt: now,
      cancelRequestedAt: now,
      cancelReason: reason,
      leaseExpiresAt: null,
      leasedBy: null,
    },
  });
  await recordQueueAudit({
    jobQueueId,
    event: "canceled",
    fromStatus: row.status,
    toStatus: "skipped",
    actorUsername,
    reason,
  });
  return { ok: true, status: "canceled" };
}

/**
 * Worker-side cancellation check: returns true when the row has a
 * `cancelRequestedAt` set. The worker calls this between batches and
 * exits early when the admin requested cancellation.
 */
export async function isCancelRequested(jobQueueId: string): Promise<boolean> {
  const row = await prisma.ingestionJobQueue.findUnique({
    where: { id: jobQueueId },
    select: { cancelRequestedAt: true },
  });
  return !!row?.cancelRequestedAt;
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
    await recordQueueAudit({
      jobQueueId: null,
      event: "stale_recovered",
      reason: `Recovered ${result.count} stale-leased jobs`,
      metadata: { count: result.count, graceMs: grace },
    });
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
  await recordQueueAudit({
    jobQueueId,
    event: "enqueued",
    fromStatus: "failed",
    toStatus: "pending",
    actorUsername: actorUsername ?? null,
    reason: "Manual retry — attempts reset to 0",
  });
  return rowToJob(updated);
}

/**
 * Queue retention pruner. Completed rows are pruned after
 * `completedRetentionDays` (default 30); failed rows are kept longer
 * (`failedRetentionDays`, default 90) so debugging information stays
 * around. Returns the per-status count of pruned rows.
 */
export async function pruneQueueHistory(
  options: { completedRetentionDays?: number; failedRetentionDays?: number; now?: Date } = {},
): Promise<{ completed: number; skipped: number; failed: number }> {
  const now = options.now ?? new Date();
  const completedDays = options.completedRetentionDays ?? 30;
  const failedDays = options.failedRetentionDays ?? 90;
  const completedCutoff = new Date(now.getTime() - completedDays * 24 * 60 * 60 * 1000);
  const failedCutoff = new Date(now.getTime() - failedDays * 24 * 60 * 60 * 1000);
  const [completed, skipped, failed] = await Promise.all([
    prisma.ingestionJobQueue.deleteMany({
      where: { status: "completed", finishedAt: { lt: completedCutoff } },
    }),
    prisma.ingestionJobQueue.deleteMany({
      where: { status: "skipped", finishedAt: { lt: completedCutoff } },
    }),
    prisma.ingestionJobQueue.deleteMany({
      where: { status: "failed", finishedAt: { lt: failedCutoff } },
    }),
  ]);
  return { completed: completed.count, skipped: skipped.count, failed: failed.count };
}

/**
 * Queue latency snapshot — used by admin dashboard + the
 * "oldest pending job age" alert.
 */
export async function queueLatencySnapshot(): Promise<{
  oldestPendingAgeMs: number | null;
  oldestRetryingAgeMs: number | null;
  avgWaitMs: number | null;
}> {
  const now = Date.now();
  const oldestPending = await prisma.ingestionJobQueue.findFirst({
    where: { status: "pending" },
    orderBy: { runAt: "asc" },
    select: { runAt: true },
  });
  const oldestRetrying = await prisma.ingestionJobQueue.findFirst({
    where: { status: "retrying" },
    orderBy: { runAt: "asc" },
    select: { runAt: true },
  });
  const recentDone = await prisma.ingestionJobQueue.findMany({
    where: { status: "completed", startedAt: { not: null }, finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    take: 50,
    select: { createdAt: true, startedAt: true },
  });
  const waits = recentDone
    .map((r) => (r.startedAt ? r.startedAt.getTime() - r.createdAt.getTime() : 0))
    .filter((w) => w > 0);
  const avgWaitMs = waits.length > 0 ? waits.reduce((a, b) => a + b, 0) / waits.length : null;
  return {
    oldestPendingAgeMs: oldestPending ? now - oldestPending.runAt.getTime() : null,
    oldestRetryingAgeMs: oldestRetrying ? now - oldestRetrying.runAt.getTime() : null,
    avgWaitMs,
  };
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

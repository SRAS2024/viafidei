/**
 * Worker build queue.
 *
 * Approved checklist items are enqueued as WorkerBuildJob rows. The worker
 * leases jobs by setting status=running and a lease expiry; on success it
 * marks succeeded, on failure either retries with exponential backoff or
 * fails terminally. Partial builds persist a partialPayload so progress is
 * not lost between attempts.
 */

import type {
  PrismaClient,
  WorkerBuildJob,
  WorkerBuildStatus,
} from "@prisma/client";

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

export interface EnqueueOptions {
  checklistItemId: string;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
  triggeredBy?: string;
  actorUsername?: string;
}

export async function enqueueBuild(
  prisma: PrismaClient,
  options: EnqueueOptions
): Promise<WorkerBuildJob> {
  const lastAttempt = await prisma.workerBuildJob.findFirst({
    where: { checklistItemId: options.checklistItemId },
    orderBy: { attempt: "desc" },
    select: { attempt: true },
  });
  const attempt = (lastAttempt?.attempt ?? 0) + 1;

  return prisma.workerBuildJob.create({
    data: {
      checklistItemId: options.checklistItemId,
      attempt,
      priority: options.priority ?? 100,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      triggeredBy: options.triggeredBy ?? "automatic",
      actorUsername: options.actorUsername,
    },
  });
}

export async function leaseNextBuildJob(
  prisma: PrismaClient,
  workerId: string,
  options: { leaseMs?: number } = {}
): Promise<WorkerBuildJob | null> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + (options.leaseMs ?? DEFAULT_LEASE_MS));
  return prisma.$transaction(async (tx) => {
    const next = await tx.workerBuildJob.findFirst({
      where: {
        OR: [
          { status: "pending", runAt: { lte: now } },
          {
            status: "running",
            leaseExpiresAt: { lt: now },
          },
          { status: "retrying", runAt: { lte: now } },
        ],
      },
      orderBy: [{ priority: "asc" }, { runAt: "asc" }, { createdAt: "asc" }],
    });
    if (!next) return null;
    return tx.workerBuildJob.update({
      where: { id: next.id },
      data: {
        status: "running",
        startedAt: next.startedAt ?? now,
        leaseExpiresAt: leaseUntil,
        leasedBy: workerId,
      },
    });
  });
}

export async function markBuildSucceeded(
  prisma: PrismaClient,
  jobId: string,
  resultPayload: unknown,
  confidence: number
): Promise<void> {
  const job = await prisma.workerBuildJob.findUnique({
    where: { id: jobId },
    select: { startedAt: true },
  });
  const durationMs = job?.startedAt
    ? Date.now() - job.startedAt.getTime()
    : null;
  await prisma.workerBuildJob.update({
    where: { id: jobId },
    data: {
      status: "succeeded",
      resultPayload: resultPayload as never,
      partialPayload: undefined,
      confidence,
      finishedAt: new Date(),
      durationMs,
      leaseExpiresAt: null,
    },
  });
}

export async function markBuildPartial(
  prisma: PrismaClient,
  jobId: string,
  partialPayload: unknown,
  message: string,
  confidence: number
): Promise<void> {
  await prisma.workerBuildJob.update({
    where: { id: jobId },
    data: {
      status: "partial",
      partialPayload: partialPayload as never,
      errorMessage: message,
      confidence,
      finishedAt: new Date(),
      leaseExpiresAt: null,
    },
  });
}

function backoffMs(attempt: number): number {
  const base = 30_000;
  const cap = 30 * 60 * 1000;
  return Math.min(cap, base * Math.pow(2, attempt - 1));
}

export async function markBuildFailedOrRetry(
  prisma: PrismaClient,
  jobId: string,
  errorMessage: string
): Promise<{ status: WorkerBuildStatus; nextRunAt: Date | null }> {
  const job = await prisma.workerBuildJob.findUnique({
    where: { id: jobId },
  });
  if (!job) {
    throw new Error(`WorkerBuildJob ${jobId} not found`);
  }
  const exhausted = job.attempt >= job.maxAttempts;
  if (exhausted) {
    await prisma.workerBuildJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage,
        finishedAt: new Date(),
        leaseExpiresAt: null,
      },
    });
    return { status: "failed", nextRunAt: null };
  }
  const nextRunAt = new Date(Date.now() + backoffMs(job.attempt));
  await prisma.workerBuildJob.update({
    where: { id: jobId },
    data: {
      status: "retrying",
      errorMessage,
      runAt: nextRunAt,
      finishedAt: new Date(),
      leaseExpiresAt: null,
    },
  });
  return { status: "retrying", nextRunAt };
}

export async function cancelBuild(
  prisma: PrismaClient,
  jobId: string,
  reason?: string,
  actorUsername?: string
): Promise<void> {
  await prisma.workerBuildJob.update({
    where: { id: jobId },
    data: {
      status: "cancelled",
      errorMessage: reason,
      actorUsername,
      finishedAt: new Date(),
      leaseExpiresAt: null,
    },
  });
}

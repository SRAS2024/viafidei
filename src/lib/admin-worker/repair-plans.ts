/**
 * AdminWorkerRepairPlan helpers (spec §14). Durable repair plans that
 * survive process restarts. Distinct from the in-pass repair handlers
 * in `repair.ts`: those run immediately during a pass; these queue up
 * for retry with exponential backoff.
 */

import type {
  AdminWorkerRepairKind,
  AdminWorkerRepairStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

const BASE_BACKOFF_MS = 60_000; // 1 min
const MAX_BACKOFF_MS = 60 * 60_000; // 1h

// A (kind, failedEntity) that ABANDONED recently is a proven dead-end for now
// (e.g. a source that deterministically can't yield a required field, or a
// content type with no newly-discoverable sources). Re-filing it immediately
// just burns another maxAttempts cycle and re-abandons — the churn that pinned
// the "Repair orchestrator FAIL" rating red. Suppress the re-file for this
// cooldown; after it elapses (the source may have improved, or code changed) a
// fresh attempt is allowed again.
const ABANDON_REFILE_COOLDOWN_MS = 7 * 24 * 60 * 60_000; // 7 days

function nextBackoff(attempts: number): Date {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
  return new Date(Date.now() + delay);
}

export interface FilePlanInput {
  kind: AdminWorkerRepairKind;
  failedEntity?: string;
  repairAction: string;
  maxAttempts?: number;
  metadata?: Prisma.InputJsonValue;
}

export async function filePlan(
  prisma: PrismaClient,
  input: FilePlanInput,
): Promise<{ id: string }> {
  if (input.failedEntity) {
    // Coalesce: if there is already a PENDING / RUNNING plan for the same
    // (kind, failedEntity), don't file a duplicate.
    const existing = await prisma.adminWorkerRepairPlan.findFirst({
      where: {
        kind: input.kind,
        failedEntity: input.failedEntity,
        status: { in: ["PENDING", "RUNNING"] },
      },
      select: { id: true },
    });
    if (existing) return existing;
    // Cooldown: if the same (kind, failedEntity) ABANDONED within the cooldown,
    // it is a proven dead-end right now — don't re-file a fresh maxAttempts cycle
    // that will only re-abandon. Return the abandoned plan so callers still get
    // an id but no new attempt is queued.
    const recentlyAbandoned = await prisma.adminWorkerRepairPlan.findFirst({
      where: {
        kind: input.kind,
        failedEntity: input.failedEntity,
        status: "ABANDONED",
        updatedAt: { gte: new Date(Date.now() - ABANDON_REFILE_COOLDOWN_MS) },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (recentlyAbandoned) return recentlyAbandoned;
  }
  return prisma.adminWorkerRepairPlan.create({
    data: {
      kind: input.kind,
      failedEntity: input.failedEntity,
      repairAction: input.repairAction,
      maxAttempts: input.maxAttempts ?? 5,
      nextAttemptAt: new Date(),
      metadata: input.metadata,
    },
    select: { id: true },
  });
}

/**
 * Lease the next due plan + mark it RUNNING. Returns null when no
 * plan is due. Caller must call `completePlan` to mark the outcome.
 */
export async function leaseNextPlan(prisma: PrismaClient) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const plan = await tx.adminWorkerRepairPlan.findFirst({
      where: {
        status: "PENDING",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!plan) return null;
    return tx.adminWorkerRepairPlan.update({
      where: { id: plan.id },
      data: {
        status: "RUNNING",
        lastAttemptAt: now,
        attempts: { increment: 1 },
      },
    });
  });
}

export async function completePlan(
  prisma: PrismaClient,
  id: string,
  input: { status: AdminWorkerRepairStatus; finalResult?: string; retry?: boolean },
): Promise<void> {
  const plan = await prisma.adminWorkerRepairPlan.findUnique({ where: { id } });
  if (!plan) return;

  if (input.retry && plan.attempts < plan.maxAttempts && input.status !== "SUCCEEDED") {
    // Re-queue with exponential backoff.
    await prisma.adminWorkerRepairPlan.update({
      where: { id },
      data: {
        status: "PENDING",
        nextAttemptAt: nextBackoff(plan.attempts),
        finalResult: input.finalResult,
      },
    });
    return;
  }

  await prisma.adminWorkerRepairPlan.update({
    where: { id },
    data: {
      status:
        input.status === "SUCCEEDED"
          ? "SUCCEEDED"
          : plan.attempts >= plan.maxAttempts
            ? "ABANDONED"
            : input.status,
      finalResult: input.finalResult,
      nextAttemptAt: null,
    },
  });
}

export async function countOpenPlansByKind(prisma: PrismaClient) {
  const rows = await prisma.adminWorkerRepairPlan.groupBy({
    by: ["kind"],
    where: { status: { in: ["PENDING", "RUNNING"] } },
    _count: true,
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.kind] = r._count as number;
  return out;
}

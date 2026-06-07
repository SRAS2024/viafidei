/**
 * Autonomous planner. When content goals have unmet gaps and the
 * build queue has no pending work for that content type, the planner
 * generates work items — without manual admin triggering.
 *
 * Spec section 2:
 *   "The Admin Worker should create its own needed work items when
 *    content goals are unmet."
 *   "The Admin Worker should not depend on manual admin triggering
 *    for normal operation."
 *
 * Spec section 6:
 *   "If a content type is below goal, the Admin Worker should
 *    automatically: find sources, discover candidate URLs, fetch
 *    source documents, build content packages, validate content,
 *    publish valid content, update diagnostics, update progress."
 *
 * The "enqueue build jobs from gaps" step: the planner finds
 * approved checklist items for the under-goal content type that have
 * no pending build job and enqueues them. The
 * downstream build engine (already deterministic) does the rest.
 */

import type { ChecklistApprovalStatus, ChecklistContentType, PrismaClient } from "@prisma/client";

import { enqueueBuild } from "@/lib/checklist";
import { refreshContentGoals } from "./content-goals";
import { writeAdminWorkerLog } from "./logs";
import { createTask } from "./tasks";

/** Statuses whose items the planner is allowed to enqueue. */
const ENQUEUABLE_STATUSES: ReadonlyArray<ChecklistApprovalStatus> = [
  "SOURCE_VERIFIED",
  "APPROVED_FOR_BUILD",
];

export interface PlanOutcome {
  contentType: string | null;
  gap: number;
  enqueued: number;
  reason: string;
}

/**
 * Compare goals to live counts and enqueue build jobs to close the
 * largest gap. Returns `enqueued = 0` when no work is available (eg.
 * every gap is already covered by pending jobs or there are no
 * approved items left to build).
 */
export async function planAndEnqueue(
  prisma: PrismaClient,
  opts: { passId?: string; batchSize?: number } = {},
): Promise<PlanOutcome> {
  await refreshContentGoals(prisma);

  const gaps = await prisma.contentGoal.findMany({
    where: { gapCount: { gt: 0 } },
    orderBy: [{ gapCount: "desc" }, { priority: "asc" }],
  });

  if (gaps.length === 0) {
    return { contentType: null, gap: 0, enqueued: 0, reason: "All content goals met." };
  }

  for (const goal of gaps) {
    const contentType = goal.contentType as ChecklistContentType;
    // Already-pending jobs for this content type — don't double-enqueue.
    const pendingForType = await prisma.workerBuildJob.count({
      where: {
        status: "pending",
        checklistItem: { contentType },
      },
    });
    const desiredEnqueue = Math.min(
      opts.batchSize ?? 5,
      Math.max(0, goal.gapCount - pendingForType),
    );
    if (desiredEnqueue === 0) continue;

    const candidates = await prisma.checklistItem.findMany({
      where: {
        contentType,
        approvalStatus: { in: [...ENQUEUABLE_STATUSES] },
        buildJobs: { none: { status: { in: ["pending", "running"] } } },
      },
      orderBy: [{ priority: "asc" }, { discoveredAt: "asc" }],
      take: desiredEnqueue,
    });

    if (candidates.length === 0) {
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId ?? null,
        category: "CONTENT_BUILD",
        severity: "WARN",
        eventName: "planner_no_candidates",
        message: `Goal for ${contentType} has gap ${goal.gapCount} but no SOURCE_VERIFIED / APPROVED_FOR_BUILD items are available.`,
        contentType,
      });
      continue;
    }

    let enqueued = 0;
    for (const item of candidates) {
      await enqueueBuild(prisma, { checklistItemId: item.id, triggeredBy: "admin_worker" });
      await createTask(prisma, {
        passId: opts.passId,
        taskType: "BUILD_CONTENT",
        priority: "CONTENT_BUILD",
        contentType,
        relatedContentId: item.id,
        plannedAction: `Build ${item.canonicalName}`,
      });
      enqueued += 1;
    }

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "planner_enqueued",
      message: `Planner enqueued ${enqueued} ${contentType} build job(s) to close gap ${goal.gapCount}.`,
      contentType,
      safeMetadata: { gap: goal.gapCount, enqueued, pendingExisting: pendingForType },
    });

    return {
      contentType,
      gap: goal.gapCount,
      enqueued,
      reason: `Enqueued ${enqueued} ${contentType} build job(s).`,
    };
  }

  return {
    contentType: gaps[0].contentType,
    gap: gaps[0].gapCount,
    enqueued: 0,
    reason: "Gaps remain but no approvable items are available; needs admin source verification.",
  };
}

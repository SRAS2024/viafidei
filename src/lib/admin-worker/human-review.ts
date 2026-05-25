/**
 * Human review queue. The Admin Worker is designed so this queue stays
 * small — normal publishing never reaches it. Items appear only when:
 *   - confidence is below the publish threshold (0.8 default)
 *   - deletion is uncertain (below the delete threshold, 0.9 default)
 *   - the worker cannot determine the content type
 *   - source evidence conflicts in ways cross-source can't reconcile
 *   - the change is a major homepage redesign
 *   - a schema conflict is detected
 */

import type { HumanReviewStatus, Prisma, PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export interface FileHumanReviewInput {
  taskId?: string;
  contentType?: string;
  contentTitle?: string;
  proposedAction: string;
  reason: string;
  confidence: number;
  sourceEvidence?: Prisma.InputJsonValue;
  currentVersion?: Prisma.InputJsonValue;
  proposedVersion?: Prisma.InputJsonValue;
}

export async function fileHumanReview(
  prisma: PrismaClient,
  input: FileHumanReviewInput,
): Promise<{ id: string }> {
  const row = await prisma.humanReviewQueue.create({
    data: {
      taskId: input.taskId,
      contentType: input.contentType,
      contentTitle: input.contentTitle,
      proposedAction: input.proposedAction,
      reason: input.reason,
      confidence: input.confidence,
      sourceEvidence: input.sourceEvidence,
      currentVersion: input.currentVersion,
      proposedVersion: input.proposedVersion,
      status: "PENDING",
    },
    select: { id: true },
  });

  await writeAdminWorkerLog(prisma, {
    taskId: input.taskId ?? null,
    category: "PUBLISHING",
    severity: "WARN",
    eventName: "human_review_filed",
    message: `Filed human review for "${input.contentTitle ?? input.contentType ?? "item"}": ${input.reason}`,
    contentType: input.contentType ?? null,
    relatedEntityId: row.id,
    safeMetadata: {
      proposedAction: input.proposedAction,
      confidence: input.confidence,
    },
  });

  return row;
}

export async function listPendingReview(prisma: PrismaClient, opts: { limit?: number } = {}) {
  return prisma.humanReviewQueue.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
  });
}

export async function resolveReview(
  prisma: PrismaClient,
  reviewId: string,
  input: { status: HumanReviewStatus; byUsername: string; notes?: string },
): Promise<void> {
  await prisma.humanReviewQueue.update({
    where: { id: reviewId },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedByUsername: input.byUsername,
      reviewerNotes: input.notes,
    },
  });
}

export async function countPendingReview(prisma: PrismaClient): Promise<number> {
  return prisma.humanReviewQueue.count({ where: { status: "PENDING" } });
}

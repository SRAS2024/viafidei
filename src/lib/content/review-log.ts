import type { ReviewDecision } from "@prisma/client";
import { prisma } from "../db/client";
import type { ReviewActor, ReviewableEntityType } from "./types";

export async function recordReview(args: {
  entityType: ReviewableEntityType;
  entityId: string;
  decision: ReviewDecision;
  notes?: string | null;
  actor: ReviewActor;
}) {
  return prisma.contentReview.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      decision: args.decision,
      notes: args.notes ?? null,
      reviewerUserId: args.actor.userId ?? null,
      reviewerUsername: args.actor.username ?? null,
    },
  });
}

export function listReviewHistory(
  entityType: ReviewableEntityType,
  entityId: string,
  take = 50,
) {
  return prisma.contentReview.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function listPendingReviews(take = 50) {
  return prisma.contentReview.findMany({
    where: { decision: "PENDING" },
    orderBy: { createdAt: "asc" },
    take,
  });
}

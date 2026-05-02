import { recordReview } from "./review-log";
import { getEntityStatus, setEntityStatus } from "./status-update";
import { canPublish, canReject, canRequestRevision } from "./transitions";
import type { ReviewActionOutcome, ReviewActor, ReviewableEntityType } from "./types";

type ReviewArgs = {
  entityType: ReviewableEntityType;
  entityId: string;
  actor: ReviewActor;
  notes?: string | null;
};

export async function approveContent(args: ReviewArgs): Promise<ReviewActionOutcome> {
  const current = await getEntityStatus(args.entityType, args.entityId);
  if (current === null) return { ok: false, reason: "not-found" };
  if (!canPublish(current)) return { ok: false, reason: `cannot-publish-from-${current}` };

  const updated = await setEntityStatus(args.entityType, args.entityId, "PUBLISHED");
  if (!updated) return { ok: false, reason: "update-failed" };

  await recordReview({
    entityType: args.entityType,
    entityId: args.entityId,
    decision: "APPROVED",
    notes: args.notes ?? null,
    actor: args.actor,
  });

  return { ok: true, status: "PUBLISHED", decision: "APPROVED" };
}

export async function rejectContent(args: ReviewArgs): Promise<ReviewActionOutcome> {
  const current = await getEntityStatus(args.entityType, args.entityId);
  if (current === null) return { ok: false, reason: "not-found" };
  if (!canReject(current)) return { ok: false, reason: `cannot-reject-from-${current}` };

  const updated = await setEntityStatus(args.entityType, args.entityId, "ARCHIVED");
  if (!updated) return { ok: false, reason: "update-failed" };

  await recordReview({
    entityType: args.entityType,
    entityId: args.entityId,
    decision: "REJECTED",
    notes: args.notes ?? null,
    actor: args.actor,
  });

  return { ok: true, status: "ARCHIVED", decision: "REJECTED" };
}

export async function requestRevision(args: ReviewArgs): Promise<ReviewActionOutcome> {
  const current = await getEntityStatus(args.entityType, args.entityId);
  if (current === null) return { ok: false, reason: "not-found" };
  if (!canRequestRevision(current)) {
    return { ok: false, reason: `cannot-request-revision-from-${current}` };
  }

  const updated = await setEntityStatus(args.entityType, args.entityId, "DRAFT");
  if (!updated) return { ok: false, reason: "update-failed" };

  await recordReview({
    entityType: args.entityType,
    entityId: args.entityId,
    decision: "REVISION_REQUESTED",
    notes: args.notes ?? null,
    actor: args.actor,
  });

  return { ok: true, status: "DRAFT", decision: "REVISION_REQUESTED" };
}

export async function moveToReview(args: ReviewArgs): Promise<ReviewActionOutcome> {
  const current = await getEntityStatus(args.entityType, args.entityId);
  if (current === null) return { ok: false, reason: "not-found" };
  if (current !== "DRAFT") return { ok: false, reason: `cannot-review-from-${current}` };

  const updated = await setEntityStatus(args.entityType, args.entityId, "REVIEW");
  if (!updated) return { ok: false, reason: "update-failed" };

  await recordReview({
    entityType: args.entityType,
    entityId: args.entityId,
    decision: "PENDING",
    notes: args.notes ?? null,
    actor: args.actor,
  });

  return { ok: true, status: "REVIEW", decision: "PENDING" };
}

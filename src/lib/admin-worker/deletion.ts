/**
 * Deletion gate. The Admin Worker rarely deletes content; when it
 * does, every deletion is precise and logged.
 *
 * Spec section 9: automatic deletion is allowed only when one of nine
 * criteria is clearly true AND the confidence is at or above
 * CONFIDENCE_THRESHOLDS.delete. Below that confidence, the proposal is
 * routed to human review.
 *
 * Logged fields (mandatory): content type, title, source URL, reason,
 * failed fields, confidence score, timestamp, worker task ID.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { CONFIDENCE_THRESHOLDS } from "./decisions";
import { fileHumanReview } from "./human-review";
import { writeAdminWorkerLog } from "./logs";

export type DeletionReason =
  | "wrong_content_type"
  | "duplicate"
  | "meaningless_content"
  | "spam"
  | "broken_or_empty_package"
  | "failed_strict_qa_no_recoverable_path"
  | "violates_content_contract"
  | "clearly_not_catholic"
  | "clearly_junk_page";

export const DELETION_REASONS: readonly DeletionReason[] = [
  "wrong_content_type",
  "duplicate",
  "meaningless_content",
  "spam",
  "broken_or_empty_package",
  "failed_strict_qa_no_recoverable_path",
  "violates_content_contract",
  "clearly_not_catholic",
  "clearly_junk_page",
];

export interface DeletionInput {
  contentType: string;
  contentTitle: string;
  contentId: string;
  sourceUrl?: string;
  reason: DeletionReason;
  failedFields: string[];
  confidence: number;
  taskId?: string;
}

export type DeletionDecision =
  | { kind: "delete"; reason: string }
  | { kind: "review"; reason: string };

export function evaluateDeletion(input: DeletionInput): DeletionDecision {
  if (!DELETION_REASONS.includes(input.reason)) {
    return {
      kind: "review",
      reason: `Unrecognised deletion reason: ${input.reason}. Routing to review.`,
    };
  }
  if (input.confidence < CONFIDENCE_THRESHOLDS.delete) {
    return {
      kind: "review",
      reason: `Confidence ${input.confidence.toFixed(2)} below delete threshold ${CONFIDENCE_THRESHOLDS.delete}.`,
    };
  }
  return {
    kind: "delete",
    reason: `Clear ${input.reason} at confidence ${input.confidence.toFixed(2)}.`,
  };
}

/**
 * Apply the deletion decision. When the decision is `delete`, write a
 * structured log row and unpublish the corresponding PublishedContent
 * row. When the decision is `review`, file a HumanReviewQueue row
 * instead. Either way, the spec-required fields are persisted.
 */
export async function applyDeletion(
  prisma: PrismaClient,
  input: DeletionInput,
): Promise<{ outcome: "deleted" | "filed_for_review"; logId: string }> {
  const decision = evaluateDeletion(input);

  if (decision.kind === "review") {
    const review = await fileHumanReview(prisma, {
      taskId: input.taskId,
      contentType: input.contentType,
      contentTitle: input.contentTitle,
      proposedAction: `delete:${input.reason}`,
      reason: decision.reason,
      confidence: input.confidence,
      sourceEvidence: {
        sourceUrl: input.sourceUrl ?? null,
        failedFields: input.failedFields,
      } satisfies Prisma.InputJsonValue,
    });
    return { outcome: "filed_for_review", logId: review.id };
  }

  // Unpublish the content. The actual delete is left to the existing
  // janitor / cleanup paths so we keep a single source of truth for
  // PublishedContent mutations; we only flip `isPublished` here and
  // log the structured deletion record.
  await prisma.publishedContent
    .updateMany({
      where: { id: input.contentId, isPublished: true },
      data: { isPublished: false, unpublishedAt: new Date() },
    })
    .catch(() => undefined);

  await writeAdminWorkerLog(prisma, {
    taskId: input.taskId ?? null,
    category: "PUBLISHING",
    severity: "WARN",
    eventName: "content_deleted",
    message: `Deleted "${input.contentTitle}" (${input.contentType}): ${decision.reason}`,
    contentType: input.contentType,
    relatedEntityId: input.contentId,
    sourceUrl: input.sourceUrl ?? null,
    safeMetadata: {
      reason: input.reason,
      failedFields: input.failedFields,
      confidence: input.confidence,
      timestamp: new Date().toISOString(),
      workerTaskId: input.taskId ?? null,
    } satisfies Prisma.InputJsonValue,
  });

  // Use the AdminWorkerLog row id as the deletion log id since it
  // already captures every spec-required field.
  const logRow = await prisma.adminWorkerLog.findFirst({
    where: { relatedEntityId: input.contentId, eventName: "content_deleted" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return { outcome: "deleted", logId: logRow?.id ?? "unknown" };
}

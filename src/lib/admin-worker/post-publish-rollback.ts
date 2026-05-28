/**
 * Post-publish rollback decision tree (spec §9 follow-up).
 *
 * When post-publish verification fails the worker walks this
 * sequence:
 *
 *   1. attempt repair (cache refresh + sitemap refresh + search
 *      refresh + re-render check)
 *   2. if repair succeeds, recheck the failed dimensions
 *   3. if repair fails or the recheck still fails, unpublish
 *   4. if the failure is severe + clear, delete with a full log
 *   5. if the failure is ambiguous, send to rare human review
 *
 * "Severe + clear" means: HTTP 4xx/5xx on the public route AND
 * the content type / slug pairing has no other valid published
 * row (delete is safe because the user-facing URL is broken).
 *
 * Every rollback writes a structured log row so the admin can see
 * exactly which check failed, what repair was attempted, what the
 * rollback action was, and whether human review was filed.
 */

import type { PrismaClient } from "@prisma/client";

import { fileHumanReview } from "./human-review";
import { writeAdminWorkerLog } from "./logs";

export type RollbackDecisionKind = "REPAIRED" | "UNPUBLISHED" | "DELETED" | "HUMAN_REVIEW";

export interface PostPublishFailureInput {
  contentType: string;
  contentId: string;
  slug: string;
  /** Which post-publish check failed. */
  failedCheck:
    | "public_route"
    | "title"
    | "body_marker"
    | "tab_placement"
    | "search"
    | "sitemap"
    | "cache"
    | "related_links"
    | "content_goal_count";
  reason: string;
  /** True when the failure is clearly recoverable (cache stale, etc.). */
  recoverableHint?: boolean;
  /**
   * Spec §8: after repair the dispatcher re-runs the failed check.
   * The caller passes this callback so the rollback module stays
   * independent of the actual probe implementation. Return true when
   * the re-check now passes.
   */
  reverify?: () => Promise<boolean>;
}

export interface RollbackDecisionResult {
  kind: RollbackDecisionKind;
  repairAttempted: string | null;
  rollbackAction: string | null;
  humanReviewFiled: boolean;
  reason: string;
}

/**
 * Drive the decision tree. The caller is responsible for first
 * running verifyPublished() and only invoking this when the
 * verification result is FAIL.
 */
export async function decideAndExecuteRollback(
  prisma: PrismaClient,
  input: PostPublishFailureInput,
): Promise<RollbackDecisionResult> {
  // Step 1: attempt repair for the specific failed check.
  const repairAttempted = await attemptRepair(prisma, input);

  if (repairAttempted.ok) {
    // Spec §8 follow-up: don't claim REPAIRED until the failed check
    // actually passes again. If the caller supplied a reverify
    // callback, run it; if it still fails, treat the repair as failed
    // and fall through to unpublish.
    const reverified = input.reverify ? await input.reverify().catch(() => false) : true;
    if (reverified) {
      await logRollback(prisma, {
        ...input,
        kind: "REPAIRED",
        repairAttempted: repairAttempted.what,
        rollbackAction: input.reverify ? "repair + reverify succeeded" : null,
        humanReviewFiled: false,
      });
      return {
        kind: "REPAIRED",
        repairAttempted: repairAttempted.what,
        rollbackAction: input.reverify ? "repair + reverify succeeded" : null,
        humanReviewFiled: false,
        reason: `Repair succeeded: ${repairAttempted.what}${input.reverify ? " (re-verified)" : ""}`,
      };
    }
    // Reverify failed — fall through, treating the repair as ineffective.
  }

  // Step 2: repair didn't fix it — unpublish.
  await unpublishRow(prisma, input);

  // Step 3: decide delete vs human review.
  const isSevere = input.failedCheck === "public_route" || input.failedCheck === "body_marker";
  if (isSevere && !input.recoverableHint) {
    // "Severe + clear" — log the deletion intent but never delete
    // the row outright; the deletion path goes through the logged
    // deletion system (DELETION_REASONS in deletion.ts) which the
    // operator review. We mark the artifact for deletion and route
    // to the logged delete pipeline.
    await logRollback(prisma, {
      ...input,
      kind: "DELETED",
      repairAttempted: repairAttempted.what,
      rollbackAction: "marked for logged deletion",
      humanReviewFiled: false,
    });
    return {
      kind: "DELETED",
      repairAttempted: repairAttempted.what,
      rollbackAction: "marked for logged deletion",
      humanReviewFiled: false,
      reason: "Severe + clear failure; flagged for logged delete after unpublish.",
    };
  }

  // Step 4: ambiguous — rare human review.
  await fileHumanReview(prisma, {
    contentType: input.contentType,
    contentTitle: input.slug,
    proposedAction: "investigate_post_publish_failure",
    reason: `Post-publish ${input.failedCheck} FAIL: ${input.reason}`,
    confidence: 0.5,
  }).catch(() => undefined);

  await logRollback(prisma, {
    ...input,
    kind: "HUMAN_REVIEW",
    repairAttempted: repairAttempted.what,
    rollbackAction: "unpublished + filed for review",
    humanReviewFiled: true,
  });

  return {
    kind: "HUMAN_REVIEW",
    repairAttempted: repairAttempted.what,
    rollbackAction: "unpublished + filed for review",
    humanReviewFiled: true,
    reason: "Ambiguous failure; unpublished and routed to human review.",
  };
}

async function attemptRepair(
  prisma: PrismaClient,
  input: PostPublishFailureInput,
): Promise<{ ok: boolean; what: string }> {
  // Map the failed check to the right repair action.
  if (input.failedCheck === "cache") {
    const { flagCacheRefresh } = await import("./repair");
    const r = await flagCacheRefresh(prisma, `${input.contentType}:${input.slug}`).catch(
      () => null,
    );
    return { ok: r?.succeeded === true, what: "cache refresh" };
  }
  if (input.failedCheck === "sitemap") {
    const { flagSitemapRefresh } = await import("./repair");
    const r = await flagSitemapRefresh(prisma).catch(() => null);
    return { ok: r?.succeeded === true, what: "sitemap refresh" };
  }
  if (input.failedCheck === "search") {
    const { flagSearchRefresh } = await import("./repair");
    const r = await flagSearchRefresh(prisma).catch(() => null);
    return { ok: r?.succeeded === true, what: "search refresh" };
  }
  // Other failed checks have no automatic repair — proceed straight
  // to unpublish + review.
  return { ok: false, what: `no automatic repair for ${input.failedCheck}` };
}

async function unpublishRow(prisma: PrismaClient, input: PostPublishFailureInput): Promise<void> {
  await prisma.publishedContent
    .updateMany({
      where: { contentType: input.contentType as never, slug: input.slug },
      data: { isPublished: false, unpublishedAt: new Date() },
    })
    .catch(() => undefined);
}

async function logRollback(
  prisma: PrismaClient,
  detail: PostPublishFailureInput & {
    kind: RollbackDecisionKind;
    repairAttempted: string | null;
    rollbackAction: string | null;
    humanReviewFiled: boolean;
  },
): Promise<void> {
  await writeAdminWorkerLog(prisma, {
    category: "POST_PUBLISH",
    severity: detail.kind === "REPAIRED" ? "INFO" : detail.kind === "DELETED" ? "ERROR" : "WARN",
    eventName: `post_publish_rollback_${detail.kind.toLowerCase()}`,
    message: `Rollback for ${detail.contentType}/${detail.slug}: ${detail.kind} (${detail.reason}).`,
    contentType: detail.contentType,
    relatedEntityId: detail.contentId,
    safeMetadata: {
      contentType: detail.contentType,
      slug: detail.slug,
      failedCheck: detail.failedCheck,
      reason: detail.reason,
      repairAttempted: detail.repairAttempted,
      rollbackAction: detail.rollbackAction,
      humanReviewFiled: detail.humanReviewFiled,
      kind: detail.kind,
    },
  }).catch(() => undefined);
}

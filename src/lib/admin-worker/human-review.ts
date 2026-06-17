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
import { translatePrayerLanguages } from "./prayer-translator";
import { computeContentChecksum } from "./cache-freshness";

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

type ReviewItem = {
  id: string;
  proposedAction: string;
  contentTitle: string | null;
  contentType: string | null;
  sourceEvidence: Prisma.JsonValue | null;
};

/**
 * Apply an APPROVED review's proposed change to live content. Today the only
 * executable action is CONFIRM_TRANSLATION: write the confirmed Latin/Greek onto
 * the published prayer (so "approve" actually publishes the translation, not just
 * flips a status). Best-effort + idempotent; unknown actions record the approval
 * without a content change.
 */
export async function executeApprovedReview(
  prisma: PrismaClient,
  item: ReviewItem,
): Promise<{ applied: boolean; detail: string }> {
  if (item.proposedAction === "CONFIRM_TRANSLATION") {
    const ev = (item.sourceEvidence ?? {}) as { language?: string; text?: string };
    const field = ev.language === "la" ? "latin" : ev.language === "el" ? "greek" : null;
    if (!field || !ev.text?.trim() || !item.contentTitle) {
      return { applied: false, detail: "incomplete translation evidence" };
    }
    const row = await prisma.publishedContent
      .findFirst({
        where: { contentType: "PRAYER", isPublished: true, title: item.contentTitle },
        select: { id: true, title: true, slug: true, payload: true },
      })
      .catch(() => null);
    if (!row) return { applied: false, detail: "prayer no longer published" };
    const payload = { ...((row.payload ?? {}) as Record<string, unknown>), [field]: ev.text };
    await prisma.publishedContent.update({
      where: { id: row.id },
      data: {
        payload: payload as Prisma.InputJsonValue,
        contentChecksum: computeContentChecksum(row.title, payload),
      },
    });
    try {
      const { flagCacheRefresh } = await import("./repair");
      await flagCacheRefresh(prisma, `PRAYER:${row.slug}`).catch(() => undefined);
    } catch {
      // best-effort
    }
    return { applied: true, detail: `applied ${field} to "${row.title}"` };
  }
  return {
    applied: false,
    detail: `approval recorded (no auto-executor for ${item.proposedAction})`,
  };
}

export async function resolveReview(
  prisma: PrismaClient,
  reviewId: string,
  input: { status: HumanReviewStatus; byUsername: string; notes?: string },
): Promise<{ applied: boolean; detail: string }> {
  const item = await prisma.humanReviewQueue
    .findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        proposedAction: true,
        contentTitle: true,
        contentType: true,
        sourceEvidence: true,
      },
    })
    .catch(() => null);
  if (!item) return { applied: false, detail: "review not found" };

  // On APPROVED, actually apply the change before recording the decision.
  let exec = { applied: false, detail: "" };
  if (input.status === "APPROVED") {
    exec = await executeApprovedReview(prisma, item).catch((e) => ({
      applied: false,
      detail: e instanceof Error ? e.message : "execute error",
    }));
  }

  await prisma.humanReviewQueue.update({
    where: { id: reviewId },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedByUsername: input.byUsername,
      reviewerNotes: input.notes,
    },
  });
  return exec;
}

/**
 * Autonomously resolve the review items the worker can decide ON ITS OWN, so the
 * queue stops piling up waiting for a human. Accuracy is never traded for an
 * empty queue — only safe decisions are made:
 *   - a translation proposal whose prayer ALREADY carries that language is
 *     redundant → auto-REJECT;
 *   - one the prayer no longer exists for → auto-REJECT (moot);
 *   - one the deterministic CANONICAL engine can now resolve authentically →
 *     apply the AUTHENTIC received text (never the machine guess) + APPROVE.
 * A genuine machine-only proposal is LEFT for a human. Bounded + fail-open, and
 * wired into the loop so it runs every pass.
 */
export async function runReviewAutoResolve(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<{ scanned: number; approved: number; rejected: number; left: number; detail: string }> {
  const out = { scanned: 0, approved: 0, rejected: 0, left: 0, detail: "" };
  const items = await prisma.humanReviewQueue
    .findMany({
      where: { status: "PENDING", proposedAction: "CONFIRM_TRANSLATION" },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? 50,
      select: { id: true, contentTitle: true, sourceEvidence: true },
    })
    .catch(
      () =>
        [] as Array<{
          id: string;
          contentTitle: string | null;
          sourceEvidence: Prisma.JsonValue | null;
        }>,
    );

  for (const item of items) {
    const ev = (item.sourceEvidence ?? {}) as { language?: string };
    const field = ev.language === "la" ? "latin" : ev.language === "el" ? "greek" : null;
    if (!field || !item.contentTitle) continue;
    out.scanned += 1;

    const row = await prisma.publishedContent
      .findFirst({
        where: { contentType: "PRAYER", isPublished: true, title: item.contentTitle },
        select: { payload: true },
      })
      .catch(() => null);
    if (!row) {
      await resolveReview(prisma, item.id, {
        status: "REJECTED",
        byUsername: "admin-worker",
        notes: "Prayer no longer published — proposal moot.",
      }).catch(() => undefined);
      out.rejected += 1;
      continue;
    }
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    if (typeof payload[field] === "string" && (payload[field] as string).trim()) {
      await resolveReview(prisma, item.id, {
        status: "REJECTED",
        byUsername: "admin-worker",
        notes: `Already has authentic ${field} — proposal redundant.`,
      }).catch(() => undefined);
      out.rejected += 1;
      continue;
    }
    const english =
      typeof payload.body === "string"
        ? payload.body
        : typeof payload.prayerText === "string"
          ? (payload.prayerText as string)
          : "";
    const canonical = english ? translatePrayerLanguages(english) : undefined;
    const authentic = field === "latin" ? canonical?.latin : canonical?.greek;
    if (authentic) {
      // Swap the machine evidence for the AUTHENTIC received text, then approve —
      // executeApprovedReview writes that authentic text onto the prayer.
      await prisma.humanReviewQueue
        .update({
          where: { id: item.id },
          data: {
            sourceEvidence: { language: ev.language, provider: "canonical", text: authentic },
          },
        })
        .catch(() => undefined);
      await resolveReview(prisma, item.id, {
        status: "APPROVED",
        byUsername: "admin-worker",
        notes: "Resolved with authentic canonical text.",
      }).catch(() => undefined);
      out.approved += 1;
      continue;
    }
    out.left += 1; // genuine machine-only proposal — needs a human
  }

  out.detail = `auto-resolved ${out.approved + out.rejected}/${out.scanned} translation review(s): ${out.approved} applied authentic, ${out.rejected} redundant/moot, ${out.left} left for a human.`;
  if (out.approved + out.rejected > 0) {
    await writeAdminWorkerLog(prisma, {
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "review_auto_resolve",
      message: `Human-review auto-resolve: ${out.detail}`,
      safeMetadata: { ...out },
    }).catch(() => undefined);
  }
  return out;
}

export async function countPendingReview(prisma: PrismaClient): Promise<number> {
  return prisma.humanReviewQueue.count({ where: { status: "PENDING" } });
}

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

const TRANSLATION_ACTIONS = new Set([
  "CONFIRM_TRANSLATION",
  "TRANSLATE_TO_LATIN",
  "TRANSLATE_TO_GREEK",
]);

function hasText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** The Latin/Greek field a translation review targets, from its action + evidence. */
function translationField(
  action: string,
  ev: { language?: unknown; targetLanguage?: unknown },
): "latin" | "greek" | null {
  if (action === "TRANSLATE_TO_LATIN") return "latin";
  if (action === "TRANSLATE_TO_GREEK") return "greek";
  const lang = typeof ev.language === "string" ? ev.language : "";
  if (lang === "la") return "latin";
  if (lang === "el") return "greek";
  const tl = typeof ev.targetLanguage === "string" ? ev.targetLanguage.toLowerCase() : "";
  if (tl.includes("latin")) return "latin";
  if (tl.includes("greek")) return "greek";
  return null;
}

/** Is a content item with this title OR slug currently published? */
async function contentIsLive(
  prisma: PrismaClient,
  contentType: string | null,
  key: string | null,
): Promise<boolean> {
  if (!contentType || !key) return false;
  const row = await prisma.publishedContent
    .findFirst({
      where: {
        contentType: contentType as never,
        isPublished: true,
        OR: [{ title: key }, { slug: key }],
      },
      select: { id: true },
    })
    .catch(() => null);
  return Boolean(row);
}

/** Does the day named in a "Daily readings — YYYY-MM-DD" review now carry verified text? */
async function dailyReadingVerified(prisma: PrismaClient, title: string | null): Promise<boolean> {
  const m = (title ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const row = await prisma.dailyReading
    .findFirst({ where: { date }, select: { sections: true } })
    .catch(() => null);
  if (!row) return false;
  const sections = Array.isArray(row.sections) ? (row.sections as unknown[]) : [];
  return sections.some(
    (s) => s != null && typeof s === "object" && hasText((s as { body?: unknown }).body),
  );
}

async function rejectReview(prisma: PrismaClient, id: string, notes: string): Promise<void> {
  await prisma.humanReviewQueue
    .update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUsername: "admin-worker",
        reviewerNotes: notes,
      },
    })
    .catch(() => undefined);
}

/**
 * Resolve one translation review the worker can decide on its own. Returns
 * "approved" (authentic text applied), "rejected" (redundant/moot), or "left".
 */
async function resolveTranslationReview(
  prisma: PrismaClient,
  item: { id: string; contentTitle: string | null; sourceEvidence: Prisma.JsonValue | null },
  action: string,
): Promise<"approved" | "rejected" | "left"> {
  const ev = (item.sourceEvidence ?? {}) as { language?: unknown; targetLanguage?: unknown };
  const field = translationField(action, ev);
  if (!field || !item.contentTitle) return "left";

  // The filers key on either the prayer title (CONFIRM_TRANSLATION) or its slug
  // (TRANSLATE_TO_*), so match on either.
  const row = await prisma.publishedContent
    .findFirst({
      where: {
        contentType: "PRAYER",
        isPublished: true,
        OR: [{ title: item.contentTitle }, { slug: item.contentTitle }],
      },
      select: { id: true, title: true, slug: true, payload: true },
    })
    .catch(() => null);
  if (!row) {
    await rejectReview(prisma, item.id, "Prayer no longer published — proposal moot.");
    return "rejected";
  }
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  if (hasText(payload[field])) {
    await rejectReview(prisma, item.id, `Already has authentic ${field} — proposal redundant.`);
    return "rejected";
  }
  const english = hasText(payload.body)
    ? (payload.body as string)
    : hasText(payload.prayerText)
      ? (payload.prayerText as string)
      : "";
  const canonical = english ? translatePrayerLanguages(english) : undefined;
  const authentic = field === "latin" ? canonical?.latin : canonical?.greek;
  if (authentic) {
    // Apply the AUTHENTIC received text (never a machine guess) directly, then
    // approve. Recompute the freshness marker so cache verification still passes.
    const newPayload = { ...payload, [field]: authentic };
    await prisma.publishedContent
      .update({
        where: { id: row.id },
        data: {
          payload: newPayload as Prisma.InputJsonValue,
          contentChecksum: computeContentChecksum(row.title, newPayload),
        },
      })
      .catch(() => undefined);
    try {
      const { flagCacheRefresh } = await import("./repair");
      await flagCacheRefresh(prisma, `PRAYER:${row.slug}`).catch(() => undefined);
    } catch {
      // best-effort
    }
    await prisma.humanReviewQueue
      .update({
        where: { id: item.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedByUsername: "admin-worker",
          reviewerNotes: `Resolved with authentic canonical ${field}.`,
        },
      })
      .catch(() => undefined);
    return "approved";
  }
  // A genuine gap with no authentic form. The prayer-translation backfill fills
  // it from the machine provider when one is configured (then the next sweep
  // rejects this as redundant); otherwise it is left for a human.
  return "left";
}

/**
 * Autonomously resolve the review items the worker can decide ON ITS OWN, so the
 * queue stops piling up waiting for a human. Accuracy is never traded for an
 * empty queue — only SAFE decisions are made:
 *   - translation reviews (CONFIRM_TRANSLATION / TRANSLATE_TO_LATIN / _GREEK):
 *     apply the AUTHENTIC received text when the canonical engine resolves it,
 *     reject when the prayer already carries that language (redundant) or no
 *     longer exists (moot), and leave a genuine machine-only gap for a human;
 *   - a `publish` / `PUBLISH_PARISH` proposal whose content is now live → REJECT
 *     (moot — it published through the pipeline since);
 *   - a `delete:*` proposal whose content is already gone → REJECT (moot);
 *   - an `investigate_post_publish_failure` whose content is published + healthy
 *     again → REJECT (moot);
 *   - a `publish-daily-readings` whose day now carries verified text → REJECT.
 * Genuinely-undecidable items (a real low-confidence publish, a live deletion
 * candidate, an unresolved sacred-text gap) are LEFT for a human. Bounded +
 * fail-open, and wired into the loop so it runs every pass and on every
 * stuckness signal.
 */
export async function runReviewAutoResolve(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<{ scanned: number; approved: number; rejected: number; left: number; detail: string }> {
  const out = { scanned: 0, approved: 0, rejected: 0, left: 0, detail: "" };
  const items = await prisma.humanReviewQueue
    .findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? 200,
      select: {
        id: true,
        proposedAction: true,
        contentTitle: true,
        contentType: true,
        sourceEvidence: true,
      },
    })
    .catch(
      () =>
        [] as Array<{
          id: string;
          proposedAction: string;
          contentTitle: string | null;
          contentType: string | null;
          sourceEvidence: Prisma.JsonValue | null;
        }>,
    );

  for (const item of items) {
    out.scanned += 1;
    const action = item.proposedAction ?? "";

    if (TRANSLATION_ACTIONS.has(action)) {
      const r = await resolveTranslationReview(prisma, item, action);
      if (r === "approved") out.approved += 1;
      else if (r === "rejected") out.rejected += 1;
      else out.left += 1;
      continue;
    }

    if (action === "publish" || action === "PUBLISH_PARISH") {
      if (await contentIsLive(prisma, item.contentType, item.contentTitle)) {
        await rejectReview(prisma, item.id, "Content is now published — proposal moot.");
        out.rejected += 1;
      } else {
        out.left += 1;
      }
      continue;
    }

    if (action.startsWith("delete:")) {
      if (
        item.contentTitle &&
        !(await contentIsLive(prisma, item.contentType, item.contentTitle))
      ) {
        await rejectReview(prisma, item.id, "Content already removed — deletion moot.");
        out.rejected += 1;
      } else {
        out.left += 1;
      }
      continue;
    }

    if (action === "investigate_post_publish_failure") {
      if (await contentIsLive(prisma, item.contentType, item.contentTitle)) {
        await rejectReview(prisma, item.id, "Content is published and healthy again — moot.");
        out.rejected += 1;
      } else {
        out.left += 1;
      }
      continue;
    }

    if (action === "publish-daily-readings") {
      if (await dailyReadingVerified(prisma, item.contentTitle)) {
        await rejectReview(prisma, item.id, "Readings now verified for this day — moot.");
        out.rejected += 1;
      } else {
        out.left += 1;
      }
      continue;
    }

    out.left += 1; // no safe autonomous decision — leave for a human
  }

  out.detail = `auto-resolved ${out.approved + out.rejected}/${out.scanned} review(s): ${out.approved} applied authentic, ${out.rejected} redundant/moot, ${out.left} left for a human.`;
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

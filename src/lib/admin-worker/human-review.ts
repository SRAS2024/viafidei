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
import { requireHumanReview } from "./policy";

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
  // Review-queue intelligence: so every queued item explains itself and never
  // sits unexplained (adaptive-worker Phase A).
  blockingGate?: string;
  neededAction?: string;
  repairSuggestion?: string;
  nextAutomatedAction?: string;
  /**
   * Create the queue row even in full-autonomy mode. Reserved for decisions the
   * worker cannot undo on its own — an automated unpublish of live content —
   * so an operator always has a row to restore from.
   */
  alwaysQueue?: boolean;
}

export async function fileHumanReview(
  prisma: PrismaClient,
  input: FileHumanReviewInput,
): Promise<{ id: string }> {
  // Full autonomy (default): the worker NEVER parks work for a human. Instead of
  // queueing, it records the terminal decision it made on its own — do NOT
  // perform the uncertain action — as an audit log, and returns. Accuracy is
  // preserved: nothing uncertain is published or deleted; the worker simply
  // moves on and revisits autonomously when better evidence / a capability is
  // available. Opt back into human-gated review with
  // ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1.
  if (!requireHumanReview() && !input.alwaysQueue) {
    await writeAdminWorkerLog(prisma, {
      taskId: input.taskId ?? null,
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "autonomous_decision",
      message: `Autonomous decision (no human review required) for "${
        input.contentTitle ?? input.contentType ?? "item"
      }": did not perform "${input.proposedAction}" on an uncertain item — ${input.reason}. The worker will revisit it on its own.`,
      contentType: input.contentType ?? null,
      safeMetadata: {
        proposedAction: input.proposedAction,
        confidence: input.confidence,
        autonomous: true,
      },
    }).catch(() => undefined);
    return { id: "autonomous" };
  }

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
      blockingGate: input.blockingGate,
      neededAction: input.neededAction,
      repairSuggestion: input.repairSuggestion,
      nextAutomatedAction: input.nextAutomatedAction,
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
 * Items that are not moot/redundant/authentically-resolvable get the worker's
 * own SAFE terminal decision in autonomous mode (the default): decline the
 * uncertain action — never publish/delete on uncertainty — so the queue drains
 * to zero and nothing waits on a person. Only when human review is explicitly
 * required (ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1) are those items LEFT pending.
 * Bounded + fail-open, and wired into the loop so it runs every pass and on
 * every stuckness signal.
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

  // In autonomous mode (the default) the worker makes its OWN terminal decision
  // rather than leaving anything for a person: it declines the uncertain action
  // (never publishing/deleting on uncertainty) and records why, so the queue
  // drains to zero. In human-gated mode (ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1) it
  // leaves the genuinely-undecidable item PENDING for a person.
  const autonomous = !requireHumanReview();
  const leaveOrAutoDecide = async (id: string, note: string): Promise<void> => {
    if (autonomous) {
      await rejectReview(prisma, id, `Auto-decided (no human review required): ${note}`);
      out.rejected += 1;
    } else {
      out.left += 1;
    }
  };

  for (const item of items) {
    out.scanned += 1;
    const action = item.proposedAction ?? "";

    if (TRANSLATION_ACTIONS.has(action)) {
      const r = await resolveTranslationReview(prisma, item, action);
      if (r === "approved") out.approved += 1;
      else if (r === "rejected") out.rejected += 1;
      else
        await leaveOrAutoDecide(
          item.id,
          "no authentic received form and no machine provider available yet; the prayer keeps the languages it has and the worker fills this automatically once a translation provider is configured.",
        );
      continue;
    }

    if (action === "publish" || action === "PUBLISH_PARISH") {
      if (await contentIsLive(prisma, item.contentType, item.contentTitle)) {
        await rejectReview(prisma, item.id, "Content is now published — proposal moot.");
        out.rejected += 1;
      } else {
        await leaveOrAutoDecide(
          item.id,
          "content did not meet the publish confidence bar; the worker does not publish uncertain content and re-derives + publishes it when it passes.",
        );
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
        await leaveOrAutoDecide(
          item.id,
          "deletion confidence below threshold; the worker keeps the content rather than deleting on uncertainty.",
        );
      }
      continue;
    }

    if (action === "investigate_post_publish_failure") {
      if (await contentIsLive(prisma, item.contentType, item.contentTitle)) {
        await rejectReview(prisma, item.id, "Content is published and healthy again — moot.");
        out.rejected += 1;
      } else {
        await leaveOrAutoDecide(
          item.id,
          "post-publish failure already handled by the rollback decision tree; no human investigation required.",
        );
      }
      continue;
    }

    if (action === "publish-daily-readings") {
      if (await dailyReadingVerified(prisma, item.contentTitle)) {
        await rejectReview(prisma, item.id, "Readings now verified for this day — moot.");
        out.rejected += 1;
      } else {
        await leaveOrAutoDecide(
          item.id,
          "readings not yet verifiable; the page shows the liturgical framing + official source link until verified.",
        );
      }
      continue;
    }

    await leaveOrAutoDecide(
      item.id,
      "no autonomous executor for this proposal; the worker takes no action.",
    );
  }

  out.detail = `resolved ${out.approved + out.rejected}/${out.scanned} review(s): ${out.approved} applied authentic, ${out.rejected} decided autonomously (moot/redundant/declined), ${out.left} left for a human.`;
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

// ---------------------------------------------------------------------------
// Autonomous handling of "review" publish outcomes.
//
// In full-autonomy mode nothing waits on a person, so a publish outcome of
// "review" used to be a dead end: the artifact was parked NEEDS_REVIEW with a
// reason string and never looked at again. Most of those reasons are NOT
// genuine ambiguity — the brain was offline, a best-effort specialist objected,
// the score landed just under the threshold — and clear on a later attempt.
// The table below says which reasons are safe to retry and how; the retry
// budget (kept in AdminWorkerMemory, no schema change) bounds the loop so an
// item that keeps landing in review stops after a few backed-off attempts and
// stays parked for a person. Reasons that encode a real doctrinal doubt
// (communion risk, a verifier conflict) are deliberately NOT retried: routing
// them through a fail-open path when the brain happens to be down would defeat
// the screen. Catholic accuracy beats throughput.
// ---------------------------------------------------------------------------

export type ReviewRoute =
  /** Re-run the publish attempt later (the reason is transient / advisory). */
  | "retry"
  /** File a re-extraction repair (the reason is a score just under the bar). */
  | "repair"
  /** Leave parked for a person. */
  | "terminal";

export interface RecoverableReviewRule {
  /** Substring of the orchestrator's review reason (case-insensitive). */
  match: string;
  route: Exclude<ReviewRoute, "terminal">;
  /** Recovery is limited to artifacts whose provenance is non-empty. */
  requireProvenance?: boolean;
  /** Human-readable why. */
  why: string;
}

export const RECOVERABLE_REVIEW_RULES: readonly RecoverableReviewRule[] = [
  {
    match: "objections: citation",
    route: "retry",
    requireProvenance: true,
    why: "citation specialist false positive for provenanced content",
  },
  {
    match: "specialist panel routed to review",
    route: "retry",
    why: "the specialist panel is advisory and varies with brain availability",
  },
  {
    match: "proof-based publishing",
    route: "retry",
    why: "proof packets depend on the brain being online and on evidence that later publishes supply",
  },
  {
    match: "finalScore ",
    route: "repair",
    why: "score in the review band — a re-extraction can lift it over the threshold",
  },
  {
    match: "confidence ",
    route: "repair",
    why: "confidence in the review band — a re-extraction can lift it over the threshold",
  },
];

/** How many autonomous attempts a single artifact gets before it stays parked. */
export const REVIEW_RETRY_BUDGET = 3;
/** First backoff; doubles per attempt (10 → 20 → 40 minutes). */
export const REVIEW_RETRY_BASE_MS = 10 * 60 * 1000;

export function classifyReviewReason(reason: string | null | undefined): {
  route: ReviewRoute;
  rule: RecoverableReviewRule | null;
} {
  const r = (reason ?? "").toLowerCase();
  if (!r) return { route: "terminal", rule: null };
  for (const rule of RECOVERABLE_REVIEW_RULES) {
    if (r.includes(rule.match.toLowerCase())) return { route: rule.route, rule };
  }
  return { route: "terminal", rule: null };
}

/** Exponential backoff for the n-th attempt (1-based). */
export function reviewRetryDelayMs(attempt: number): number {
  return REVIEW_RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1);
}

export interface RetryBudgetState {
  attempts: number;
  nextRetryAt: Date | null;
  lastReason: string | null;
}

function retryKey(scope: string, id: string): string {
  return `retry-budget:${scope}:${id}`;
}

/** Read the retry state for (scope, id). Fail-open: unknown → zero attempts. */
export async function readRetryBudget(
  prisma: PrismaClient,
  scope: string,
  id: string,
): Promise<RetryBudgetState> {
  let row: { memoryValue: unknown } | null = null;
  try {
    row = await prisma.adminWorkerMemory.findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: retryKey(scope, id) } },
      select: { memoryValue: true },
    });
  } catch {
    row = null;
  }
  const v = (row?.memoryValue ?? {}) as {
    attempts?: number;
    nextRetryAt?: string;
    lastReason?: string;
  };
  const next = typeof v.nextRetryAt === "string" ? new Date(v.nextRetryAt) : null;
  return {
    attempts: typeof v.attempts === "number" && Number.isFinite(v.attempts) ? v.attempts : 0,
    nextRetryAt: next && !Number.isNaN(next.getTime()) ? next : null,
    lastReason: typeof v.lastReason === "string" ? v.lastReason : null,
  };
}

/**
 * Consume one attempt for (scope, id). Returns whether the attempt is within
 * budget and when the next one may run. A DB error never blocks the attempt —
 * the worst case is one extra retry, never a lost item.
 */
export async function consumeRetryBudget(
  prisma: PrismaClient,
  scope: string,
  id: string,
  opts: { reason?: string; budget?: number } = {},
): Promise<{ allowed: boolean; attempts: number; nextRetryAt: Date }> {
  const budget = opts.budget ?? REVIEW_RETRY_BUDGET;
  const prev = await readRetryBudget(prisma, scope, id);
  const attempts = prev.attempts + 1;
  const nextRetryAt = new Date(Date.now() + reviewRetryDelayMs(attempts));
  const memoryValue = {
    attempts,
    nextRetryAt: nextRetryAt.toISOString(),
    lastReason: (opts.reason ?? "").slice(0, 300) || null,
  };
  const key = retryKey(scope, id);
  try {
    await prisma.adminWorkerMemory.upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue, lastUsedAt: new Date() },
      create: { memoryType: "GENERIC", memoryKey: key, memoryValue, lastUsedAt: new Date() },
    });
  } catch {
    // Budget bookkeeping is best-effort; the attempt itself proceeds.
  }
  return { allowed: attempts <= budget, attempts, nextRetryAt };
}

/** Forget the retry state (the item published or was terminally decided). */
export async function clearRetryBudget(
  prisma: PrismaClient,
  scope: string,
  id: string,
): Promise<void> {
  try {
    await prisma.adminWorkerMemory.deleteMany({
      where: { memoryType: "GENERIC", memoryKey: retryKey(scope, id) },
    });
  } catch {
    // best-effort
  }
}

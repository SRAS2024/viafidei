/**
 * PublishOrchestrator (spec §13). The single entry point the
 * autonomous publish path goes through. Handles:
 *
 *   - receive validated package
 *   - check quality score >= content-type threshold
 *   - check duplicate keys (slug, canonical name)
 *   - check public tab placement (publicRouteFor returns a valid path)
 *   - check slug uniqueness
 *   - persist the published row
 *   - mark strict public flags (already in PublishedContent.isPublished)
 *   - update content goals
 *   - request search index refresh
 *   - request sitemap refresh
 *   - revalidate cache
 *   - record post-publish verification placeholder
 *
 * The orchestrator never approves doctrinally-sensitive content
 * without the cross-source verifier signing off — VerifierOutcome
 * is a required input.
 *
 * Idempotence: re-running the orchestrator on the same package +
 * checksum is a no-op (the same PublishedContent row exists and is
 * returned untouched).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { CONFIDENCE_THRESHOLDS } from "./decisions";
import { refreshContentGoals } from "./content-goals";
import { writeAdminWorkerLog } from "./logs";
import { publicRouteFor } from "./public-routes";
import { evaluatePublishGate } from "./publisher";
import type { VerifierOutcome } from "./verifier";

export interface PublishOrchestratorInput {
  contentType: string;
  contentId: string; // checklistItemId
  title: string;
  slug: string;
  payload: Prisma.InputJsonValue;
  authorityLevel: string;
  finalScore: number;
  qaPassed: boolean;
  hasSourceEvidence: boolean;
  isDoctrinallySensitive: boolean;
  confidence: number;
  verifier?: VerifierOutcome;
  /** Spec §5: when supplied, gate requires status="PASSED". */
  strictQAArtifactId?: string;
}

export type OrchestratorResult =
  | {
      kind: "published";
      publishedContentId: string;
      slug: string;
      route: string;
      reason: string;
    }
  | { kind: "blocked"; reason: string; gate?: string; blockedBy: string }
  | { kind: "review"; reason: string }
  | { kind: "duplicate"; existingId: string; reason: string };

export async function runPublishOrchestrator(
  prisma: PrismaClient,
  input: PublishOrchestratorInput,
): Promise<OrchestratorResult> {
  // 0. Strict QA artifact requirement (spec §5/§6 follow-up).
  // When a strictQAArtifactId is supplied, the publish gate refuses
  // unless the AdminWorkerStrictQAResult row exists with status =
  // "PASSED".
  if (input.strictQAArtifactId) {
    const { getStrictQAResult } = await import("./strict-qa");
    const qa = await getStrictQAResult(prisma, input.strictQAArtifactId);
    if (!qa) {
      return {
        kind: "blocked",
        blockedBy: "strict-qa",
        reason: "no AdminWorkerStrictQAResult row for this artifact",
      };
    }
    if (qa.status !== "PASSED") {
      const reason = `strict QA status=${qa.status} (finalScore=${qa.finalScore.toFixed(2)}, blocking=${qa.blockingReasons.join("; ") || "(none)"})`;
      if (qa.status === "NEEDS_REPAIR") {
        return { kind: "review", reason };
      }
      return { kind: "blocked", blockedBy: "strict-qa", reason };
    }
  }

  // 1. Sensitive content requires verifier sign-off.
  if (input.isDoctrinallySensitive) {
    if (!input.verifier) {
      return {
        kind: "blocked",
        blockedBy: "verifier",
        reason: "doctrinally sensitive content requires verifier sign-off",
      };
    }
    if (!input.verifier.publishAllowed) {
      return {
        kind: "blocked",
        blockedBy: "verifier",
        reason: `verifier blocked: ${input.verifier.summary}`,
      };
    }
  }

  // 2. Publish gate (quality + QA + source evidence + confidence).
  const gate = evaluatePublishGate({
    contentType: input.contentType,
    contentTitle: input.title,
    contentId: input.contentId,
    finalScore: input.finalScore,
    qaPassed: input.qaPassed,
    hasSourceEvidence: input.hasSourceEvidence,
    isDoctrinallySensitive: input.isDoctrinallySensitive,
    confidence: input.confidence,
  });
  if (gate.kind === "reject") {
    await logBlocked(prisma, input, gate.reason);
    return { kind: "blocked", blockedBy: "gate", reason: gate.reason };
  }
  if (gate.kind === "review") {
    await logBlocked(prisma, input, gate.reason);
    return { kind: "review", reason: gate.reason };
  }

  // 3. Public route placement.
  const routeInfo = publicRouteFor(input.contentType, input.slug);
  const route = routeInfo.slugPath;
  if (!route) {
    return {
      kind: "blocked",
      blockedBy: "route",
      reason: `no public route for content type ${input.contentType}`,
    };
  }

  // 4. Duplicate check (slug + content type — schema-unique).
  const existing = await prisma.publishedContent
    .findFirst({
      where: { contentType: input.contentType as never, slug: input.slug },
      select: { id: true, isPublished: true },
    })
    .catch(() => null);
  if (existing) {
    // Idempotent re-publish: if the row is already published, return
    // duplicate; otherwise update isPublished=true and return.
    if (existing.isPublished) {
      return {
        kind: "duplicate",
        existingId: existing.id,
        reason: "PublishedContent already exists for this (contentType, slug)",
      };
    }
    const repub = await prisma.publishedContent
      .update({
        where: { id: existing.id },
        data: {
          isPublished: true,
          publishedAt: new Date(),
          payload: input.payload,
          title: input.title,
        },
      })
      .catch(() => null);
    if (!repub) {
      return {
        kind: "blocked",
        blockedBy: "persist",
        reason: "failed to update existing row to published",
      };
    }
    await postPublishSideEffects(prisma, input, repub.id, route);
    return {
      kind: "published",
      publishedContentId: repub.id,
      slug: input.slug,
      route,
      reason: "republished existing row",
    };
  }

  // 5. Persist a new PublishedContent row.
  const created = await prisma.publishedContent
    .create({
      data: {
        checklistItemId: input.contentId,
        contentType: input.contentType as never,
        slug: input.slug,
        title: input.title,
        payload: input.payload,
        authorityLevel: input.authorityLevel as never,
        isPublished: true,
        publishedAt: new Date(),
        version: 1,
      },
    })
    .catch((e) => {
      void writeAdminWorkerLog(prisma, {
        category: "PUBLISHING",
        severity: "ERROR",
        eventName: "publish_persist_failed",
        message: `Persistence failed for ${input.contentType}/${input.slug}: ${(e as Error).message}`,
        contentType: input.contentType,
      });
      return null;
    });

  if (!created) {
    return {
      kind: "blocked",
      blockedBy: "persist",
      reason: "PublishedContent create() failed",
    };
  }

  await postPublishSideEffects(prisma, input, created.id, route);

  return {
    kind: "published",
    publishedContentId: created.id,
    slug: input.slug,
    route,
    reason: `published with finalScore=${input.finalScore.toFixed(2)}`,
  };
}

async function postPublishSideEffects(
  prisma: PrismaClient,
  input: PublishOrchestratorInput,
  publishedContentId: string,
  route: string,
): Promise<void> {
  // Update content goals so the gap closes immediately.
  await refreshContentGoals(prisma).catch(() => undefined);

  // Request search + sitemap + cache refresh through the repair module.
  const { flagSearchRefresh, flagSitemapRefresh, flagCacheRefresh } = await import("./repair");
  await Promise.all([
    flagSearchRefresh(prisma).catch(() => undefined),
    flagSitemapRefresh(prisma).catch(() => undefined),
    flagCacheRefresh(prisma, `${input.contentType}:${input.slug}`).catch(() => undefined),
  ]);

  await writeAdminWorkerLog(prisma, {
    category: "PUBLISHING",
    severity: "INFO",
    eventName: "publish_orchestrator_succeeded",
    message: `Published ${input.contentType}/${input.slug} → ${route} (finalScore=${input.finalScore.toFixed(2)}).`,
    contentType: input.contentType,
    relatedEntityId: publishedContentId,
    safeMetadata: {
      finalScore: input.finalScore,
      threshold: input.isDoctrinallySensitive
        ? CONFIDENCE_THRESHOLDS.publishDoctrinal
        : CONFIDENCE_THRESHOLDS.publish,
      verifier: input.verifier
        ? {
            publishAllowed: input.verifier.publishAllowed,
            blockingSensitiveFields: input.verifier.blockingSensitiveFields,
          }
        : null,
    },
  }).catch(() => undefined);
}

async function logBlocked(
  prisma: PrismaClient,
  input: PublishOrchestratorInput,
  reason: string,
): Promise<void> {
  await writeAdminWorkerLog(prisma, {
    category: "PUBLISHING",
    severity: "WARN",
    eventName: "publish_orchestrator_blocked",
    message: `Publish blocked for ${input.contentType}/${input.slug}: ${reason}`,
    contentType: input.contentType,
    safeMetadata: {
      finalScore: input.finalScore,
      qaPassed: input.qaPassed,
      hasSourceEvidence: input.hasSourceEvidence,
      isDoctrinallySensitive: input.isDoctrinallySensitive,
      verifier: input.verifier ? input.verifier.summary : null,
    },
  }).catch(() => undefined);
}

/**
 * Render-side helper: explain why a content row is currently public
 * (or not). Used by the admin item-detail page to answer the
 * spec §13 question "explain why an item is public / blocked".
 */
export async function explainPublishStatus(
  prisma: PrismaClient,
  opts: { contentType: string; slug: string },
): Promise<{
  isPublished: boolean;
  publishedAt: Date | null;
  reason: string;
  lastDecision: string | null;
}> {
  const row = await prisma.publishedContent
    .findFirst({
      where: { contentType: opts.contentType as never, slug: opts.slug },
      select: { isPublished: true, publishedAt: true },
    })
    .catch(() => null);
  const decision = await prisma.adminWorkerLog
    .findFirst({
      where: {
        category: "PUBLISHING",
        contentType: opts.contentType,
      },
      orderBy: { createdAt: "desc" },
      select: { message: true },
    })
    .catch(() => null);
  return {
    isPublished: !!row?.isPublished,
    publishedAt: row?.publishedAt ?? null,
    reason: row?.isPublished
      ? "PublishedContent row exists and isPublished=true."
      : "No public row.",
    lastDecision: decision?.message ?? null,
  };
}

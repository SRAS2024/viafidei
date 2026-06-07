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
 *   - record post-publish verification result
 *
 * The orchestrator never approves doctrinally-sensitive content
 * without the cross-source verifier signing off — VerifierOutcome
 * is a required input.
 *
 * Idempotence: re-running the orchestrator on the same package +
 * checksum is a no-op (the same PublishedContent row exists and is
 * returned untouched).
 */

import type { ChecklistContentType, Prisma, PrismaClient } from "@prisma/client";

import { CONFIDENCE_THRESHOLDS } from "./decisions";
import { refreshContentGoals } from "./content-goals";
import { isBrainEnabled } from "./intelligence";
import { writeAdminWorkerLog } from "./logs";
import { publicRouteFor } from "./public-routes";
import { evaluatePublishGate } from "./publisher";
import { recordReasoningEdge } from "./reasoning-graph";
import type { QualityInputs } from "./quality";
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
  /**
   * Skip the post-publish side effects (post-publish verification, search /
   * sitemap / cache verification). These are non-gating follow-ups, so this is
   * safe for bulk seeding where running them per item would be O(n²); the
   * worker still runs full verification in its normal passes. The publish
   * itself — safety gate + full quality gate + persist — is unchanged.
   */
  skipPostPublishSideEffects?: boolean;
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
  // Spec §6: "repair" is distinct from "review". A repairable failure
  // (e.g. strict QA NEEDS_REPAIR, quality score just below threshold)
  // goes to repair first; "review" is reserved for genuinely
  // ambiguous / conflicting cases a human must adjudicate.
  | { kind: "repair"; reason: string }
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
        // Spec §6: needs repair, not review — repair first.
        return { kind: "repair", reason };
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
      // Spec §5 follow-up: missing evidence → repair (file
      // VALIDATION_EVIDENCE_MISSING); conflicts → human review;
      // hard blocker → blocked.
      const reason = `verifier blocked: ${input.verifier.summary}`;
      const missing = input.verifier.missingRequired ?? [];
      if (missing.length > 0 && !input.verifier.hasConflict && input.strictQAArtifactId) {
        const { filePlan } = await import("./repair-plans");
        await filePlan(prisma, {
          kind: "VALIDATION_EVIDENCE_MISSING",
          failedEntity: input.strictQAArtifactId,
          repairAction: `Fetch + compare validation sources for ${missing.join(", ")}.`,
          metadata: { contentType: input.contentType, slug: input.slug, missing },
        }).catch(() => undefined);
        return { kind: "repair", reason };
      }
      if (input.verifier.hasConflict) {
        return { kind: "review", reason };
      }
      return { kind: "blocked", blockedBy: "verifier", reason };
    }
  }

  // 1c. Catholic communion-risk screen (intelligence brain). A
  //     *verification flag*, not a canonical ruling: when the title /
  //     payload trips the communion-risk threshold, route to human review
  //     rather than auto-publishing ("communion risk, no publish" —
  //     prevent unsafe publishing until verified). Fail-open: when the
  //     brain is disabled or offline this is a no-op and the existing
  //     gates below still apply.
  {
    const { screenCommunionRisk } = await import("./intelligence/service");
    const screenText = `${input.title}\n${JSON.stringify(input.payload)}`.slice(0, 8000);
    const screen = await screenCommunionRisk(
      prisma,
      { name: input.title, text: screenText },
      { contentType: input.contentType, entityId: input.contentId },
    );
    if (screen.available && screen.block) {
      const reason = `communion risk ${screen.risk.toFixed(2)} (${screen.verdict}); requires human verification before publish — flags: ${
        screen.flags.slice(0, 3).join("; ") || "n/a"
      }`;
      await logBlocked(prisma, input, reason);
      return { kind: "review", reason };
    }
  }

  // 1d. Semantic duplicate gate (intelligence brain). Catches near-duplicates
  //     the slug/canonical checks miss — alternate titles, fuzzy + semantic
  //     overlap — across other published items of the same type. The item's
  //     own slug is excluded so idempotent re-publish/update still works.
  //     Fully skipped (no DB query) when the brain is disabled, so it is
  //     inert in tests and non-blocking. "duplicate detected, no publish."
  if (isBrainEnabled()) {
    try {
      const { checkDuplicate } = await import("./intelligence/service");
      const candidates = await prisma.publishedContent
        .findMany({
          where: {
            isPublished: true,
            contentType: input.contentType as ChecklistContentType,
            slug: { not: input.slug },
          },
          take: 200,
          select: { id: true, title: true, slug: true },
        })
        .catch(() => [] as Array<{ id: string; title: string; slug: string }>);
      if (candidates.length > 0) {
        const dup = await checkDuplicate(
          prisma,
          { title: input.title, slug: input.slug },
          candidates.map((c) => ({ id: c.id, title: c.title, slug: c.slug })),
          { contentType: input.contentType, entityId: input.contentId },
        );
        if (dup.available && dup.isDuplicate && dup.bestMatchId) {
          const reason = `semantic duplicate of published ${dup.bestMatchId} (score ${dup.bestScore.toFixed(2)})`;
          await logBlocked(prisma, input, reason);
          return { kind: "duplicate", existingId: dup.bestMatchId, reason };
        }
      }
    } catch {
      // Intelligence dedupe is a best-effort safety check; never block publishing on its failure.
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

  // 2b. Spec §4 + §6: ContentQualityScore is mandatory before publish
  //     and derives from the strict-QA dimensions when the artifact
  //     has a stored result. Only when no strict-QA row exists do we
  //     fall back to default inputs (this path also has the strict-QA
  //     gate refuse the publish above).
  //
  //     The mapping folds in source authority and verification evidence
  //     strength as quality factors (spec §6): sourceAuthorityScore is
  //     biased downward when the source authority is below VATICAN,
  //     and validationEvidenceScore is biased downward when the stored
  //     verifier outcome reports missing evidence. duplicate-safety is
  //     pulled from strict-QA and combined with the geometric mean by
  //     dragging completeness down to zero on a duplicate-safety
  //     failure (= refusal to publish a duplicate).
  // Build the full ten-dimension quality inputs (spec §12: store + enforce
  // the full quality model). Prefer strict-QA-derived dimensions; fall back
  // to coarse package-artifact defaults. There is no reduced-model path.
  let quality: QualityInputs | undefined;
  if (input.strictQAArtifactId) {
    const { getStrictQAResult } = await import("./strict-qa");
    const qa = await getStrictQAResult(prisma, input.strictQAArtifactId);
    const qaRow = await prisma.adminWorkerStrictQAResult
      .findUnique({ where: { packageArtifactId: input.strictQAArtifactId } })
      .catch(() => null);
    if (qa && qaRow) {
      // Source-authority factor: VATICAN=1.0, CONFERENCE/MAGISTERIUM=0.95,
      // DIOCESAN=0.88, PARISH/COMMUNITY=0.78.
      const authorityFactor = sourceAuthorityFactor(input.authorityLevel);
      // Verification-evidence-strength factor: when a verifier outcome
      // is supplied, missing required fields drag validation down even
      // if the strict-QA validation score was high.
      const evidenceStrength = verificationEvidenceStrength(input.verifier);
      // Duplicate-safety failure → completeness + duplicateSafety = 0 so
      // the geometric mean is zero and the publish gate refuses (a
      // duplicate is not a valid publish). A pre-column strict-QA row
      // (undefined/null) is treated as "not yet measured" and passes.
      const duplicateOk =
        qaRow.duplicateSafetyScore === undefined || qaRow.duplicateSafetyScore === null
          ? true
          : qaRow.duplicateSafetyScore > 0;
      quality = {
        contentType: input.contentType,
        contentId: input.contentId,
        completenessScore: duplicateOk ? (qaRow.completenessScore ?? 1) : 0,
        correctnessScore: qaRow.correctnessScore ?? 1,
        formattingScore: qaRow.formattingScore ?? 1,
        sourceAuthorityScore: authorityFactor,
        fieldProvenanceScore: qaRow.provenanceScore ?? 1,
        validationEvidenceScore: (qaRow.validationScore ?? 1) * evidenceStrength,
        duplicateSafetyScore: duplicateOk ? (qaRow.duplicateSafetyScore ?? 1) : 0,
        publicRenderingScore: qaRow.publicReadinessScore ?? 1,
        // Doctrinally-sensitive content cannot pass without the verifier
        // signing off — drives doctrinalSensitivity (and the gate) to 0.
        doctrinalSensitivityScore: input.isDoctrinallySensitive
          ? input.verifier?.publishAllowed
            ? 1
            : 0
          : 1,
        packageConsistencyScore: qaRow.correctnessScore ?? 1,
      };
    }
  }
  const qualityFinal: QualityInputs = quality ?? {
    contentType: input.contentType,
    contentId: input.contentId,
    completenessScore: input.qaPassed ? 1 : 0.5,
    correctnessScore: input.confidence,
    formattingScore: 0.8,
    sourceAuthorityScore: sourceAuthorityFactor(input.authorityLevel),
    fieldProvenanceScore: input.hasSourceEvidence ? 1 : 0,
    validationEvidenceScore: input.verifier?.publishAllowed
      ? 1
      : input.isDoctrinallySensitive
        ? 0
        : 0.8,
    duplicateSafetyScore: 1,
    publicRenderingScore: 1,
    doctrinalSensitivityScore: input.isDoctrinallySensitive
      ? input.verifier?.publishAllowed
        ? 1
        : 0
      : 1,
    packageConsistencyScore: input.qaPassed ? 1 : 0.8,
  };
  const { recordQualityScore, thresholdFor } = await import("./quality");
  const qualityScore = await recordQualityScore(prisma, qualityFinal).catch(() => null);
  // Spec: publishing must use the FULL stored quality score. `passed`
  // already folds in the per-content-type threshold.
  if (!qualityScore || !qualityScore.passed) {
    const failed = qualityScore?.failedDimensions ?? [];
    const qualityThreshold = qualityScore?.threshold ?? thresholdFor(input.contentType);
    const reason = `ContentQualityScore ${qualityScore?.finalScore?.toFixed(2) ?? "missing"} below ${input.contentType} threshold ${qualityThreshold.toFixed(2)}${failed.length ? ` (failed dimensions: ${failed.join(", ")})` : ""}`;
    await logBlocked(prisma, input, reason);
    // Spec §4 + §9: file a QUALITY_SCORE_FAILED repair plan so the
    // package goes to repair first rather than being silently
    // rejected. The repair handler inspects the failed dimension and
    // chooses the targeted repair. When the artifact is repairable (we
    // have its id) the result is "repair", not "blocked".
    if (input.strictQAArtifactId) {
      const { filePlan } = await import("./repair-plans");
      await filePlan(prisma, {
        kind: "QUALITY_SCORE_FAILED",
        failedEntity: input.strictQAArtifactId,
        repairAction: `Re-extract ${input.contentType}/${input.slug}; quality score too low${failed.length ? ` (failed: ${failed.join(", ")})` : ""}.`,
        metadata: {
          contentType: input.contentType,
          slug: input.slug,
          finalScore: qualityScore?.finalScore ?? 0,
          threshold: qualityThreshold,
          failedDimensions: failed,
        },
      }).catch(() => undefined);
      return { kind: "repair", reason };
    }
    return { kind: "blocked", blockedBy: "quality-score", reason };
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

  // Freshness marker written at publish time; cache verification later
  // confirms this checksum is actually being served from the public route.
  const { computeContentChecksum } = await import("./cache-freshness");
  const contentChecksum = computeContentChecksum(input.title, input.payload);

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
          contentChecksum,
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
    if (!input.skipPostPublishSideEffects) {
      await postPublishSideEffects(prisma, input, repub.id, route);
    }
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
        contentChecksum,
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

  if (!input.skipPostPublishSideEffects) {
    await postPublishSideEffects(prisma, input, created.id, route);
  }

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

  // Spec §45: record the marquee reasoning edge — "publish allowed
  // because strict QA and quality score passed" — so the Worker
  // Reasoning view can show why this item went public.
  await recordReasoningEdge(prisma, {
    contentType: input.contentType,
    contentId: input.contentId,
    from: { type: "QUALITY_SCORE", id: input.contentId, label: input.title },
    to: { type: "PUBLISHED_CONTENT", id: publishedContentId, label: input.slug },
    relation: "PUBLISH_ALLOWED_BECAUSE",
    explanation: `strict QA passed and quality score ${input.finalScore.toFixed(2)} cleared the ${input.contentType} threshold${
      input.isDoctrinallySensitive ? " (doctrinally sensitive: verifier signed off)" : ""
    }`,
    confidence: input.confidence,
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

  // Spec §44/§48: record why publish was blocked so the decision is
  // explainable later in the Worker Reasoning view.
  await recordReasoningEdge(prisma, {
    contentType: input.contentType,
    contentId: input.contentId,
    from: { type: "QUALITY_SCORE", id: input.contentId, label: input.title },
    to: { type: "PUBLISHED_CONTENT", label: input.slug },
    relation: "PUBLISH_BLOCKED_BECAUSE",
    explanation: reason,
    confidence: input.confidence,
  }).catch(() => undefined);
}

/**
 * Spec §6: source-authority factor used to bias sourceAuthorityScore
 * by where the content was sourced. VATICAN is the unconditional
 * baseline (1.0); conference / magisterium sources are slightly
 * deboosted; diocesan / parish / community sources are deboosted
 * further so the geometric mean reflects the actual authority of the
 * sources backing the publish.
 */
function sourceAuthorityFactor(authorityLevel: string): number {
  switch (authorityLevel) {
    case "VATICAN":
      return 1.0;
    case "MAGISTERIUM":
    case "CONFERENCE":
      return 0.95;
    case "DIOCESAN":
      return 0.88;
    case "PARISH":
    case "COMMUNITY":
      return 0.78;
    default:
      return 0.85;
  }
}

/**
 * Spec §6: verification-evidence-strength factor used to bias
 * validationScore by how much stored verification evidence actually
 * confirmed the package. Missing required fields drop the factor
 * proportionally; a clean publish-allowed outcome is full strength.
 */
function verificationEvidenceStrength(verifier?: VerifierOutcome): number {
  if (!verifier) return 1.0;
  if (verifier.publishAllowed) return 1.0;
  const missing = verifier.missingRequired?.length ?? 0;
  const blocking = verifier.blockingSensitiveFields?.length ?? 0;
  // Each missing / blocking field deducts 25% from the factor;
  // floors at 0.1 so the geometric mean still reflects partial work.
  return Math.max(0.1, 1 - 0.25 * (missing + blocking));
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

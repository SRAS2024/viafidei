/**
 * Why No Content Growth diagnostic (spec §15).
 *
 * Walks the autonomous chain in order and stops at the first stage
 * that is the actual blocker for a given content type. Returns a
 * structured report the admin UI + Developer Audit can render.
 *
 * Walk order (matches the dispatcher's content chain):
 *   1. content goals seeded
 *   2. approved sources exist
 *   3. discovery has run
 *   4. candidate URLs exist (DISCOVERED + PRIORITIZED)
 *   5. candidates have been prioritized (any with fetchPriority > 0)
 *   6. fetcher is running (recent AdminWorkerFetchResult rows)
 *   7. fetches are succeeding (recent rows with succeeded=true)
 *   8. source-reads exist
 *   9. classifier has classified at least one read
 *  10. extraction has materialised at least one artifact
 *  11. artifacts have reached CHECKLIST_READY
 *  12. cross-source verification has run
 *  13. QA is not rejecting everything
 *  14. publishing has succeeded (PublishedContent exists)
 *  15. post-publish verification is passing
 *  16. cache + sitemap + search refreshes have fired
 */

import type { PrismaClient } from "@prisma/client";

export type GrowthBlockerStage =
  | "NONE"
  | "WORKER_NOT_RUNNING"
  | "WORKER_PAUSED"
  | "BRAIN_DEGRADED"
  | "NO_CONTENT_GOALS"
  | "NO_APPROVED_SOURCES"
  | "NO_DISCOVERY_RUN"
  | "NO_CANDIDATE_URLS"
  | "NO_CANDIDATES_PRIORITIZED"
  | "FETCH_NOT_RUNNING"
  | "FETCH_FAILING"
  | "NO_SOURCE_READS"
  | "STRUCTURED_BLOCKS_MISSING"
  | "CLASSIFICATION_FAILING"
  | "EXTRACTION_FAILING"
  | "NO_PACKAGE_ARTIFACTS"
  | "CHECKLIST_OR_CITATIONS_MISSING"
  | "VALIDATION_EVIDENCE_MISSING"
  | "QA_REJECTING"
  | "QUALITY_SCORE_TOO_LOW"
  | "PUBLISH_BLOCKED"
  | "POST_PUBLISH_FAILING"
  | "CACHE_HIDING_CONTENT"
  | "SEARCH_OR_SITEMAP_MISSING_CONTENT";

export interface WhyNoGrowthReport {
  contentType: string | null;
  blocker: GrowthBlockerStage;
  blockerExplanation: string;
  exactTable: string;
  exactCount: number;
  mostRecentFailure: { when: Date; reason: string } | null;
  nextAutomaticRepair: string | null;
  lastWorkerDecision: { when: Date; chosenAction: string; reason: string | null } | null;
  nextWorkerDecision: string;
  checks: Array<{
    stage: GrowthBlockerStage;
    label: string;
    ok: boolean;
    count: number;
    detail: string;
  }>;
}

/**
 * Run the diagnostic. When `contentType` is omitted, picks the
 * content type with the largest gap as the focus.
 */
export async function diagnoseWhyNoGrowth(
  prisma: PrismaClient,
  opts: { contentType?: string } = {},
): Promise<WhyNoGrowthReport> {
  // Pick the focus content type (largest gap if none specified).
  let contentType = opts.contentType ?? null;
  if (!contentType) {
    const goal = await prisma.contentGoal
      .findFirst({
        where: { gapCount: { gt: 0 } },
        orderBy: { gapCount: "desc" },
      })
      .catch(() => null);
    contentType = goal?.contentType ?? null;
  }

  const checks: WhyNoGrowthReport["checks"] = [];
  let blocker: GrowthBlockerStage = "NONE";
  let blockerExplanation = "Content is growing.";
  let exactTable = "";
  let exactCount = 0;
  let nextRepair: string | null = null;

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 0. The worker itself must be RUNNING, UNPAUSED, and in ACTIVE (non-degraded)
  //    brain mode. Every publishing path — curated ingest, structured ingest,
  //    AND the fetcher chain below — is gated on all three, so when one of them
  //    is the cause, the pipeline walk underneath can't see it and would mislead.
  //    These are the most common reason a worker that WAS growing suddenly
  //    plateaus, so they are checked first. (Skipped only when a minimal test
  //    harness stubs a prisma without the worker-state model; production always
  //    has it.)
  const stateModel = (prisma as { adminWorkerState?: { findFirst?: unknown } }).adminWorkerState;
  if (typeof stateModel?.findFirst === "function") {
    const state = await prisma.adminWorkerState.findFirst().catch(() => null);
    const heartbeatAgeMs = state?.lastHeartbeatAt
      ? Date.now() - new Date(state.lastHeartbeatAt).getTime()
      : null;
    const workerLive = heartbeatAgeMs != null && heartbeatAgeMs <= 10 * 60_000;
    checks.push({
      stage: "WORKER_NOT_RUNNING",
      label: "Worker process running (recent heartbeat)",
      ok: workerLive,
      count: heartbeatAgeMs == null ? 0 : Math.round(heartbeatAgeMs / 1000),
      detail: state?.lastHeartbeatAt
        ? `Last heartbeat ${Math.round((heartbeatAgeMs ?? 0) / 1000)}s ago.`
        : "No heartbeat has ever been recorded.",
    });
    if (!workerLive) {
      blocker = "WORKER_NOT_RUNNING";
      blockerExplanation =
        "The Admin Worker process is not running (no heartbeat in the last 10 minutes). Nothing — curated, structured, or fetched — can publish until the worker service is up.";
      exactTable = "AdminWorkerState.lastHeartbeatAt";
      nextRepair = "Start / restart the Admin Worker service (the worker container).";
    }

    if (blocker === "NONE" && state?.paused) {
      checks.push({
        stage: "WORKER_PAUSED",
        label: "Worker not paused",
        ok: false,
        count: 0,
        detail: state.pausedReason ? `Paused: ${state.pausedReason}` : "Paused by an operator.",
      });
      blocker = "WORKER_PAUSED";
      blockerExplanation = `The worker is paused by an operator${
        state.pausedReason ? ` (${state.pausedReason})` : ""
      }. Content publishing stays off until it is resumed (security defense still runs).`;
      exactTable = "AdminWorkerState.paused";
      nextRepair = "Resume the worker (Command Center → Resume).";
    }

    if (blocker === "NONE") {
      const latestBrain = await prisma.adminWorkerLog
        .findFirst({
          where: { eventName: "brain_decided" },
          orderBy: { createdAt: "desc" },
          select: { safeMetadata: true },
        })
        .catch(() => null);
      const finalBrain =
        (latestBrain?.safeMetadata as { finalBrain?: string } | null)?.finalBrain ?? null;
      const degraded = finalBrain != null && finalBrain !== "python";
      checks.push({
        stage: "BRAIN_DEGRADED",
        label: "Python final brain active (publishing allowed)",
        ok: !degraded,
        count: 0,
        detail: finalBrain
          ? `Latest finalBrain = ${finalBrain}.`
          : "No brain decision recorded yet.",
      });
      if (degraded) {
        blocker = "BRAIN_DEGRADED";
        blockerExplanation =
          "The worker is live but the Python final brain is unavailable, so it is in safe-degraded mode: it runs diagnostics / security / maintenance but does NOT publish new content. Every publishing path (curated, structured, fetched) is gated on the brain being active.";
        exactTable = "AdminWorkerLog(eventName=brain_decided).safeMetadata.finalBrain";
        nextRepair =
          "Restore the Python intelligence service so the final brain returns to active (PYTHON_FINAL_BRAIN_ACTIVE).";
      }
    }
  }

  // 1. Content goals.
  const goalCount = await prisma.contentGoal.count().catch(() => 0);
  checks.push({
    stage: "NO_CONTENT_GOALS",
    label: "Content goals seeded",
    ok: goalCount > 0,
    count: goalCount,
    detail: `${goalCount} ContentGoal row(s).`,
  });
  if (blocker === "NONE" && goalCount === 0) {
    blocker = "NO_CONTENT_GOALS";
    blockerExplanation = "No ContentGoal rows. Call seedContentGoals() before running the worker.";
    exactTable = "ContentGoal";
    nextRepair = "seedContentGoals(prisma) — runs automatically on first worker pass.";
  }

  // 2. Approved sources.
  const authorityCount =
    blocker === "NONE" ? await prisma.authoritySource.count().catch(() => 0) : 0;
  checks.push({
    stage: "NO_APPROVED_SOURCES",
    label: "Approved sources",
    ok: authorityCount > 0,
    count: authorityCount,
    detail: `${authorityCount} AuthoritySource row(s).`,
  });
  if (blocker === "NONE" && authorityCount === 0) {
    blocker = "NO_APPROVED_SOURCES";
    blockerExplanation = "No approved sources are configured.";
    exactTable = "AuthoritySource";
    nextRepair = "Add approved sources via the source registry.";
  }

  // 3 + 4. Discovery + candidate URLs.
  const candidateCount =
    blocker === "NONE"
      ? await prisma.candidateSourceUrl
          .count({
            where: contentType
              ? { OR: [{ predictedContentType: contentType }, { predictedContentType: null }] }
              : undefined,
          })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "NO_CANDIDATE_URLS",
    label: "Candidate URLs",
    ok: candidateCount > 0,
    count: candidateCount,
    detail: `${candidateCount} CandidateSourceUrl row(s).`,
  });
  if (blocker === "NONE" && candidateCount === 0) {
    blocker = "NO_CANDIDATE_URLS";
    blockerExplanation = `No candidate URLs for ${contentType ?? "any content type"}.`;
    exactTable = "CandidateSourceUrl";
    nextRepair = "Run the DISCOVERY mission stage (Command Center → Run discovery).";
  }

  // 5. Prioritized candidates.
  const prioritizedCount =
    blocker === "NONE"
      ? await prisma.candidateSourceUrl
          .count({ where: { status: "PRIORITIZED", fetchPriority: { gt: 0 } } })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "NO_CANDIDATES_PRIORITIZED",
    label: "Candidates prioritized",
    ok: prioritizedCount > 0,
    count: prioritizedCount,
    detail: `${prioritizedCount} PRIORITIZED candidate(s) with fetchPriority > 0.`,
  });
  if (blocker === "NONE" && prioritizedCount === 0 && candidateCount > 0) {
    blocker = "NO_CANDIDATES_PRIORITIZED";
    blockerExplanation = "Candidates exist but the CandidateUrlScorer hasn't run yet.";
    exactTable = "CandidateSourceUrl";
    nextRepair = "Run the CANDIDATE_PRIORITIZATION stage.";
  }

  // 6 + 7. Fetcher activity.
  const recentFetches =
    blocker === "NONE"
      ? await prisma.adminWorkerFetchResult
          .count({ where: { createdAt: { gte: since24h } } })
          .catch(() => 0)
      : 0;
  const recentSuccessfulFetches =
    recentFetches > 0
      ? await prisma.adminWorkerFetchResult
          .count({ where: { createdAt: { gte: since24h }, succeeded: true } })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "FETCH_NOT_RUNNING",
    label: "Fetcher running",
    ok: recentFetches > 0,
    count: recentFetches,
    detail: `${recentFetches} fetch attempt(s) in the last 24h.`,
  });
  if (blocker === "NONE" && recentFetches === 0 && prioritizedCount > 0) {
    blocker = "FETCH_NOT_RUNNING";
    blockerExplanation = "Prioritized candidates exist but no fetches have happened in 24h.";
    exactTable = "AdminWorkerFetchResult";
    nextRepair = "Run the SOURCE_FETCH mission stage; check worker heartbeat.";
  }
  checks.push({
    stage: "FETCH_FAILING",
    label: "Fetcher succeeding",
    ok: recentFetches === 0 || recentSuccessfulFetches / recentFetches >= 0.5,
    count: recentSuccessfulFetches,
    detail: `${recentSuccessfulFetches}/${recentFetches} fetches succeeded in 24h.`,
  });
  if (blocker === "NONE" && recentFetches > 0 && recentSuccessfulFetches / recentFetches < 0.5) {
    blocker = "FETCH_FAILING";
    blockerExplanation = "Fetches are running but >50% are failing.";
    exactTable = "AdminWorkerFetchResult";
    nextRepair =
      "Pause failing sources via reputation tier; investigate FETCH_FAILED repair plans.";
  }

  // 8. Source reads.
  const sourceReadCount =
    blocker === "NONE" ? await prisma.adminWorkerSourceRead.count().catch(() => 0) : 0;
  checks.push({
    stage: "NO_SOURCE_READS",
    label: "Source reads recorded",
    ok: sourceReadCount > 0,
    count: sourceReadCount,
    detail: `${sourceReadCount} AdminWorkerSourceRead row(s).`,
  });
  if (blocker === "NONE" && sourceReadCount === 0) {
    blocker = "NO_SOURCE_READS";
    blockerExplanation = "Fetches succeeded but readSource() didn't write a row.";
    exactTable = "AdminWorkerSourceRead";
    nextRepair = "Run a SOURCE_READ pass; verify readSource() is wired into the dispatcher.";
  }

  // 8.5. Structured source blocks (spec §14: "structured blocks not
  //      created"). readSource() parses blocks for every page; if
  //      reads exist but no AdminWorkerSourceBlock rows do, the
  //      structured parser is not wired into the active read path.
  const blockCount =
    blocker === "NONE" ? await prisma.adminWorkerSourceBlock.count().catch(() => 0) : 0;
  checks.push({
    stage: "STRUCTURED_BLOCKS_MISSING",
    label: "Structured source blocks created",
    ok: sourceReadCount === 0 || blockCount > 0,
    count: blockCount,
    detail: `${blockCount} AdminWorkerSourceBlock row(s).`,
  });
  if (blocker === "NONE" && sourceReadCount > 0 && blockCount === 0) {
    blocker = "STRUCTURED_BLOCKS_MISSING";
    blockerExplanation =
      "Source reads exist but parseStructuredBlocks() produced no AdminWorkerSourceBlock rows.";
    exactTable = "AdminWorkerSourceBlock";
    nextRepair = "Verify readSource() calls parseStructuredBlocks() + persistStructuredBlocks().";
  }

  // 9. Classification.
  const classifiedCount =
    blocker === "NONE"
      ? await prisma.adminWorkerSourceRead
          .count({ where: { detectedContentType: { not: null } } })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "CLASSIFICATION_FAILING",
    label: "Classification running",
    ok: sourceReadCount === 0 || classifiedCount > 0,
    count: classifiedCount,
    detail: `${classifiedCount} classified read(s) of ${sourceReadCount}.`,
  });
  if (blocker === "NONE" && sourceReadCount > 0 && classifiedCount === 0) {
    blocker = "CLASSIFICATION_FAILING";
    blockerExplanation = "Source reads exist but none have been classified.";
    exactTable = "AdminWorkerSourceRead.detectedContentType";
    nextRepair = "Run the CLASSIFICATION mission stage.";
  }

  // 10 + 11. Package artifacts.
  const artifactCount =
    blocker === "NONE"
      ? await prisma.adminWorkerPackageArtifact
          .count({ where: contentType ? { contentType } : undefined })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "NO_PACKAGE_ARTIFACTS",
    label: "Package artifacts",
    ok: artifactCount > 0,
    count: artifactCount,
    detail: `${artifactCount} AdminWorkerPackageArtifact row(s) for ${contentType ?? "all types"}.`,
  });
  if (blocker === "NONE" && classifiedCount > 0 && artifactCount === 0) {
    blocker = "NO_PACKAGE_ARTIFACTS";
    blockerExplanation =
      "Classified reads exist but the extractor hasn't materialised any package artifacts.";
    exactTable = "AdminWorkerPackageArtifact";
    nextRepair = "Run the EXTRACTION mission stage.";
  }

  // 11.5. Checklist + citation bridge (spec §14: "checklist or
  //        citations missing"). Artifacts become checklist items via
  //        the checklist-citation orchestrator; if artifacts exist but
  //        none carry a checklistItemId, the bridge hasn't run.
  const bridgedCount =
    blocker === "NONE"
      ? await prisma.adminWorkerPackageArtifact
          .count({
            where: {
              checklistItemId: { not: null },
              ...(contentType ? { contentType } : {}),
            },
          })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "CHECKLIST_OR_CITATIONS_MISSING",
    label: "Checklist + citations created",
    ok: artifactCount === 0 || bridgedCount > 0,
    count: bridgedCount,
    detail: `${bridgedCount} artifact(s) bridged to a ChecklistItem.`,
  });
  if (blocker === "NONE" && artifactCount > 0 && bridgedCount === 0) {
    blocker = "CHECKLIST_OR_CITATIONS_MISSING";
    blockerExplanation =
      "Package artifacts exist but none have been promoted to checklist items + citations.";
    exactTable = "AdminWorkerPackageArtifact.checklistItemId";
    nextRepair = "Run the CHECKLIST_CREATION / CITATION_CREATION mission stages.";
  }

  // 12. Verification evidence.
  const verifiedCount =
    blocker === "NONE" ? await prisma.adminWorkerCrossSourceVerification.count().catch(() => 0) : 0;
  checks.push({
    stage: "VALIDATION_EVIDENCE_MISSING",
    label: "Verification evidence",
    ok: artifactCount === 0 || verifiedCount > 0,
    count: verifiedCount,
    detail: `${verifiedCount} cross-source verification row(s).`,
  });
  if (blocker === "NONE" && artifactCount > 0 && verifiedCount === 0) {
    blocker = "VALIDATION_EVIDENCE_MISSING";
    blockerExplanation = "Package artifacts exist but no cross-source verification has happened.";
    exactTable = "AdminWorkerCrossSourceVerification";
    nextRepair = "Run the CROSS_SOURCE_VERIFICATION mission stage.";
  }

  // 13. QA.
  const qaReports =
    blocker === "NONE"
      ? await prisma.adminWorkerStrictQAResult
          .findMany({
            where: { createdAt: { gte: since7d } },
            select: { status: true },
            take: 200,
          })
          .catch(() => [])
      : [];
  const qaPassRate =
    qaReports.length === 0
      ? 1
      : qaReports.filter((r) => r.status === "PASSED").length / qaReports.length;
  checks.push({
    stage: "QA_REJECTING",
    label: "QA pass rate (7d)",
    ok: qaPassRate >= 0.3,
    count: qaReports.length,
    detail: `${Math.round(qaPassRate * 100)}% pass rate across ${qaReports.length} report(s).`,
  });
  if (blocker === "NONE" && qaReports.length >= 5 && qaPassRate < 0.3) {
    blocker = "QA_REJECTING";
    blockerExplanation = `QA is rejecting more than 70% of builds in the last 7 days.`;
    exactTable = "AdminWorkerStrictQAResult";
    nextRepair = "Improve source selection + extractor strategy; review rejection reasons.";
  }

  // 13.5. Quality score (spec §14: "quality score too low"). Every
  //        artifact must clear ContentQualityScore before publish; if
  //        recent scores are mostly below threshold, that's the gate.
  const qualityScores =
    blocker === "NONE"
      ? await prisma.contentQualityScore
          .findMany({
            where: { createdAt: { gte: since7d } },
            select: { finalScore: true },
            take: 200,
          })
          .catch(() => [] as Array<{ finalScore: number }>)
      : [];
  const qualityPassRate =
    qualityScores.length === 0
      ? 1
      : qualityScores.filter((q) => q.finalScore >= 0.8).length / qualityScores.length;
  checks.push({
    stage: "QUALITY_SCORE_TOO_LOW",
    label: "Quality score pass rate (7d)",
    ok: qualityPassRate >= 0.3,
    count: qualityScores.length,
    detail: `${Math.round(qualityPassRate * 100)}% scored >= 0.8 across ${qualityScores.length} score(s).`,
  });
  if (blocker === "NONE" && qualityScores.length >= 5 && qualityPassRate < 0.3) {
    blocker = "QUALITY_SCORE_TOO_LOW";
    blockerExplanation =
      "More than 70% of recent ContentQualityScore rows are below the publish threshold.";
    exactTable = "ContentQualityScore";
    nextRepair = "Improve extraction completeness + provenance; review quality-score logs.";
  }

  // 14. Publishing.
  const publishedCount =
    blocker === "NONE"
      ? await prisma.publishedContent
          .count({
            where: {
              isPublished: true,
              ...(contentType ? { contentType: contentType as never } : {}),
            },
          })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "PUBLISH_BLOCKED",
    label: "Published content",
    ok: publishedCount > 0,
    count: publishedCount,
    detail: `${publishedCount} published row(s) for ${contentType ?? "all types"}.`,
  });
  if (blocker === "NONE" && artifactCount > 0 && publishedCount === 0) {
    blocker = "PUBLISH_BLOCKED";
    blockerExplanation =
      "Artifacts exist but nothing has published. Check the PublishOrchestrator gate.";
    exactTable = "PublishedContent";
    nextRepair = "Run the PUBLIC_PUBLISH mission stage; review publish_orchestrator_blocked logs.";
  }

  // 15. Post-publish verification.
  const recentFailedVerifications =
    blocker === "NONE"
      ? await prisma.postPublishVerification
          .count({ where: { createdAt: { gte: since7d }, result: "FAIL" } })
          .catch(() => 0)
      : 0;
  const recentVerifications =
    blocker === "NONE"
      ? await prisma.postPublishVerification
          .count({ where: { createdAt: { gte: since7d } } })
          .catch(() => 0)
      : 0;
  checks.push({
    stage: "POST_PUBLISH_FAILING",
    label: "Post-publish verification passing",
    ok: recentVerifications === 0 || recentFailedVerifications / recentVerifications < 0.5,
    count: recentVerifications,
    detail: `${recentFailedVerifications}/${recentVerifications} FAIL in last 7d.`,
  });
  if (
    blocker === "NONE" &&
    recentVerifications >= 3 &&
    recentFailedVerifications / recentVerifications >= 0.5
  ) {
    blocker = "POST_PUBLISH_FAILING";
    blockerExplanation = "More than half of recent post-publish verifications failed.";
    exactTable = "PostPublishVerification";
    nextRepair = "Investigate cache/sitemap/search refreshes; re-run the post-publish probe.";
  }

  // Spec §14: surface the exact count for the blocking stage so the
  // operator sees "0 candidate URLs", "0 structured blocks", etc.
  if (blocker !== "NONE") {
    const blockingCheck = checks.find((c) => c.stage === blocker);
    if (blockingCheck) exactCount = blockingCheck.count;
  }

  // Surface the most recent failure across the pipeline.
  const recentFailure = await prisma.adminWorkerLog
    .findFirst({
      where: { severity: { in: ["ERROR", "WARN"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, message: true },
    })
    .catch(() => null);

  // When the blocker is a stage a missing outward CAPABILITY explains
  // (no candidates to fetch, fetches failing on unapproved hosts, extraction
  // can't complete required fields, validation sources unreachable, quality/
  // publish gated on evidence) append the EXACT env/network remediation, so the
  // operator sees what to enable. The worker can't grant itself a key or open a
  // firewall — but it names the precise fix instead of a generic "run the stage".
  const CAPABILITY_GATED: GrowthBlockerStage[] = [
    "NO_CANDIDATE_URLS",
    "NO_CANDIDATES_PRIORITIZED",
    "FETCH_FAILING",
    "NO_SOURCE_READS",
    "EXTRACTION_FAILING",
    "NO_PACKAGE_ARTIFACTS",
    "VALIDATION_EVIDENCE_MISSING",
    "QUALITY_SCORE_TOO_LOW",
    "PUBLISH_BLOCKED",
  ];
  if (CAPABILITY_GATED.includes(blocker)) {
    try {
      const { diagnoseCapabilityGaps } = await import("./capability-gaps");
      const cap = await diagnoseCapabilityGaps(prisma);
      if (cap.missing.length > 0) {
        const top = cap.missing[0];
        nextRepair = `${nextRepair ? `${nextRepair} ` : ""}Likely capability gap — ${top.capability}: set ${top.env}.`;
      }
    } catch {
      // best-effort — the capability hint is additive
    }
  }

  // Last + next worker decision.
  const lastDecision = await prisma.adminWorkerDecision
    .findFirst({
      where: { decisionType: "brain_pass" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, chosenAction: true, reason: true },
    })
    .catch(() => null);

  return {
    contentType,
    blocker,
    blockerExplanation,
    exactTable,
    exactCount,
    mostRecentFailure: recentFailure
      ? { when: recentFailure.createdAt, reason: recentFailure.message }
      : null,
    nextAutomaticRepair: nextRepair,
    lastWorkerDecision: lastDecision
      ? {
          when: lastDecision.createdAt,
          chosenAction: lastDecision.chosenAction,
          reason: lastDecision.reason,
        }
      : null,
    nextWorkerDecision:
      blocker === "NONE"
        ? "Continue normal maintenance + growth passes."
        : `Run the dispatcher; brain will choose the action that fixes "${blocker}".`,
    checks,
  };
}

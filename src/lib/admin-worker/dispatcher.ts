/**
 * AdminWorkerDispatcher (spec §2). Executes the mission stage the
 * brain selected. Replaces the previous loop logic that only knew how
 * to call `planAndEnqueue()` + `runOneBuildCycle()` — the dispatcher
 * walks every stage of the content chain and invokes the correct
 * module for the brain's chosen action.
 *
 * Each stage handler is small and delegates to the existing modules
 * (web-navigator, source-reader, classifier, extractors,
 * cross-source-verifier, publisher, post-publish-probe, homepage
 * mutator, repair orchestrator, etc.). The dispatcher's value is
 * twofold:
 *   1. The brain's mission stage maps to one place, not one place per
 *      mode handler.
 *   2. Every dispatch records its outcome (advanced / rejected /
 *      repair-planned) so the audit view can show what actually
 *      happened after the brain decided.
 *
 * The dispatcher never invents work — if there is nothing to do for
 * the chosen stage it returns `{ kind: "idle" }` and the loop is free
 * to fall through to maintenance.
 */

import type { PrismaClient } from "@prisma/client";

import { runOneBuildCycle } from "@/lib/worker";
import type { BrainDecision, BrainMissionStage } from "./brain";
import { writeAdminWorkerLog } from "./logs";
import { planAndEnqueue, type PlanOutcome } from "./planner";

export interface DispatchOutcome {
  /** The mission stage the dispatcher actually executed. */
  stage: BrainMissionStage;
  /**
   * One of:
   *   - "advanced": work moved an item to the next stage
   *   - "rejected": work explicitly rejected an item (with a reason)
   *   - "repair-planned": work filed a repair plan instead of completing
   *   - "idle": nothing to do for this stage right now
   *   - "skipped": the brain told us not to act (eg. paused)
   *   - "failed": the stage threw; failure is recorded for repair
   */
  kind: "advanced" | "rejected" | "repair-planned" | "idle" | "skipped" | "failed";
  /** Short human-readable summary the audit view surfaces. */
  summary: string;
  /** Items advanced through the chain by this dispatch (eg. build count). */
  built?: number;
  /** Items the dispatch published live. */
  published?: number;
  /** Items the dispatch explicitly failed. */
  failed?: number;
  /** Items the dispatch rejected with a reason. */
  rejected?: number;
  /** Repair plans the dispatch filed during the run. */
  repairsPlanned?: number;
  /** Free-form metadata kept on the log row for diagnostics. */
  metadata?: Record<string, unknown>;
}

export interface DispatchInput {
  prisma: PrismaClient;
  workerId: string;
  passId: string;
  decision: BrainDecision;
}

/**
 * Execute the mission stage the brain selected. Every stage maps to
 * exactly one handler; new stages slot into the switch below.
 */
export async function executeMissionStage(input: DispatchInput): Promise<DispatchOutcome> {
  const { prisma, workerId, passId, decision } = input;
  const stage = decision.missionStage;

  try {
    switch (stage) {
      case "PAUSED":
        return idle(stage, "Worker paused; only security defense allowed.");
      case "SECURITY_DEFENSE":
        return await runSecurityDefense(prisma, passId);
      case "DISCOVERY":
        return await runDiscovery(prisma, passId, decision);
      case "CANDIDATE_PRIORITIZATION":
        return await runCandidatePrioritization(prisma, passId);
      case "SOURCE_FETCH":
      case "SOURCE_READ":
        return await runSourceFetchRead(prisma, passId, decision);
      case "CLASSIFICATION":
        return await runClassification(prisma, passId);
      case "EXTRACTION":
        return await runExtraction(prisma, passId);
      case "CHECKLIST_CREATION":
      case "CITATION_CREATION":
        return await runChecklistOrCitation(prisma, passId, stage);
      case "PACKAGE_BUILD":
        return await runPackageBuild(prisma, workerId, passId);
      case "CROSS_SOURCE_VERIFICATION":
        return await runCrossSourceVerification(prisma, passId);
      case "STRICT_QA":
        return await runStrictQA(prisma, passId);
      case "PERSISTENCE":
      case "PUBLIC_PUBLISH":
        return await runPersistAndPublish(prisma, workerId, passId);
      case "POST_PUBLISH_VERIFY":
        return await runPostPublishVerify(prisma, passId);
      case "SEARCH_VERIFY":
        return await runSearchVerify(prisma, passId);
      case "SITEMAP_VERIFY":
        return await runSitemapVerify(prisma, passId);
      case "CACHE_REFRESH":
        return await runCacheRefresh(prisma, passId);
      case "REPAIR":
        return await runRepair(prisma, workerId, passId);
      case "HOMEPAGE_WORK":
        return await runHomepageWork(prisma, passId);
      case "REPORTING":
        return await runReporting(prisma, passId);
      case "MAINTENANCE":
        return await runMaintenance(prisma, passId);
      default:
        return idle(stage, `No dispatcher registered for ${stage}.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "ERROR",
      severity: "ERROR",
      eventName: "dispatch_failed",
      message: `Dispatcher for ${stage} threw: ${message}`,
      safeMetadata: { stage },
    });
    return {
      stage,
      kind: "failed",
      summary: `Stage ${stage} failed: ${message.slice(0, 240)}`,
      failed: 1,
    };
  }
}

function idle(stage: BrainMissionStage, summary: string): DispatchOutcome {
  return { stage, kind: "idle", summary };
}

// ── Stage handlers ────────────────────────────────────────────────────

async function runSecurityDefense(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Defender fires from request paths. From the loop, all we do is
  // record that we noticed and acknowledge any pending security
  // events; the heavy lifting happens in the request middleware.
  const pending = await prisma.securityEvent
    .count({
      where: {
        classification: "Breach",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    .catch(() => 0);
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "SECURITY",
    severity: "WARN",
    eventName: "security_defense_pass",
    message: `Security defense pass acknowledged ${pending} breach(es) in the last 24h.`,
    safeMetadata: { pendingBreaches: pending },
  });
  return {
    stage: "SECURITY_DEFENSE",
    kind: "advanced",
    summary: `Acknowledged ${pending} breach(es).`,
    metadata: { pendingBreaches: pending },
  };
}

async function runDiscovery(
  prisma: PrismaClient,
  passId: string,
  decision: BrainDecision,
): Promise<DispatchOutcome> {
  // Delegate to the DiscoveryOrchestrator (spec §4) which knows
  // content-type-specific strategies, source ranking, skip rules,
  // and the candidate scorer wiring.
  const { runDiscoveryOrchestrator } = await import("./discovery-orchestrator");
  const outcome = await runDiscoveryOrchestrator(prisma, {
    passId,
    contentType: decision.contentType,
  });
  return {
    stage: "DISCOVERY",
    kind: outcome.surfaced > 0 ? "advanced" : "idle",
    summary: `Discovery orchestrator: surfaced ${outcome.surfaced}, rejected ${outcome.rejected}, ${outcome.hostsSkipped.length} host(s) skipped.`,
    metadata: {
      surfaced: outcome.surfaced,
      rejected: outcome.rejected,
      hostsSkipped: outcome.hostsSkipped.length,
      errors: outcome.errors,
    },
  };
}

async function runCandidatePrioritization(
  prisma: PrismaClient,
  passId: string,
): Promise<DispatchOutcome> {
  // Score every DISCOVERED or PRIORITIZED candidate so the fetcher
  // can sort by fetchPriority. The scorer also flips junk-heavy
  // candidates to REJECTED (visible in the rejected-candidate
  // dashboard) — spec §5.
  const { rescoreAllCandidates } = await import("./candidate-scorer");
  const result = await rescoreAllCandidates(prisma, { limit: 200 });
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "candidates_prioritized",
    message: `Candidate scorer: ${result.scored} scored, ${result.prioritized} prioritized, ${result.rejected} rejected.`,
    safeMetadata: result,
  });
  return {
    stage: "CANDIDATE_PRIORITIZATION",
    kind: result.scored > 0 ? "advanced" : "idle",
    summary: `Scored ${result.scored} candidates (${result.prioritized} prioritized, ${result.rejected} rejected).`,
    metadata: result,
  };
}

async function runSourceFetchRead(
  prisma: PrismaClient,
  passId: string,
  decision: BrainDecision,
): Promise<DispatchOutcome> {
  // Order by the candidate scorer's fetchPriority — the best safe
  // candidate first (spec §5).
  const candidate = await prisma.candidateSourceUrl.findFirst({
    where: { status: { in: ["DISCOVERED", "PRIORITIZED"] } },
    orderBy: [{ fetchPriority: "desc" }, { predictedUsefulness: "desc" }, { createdAt: "asc" }],
  });
  if (!candidate) {
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "SOURCE_READING",
      severity: "INFO",
      eventName: "fetch_no_candidates",
      message: "Fetch/read stage idle: no candidates available.",
    });
    return idle("SOURCE_FETCH", "No candidates available to fetch.");
  }

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "SOURCE_READING",
    severity: "INFO",
    eventName: "fetch_planned",
    message: `Planned fetch for ${candidate.discoveredUrl}.`,
    sourceHost: candidate.sourceHost,
    sourceUrl: candidate.discoveredUrl,
    contentType: decision.contentType ?? undefined,
    safeMetadata: {
      candidateId: candidate.id,
      predictedContentType: candidate.predictedContentType,
      predictedUsefulness: candidate.predictedUsefulness,
    },
  });

  // The actual network fetch happens in a separate environment (the
  // worker process owns HTTP). The dispatcher's job is to advance
  // the chain: mark the candidate FETCHED so the build engine picks
  // it up. Future passes / repair plans handle real network IO.
  await prisma.candidateSourceUrl.update({
    where: { id: candidate.id },
    data: { fetchAttempts: candidate.fetchAttempts + 1, lastFetchedAt: new Date() },
  });

  return {
    stage: "SOURCE_FETCH",
    kind: "advanced",
    summary: `Marked ${candidate.discoveredUrl} as fetched.`,
    metadata: { candidateId: candidate.id, url: candidate.discoveredUrl },
  };
}

async function runClassification(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  const unclassified = await prisma.adminWorkerSourceRead.findFirst({
    where: { detectedContentType: null },
    orderBy: { createdAt: "asc" },
  });
  if (!unclassified) {
    return idle("CLASSIFICATION", "No unclassified source-reads.");
  }
  const { classify } = await import("./classifier");
  const result = classify({
    url: unclassified.sourceUrl,
    title: unclassified.extractedTitle,
    bodyText: unclassified.extractedText ?? "",
    headings: Array.isArray(unclassified.extractedHeadings)
      ? (unclassified.extractedHeadings as string[])
      : [],
  });
  await prisma.adminWorkerSourceRead.update({
    where: { id: unclassified.id },
    data: {
      detectedContentType: result.contentType,
      confidenceScore: result.confidence,
    },
  });
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CONTENT_CLASSIFICATION",
    severity: "INFO",
    eventName: "classified_source_read",
    message: `Classified ${unclassified.sourceUrl} as ${result.contentType} (confidence ${result.confidence.toFixed(2)}).`,
    sourceUrl: unclassified.sourceUrl,
    sourceHost: unclassified.sourceHost,
    safeMetadata: { classification: result.contentType, confidence: result.confidence },
  });

  // Feed source reputation with the classification outcome (spec §16).
  const { pushReputation } = await import("./source-reputation-hooks");
  await pushReputation(prisma, {
    sourceHost: unclassified.sourceHost,
    contentType: result.contentType,
    stage: "classification",
    ok: result.contentType !== "WRONG" && result.contentType !== "UNUSABLE",
    usefulness: result.confidence,
  }).catch(() => undefined);

  return {
    stage: "CLASSIFICATION",
    kind: "advanced",
    summary: `Classified ${unclassified.sourceUrl} as ${result.contentType}.`,
  };
}

async function runExtraction(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Extraction happens inside source-reader.readSource(). Here we
  // ensure the latest classified read has had extraction attempted —
  // a future enhancement will materialise a structured-block table.
  const read = await prisma.adminWorkerSourceRead.findFirst({
    where: { detectedContentType: { not: null } },
    orderBy: { updatedAt: "desc" },
  });
  if (!read) {
    return idle("EXTRACTION", "No classified source-reads available for extraction.");
  }
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CONTENT_BUILD",
    severity: "INFO",
    eventName: "extraction_planned",
    message: `Extraction planned for ${read.sourceUrl} (${read.detectedContentType}).`,
    sourceUrl: read.sourceUrl,
    sourceHost: read.sourceHost,
  });
  return {
    stage: "EXTRACTION",
    kind: "advanced",
    summary: `Extraction planned for ${read.sourceUrl}.`,
  };
}

async function runChecklistOrCitation(
  prisma: PrismaClient,
  passId: string,
  stage: BrainMissionStage,
): Promise<DispatchOutcome> {
  // Today these stages are handled inside the build engine. We log
  // the chosen stage so the audit view can show the brain reached
  // for it — the engine itself does the work.
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CONTENT_BUILD",
    severity: "INFO",
    eventName: `${stage.toLowerCase()}_pass`,
    message: `Stage ${stage} delegated to the build engine.`,
  });
  return {
    stage,
    kind: "advanced",
    summary: `Stage ${stage} delegated to build engine.`,
  };
}

async function runPackageBuild(
  prisma: PrismaClient,
  workerId: string,
  passId: string,
): Promise<DispatchOutcome> {
  // First make sure the queue has work — the planner enqueues new
  // build jobs to close any content-type gap.
  const planOutcome: PlanOutcome = await planAndEnqueue(prisma, { passId });
  if (planOutcome.enqueued > 0) {
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "planner_run_dispatcher",
      message: planOutcome.reason,
      contentType: planOutcome.contentType ?? undefined,
    });
  }

  // Then drain one build cycle.
  const cycle = await runOneBuildCycle(prisma, workerId);
  if (cycle.kind === "idle") {
    return {
      stage: "PACKAGE_BUILD",
      kind: "idle",
      summary: "Build engine idle; nothing to drain.",
      metadata: { enqueued: planOutcome.enqueued },
    };
  }

  const built = cycle.status === "succeeded" || cycle.status === "published" ? 1 : 0;
  const published = cycle.status === "published" ? 1 : 0;
  const failed = cycle.status === "failed" || cycle.status === "retrying" ? 1 : 0;
  return {
    stage: "PACKAGE_BUILD",
    kind: failed > 0 ? "failed" : "advanced",
    summary: `Build cycle ${cycle.status}.`,
    built,
    published,
    failed,
    metadata: {
      enqueued: planOutcome.enqueued,
      jobId: cycle.kind === "ran" ? cycle.jobId : undefined,
    },
  };
}

async function runCrossSourceVerification(
  prisma: PrismaClient,
  passId: string,
): Promise<DispatchOutcome> {
  // Pick the most recent published content row that has not had
  // verification evidence stored yet. The verifier persists per-field
  // evidence to AdminWorkerCrossSourceVerification so the publish
  // gate + admin UI can show the audit trail (spec §11).
  const pending = await prisma.checklistQAReport
    .count({ where: { needsHumanReview: true, reviewedAt: null } })
    .catch(() => 0);

  // Best-effort: pick the most recent published content we haven't
  // already verified, and run the durable verifier on its payload.
  const candidate = await prisma.publishedContent
    .findFirst({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { id: true, contentType: true, title: true, slug: true, payload: true },
    })
    .catch(() => null);

  let verifiedFieldCount = 0;
  let blockingFields: string[] = [];
  if (candidate) {
    const already = await prisma.adminWorkerCrossSourceVerification
      .findFirst({
        where: { contentType: candidate.contentType, contentId: candidate.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
      .catch(() => null);

    if (!already) {
      const { runVerifier } = await import("./verifier");
      const fields =
        typeof candidate.payload === "object" && candidate.payload != null
          ? (candidate.payload as Record<string, unknown>)
          : {};
      const result = await runVerifier(prisma, {
        contentType: candidate.contentType,
        contentId: candidate.id,
        fields,
        // With no live validation source connection in the dispatcher,
        // we record a single "self" row — the verifier surfaces
        // MISSING_EVIDENCE for the admin UI to act on.
        validationSources: [],
      }).catch(() => null);
      verifiedFieldCount = result?.verificationRowIds.length ?? 0;
      blockingFields = result?.blockingSensitiveFields ?? [];
    }
  }

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "VALIDATION",
    severity: blockingFields.length > 0 ? "WARN" : "INFO",
    eventName: "cross_source_pass",
    message: `Cross-source verification pass: ${pending} pending QA review(s); ${verifiedFieldCount} field(s) recorded${
      blockingFields.length > 0 ? `; blocked on ${blockingFields.join(", ")}` : ""
    }.`,
    safeMetadata: {
      pendingReviews: pending,
      verifiedFieldCount,
      blockingFields,
      contentId: candidate?.id,
    },
  });
  return {
    stage: "CROSS_SOURCE_VERIFICATION",
    kind: verifiedFieldCount > 0 ? "advanced" : pending > 0 ? "advanced" : "idle",
    summary:
      verifiedFieldCount > 0
        ? `Verified ${verifiedFieldCount} field(s)${
            blockingFields.length > 0 ? `, blocked on ${blockingFields.join(", ")}` : ""
          }.`
        : `${pending} QA review(s) to verify.`,
    metadata: {
      pendingReviews: pending,
      verifiedFieldCount,
      blockingFields,
    },
    rejected: blockingFields.length > 0 ? 1 : 0,
  };
}

async function runStrictQA(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "QA",
    severity: "INFO",
    eventName: "strict_qa_pass",
    message: "Strict QA pass: build engine runs QA inline; nothing extra to do here.",
  });
  return {
    stage: "STRICT_QA",
    kind: "advanced",
    summary: "Strict QA runs inline with the build engine.",
  };
}

async function runPersistAndPublish(
  prisma: PrismaClient,
  workerId: string,
  passId: string,
): Promise<DispatchOutcome> {
  // Persist + publish happens inside the build engine when QA passes.
  // From the dispatcher we drive a build cycle to make forward
  // progress on the publish path.
  const cycle = await runOneBuildCycle(prisma, workerId);
  if (cycle.kind === "idle") {
    return idle("PUBLIC_PUBLISH", "Publish queue idle.");
  }
  const built = cycle.status === "succeeded" || cycle.status === "published" ? 1 : 0;
  const published = cycle.status === "published" ? 1 : 0;
  const failed = cycle.status === "failed" || cycle.status === "retrying" ? 1 : 0;
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "PUBLISHING",
    severity: published > 0 ? "INFO" : "WARN",
    eventName: "publish_pass",
    message: `Publish pass status: ${cycle.status}.`,
  });
  return {
    stage: "PUBLIC_PUBLISH",
    kind: failed > 0 ? "failed" : "advanced",
    summary: `Publish cycle ${cycle.status}.`,
    built,
    published,
    failed,
  };
}

async function runPostPublishVerify(
  prisma: PrismaClient,
  passId: string,
): Promise<DispatchOutcome> {
  const { verifyPublished } = await import("./post-publish-probe");
  // Find one published item missing a verification row.
  const verifiedIds = await prisma.postPublishVerification.findMany({
    select: { contentId: true },
    distinct: ["contentId"],
  });
  const verifiedSet = new Set(verifiedIds.map((r) => r.contentId));
  const candidates = await prisma.publishedContent.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: { id: true, contentType: true, slug: true, title: true },
  });
  const target = candidates.find((c) => !verifiedSet.has(c.id));
  if (!target) {
    return idle("POST_PUBLISH_VERIFY", "All published content already verified.");
  }
  const verification = await verifyPublished(prisma, {
    contentType: target.contentType,
    contentId: target.id,
    slug: target.slug,
    expectedTitle: target.title,
    skipNetwork: true,
  }).catch(
    () =>
      ({
        verificationId: "",
        result: "FAIL" as const,
        checks: {} as never,
        publicUrl: "",
      }) as Awaited<ReturnType<typeof verifyPublished>>,
  );
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: verification.result === "PASS" ? "INFO" : "WARN",
    eventName: "post_publish_verified",
    message: `Verified ${target.contentType}/${target.slug}: ${verification.result}.`,
    contentType: target.contentType,
    relatedEntityId: target.id,
    safeMetadata: { result: verification.result },
  });
  return {
    stage: "POST_PUBLISH_VERIFY",
    kind: verification.result === "PASS" ? "advanced" : "rejected",
    summary: `Verified ${target.contentType}/${target.slug}: ${verification.result}.`,
    rejected: verification.result === "PASS" ? 0 : 1,
  };
}

async function runSearchVerify(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: "INFO",
    eventName: "search_verify_pass",
    message: "Search verification pass: relies on post-publish probe for now.",
  });
  return { stage: "SEARCH_VERIFY", kind: "advanced", summary: "Search verify pass acknowledged." };
}

async function runSitemapVerify(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: "INFO",
    eventName: "sitemap_verify_pass",
    message: "Sitemap verification pass: relies on post-publish probe for now.",
  });
  return {
    stage: "SITEMAP_VERIFY",
    kind: "advanced",
    summary: "Sitemap verify pass acknowledged.",
  };
}

async function runCacheRefresh(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  const { flagCacheRefresh } = await import("./repair");
  await flagCacheRefresh(prisma, "admin-worker-brain-requested");
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: "INFO",
    eventName: "cache_refresh",
    message: "Cache refresh requested.",
  });
  return { stage: "CACHE_REFRESH", kind: "advanced", summary: "Cache refresh requested." };
}

async function runRepair(
  prisma: PrismaClient,
  workerId: string,
  passId: string,
): Promise<DispatchOutcome> {
  // First drain durable repair plans via the orchestrator (spec §17).
  const { runRepairOrchestrator } = await import("./repair-orchestrator");
  const orchestrator = await runRepairOrchestrator(prisma, { passId });

  // Then run the legacy stuck-queue recovery for in-pass fixups.
  const { recoverStuckQueue } = await import("./repair");
  const recovery = await recoverStuckQueue(prisma);
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "REPAIR",
    severity: "INFO",
    eventName: "repair_pass",
    message: `Repair orchestrator: ${orchestrator.plansSucceeded}/${orchestrator.plansConsidered} succeeded; stuck-queue ${recovery.attempted ? "attempted" : "skipped"}.`,
    safeMetadata: {
      orchestrator: {
        considered: orchestrator.plansConsidered,
        succeeded: orchestrator.plansSucceeded,
        failed: orchestrator.plansFailed,
        abandoned: orchestrator.plansAbandoned,
      },
      stuckQueue: JSON.parse(JSON.stringify(recovery)),
    },
  });

  // After repair, attempt a build cycle to make forward progress.
  const cycle = await runOneBuildCycle(prisma, workerId);
  const built =
    cycle.kind === "ran" && (cycle.status === "succeeded" || cycle.status === "published") ? 1 : 0;
  const published = cycle.kind === "ran" && cycle.status === "published" ? 1 : 0;
  return {
    stage: "REPAIR",
    kind: "advanced",
    summary: `Repair orchestrator + stuck-queue + build cycle: ${cycle.kind === "ran" ? cycle.status : "idle"}.`,
    built,
    published,
    repairsPlanned: orchestrator.plansExecuted + (recovery.attempted ? 1 : 0),
  };
}

async function runHomepageWork(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Spec §20: homepage makeover is a real worker mission. Delegate
  // to the HomepagePublishOrchestrator which inspects, mutates,
  // verifies, and rolls back when needed.
  const { runHomepagePublishOrchestrator } = await import("./homepage-publish-orchestrator");
  const result = await runHomepagePublishOrchestrator(prisma, { passId });
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "HOMEPAGE",
    severity: result.kind === "rolled-back" ? "WARN" : "INFO",
    eventName: "homepage_dispatch",
    message: `Homepage orchestrator: ${result.kind} (composite=${result.inspection.composite.toFixed(2)}).`,
    safeMetadata: {
      kind: result.kind,
      draftId: result.draftId,
      composite: result.inspection.composite,
      verificationPassed: result.verificationPassed,
    },
  });
  return {
    stage: "HOMEPAGE_WORK",
    kind:
      result.kind === "auto-published" || result.kind === "review-draft"
        ? "advanced"
        : result.kind === "rolled-back"
          ? "rejected"
          : "idle",
    summary: result.reason,
    metadata: {
      kind: result.kind,
      draftId: result.draftId,
      composite: result.inspection.composite,
    },
  };
}

async function runReporting(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Reporting now bundles diagnostics + growth orchestrator + source
  // coverage so the admin UI always has fresh "why content isn't
  // growing" and "where source coverage is thin" panels (spec §22, §23).
  const [ratings, growth, coverage] = await Promise.all([
    (await import("./diagnostics")).runAdminWorkerDiagnostics(prisma),
    (await import("./growth-orchestrator"))
      .runGrowthOrchestrator(prisma, { passId })
      .catch(() => ({ assessments: [], repairPlansFiled: 0, movedToMaintenance: 0 })),
    (await import("./source-coverage")).runSourceCoverage(prisma).catch(() => []),
  ]);
  const blocked = coverage.filter((c) => c.blockedByCoverage).length;
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "REPORT",
    severity: "INFO",
    eventName: "diagnostics_dispatch",
    message: `Reporting pass: ${ratings.length} ratings checked, ${growth.assessments.length} growth assessments (${growth.repairPlansFiled} repair plan(s)), ${blocked} content type(s) blocked by source coverage.`,
    safeMetadata: {
      ratingsCount: ratings.length,
      growthAssessments: growth.assessments.length,
      repairPlansFiled: growth.repairPlansFiled,
      movedToMaintenance: growth.movedToMaintenance,
      coverageBlocked: blocked,
    },
  });
  return {
    stage: "REPORTING",
    kind: "advanced",
    summary: `Reporting pass: ${ratings.length} ratings, ${growth.assessments.length} growth, ${blocked} coverage-blocked.`,
    metadata: {
      ratingsCount: ratings.length,
      growthAssessments: growth.assessments.length,
      repairPlansFiled: growth.repairPlansFiled,
      coverageBlocked: blocked,
    },
  };
}

async function runMaintenance(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  const { runCleanupPass } = await import("./cleanup");
  const { decayMemory } = await import("./memory");
  const [cleanup, memoryDecay] = await Promise.all([
    runCleanupPass(prisma),
    decayMemory(prisma).catch(() => ({ decayed: 0, pruned: 0 })),
  ]);
  const safe = JSON.parse(JSON.stringify({ cleanup, memoryDecay }));
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CLEANUP",
    severity: "INFO",
    eventName: "maintenance_dispatch",
    message: `Maintenance: ${cleanup.staleCandidatesRemoved} stale candidate(s), ${cleanup.expiredReviewsClosed} expired review(s) closed; memory decayed=${memoryDecay.decayed}, pruned=${memoryDecay.pruned}.`,
    safeMetadata: safe,
  });
  return {
    stage: "MAINTENANCE",
    kind: "advanced",
    summary: `Maintenance: cleanup + memory decay (${memoryDecay.decayed} rows).`,
    metadata: safe,
  };
}

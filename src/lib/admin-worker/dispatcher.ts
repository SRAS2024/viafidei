/**
 * AdminWorkerDispatcher (spec §2). Executes the mission stage the
 * brain selected. The legacy planAndEnqueue() + runOneBuildCycle()
 * build/publish path is gone (spec §1) — the dispatcher walks every
 * stage of the artifact content chain and invokes the correct module
 * for the brain's chosen action. The ONLY way content becomes public
 * is EXTRACTION → STRICT_QA → PUBLIC_PUBLISH (runPublishOrchestrator).
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

import type { BrainDecision, BrainMissionStage } from "./brain";
import { writeAdminWorkerLog } from "./logs";

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
  // ── Spec §3.4: every stage return carries the full result shape. ──
  /** What the stage actually did (e.g. "fetched candidate", "no work"). */
  actionTaken?: string;
  /** The entity the stage consumed (candidate URL, source-read id, artifact id). */
  inputEntity?: string | null;
  /** The entity the stage produced (source-read id, artifact id, published id). */
  outputEntity?: string | null;
  /** Items advanced through the chain by this dispatch. */
  advancedCount?: number;
  /** Items rejected by this dispatch. */
  rejectedCount?: number;
  /** Items repaired / repair-planned by this dispatch. */
  repairedCount?: number;
  /** The blocker, when the stage could not advance. */
  blocker?: string | null;
  /** The next stage in the chain the worker should run. */
  nextStage?: BrainMissionStage | null;
  /** How many log rows the stage wrote. */
  logsCreated?: number;
}

/**
 * Spec §3.4: the next mission stage in the artifact chain. Side
 * missions (repair / homepage / reporting / security / maintenance)
 * loop back to discovery.
 */
const NEXT_STAGE: Partial<Record<BrainMissionStage, BrainMissionStage | null>> = {
  DISCOVERY: "CANDIDATE_PRIORITIZATION",
  CANDIDATE_PRIORITIZATION: "SOURCE_FETCH",
  SOURCE_FETCH: "SOURCE_READ",
  SOURCE_READ: "CLASSIFICATION",
  CLASSIFICATION: "EXTRACTION",
  EXTRACTION: "CHECKLIST_CREATION",
  CHECKLIST_CREATION: "CITATION_CREATION",
  CITATION_CREATION: "PACKAGE_BUILD",
  PACKAGE_BUILD: "CROSS_SOURCE_VERIFICATION",
  CROSS_SOURCE_VERIFICATION: "STRICT_QA",
  STRICT_QA: "PERSISTENCE",
  PERSISTENCE: "PUBLIC_PUBLISH",
  PUBLIC_PUBLISH: "POST_PUBLISH_VERIFY",
  POST_PUBLISH_VERIFY: "SEARCH_VERIFY",
  SEARCH_VERIFY: "SITEMAP_VERIFY",
  SITEMAP_VERIFY: "CACHE_REFRESH",
  CACHE_REFRESH: null,
  REPAIR: "DISCOVERY",
  HOMEPAGE_WORK: "DISCOVERY",
  REPORTING: "DISCOVERY",
  SECURITY_DEFENSE: "DISCOVERY",
  MAINTENANCE: "DISCOVERY",
  PAUSED: null,
};

/**
 * Spec §3.4: enrich a raw handler outcome with the full result shape
 * (actionTaken, input/output entity, advanced/rejected/repaired
 * counts, blocker, nextStage, logsCreated). Fields the handler already
 * set are preserved; the rest are derived from kind + metadata so
 * every stage return is uniform without editing all 19 handlers.
 */
function enrichOutcome(outcome: DispatchOutcome, decision: BrainDecision): DispatchOutcome {
  const meta = (outcome.metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const advancedCount =
    outcome.advancedCount ?? outcome.built ?? (outcome.kind === "advanced" ? 1 : 0);
  const rejectedCount =
    outcome.rejectedCount ?? outcome.rejected ?? (outcome.kind === "rejected" ? 1 : 0);
  const repairedCount = outcome.repairedCount ?? outcome.repairsPlanned ?? 0;
  const blocker =
    outcome.blocker ??
    (outcome.kind === "rejected" || outcome.kind === "failed" ? outcome.summary : null);
  return {
    ...outcome,
    actionTaken: outcome.actionTaken ?? `${outcome.stage}:${outcome.kind}`,
    inputEntity:
      outcome.inputEntity ??
      str(meta.candidateUrlId) ??
      str(meta.sourceReadId) ??
      str(meta.artifactId) ??
      decision.chosenAction?.candidateUrl ??
      null,
    outputEntity:
      outcome.outputEntity ??
      str(meta.publishedContentId) ??
      str(meta.artifactId) ??
      str(meta.sourceReadId) ??
      null,
    advancedCount,
    rejectedCount,
    repairedCount,
    blocker,
    nextStage: outcome.nextStage ?? NEXT_STAGE[outcome.stage] ?? null,
    // Every stage writes at least one log row (the dispatch log); most
    // write more. Default to 1 when the handler didn't count.
    logsCreated: outcome.logsCreated ?? 1,
  };
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
    const raw = await runStageHandler(prisma, workerId, passId, decision, stage);
    // Spec §3.4: every stage return carries the full uniform shape.
    return enrichOutcome(raw, decision);
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
    return enrichOutcome(
      {
        stage,
        kind: "failed",
        summary: `Stage ${stage} failed: ${message.slice(0, 240)}`,
        failed: 1,
        blocker: message.slice(0, 240),
      },
      decision,
    );
  }
}

async function runStageHandler(
  prisma: PrismaClient,
  workerId: string,
  passId: string,
  decision: BrainDecision,
  stage: BrainMissionStage,
): Promise<DispatchOutcome> {
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
      return await runPackageBuild(prisma, passId);
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
      return await runRepair(prisma, passId);
    case "HOMEPAGE_WORK":
      return await runHomepageWork(prisma, passId);
    case "REPORTING":
      return await runReporting(prisma, passId);
    case "MAINTENANCE":
      return await runMaintenance(prisma, passId);
    default:
      return idle(stage, `No dispatcher registered for ${stage}.`);
  }
}

function idle(stage: BrainMissionStage, summary: string): DispatchOutcome {
  return { stage, kind: "idle", summary };
}

/**
 * Spec §5 follow-up: build a VerifierOutcome from the stored
 * AdminWorkerCrossSourceVerification rows the cross-source stage
 * already produced. The publish orchestrator gates on this outcome
 * rather than re-running the verifier with empty validation sources.
 *
 * - missingRequired: validation needs with no MATCH/PASS row.
 * - blockingSensitiveFields: needs with a MISMATCH or only
 *   MISSING_EVIDENCE rows.
 * - publishAllowed: every need has at least one passing match AND no
 *   blocker.
 */
async function loadVerifierFromStoredEvidence(
  prisma: PrismaClient,
  artifactId: string,
  validationNeeds: string[],
): Promise<{
  evidence: never[];
  hasConflict: boolean;
  missingRequired: string[];
  publishAllowed: boolean;
  verificationRowIds: string[];
  blockingSensitiveFields: string[];
  summary: string;
}> {
  const needs = (validationNeeds ?? []).filter((n) => typeof n === "string");
  if (needs.length === 0) {
    return {
      evidence: [],
      hasConflict: false,
      missingRequired: [],
      publishAllowed: true,
      verificationRowIds: [],
      blockingSensitiveFields: [],
      summary: "No validation needs for this artifact.",
    };
  }
  const rows = await prisma.adminWorkerCrossSourceVerification
    .findMany({
      where: { contentId: artifactId },
      select: { id: true, fieldName: true, matchResult: true },
    })
    .catch(() => [] as Array<{ id: string; fieldName: string; matchResult: string }>);
  const byField = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byField.get(r.fieldName) ?? [];
    arr.push(r.matchResult);
    byField.set(r.fieldName, arr);
  }
  const missingRequired: string[] = [];
  const blockingSensitiveFields: string[] = [];
  let hasConflict = false;
  for (const need of needs) {
    const results = byField.get(need) ?? [];
    if (results.length === 0) {
      missingRequired.push(need);
      continue;
    }
    if (results.some((r) => r === "MISMATCH")) {
      blockingSensitiveFields.push(need);
      hasConflict = true;
      continue;
    }
    if (!results.some((r) => r === "MATCH" || r === "PASS")) {
      blockingSensitiveFields.push(need);
    }
  }
  const publishAllowed =
    missingRequired.length === 0 && blockingSensitiveFields.length === 0 && !hasConflict;
  const summary = publishAllowed
    ? `All ${needs.length} validation need(s) confirmed by stored evidence.`
    : `Stored evidence: ${missingRequired.length} missing, ${blockingSensitiveFields.length} blocking.`;
  return {
    evidence: [],
    hasConflict,
    missingRequired,
    publishAllowed,
    verificationRowIds: rows.map((r) => r.id),
    blockingSensitiveFields,
    summary,
  };
}

/**
 * Spec §19: resolve the originating source host for a package artifact
 * (via its source-read) so the strict-QA + publish stages can feed
 * source reputation. Returns null when the artifact has no linked read.
 */
async function resolveArtifactSourceHost(
  prisma: PrismaClient,
  sourceReadId: string | null,
): Promise<string | null> {
  if (!sourceReadId) return null;
  const read = await prisma.adminWorkerSourceRead
    .findUnique({ where: { id: sourceReadId }, select: { sourceHost: true } })
    .catch(() => null);
  return read?.sourceHost ?? null;
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

  // Look up the most recent successful fetch for this candidate so the
  // fetcher can short-circuit on a 304 / unchanged checksum (spec §6).
  const previousFetch = await prisma.adminWorkerFetchResult
    .findFirst({
      where: { sourceUrl: candidate.discoveredUrl, succeeded: true },
      orderBy: { createdAt: "desc" },
      select: { checksum: true, etag: true },
    })
    .catch(() => null);

  // Reputation tier informs both the scorer and the source reader.
  const reputation = await prisma.adminWorkerSourceReputation
    .findFirst({
      where: { sourceHost: candidate.sourceHost },
      orderBy: { lastScoreUpdate: "desc" },
      select: { reputationTier: true },
    })
    .catch(() => null);

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "SOURCE_READING",
    severity: "INFO",
    eventName: "fetch_started",
    message: `Fetching ${candidate.discoveredUrl}.`,
    sourceHost: candidate.sourceHost,
    sourceUrl: candidate.discoveredUrl,
    contentType: decision.contentType ?? undefined,
    safeMetadata: {
      candidateId: candidate.id,
      predictedContentType: candidate.predictedContentType,
      predictedUsefulness: candidate.predictedUsefulness,
    },
  });

  // Real fetch + read (spec §6, §7). In tests `process.env.ADMIN_WORKER_SKIP_NETWORK`
  // forces the synthetic-success path so unit suites don't hit the
  // network; production leaves it unset so the real HTTP call runs.
  const skipNetwork = process.env.ADMIN_WORKER_SKIP_NETWORK === "1";
  const { adminWorkerFetch } = await import("./fetcher");
  const fetched = await adminWorkerFetch(prisma, {
    url: candidate.discoveredUrl,
    candidateUrlId: candidate.id,
    previousChecksum: previousFetch?.checksum ?? undefined,
    previousEtag: previousFetch?.etag ?? null,
    skipNetwork,
  });

  // Bookkeeping on the candidate row.
  await prisma.candidateSourceUrl
    .update({
      where: { id: candidate.id },
      data: {
        fetchAttempts: candidate.fetchAttempts + 1,
        lastFetchedAt: new Date(),
        status: fetched.succeeded
          ? "FETCHED"
          : fetched.rejectionReason
            ? "REJECTED"
            : candidate.status,
        rejectionReason: fetched.rejectionReason ?? candidate.rejectionReason,
      },
    })
    .catch(() => undefined);

  // Failed fetch → file a repair plan + push reputation down + return.
  if (!fetched.succeeded) {
    const { filePlan } = await import("./repair-plans");
    await filePlan(prisma, {
      kind: "FETCH_FAILED",
      failedEntity: candidate.sourceHost,
      repairAction: `Re-fetch ${candidate.discoveredUrl} after backoff (${fetched.errorClass ?? "fetch_failed"}).`,
      metadata: {
        candidateId: candidate.id,
        url: candidate.discoveredUrl,
        rejectionReason: fetched.rejectionReason,
      },
    }).catch(() => undefined);
    return {
      stage: "SOURCE_FETCH",
      kind: "repair-planned",
      summary: `Fetch failed for ${candidate.discoveredUrl}: ${fetched.rejectionReason ?? fetched.errorMessage}.`,
      failed: 1,
      repairsPlanned: 1,
      metadata: {
        candidateId: candidate.id,
        url: candidate.discoveredUrl,
        errorClass: fetched.errorClass,
      },
    };
  }

  // 304 / unchanged-checksum path — no body to read, but we count
  // this as advancing the chain because the previous source-read
  // row is still valid.
  if (fetched.unchanged) {
    return {
      stage: "SOURCE_FETCH",
      kind: "advanced",
      summary: `Fetched ${candidate.discoveredUrl}: unchanged (checksum reused).`,
      metadata: { candidateId: candidate.id, url: candidate.discoveredUrl, unchanged: true },
    };
  }

  // Real fetch returned a body — run the source reader.
  const titleMatch = /<title[^>]*>([\s\S]+?)<\/title>/i.exec(fetched.body);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const headings = Array.from(fetched.body.matchAll(/<h[1-6][^>]*>([\s\S]+?)<\/h[1-6]>/gi))
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .slice(0, 30);

  const tier = reputation?.reputationTier;
  const sourceReputationTier =
    tier === "TRUSTED" ? "TRUSTED" : tier === "PAUSED" ? "PAUSED" : tier ? "PROBATION" : null;

  const { readSource } = await import("./source-reader");
  const readOutcome = await readSource(prisma, {
    sourceUrl: candidate.discoveredUrl,
    sourceHost: candidate.sourceHost,
    rawBody: fetched.body,
    title,
    headings,
    sourceReputationTier,
  }).catch(() => null);

  if (!readOutcome) {
    return {
      stage: "SOURCE_FETCH",
      kind: "failed",
      summary: `Fetched ${candidate.discoveredUrl} but readSource threw.`,
      failed: 1,
    };
  }

  return {
    stage: "SOURCE_FETCH",
    kind: readOutcome.rejected ? "rejected" : "advanced",
    summary: readOutcome.rejected
      ? `Fetched + read ${candidate.discoveredUrl}: rejected (${readOutcome.rejectionReason}).`
      : `Fetched + read ${candidate.discoveredUrl}: ${readOutcome.classifierContentType} (conf ${readOutcome.classifierConfidence.toFixed(2)}).`,
    metadata: {
      candidateId: candidate.id,
      sourceReadId: readOutcome.sourceReadId,
      checksum: readOutcome.checksum,
      classifierContentType: readOutcome.classifierContentType,
      classifierConfidence: readOutcome.classifierConfidence,
      pipelineStageId: readOutcome.pipelineStageId,
    },
    rejected: readOutcome.rejected ? 1 : 0,
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
  // Find a classified source-read that does NOT yet have a materialised
  // AdminWorkerPackageArtifact. We must pick a read WITHOUT an artifact —
  // not just the newest read — otherwise, once the newest read is
  // extracted, every older un-extracted read is stranded. Order OLDEST
  // first so the longest-waiting read is always processed next: even if
  // the take-window doesn't cover the whole backlog, the oldest pending
  // read is guaranteed to be in it, so the queue always drains forward.
  const candidates = await prisma.adminWorkerSourceRead.findMany({
    where: { detectedContentType: { not: null } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (candidates.length === 0) {
    return idle("EXTRACTION", "No classified source-reads available for extraction.");
  }
  const readIds = candidates.map((r) => r.id);
  const artifactReadIds = new Set(
    (
      await prisma.adminWorkerPackageArtifact
        .findMany({ where: { sourceReadId: { in: readIds } }, select: { sourceReadId: true } })
        .catch(() => [] as Array<{ sourceReadId: string | null }>)
    ).map((a) => a.sourceReadId),
  );
  const read = candidates.find((r) => !artifactReadIds.has(r.id));
  if (!read) {
    return idle("EXTRACTION", "Every classified source-read already has a package artifact.");
  }

  // Run the per-content-type extractor.
  const { extractByType } = await import("./extractors");
  const { buildContentPackage } = await import("./content-builder");
  const detected = read.detectedContentType;
  const supportedTypes = new Set([
    "PRAYER",
    "SAINT",
    "APPARITION",
    "DEVOTION",
    "NOVENA",
    "ROSARY",
    "CONSECRATION",
    "SACRAMENT",
    "CHURCH_DOCUMENT",
    "LITURGICAL",
    "PARISH",
    "POPE",
    "DOCTOR",
    "RITE",
  ]);
  if (!detected || !supportedTypes.has(detected)) {
    return {
      stage: "EXTRACTION",
      kind: "rejected",
      summary: `Cannot extract: read ${read.id} is type ${detected ?? "(none)"}.`,
      rejected: 1,
    };
  }
  // Spec §154: extractors use STRUCTURED BLOCKS first; raw body text is
  // only the fallback. Load the persisted source blocks for this read and
  // hand them to the extractor so multi-item structures (novena days,
  // rosary mysteries, daily consecration prayers) parse from the clean
  // block boundaries rather than a flattened body string.
  const blockRows = await prisma.adminWorkerSourceBlock
    .findMany({ where: { sourceReadId: read.id }, orderBy: { blockOrder: "asc" } })
    .catch(() => [] as Array<Record<string, unknown>>);
  const blocks = blockRows.map((b) => ({
    blockType: (b as { blockType: string }).blockType as never,
    text: (b as { text: string }).text,
    isRejected: (b as { isRejected: boolean }).isRejected,
    blockOrder: (b as { blockOrder: number }).blockOrder,
    confidenceScore: (b as { confidenceScore: number }).confidenceScore,
  }));
  const extractor = extractByType(detected as never, {
    url: read.sourceUrl,
    host: read.sourceHost,
    title: read.extractedTitle,
    headings: Array.isArray(read.extractedHeadings) ? (read.extractedHeadings as string[]) : [],
    bodyText: read.extractedText ?? "",
    blocks: blocks.length > 0 ? (blocks as never) : undefined,
    checksum: read.checksum,
  });

  const pkg = buildContentPackage({
    contentType: detected,
    extractor,
    title: read.extractedTitle ?? undefined,
  });

  // Persist the artifact durably. Status reflects whether required
  // fields are present (CHECKLIST_READY) or missing (EXTRACTED with
  // repair suggestions) or fatal (REJECTED).
  const candidate = await prisma.candidateSourceUrl
    .findFirst({ where: { discoveredUrl: read.sourceUrl } })
    .catch(() => null);
  const status =
    pkg.rejectionReasons.length > 0
      ? "REJECTED"
      : pkg.missingFields.length === 0
        ? "CHECKLIST_READY"
        : "EXTRACTED";

  const artifact = await prisma.adminWorkerPackageArtifact
    .create({
      data: {
        sourceReadId: read.id,
        candidateUrlId: candidate?.id ?? null,
        contentType: detected,
        normalizedTitle: pkg.normalizedTitle,
        normalizedSlug: pkg.normalizedSlug,
        extractedFields: pkg.displayFields as never,
        fieldProvenance: pkg.fieldProvenance as never,
        missingFields: pkg.missingFields,
        validationNeeds: pkg.validationNeeds,
        formattingMetadata: pkg.formattingMetadata as never,
        confidenceScore: pkg.confidenceByPackage,
        packageChecksum: pkg.duplicateKeys.titleHash,
        status,
        rejectionReason: pkg.rejectionReasons[0] ?? null,
        repairSuggestions: pkg.repairSuggestions,
      },
    })
    .catch(() => null);

  // Feed source reputation — extraction success/failure (spec §16).
  const { pushReputation } = await import("./source-reputation-hooks");
  await pushReputation(prisma, {
    sourceHost: read.sourceHost,
    contentType: read.detectedContentType ?? undefined,
    stage: "extraction",
    ok: status !== "REJECTED",
    usefulness: pkg.confidenceByPackage,
  }).catch(() => undefined);

  // File a repair plan when required fields are missing — the next
  // pass can try a different source via the candidate-scorer.
  if (status === "EXTRACTED" && pkg.missingFields.length > 0) {
    const { filePlan } = await import("./repair-plans");
    await filePlan(prisma, {
      kind: "EXTRACT_FAILED",
      failedEntity: read.sourceHost,
      repairAction: `Re-extract ${read.sourceUrl} or pull missing fields ${pkg.missingFields.join(", ")} from another approved source.`,
      metadata: {
        sourceReadId: read.id,
        missingFields: pkg.missingFields,
      },
    }).catch(() => undefined);
  }

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CONTENT_BUILD",
    severity: status === "REJECTED" ? "WARN" : "INFO",
    eventName: "extraction_materialised",
    message: `Extraction → ${status} for ${read.sourceUrl} (${detected}, missing=${pkg.missingFields.length}).`,
    sourceUrl: read.sourceUrl,
    sourceHost: read.sourceHost,
    contentType: detected,
    safeMetadata: {
      artifactId: artifact?.id ?? null,
      status,
      missingFields: pkg.missingFields,
    },
  });

  return {
    stage: "EXTRACTION",
    kind:
      status === "REJECTED"
        ? "rejected"
        : status === "CHECKLIST_READY"
          ? "advanced"
          : "repair-planned",
    summary: `Extraction materialised package artifact ${artifact?.id ?? "(?)"} (${status}).`,
    rejected: status === "REJECTED" ? 1 : 0,
    repairsPlanned: status === "EXTRACTED" && pkg.missingFields.length > 0 ? 1 : 0,
    metadata: {
      artifactId: artifact?.id ?? null,
      status,
      missingFields: pkg.missingFields,
    },
  };
}

async function runChecklistOrCitation(
  prisma: PrismaClient,
  passId: string,
  stage: BrainMissionStage,
): Promise<DispatchOutcome> {
  // Spec §9 follow-on: materialise package artifacts into checklist
  // items + citations so the build engine has a row to grab.
  const { runChecklistAndCitationOrchestrator } = await import("./checklist-citation-orchestrator");
  const results = await runChecklistAndCitationOrchestrator(prisma, { passId, limit: 10 });
  const advanced = results.filter((r) => r.status === "created" || r.status === "updated").length;
  const skipped = results.filter(
    (r) => r.status === "skipped_duplicate" || r.status === "skipped_insufficient",
  ).length;
  const failed = results.filter((r) => r.status === "failed").length;
  const citationsCreated = results.reduce((acc, r) => acc + r.citationsCreated, 0);

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CONTENT_BUILD",
    severity: failed > 0 ? "WARN" : "INFO",
    eventName: `${stage.toLowerCase()}_pass`,
    message: `Stage ${stage}: ${advanced} checklist item(s) materialised, ${citationsCreated} citation(s) attached, ${skipped} skipped, ${failed} failed.`,
    safeMetadata: { advanced, skipped, failed, citationsCreated },
  });

  return {
    stage,
    kind:
      results.length === 0 ? "idle" : failed > 0 ? "failed" : advanced > 0 ? "advanced" : "idle",
    summary: `Materialised ${advanced} checklist item(s); ${citationsCreated} citation(s).`,
    built: advanced,
    failed,
    metadata: { advanced, skipped, failed, citationsCreated },
  };
}

async function runPackageBuild(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Spec §4: prefer AdminWorkerPackageArtifact rows over the legacy
  // build queue. A BUILD_READY artifact already has every required
  // field + provenance + citation; the publish stage can carry it
  // through without needing the older build engine.
  const artifact = await prisma.adminWorkerPackageArtifact
    .findFirst({
      where: { status: "BUILD_READY" },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => null);

  if (artifact) {
    // Advance the artifact (it is already shaped like a complete
    // package — the publish stage will pull it next pass).
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "build_from_artifact",
      message: `Package artifact ${artifact.id} (${artifact.contentType}) is BUILD_READY; deferring to PUBLIC_PUBLISH stage.`,
      contentType: artifact.contentType,
      safeMetadata: { artifactId: artifact.id, status: artifact.status },
    });
    return {
      stage: "PACKAGE_BUILD",
      kind: "advanced",
      summary: `Artifact ${artifact.id} ready; publish stage will pick it up.`,
      built: 1,
      metadata: { artifactId: artifact.id, source: "AdminWorkerPackageArtifact" },
    };
  }

  // Spec §1: the legacy runOneBuildCycle / planAndEnqueue fallback is
  // removed. The only way an item becomes a buildable package is the
  // EXTRACTION stage materialising an AdminWorkerPackageArtifact. With
  // no BUILD_READY artifact, PACKAGE_BUILD is idle — there is no
  // legacy build/publish path to fall back to.
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CONTENT_BUILD",
    severity: "INFO",
    eventName: "package_build_idle",
    message:
      "No BUILD_READY artifact; PACKAGE_BUILD idle. (Legacy build queue removed — artifacts come from the EXTRACTION stage only.)",
  });
  return {
    stage: "PACKAGE_BUILD",
    kind: "idle",
    summary: "No BUILD_READY artifact; the EXTRACTION stage produces artifacts.",
    metadata: { source: "AdminWorkerPackageArtifact" },
  };
}

/**
 * Derive a string an authoritative validation source could plausibly
 * carry verbatim, for a sensitive field that may be a string, number,
 * array, or object. The result is substring-matched against a fetched
 * validation page, so for an array we return ONE representative element
 * (e.g. the first rosary mystery name "The Annunciation") — a real source
 * lists the mysteries individually, so it contains that token, whereas it
 * would never contain the exact comma-joined concatenation of all five.
 */
function verifiableExpectedString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    for (const el of value) {
      const s = representativeString(el);
      if (s) return s;
    }
    return "";
  }
  if (typeof value === "object") return representativeString(value);
  return String(value);
}

/** First human-readable token of a value (element of an array, or object). */
function representativeString(el: unknown): string {
  if (el == null) return "";
  if (typeof el === "string") return el;
  if (typeof el === "number" || typeof el === "boolean") return String(el);
  if (Array.isArray(el)) {
    for (const x of el) {
      const s = representativeString(x);
      if (s) return s;
    }
    return "";
  }
  if (typeof el === "object") {
    const o = el as Record<string, unknown>;
    // Rosary mystery set → its first mystery; otherwise a name/title field.
    if (Array.isArray(o.mysteries) && o.mysteries.length > 0) {
      return representativeString(o.mysteries[0]);
    }
    const named = o.name ?? o.title ?? o.mystery;
    if (named != null && named !== "") return String(named);
    // Fall back to the first string/number value present.
    for (const v of Object.values(o)) {
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
  }
  return "";
}

async function runCrossSourceVerification(
  prisma: PrismaClient,
  passId: string,
): Promise<DispatchOutcome> {
  // Spec §5: verify package artifacts BEFORE publishing — not
  // already-published rows. The verifier picks the most recent
  // BUILD_READY artifact whose validation needs haven't been
  // recorded yet, looks up the right validation sources via the
  // resolver, and persists per-field evidence.
  const pending = await prisma.checklistQAReport
    .count({ where: { needsHumanReview: true, reviewedAt: null } })
    .catch(() => 0);

  // Pick the oldest BUILD_READY artifact that ACTUALLY needs validation
  // evidence (non-empty validationNeeds). Filtering on validationNeeds is
  // essential: the brain selects this stage off "BUILD_READY AND
  // validationNeeds non-empty", so picking a no-needs artifact here would
  // skip the verification block and stall the artifact that triggered
  // selection.
  const artifact = await prisma.adminWorkerPackageArtifact
    .findFirst({
      where: { status: "BUILD_READY", validationNeeds: { isEmpty: false } },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => null);

  let verifiedFieldCount = 0;
  let blockingFields: string[] = [];
  let usedHosts: string[] = [];

  if (artifact) {
    const evidenceWhere = { contentType: artifact.contentType, contentId: artifact.id };
    const priorRows = await prisma.adminWorkerCrossSourceVerification
      .count({ where: evidenceWhere })
      .catch(() => 0);

    // First verification pass for this artifact — fetch + compare.
    if (priorRows === 0) {
      const { runVerifier } = await import("./verifier");
      const { fetchAndCompareValidation } = await import("./validation-fetcher");
      const { REQUIRED_FACTS } = await import("./cross-source-verifier");
      const fields = (artifact.extractedFields as Record<string, unknown>) ?? {};
      const skipNetwork = process.env.ADMIN_WORKER_SKIP_NETWORK === "1";

      // Fetch validation for EXACTLY the fields the verifier will check
      // (REQUIRED_FACTS) — unioned with the package's validationNeeds.
      // Previously this fetched only validationNeeds while the verifier
      // checked REQUIRED_FACTS, so the two never lined up and every field
      // came back MISSING (a doctrinally-sensitive artifact could never
      // gather evidence and so could never publish).
      const requiredFacts =
        (REQUIRED_FACTS as Record<string, string[]>)[artifact.contentType] ?? [];
      const fieldsToVerify = [...new Set([...requiredFacts, ...artifact.validationNeeds])];

      // Accumulate ALL fields per validation host into ONE source entry —
      // a per-host dedup that dropped every field after the first one would
      // leave the verifier with no value to compare for the rest, wrongly
      // blocking confirmed facts.
      const validationSources: Array<{
        host: string;
        fields: Record<string, unknown>;
        url?: string;
      }> = [];
      const byHost = new Map<string, { url?: string; fields: Record<string, unknown> }>();
      for (const field of fieldsToVerify) {
        const expected = fields[field];
        if (expected == null || expected === "") continue;
        // Derive a comparable string. Array/object sensitive fields
        // (e.g. rosary mysterySets) cannot be string-matched as
        // "[object Object]" nor as the whole comma-joined blob (no real
        // source contains that exact concatenation); we verify a
        // representative element instead (the first mystery name), which
        // IS a fact an authoritative source carries.
        const expectedValue = verifiableExpectedString(expected);
        if (!expectedValue) continue;
        const evidence = await fetchAndCompareValidation(prisma, {
          contentType: artifact.contentType,
          field,
          expectedValue: expectedValue.slice(0, 200),
          slugHint: artifact.normalizedSlug,
          maxSources: 2,
          skipNetwork,
        }).catch(() => []);
        for (const e of evidence) {
          // A source we could NOT fetch (MISSING_EVIDENCE) is not
          // evidence of anything — it must never be translated into a
          // disagreeing value, otherwise an unreachable approved source
          // would wrongly block a field that another source confirmed.
          if (e.matchStatus === "MISSING_EVIDENCE") continue;
          // MATCH → store the comparable string we confirmed; MISMATCH →
          // store the differing value the source actually carried. Using
          // the derived string (not the raw array/object) lets the
          // verifier compare like-for-like rather than on array length.
          const validationFieldValue = e.matchStatus === "MATCH" ? expectedValue : (e.found ?? "");
          if (!validationFieldValue) continue;
          const entry = byHost.get(e.host) ?? { url: e.url, fields: {} };
          entry.fields[field] = validationFieldValue;
          byHost.set(e.host, entry);
        }
      }
      for (const [host, v] of byHost.entries()) {
        validationSources.push({ host, url: v.url, fields: v.fields });
      }
      usedHosts = [...byHost.keys()];

      // Pass the SAME derived strings as the candidate values so the
      // verifier compares like-for-like (an array field would otherwise
      // normalize to "[len]" and only ever match on cardinality).
      const comparableFields: Record<string, unknown> = { ...fields };
      for (const field of fieldsToVerify) {
        if (field in fields) comparableFields[field] = verifiableExpectedString(fields[field]);
      }
      const result = await runVerifier(prisma, {
        contentType: artifact.contentType,
        contentId: artifact.id,
        packageChecksum: artifact.packageChecksum,
        fields: comparableFields,
        validationSources,
      }).catch(() => null);
      blockingFields = result?.blockingSensitiveFields ?? [];

      const { pushReputation } = await import("./source-reputation-hooks");
      for (const host of usedHosts) {
        await pushReputation(prisma, {
          sourceHost: host,
          contentType: artifact.contentType,
          stage: "verification",
          ok: blockingFields.length === 0,
        }).catch(() => undefined);
      }
    }

    // Recount MATCH/PASS evidence after any fetch this pass.
    const matchCount = await prisma.adminWorkerCrossSourceVerification
      .count({ where: { ...evidenceWhere, matchResult: { in: ["MATCH", "PASS"] } } })
      .catch(() => 0);
    verifiedFieldCount = matchCount;

    // The artifact MUST leave BUILD_READY on this pass so the brain stops
    // re-selecting it and the pipeline never stalls. Promote only on real
    // MATCH evidence with no blocking sensitive field; otherwise file a
    // VALIDATION_EVIDENCE_MISSING repair and park in NEEDS_REPAIR —
    // sensitive content never publishes without stored evidence
    // (spec §246, §258).
    if (matchCount > 0 && blockingFields.length === 0) {
      await prisma.adminWorkerPackageArtifact
        .update({ where: { id: artifact.id }, data: { status: "VERIFICATION_READY" } })
        .catch(() => undefined);
    } else {
      const missing = blockingFields.length > 0 ? blockingFields : artifact.validationNeeds;
      const { filePlan } = await import("./repair-plans");
      await filePlan(prisma, {
        kind: "VALIDATION_EVIDENCE_MISSING",
        failedEntity: artifact.id,
        repairAction: `Fetch + compare validation sources for ${missing.join(", ")} on ${artifact.contentType}/${artifact.normalizedSlug}.`,
        metadata: { artifactId: artifact.id, contentType: artifact.contentType, missing },
      }).catch(() => undefined);
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: {
            status: "NEEDS_REPAIR",
            rejectionReason: `missing cross-source evidence for ${missing.join(", ")}`,
          },
        })
        .catch(() => undefined);
      if (blockingFields.length === 0) blockingFields = [...artifact.validationNeeds];
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
      artifactId: artifact?.id ?? null,
      usedHosts,
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
  // Spec §3: find BUILD_READY / VERIFICATION_READY artifacts without a
  // strict-QA result, score the 7 dimensions, persist the result via
  // recordStrictQA, and transition the artifact status:
  //   PASSED       → QA_PASSED
  //   NEEDS_REPAIR → NEEDS_REVIEW  (review-band hold; see below)
  //   FAILED       → REJECTED
  const { recordStrictQA, getStrictQAResult } = await import("./strict-qa");

  const candidates = await prisma.adminWorkerPackageArtifact
    .findMany({
      where: { status: { in: ["BUILD_READY", "VERIFICATION_READY"] } },
      orderBy: { createdAt: "asc" },
      take: 10,
    })
    .catch(
      () => [] as Array<Awaited<ReturnType<typeof prisma.adminWorkerPackageArtifact.findFirst>>>,
    );

  if (!candidates || candidates.length === 0) {
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "QA",
      severity: "INFO",
      eventName: "strict_qa_idle",
      message: "Strict QA: no BUILD_READY / VERIFICATION_READY artifacts pending.",
    });
    return {
      stage: "STRICT_QA",
      kind: "idle",
      summary: "No artifacts pending strict QA.",
    };
  }

  let processed = 0;
  let passed = 0;
  let heldForReview = 0;
  let rejected = 0;

  for (const artifact of candidates) {
    if (!artifact) continue;
    // Defensive: a BUILD_READY artifact that carries validation needs must
    // gather cross-source evidence FIRST. The CROSS_SOURCE_VERIFICATION
    // stage transitions it to VERIFICATION_READY (evidence matched) or
    // NEEDS_REPAIR (evidence missing) — so strict QA should never score it
    // while it is still BUILD_READY, or it would zero the validation
    // dimension and wrongly FAIL doctrinally-sensitive content before it
    // has been verified. Only VERIFICATION_READY (verified) or
    // BUILD_READY-with-no-validation-needs artifacts are QA'd here.
    if (artifact.status === "BUILD_READY" && (artifact.validationNeeds ?? []).length > 0) {
      continue;
    }
    // Skip if a QA row already exists for this artifact (idempotent).
    const existing = await getStrictQAResult(prisma, artifact.id);
    if (existing && existing.status === "PASSED") {
      // Already passed; just advance status if still BUILD_READY.
      if (artifact.status === "BUILD_READY" || artifact.status === "VERIFICATION_READY") {
        await prisma.adminWorkerPackageArtifact
          .update({ where: { id: artifact.id }, data: { status: "QA_PASSED" } })
          .catch(() => undefined);
      }
      continue;
    }

    const provenance = Array.isArray(artifact.fieldProvenance)
      ? (artifact.fieldProvenance as unknown[])
      : [];
    const missing = (artifact.missingFields ?? []) as string[];
    const validationNeeds = (artifact.validationNeeds ?? []) as string[];
    const fields = (artifact.extractedFields as Record<string, unknown>) ?? {};

    // 7-dimension scoring (deterministic; spec §5).
    const requiredCount = Math.max(provenance.length + missing.length, 1);
    const completenessScore = Math.max(0, Math.min(1, 1 - missing.length / requiredCount));
    const correctnessScore = Math.max(0, Math.min(1, artifact.confidenceScore ?? 0));
    const formattingMetadata = (artifact.formattingMetadata as Record<string, unknown>) ?? {};
    const formattingScore =
      typeof formattingMetadata.score === "number"
        ? Math.max(0, Math.min(1, formattingMetadata.score as number))
        : 0.8;
    const provenanceScore =
      provenance.length > 0 ? Math.min(1, provenance.length / requiredCount) : 0;

    // Validation evidence: look for a CrossSourceVerification row for
    // this artifact. If validationNeeds is empty, no evidence is
    // required and the dimension scores 0.9 (neutral pass).
    let validationScore = 0.9;
    if (validationNeeds.length > 0) {
      const verification = await prisma.adminWorkerCrossSourceVerification
        .count({
          where: {
            contentType: artifact.contentType,
            contentId: artifact.id,
            matchResult: { in: ["MATCH", "PASS"] },
          },
        })
        .catch(() => 0);
      validationScore = verification > 0 ? 0.9 : 0;
    }

    // Duplicate safety: no other PublishedContent with the same slug.
    // Query the PUBLISHABLE catalog type (ROSARY / CONSECRATION are stored
    // as SPIRITUAL_PRACTICE) — using the raw extractor type would be an
    // invalid ChecklistContentType enum value, throw, get swallowed by the
    // catch, and disable the duplicate gate for those types.
    const { toChecklistContentType } = await import("./classifier");
    const dupType = toChecklistContentType(artifact.contentType as never) ?? artifact.contentType;
    const duplicate = await prisma.publishedContent
      .count({
        where: { contentType: dupType as never, slug: artifact.normalizedSlug },
      })
      .catch(() => 0);
    const duplicateSafetyScore = duplicate === 0 ? 0.9 : 0;

    // Public readiness: title + slug + payload present.
    const publicReadinessScore =
      artifact.normalizedTitle && artifact.normalizedSlug && Object.keys(fields).length > 0
        ? 0.9
        : 0;

    const qa = await recordStrictQA(prisma, {
      packageArtifactId: artifact.id,
      contentType: artifact.contentType,
      completenessScore,
      correctnessScore,
      formattingScore,
      provenanceScore,
      validationScore,
      duplicateSafetyScore,
      publicReadinessScore,
    });

    // A strict-QA NEEDS_REPAIR means the finalScore landed in the review
    // band [REVIEW_FLOOR, threshold) with NO zero dimension — the content
    // is structurally complete and provenance-backed but didn't clear the
    // (possibly elevated, e.g. 0.95 doctrinal) bar. Re-extracting the SAME
    // source is deterministic and can't raise that score, so this is a
    // stable hold for human review, not an automated repair loop. We park
    // it at NEEDS_REVIEW (it leaves every pipeline queue and is surfaced in
    // the Developer Audit / command center) rather than NEEDS_REPAIR, which
    // the repair orchestrator would bounce back to EXTRACTED and strand
    // (runExtraction only (re)processes reads that have no artifact yet).
    const nextStatus =
      qa.status === "PASSED"
        ? "QA_PASSED"
        : qa.status === "NEEDS_REPAIR"
          ? "NEEDS_REVIEW"
          : "REJECTED";

    await prisma.adminWorkerPackageArtifact
      .update({
        where: { id: artifact.id },
        data: {
          status: nextStatus,
          rejectionReason:
            nextStatus === "REJECTED" ? `strict QA failed: ${qa.blockingReasons.join("; ")}` : null,
        },
      })
      .catch(() => undefined);

    // Spec §19: source reputation updates after the strict-QA stage —
    // a host whose artifact passes QA is more trustworthy.
    const qaHost = await resolveArtifactSourceHost(prisma, artifact.sourceReadId);
    if (qaHost) {
      const { pushReputation } = await import("./source-reputation-hooks");
      await pushReputation(prisma, {
        sourceHost: qaHost,
        contentType: artifact.contentType,
        stage: "qa",
        ok: qa.status === "PASSED",
      }).catch(() => undefined);
    }

    // Spec §9 follow-up: a hard FAILED artifact (zero dimension or below
    // the review floor) is REJECTED — file a STRICT_QA_FAILED plan for the
    // audit trail. We do NOT file a plan for the NEEDS_REVIEW hold: it is a
    // deliberate quality hold, and the repair orchestrator's reset-to-
    // EXTRACTED retry would only strand it (re-extracting the same source
    // can't change a deterministic score).
    if (qa.status === "FAILED") {
      const { filePlan } = await import("./repair-plans");
      await filePlan(prisma, {
        kind: "STRICT_QA_FAILED",
        failedEntity: artifact.id,
        repairAction: `Re-extract ${artifact.contentType}/${artifact.normalizedSlug} and re-run strict QA.`,
        metadata: {
          contentType: artifact.contentType,
          slug: artifact.normalizedSlug,
          blockingReasons: qa.blockingReasons,
          finalScore: qa.finalScore,
        },
      }).catch(() => undefined);
    }

    processed += 1;
    if (qa.status === "PASSED") passed += 1;
    else if (qa.status === "NEEDS_REPAIR") heldForReview += 1;
    else rejected += 1;
  }

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "QA",
    severity: rejected > 0 ? "WARN" : "INFO",
    eventName: "strict_qa_pass",
    message: `Strict QA processed ${processed} artifact(s): ${passed} passed, ${heldForReview} held for review, ${rejected} rejected.`,
    safeMetadata: { processed, passed, heldForReview, rejected },
  });

  return {
    stage: "STRICT_QA",
    kind: processed > 0 ? "advanced" : "idle",
    summary: `Strict QA: ${passed} passed / ${heldForReview} held for review / ${rejected} rejected.`,
    rejected,
  };
}

async function runPersistAndPublish(
  prisma: PrismaClient,
  _workerId: string,
  passId: string,
): Promise<DispatchOutcome> {
  // Spec §13: PERSIST/PUBLIC_PUBLISH route through runPublishOrchestrator
  // when a BUILD_READY artifact exists. The orchestrator handles the
  // quality-gate, duplicate, slug, public-route, persistence, content-
  // goal refresh, search, sitemap, and cache side effects in one
  // transaction. When no artifact is ready the publish stage is idle —
  // the legacy runOneBuildCycle fallback has been removed.
  // Spec §6: publish reads QA_PASSED artifacts. BUILD_READY remains
  // queryable for backwards-compat tests, but the orchestrator gate
  // requires a passing AdminWorkerStrictQAResult either way.
  // Publish ONLY QA_PASSED artifacts. A BUILD_READY artifact has not yet
  // been through strict QA (it has no AdminWorkerStrictQAResult row), so
  // including it here caused the publish stage to pick it, fail the
  // strict-QA gate ("no AdminWorkerStrictQAResult row"), and wrongly
  // REJECT a perfectly good artifact that was simply waiting its turn at
  // the STRICT_QA stage.
  const artifact = await prisma.adminWorkerPackageArtifact
    .findFirst({
      where: { status: "QA_PASSED" },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => null);

  if (artifact) {
    const { runPublishOrchestrator } = await import("./publish-orchestrator");
    const isDoctrinal = ["APPARITION", "SACRAMENT", "CHURCH_DOCUMENT"].includes(
      artifact.contentType,
    );
    // Spec §5 follow-up: build the verifier outcome from STORED
    // AdminWorkerCrossSourceVerification rows (written by the
    // CROSS_SOURCE_VERIFICATION stage) — not from a fresh run with
    // validationSources: []. For doctrinal content, missing evidence
    // routes to repair via VALIDATION_EVIDENCE_MISSING.
    const verifier = isDoctrinal
      ? await loadVerifierFromStoredEvidence(prisma, artifact.id, artifact.validationNeeds)
      : undefined;

    // The authoritative quality signal for the publish gate is the
    // durable strict-QA finalScore (the mandatory gate the artifact just
    // passed), NOT the raw extraction confidence — extraction confidence
    // is a per-field provenance average that is routinely below the
    // publish threshold even for complete, QA-passing content. Using the
    // strict-QA score lets a PASSED artifact actually publish instead of
    // bouncing into the review band forever.
    const { getStrictQAResult } = await import("./strict-qa");
    const qaResultForPublish = await getStrictQAResult(prisma, artifact.id).catch(() => null);
    const qualitySignal =
      qaResultForPublish?.status === "PASSED"
        ? Math.max(qaResultForPublish.finalScore, artifact.confidenceScore)
        : artifact.confidenceScore;

    // Map the extractor/classifier content type to the publishable
    // catalog type before persisting (ROSARY / CONSECRATION are parsed
    // by their own extractors but stored in the catalog as
    // SPIRITUAL_PRACTICE). PublishedContent.contentType is the catalog
    // enum, so a publish that used the raw extractor type would be
    // rejected by the DB.
    const { toChecklistContentType } = await import("./classifier");
    const publishableType =
      toChecklistContentType(artifact.contentType as never) ?? artifact.contentType;

    const result = await runPublishOrchestrator(prisma, {
      contentType: publishableType,
      contentId: artifact.checklistItemId ?? artifact.id,
      title: artifact.normalizedTitle,
      slug: artifact.normalizedSlug,
      payload: artifact.extractedFields as never,
      authorityLevel: "VATICAN",
      finalScore: qualitySignal,
      qaPassed: artifact.missingFields.length === 0,
      hasSourceEvidence:
        Array.isArray(artifact.fieldProvenance) &&
        (artifact.fieldProvenance as unknown[]).length > 0,
      isDoctrinallySensitive: isDoctrinal,
      confidence: qualitySignal,
      verifier,
      // Spec §6: pass the artifact id so the orchestrator can refuse
      // publishing when no passing AdminWorkerStrictQAResult exists.
      strictQAArtifactId: artifact.id,
    });

    // Spec §19: source reputation updates after the publishing stage
    // (which also gates on the quality score). A host whose artifact
    // publishes gains reputation; a blocked/repair outcome loses it.
    const pubHost = await resolveArtifactSourceHost(prisma, artifact.sourceReadId);
    if (pubHost) {
      const { pushReputation } = await import("./source-reputation-hooks");
      await pushReputation(prisma, {
        sourceHost: pubHost,
        contentType: artifact.contentType,
        stage: "publish",
        ok: result.kind === "published",
      }).catch(() => undefined);
    }

    // Update the artifact based on the outcome.
    if (result.kind === "published") {
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: { status: "PUBLISHED", publishedContentId: result.publishedContentId },
        })
        .catch(() => undefined);
    } else if (result.kind === "blocked") {
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: { status: "REJECTED", rejectionReason: result.reason },
        })
        .catch(() => undefined);
    } else if (result.kind === "repair") {
      // Spec §6: repairable — send the artifact back for re-extraction
      // (the QUALITY_SCORE_FAILED / STRICT_QA_FAILED repair plan the
      // orchestrator filed drives the retry).
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: { status: "NEEDS_REPAIR", rejectionReason: result.reason },
        })
        .catch(() => undefined);
    } else if (result.kind === "review") {
      // Spec §6: ambiguous → rare human review. Park the artifact in
      // NEEDS_REVIEW so it leaves the QA_PASSED publish queue (otherwise
      // the brain would re-select PUBLIC_PUBLISH on it every pass).
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: { status: "NEEDS_REVIEW", rejectionReason: result.reason },
        })
        .catch(() => undefined);
    } else if (result.kind === "duplicate") {
      // Already public under this (contentType, slug) — mark the artifact
      // PUBLISHED and link the existing row so it leaves the queue.
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: { status: "PUBLISHED", publishedContentId: result.existingId },
        })
        .catch(() => undefined);
    }

    return {
      stage: "PUBLIC_PUBLISH",
      kind:
        result.kind === "published"
          ? "advanced"
          : result.kind === "blocked"
            ? "rejected"
            : result.kind === "duplicate"
              ? "idle"
              : result.kind === "repair"
                ? "repair-planned"
                : "rejected",
      summary: `Publish orchestrator: ${result.kind} (${result.reason}).`,
      built: result.kind === "published" ? 1 : 0,
      published: result.kind === "published" ? 1 : 0,
      rejected: result.kind === "blocked" || result.kind === "review" ? 1 : 0,
      repairsPlanned: result.kind === "repair" ? 1 : 0,
      metadata: {
        artifactId: artifact.id,
        kind: result.kind,
      },
    };
  }

  // Spec §6 follow-up: the legacy runOneBuildCycle fallback used to
  // publish here. That path bypasses strict QA + ContentQualityScore,
  // which the spec explicitly forbids. With no BUILD_READY or
  // QA_PASSED artifact, publishing is idle — content gets built into
  // an artifact first (PACKAGE_BUILD stage), strict-QA processes it,
  // then this stage publishes via runPublishOrchestrator.
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "PUBLISHING",
    severity: "INFO",
    eventName: "publish_pass_idle",
    message:
      "No BUILD_READY/QA_PASSED artifacts; publish stage idle. (Legacy runOneBuildCycle fallback removed — strict-QA + quality-score gate is enforced.)",
  });
  return idle(
    "PUBLIC_PUBLISH",
    "No artifacts ready; publish path requires a passing AdminWorkerStrictQAResult.",
  );
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
  // Spec §14: production post-publish must perform a real HTTP
  // probe. `ADMIN_WORKER_SKIP_NETWORK=1` is honoured for tests so the
  // unit suite doesn't hit the network.
  const skipNetwork = process.env.ADMIN_WORKER_SKIP_NETWORK === "1";
  const verification = await verifyPublished(prisma, {
    contentType: target.contentType,
    contentId: target.id,
    slug: target.slug,
    expectedTitle: target.title,
    skipNetwork,
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

  // Feed source reputation — post-publish success is the strongest
  // signal (spec §16). We pull the source host from the most recent
  // build job for this checklist item, best-effort.
  const buildJob = await prisma.workerBuildJob
    .findFirst({
      where: { checklistItemId: target.id },
      orderBy: { createdAt: "desc" },
      select: { resultPayload: true },
    })
    .catch(() => null);
  const sourceHost =
    typeof buildJob?.resultPayload === "object" &&
    buildJob?.resultPayload != null &&
    "sourceHost" in (buildJob.resultPayload as Record<string, unknown>)
      ? String((buildJob.resultPayload as Record<string, unknown>).sourceHost)
      : "";
  if (sourceHost) {
    const { pushReputation } = await import("./source-reputation-hooks");
    await pushReputation(prisma, {
      sourceHost,
      contentType: target.contentType,
      stage: "post_publish",
      ok: verification.result === "PASS",
    }).catch(() => undefined);
  }

  // Spec §8: when post-publish verification fails, drive the decision
  // tree (repair → re-verify → unpublish → DELETED / HUMAN_REVIEW)
  // rather than just logging the failure. The reverify callback
  // re-runs verifyPublished so REPAIRED is only declared when the
  // public surface is actually fixed.
  if (verification.result === "FAIL") {
    const checks = verification.checks as unknown as Record<string, unknown> | undefined;
    // Pick the first failed check as the canonical failedCheck for
    // the rollback decision tree.
    const failedCheck = pickFailedCheck(checks);
    const { decideAndExecuteRollback } = await import("./post-publish-rollback");
    await decideAndExecuteRollback(prisma, {
      contentType: target.contentType,
      contentId: target.id,
      slug: target.slug,
      failedCheck,
      reason: `verifyPublished returned FAIL on ${failedCheck}.`,
      reverify: async () => {
        const re = await verifyPublished(prisma, {
          contentType: target.contentType,
          contentId: target.id,
          slug: target.slug,
          expectedTitle: target.title,
          skipNetwork,
        }).catch(() => null);
        return re?.result === "PASS";
      },
    }).catch(() => undefined);
  }

  return {
    stage: "POST_PUBLISH_VERIFY",
    kind: verification.result === "PASS" ? "advanced" : "rejected",
    summary: `Verified ${target.contentType}/${target.slug}: ${verification.result}.`,
    rejected: verification.result === "PASS" ? 0 : 1,
  };
}

/**
 * Map the `verifyPublished` checks object to the `failedCheck` field
 * the rollback decision tree expects. Returns the first FAIL we find,
 * or "public_route" as the conservative default for "something is
 * broken but the structured check map didn't tell us what".
 */
function pickFailedCheck(
  checks: Record<string, unknown> | undefined,
):
  | "public_route"
  | "title"
  | "body_marker"
  | "tab_placement"
  | "search"
  | "sitemap"
  | "cache"
  | "related_links"
  | "content_goal_count" {
  if (!checks) return "public_route";
  const order: Array<
    [
      string,
      (
        | "public_route"
        | "title"
        | "body_marker"
        | "tab_placement"
        | "search"
        | "sitemap"
        | "cache"
        | "content_goal_count"
      ),
    ]
  > = [
    ["publicPageCheck", "public_route"],
    ["titleCheck", "title"],
    ["bodyMarkerCheck", "body_marker"],
    ["tabPlacementCheck", "tab_placement"],
    ["searchCheck", "search"],
    ["sitemapCheck", "sitemap"],
    ["cacheCheck", "cache"],
    ["contentGoalCheck", "content_goal_count"],
  ];
  for (const [key, kind] of order) {
    if (checks[key] === "FAIL") return kind;
  }
  return "public_route";
}

async function runSearchVerify(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Spec §8: direct search verification, independent of post-publish
  // probe. Picks the most recent published row and confirms the
  // search index would surface it.
  const target = await prisma.publishedContent
    .findFirst({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { contentType: true, slug: true, title: true },
    })
    .catch(() => null);
  if (!target) {
    return idle("SEARCH_VERIFY", "No published content to verify.");
  }
  const { verifySearchIndex } = await import("./search-sitemap-cache-verifiers");
  const result = await verifySearchIndex(prisma, {
    contentType: target.contentType,
    slug: target.slug,
    title: target.title,
  });
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: result.ok ? "INFO" : "WARN",
    eventName: "search_verify_independent",
    message: `Search verify ${target.contentType}/${target.slug}: ${result.reason}`,
  });
  return {
    stage: "SEARCH_VERIFY",
    kind: result.ok ? "advanced" : "rejected",
    summary: result.reason,
    rejected: result.ok ? 0 : 1,
  };
}

async function runSitemapVerify(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  const target = await prisma.publishedContent
    .findFirst({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { contentType: true, slug: true, title: true },
    })
    .catch(() => null);
  if (!target) {
    return idle("SITEMAP_VERIFY", "No published content to verify.");
  }
  const { verifySitemap } = await import("./search-sitemap-cache-verifiers");
  const result = await verifySitemap(prisma, {
    contentType: target.contentType,
    slug: target.slug,
  });
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: result.ok ? "INFO" : "WARN",
    eventName: "sitemap_verify_independent",
    message: `Sitemap verify ${target.contentType}/${target.slug}: ${result.reason}`,
  });
  return {
    stage: "SITEMAP_VERIFY",
    kind: result.ok ? "advanced" : "rejected",
    summary: result.reason,
    rejected: result.ok ? 0 : 1,
  };
}

async function runCacheRefresh(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Spec §7: this stage doesn't just flag — it verifies cache freshness
  // against the most recent published item, files a CACHE_FAILED
  // repair plan on failure, and refreshes when the flag was stale.
  const { flagCacheRefresh } = await import("./repair");
  await flagCacheRefresh(prisma, "admin-worker-brain-requested");

  const target = await prisma.publishedContent
    .findFirst({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { contentType: true, slug: true },
    })
    .catch(() => null);

  if (!target) {
    return {
      stage: "CACHE_REFRESH",
      kind: "advanced",
      summary: "Cache refresh requested; no published content to verify against.",
    };
  }

  const { verifyCacheFreshness } = await import("./search-sitemap-cache-verifiers");
  const result = await verifyCacheFreshness(prisma, {
    contentType: target.contentType,
    slug: target.slug,
  }).catch(() => ({ ok: false, reason: "verification threw" }));

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: result.ok ? "INFO" : "WARN",
    eventName: "cache_verified",
    message: `Cache verification for ${target.contentType}/${target.slug}: ${result.ok ? "PASS" : "FAIL"} — ${result.reason}`,
    contentType: target.contentType,
    safeMetadata: { reason: result.reason },
  }).catch(() => undefined);

  if (!result.ok) {
    const { filePlan } = await import("./repair-plans");
    await filePlan(prisma, {
      kind: "CACHE_FAILED",
      failedEntity: `${target.contentType}:${target.slug}`,
      repairAction: `Revalidate cache for ${target.contentType}/${target.slug}.`,
      metadata: { reason: result.reason },
    }).catch(() => undefined);
  }

  return {
    stage: "CACHE_REFRESH",
    kind: result.ok ? "advanced" : "repair-planned",
    summary: `Cache verified for ${target.contentType}/${target.slug}: ${result.ok ? "fresh" : result.reason}`,
    repairsPlanned: result.ok ? 0 : 1,
  };
}

async function runRepair(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // First drain durable repair plans via the orchestrator (spec §17).
  const { runRepairOrchestrator } = await import("./repair-orchestrator");
  const orchestrator = await runRepairOrchestrator(prisma, { passId });

  // Then sweep any stuck build jobs for in-pass fixups.
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

  // Spec §1: no legacy build cycle here. Repair fixes pipeline state;
  // forward progress to a public row happens only through the artifact
  // pipeline (EXTRACTION → STRICT_QA → PUBLIC_PUBLISH).
  return {
    stage: "REPAIR",
    kind: "advanced",
    summary: `Repair orchestrator + stuck-queue: ${orchestrator.plansSucceeded}/${orchestrator.plansConsidered} plan(s) succeeded; stuck-queue ${recovery.attempted ? "attempted" : "skipped"}.`,
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
  const { decaySourceReputation } = await import("./source-reputation");
  // Spec §17-22: decay memory AND source reputation on maintenance so
  // recent outcomes matter more than old ones, and a source that has
  // gone quiet loses its high tier until it produces valid content
  // again (it must be re-proven).
  const [cleanup, memoryDecay, reputationDecay] = await Promise.all([
    runCleanupPass(prisma),
    decayMemory(prisma).catch(() => ({ decayed: 0, pruned: 0 })),
    decaySourceReputation(prisma).catch(() => ({ decayed: 0, demoted: 0, retestable: 0 })),
  ]);
  const safe = JSON.parse(JSON.stringify({ cleanup, memoryDecay, reputationDecay }));
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CLEANUP",
    severity: "INFO",
    eventName: "maintenance_dispatch",
    message: `Maintenance: ${cleanup.staleCandidatesRemoved} stale candidate(s), ${cleanup.expiredReviewsClosed} expired review(s) closed; memory decayed=${memoryDecay.decayed}, pruned=${memoryDecay.pruned}; reputation decayed=${reputationDecay.decayed}, demoted=${reputationDecay.demoted}, retestable=${reputationDecay.retestable}.`,
    safeMetadata: safe,
  });
  return {
    stage: "MAINTENANCE",
    kind: "advanced",
    summary: `Maintenance: cleanup + memory decay (${memoryDecay.decayed} rows) + reputation decay (${reputationDecay.decayed} rows, ${reputationDecay.demoted} demoted).`,
    metadata: safe,
  };
}

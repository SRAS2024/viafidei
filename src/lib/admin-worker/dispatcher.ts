/**
 * AdminWorkerDispatcher (spec §2). Executes the mission stage the
 * brain selected. There is no build/publish fallback (spec §1) — the
 * dispatcher walks every stage of the artifact content chain and
 * invokes the correct module for the brain's chosen action. The ONLY
 * way content becomes public is EXTRACTION → STRICT_QA → PUBLIC_PUBLISH
 * (runPublishOrchestrator).
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

import { REQUIRED_FACTS } from "./cross-source-verifier";
import { assertWorkerExecutionAllowed } from "./execution-context";
import { OPERATOR_FILE_HOST } from "./file-ingest";
import type { BrainDecision, BrainMissionStage } from "./brain";
import { WEB_EXTRACTION_CONTENT_TYPES, isExtractableContentType } from "./content-types";
import { writeAdminWorkerLog } from "./logs";
import { reportQueryError } from "./schema-integrity";
import { recordStageOutcome, toStageOutcome } from "./stage-outcomes";
import {
  MAX_TRANSIENT_FETCH_ATTEMPTS,
  MAX_VERIFICATION_ROUNDS,
  buildPrayerPublishPayload,
  candidateFetchEligibility,
  classifyFetchFailure,
  cleanSourceTitle,
  deriveDocumentTitle,
  derivedParentField,
  detectReadLanguage,
  entityHintFor,
  expectedValueVariants,
  extractionCursorWhere,
  extractorFieldTitle,
  formattingQualityScore,
  loadExtractionCursor,
  saveExtractionCursor,
  type ExtractionCursor,
} from "./web-extraction-helpers";
import { classifyHostAuthority } from "@/lib/checklist/sources/authority-registry";

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
  /**
   * The dispatch ran end-to-end and rejected an input that CANNOT be used by
   * any content type — a discovery-quality problem, not a pipeline stall. Such
   * a dispatch is recorded under `UNUSABLE_INPUT_RESULT_TYPE` instead of
   * "failure" so it does not page the operator via LOOPING. See the doc comment
   * on `UNUSABLE_INPUT_RESULT_TYPE` for how that distinction stays honest.
   */
  unusableInput?: boolean;
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
  assertWorkerExecutionAllowed("execute an Admin Worker mission stage");
  const { prisma, workerId, passId, decision } = input;
  const stage = decision.missionStage;
  const startedAt = Date.now();

  try {
    const raw = await runStageHandler(prisma, workerId, passId, decision, stage);
    // Spec §3.4: every stage return carries the full uniform shape.
    const outcome = enrichOutcome(raw, decision);

    // Dispatcher-as-skill-orchestrator: consult the Skill Planner for the
    // certified-skill plan that backs this stage and record it (so the
    // dashboard + Developer Audit show which stages route through certified
    // skills and which still need one). Best-effort + non-blocking; a
    // non-executable plan means the capability refresh files a developer
    // request for the missing skill rather than the worker pretending.
    try {
      const { planForDecision } = await import("./skills");
      const plan = planForDecision({ missionStage: stage, contentType: decision.contentType });
      await writeAdminWorkerLog(prisma, {
        passId,
        category: "WORKER_PASS",
        severity: "INFO",
        eventName: "skill_plan",
        message: `Stage ${stage}: certified-skill plan ${plan.executable ? "executable" : "not executable"} (${plan.steps.length} step(s))`,
        contentType: decision.contentType ?? undefined,
        safeMetadata: {
          stage,
          executable: plan.executable,
          steps: plan.steps.map((s) => s.skillName),
          missingSkills: plan.missingSkills,
          requiresProofPacket: plan.requiresProofPacket,
        },
      }).catch(() => undefined);
    } catch {
      // planner consultation is best-effort and must not affect the dispatch
    }
    // Exact stage-outcome ledger: one precise row per dispatch so the
    // brain scores from real outcomes, not approximations.
    const stageOutcome = toStageOutcome(outcome, decision, Date.now() - startedAt);
    await recordStageOutcome(prisma, {
      ...stageOutcome,
      // A page the pipeline handled perfectly and the classifier refused for
      // matching no content type is unusable INPUT, not a stage failure. The
      // row is still written (same stage, same `result`, same summary) — only
      // the coarse bucket differs, so the ledger keeps the volume visible while
      // the LOOPING detector stops treating it as evidence of a stall.
      resultType: outcome.unusableInput ? UNUSABLE_INPUT_RESULT_TYPE : stageOutcome.resultType,
      passId,
    });
    return outcome;
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
    const outcome = enrichOutcome(
      {
        stage,
        kind: "failed",
        summary: `Stage ${stage} failed: ${message.slice(0, 240)}`,
        failed: 1,
        blocker: message.slice(0, 240),
      },
      decision,
    );
    await recordStageOutcome(prisma, {
      ...toStageOutcome(outcome, decision, Date.now() - startedAt),
      passId,
    });
    return outcome;
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
      return await runMaintenance(prisma, passId, decision);
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
  // Parishes have no sitemap/RSS directory the worker can crawl, so for PARISH
  // discovery it goes to Google Maps directly (when GOOGLE_PLACES_API_KEY is
  // configured): find Catholic churches, verify each is in communion with Rome
  // from its own website, and publish the verified ones. This is what keeps the
  // PARISH gap from spinning discovery forever.
  if (decision.contentType === "PARISH") {
    const { placesEnabled } = await import("./parish-places");
    if (placesEnabled()) {
      const { runMapsParishDiscovery } = await import("./parish-discovery-runner");
      const r = await runMapsParishDiscovery(prisma, { brainActive: true }).catch(() => null);
      if (r) {
        return {
          stage: "DISCOVERY",
          kind: r.published > 0 || r.candidates > 0 ? "advanced" : "idle",
          summary: `Google Maps parish discovery: ${r.detail}`,
          metadata: {
            surfaced: r.candidates,
            published: r.published,
            routedToReview: r.routedToReview,
            rejected: r.rejected,
          },
        };
      }
    }

    // Keyless fallback: OpenStreetMap (Overpass) parish discovery — no API key
    // required, same communion + schema + publish gates as the Maps flow. Runs
    // when Places isn't configured (and is self-throttled for Overpass fair-use).
    const { osmParishDiscoveryEnabled, runOsmParishDiscovery } = await import("./parish-osm");
    if (osmParishDiscoveryEnabled()) {
      const r = await runOsmParishDiscovery(prisma, { brainActive: true }).catch(() => null);
      if (r && (r.published > 0 || r.candidates > 0)) {
        return {
          stage: "DISCOVERY",
          kind: "advanced",
          summary: `OpenStreetMap parish discovery: ${r.detail}`,
          metadata: {
            surfaced: r.candidates,
            published: r.published,
            routedToReview: r.routedToReview,
            rejected: r.rejected,
          },
        };
      }
    }
  }

  // Ears first (spec §14): before looking for anything new, notice what has
  // CHANGED in what the worker already knows. Sources whose learned change
  // interval has elapsed are moved back into the queue; a caught-up corpus
  // produces no work here at all, which is exactly the intent.
  const { runFreshnessSweep } = await import("./change-sensing");
  const freshness = await runFreshnessSweep(prisma).catch(() => ({
    overdue: 0,
    requeued: 0,
    hosts: [] as string[],
  }));
  if (freshness.requeued > 0) {
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "SOURCE_DISCOVERY",
      severity: "INFO",
      eventName: "freshness_sweep",
      message: `Freshness sweep: ${freshness.requeued} of ${freshness.overdue} overdue source(s) re-queued across ${freshness.hosts.length} host(s).`,
      safeMetadata: {
        overdue: freshness.overdue,
        requeued: freshness.requeued,
        hosts: freshness.hosts.slice(0, 10),
      },
    }).catch(() => undefined);
  }

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
  // Score a large batch (unscored-first) so scoring keeps up with discovery —
  // otherwise a big discovered backlog leaves most candidates at fetchPriority 0
  // and the fetcher has little to prioritize. Overridable via env for big backlogs.
  const scoreLimit = Number(process.env.ADMIN_WORKER_SCORE_BATCH ?? "") || 600;
  const result = await rescoreAllCandidates(prisma, { limit: scoreLimit });

  // Information gain (spec §17): the scorer judges the URL; this judges whether
  // what is behind it would actually teach Via Fidei something it still needs.
  const { applyInformationGainToCandidates } = await import("./information-gain");
  const gain = await applyInformationGainToCandidates(prisma).catch(() => ({
    considered: 0,
    adjusted: 0,
    demoted: 0,
    examples: [] as string[],
  }));

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "candidates_prioritized",
    message:
      `Candidate scorer: ${result.scored} scored, ${result.prioritized} prioritized, ${result.rejected} rejected. ` +
      `Information gain re-ranked ${gain.adjusted}/${gain.considered} candidate(s) (${gain.demoted} demoted).`,
    safeMetadata: {
      ...result,
      informationGain: {
        considered: gain.considered,
        adjusted: gain.adjusted,
        demoted: gain.demoted,
        examples: gain.examples,
      },
    },
  });
  return {
    stage: "CANDIDATE_PRIORITIZATION",
    kind: result.scored > 0 ? "advanced" : "idle",
    summary: `Scored ${result.scored} candidates (${result.prioritized} prioritized, ${result.rejected} rejected).`,
    metadata: result,
  };
}

/** Fetch attempts on one host, all failed, before SOURCE_FETCH routes around it. */
const HOST_FETCH_FAILURE_STREAK = 3;
/** How far back the host-failure streak is measured. */
const HOST_FETCH_FAILURE_WINDOW_MS = 60 * 60_000;

/**
 * Approved hosts whose EVERY recent fetch failed.
 *
 * WHY: SOURCE_FETCH looped 62× with zero successes because the highest-priority
 * candidates all sat on one host that was refusing every request — the queue was
 * ordered by score, and score knows nothing about a host that is down right now.
 * Every pass re-picked that host, filed another repair plan, and the stage never
 * advanced, which is precisely the LOOPING escalation. Routing around a host
 * that has failed `HOST_FETCH_FAILURE_STREAK`+ times with no success in the last
 * hour lets the stage reach a DIFFERENT approved source and actually advance —
 * the worker's own way out, with no external key involved.
 *
 * A host is cleared the moment one fetch succeeds, and the whole check is
 * fail-open: any error yields an empty set and the old ordering stands.
 *
 * Exported for the regression test.
 */
export async function blockedFetchHosts(
  prisma: PrismaClient,
  nowMs: number = Date.now(),
): Promise<Set<string>> {
  const blocked = new Set<string>();
  try {
    const rows = (await prisma.adminWorkerFetchResult.findMany({
      where: { createdAt: { gte: new Date(nowMs - HOST_FETCH_FAILURE_WINDOW_MS) } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { sourceHost: true, succeeded: true },
    })) as Array<{ sourceHost: string; succeeded: boolean }>;
    const failures = new Map<string, number>();
    const worked = new Set<string>();
    for (const r of rows) {
      if (r.succeeded) worked.add(r.sourceHost);
      else failures.set(r.sourceHost, (failures.get(r.sourceHost) ?? 0) + 1);
    }
    for (const [host, n] of failures) {
      if (!worked.has(host) && n >= HOST_FETCH_FAILURE_STREAK) blocked.add(host);
    }
  } catch {
    // fail-open — a missing/erroring ledger must never stop the fetch stage
  }
  return blocked;
}

/**
 * The result-type bucket for a page the pipeline handled perfectly and the
 * CLASSIFIER refused because no Via Fidei content type could match it.
 *
 * WHY THIS IS NOT "failure". The LOOPING warning exists to say "the worker is
 * stuck and needs a human". It fires on (failures + needsRepair) ≥ N with zero
 * successes on one stage. In production on 2026-09-10 it fired on SOURCE_FETCH
 * 21× in 6h — and every single one of those "failures" was a fetch that
 * SUCCEEDED, of a gcatholic.org diocese page the classifier scored at 0.05-0.25
 * against the 0.55 threshold. Via Fidei has no DIOCESE content type. Nothing was
 * stuck: the network worked, the fetcher worked, the reader worked, the
 * classifier worked and correctly said no. Being handed unusable URLs is a
 * DISCOVERY-QUALITY problem, and paging a human for it trains them to ignore
 * the page that matters.
 *
 * HOW THE DISTINCTION STAYS HONEST — this bucket is only reachable when:
 *   1. the network fetch SUCCEEDED and `readSource` ran to completion, so every
 *      transport/parse failure (timeouts, 5xx, 429, login walls, a throwing
 *      reader) still lands in "failure" and still trips LOOPING;
 *   2. the verdict is the structural one — UNUSABLE / WRONG, "no type scored
 *      above the threshold" — not any other rejection;
 *   3. the URL's shape is NOT already suppressed. If discovery was already told
 *      to stop surfacing this shape and the worker is fetching it anyway, the
 *      suppression is not holding and the worker really IS going in circles —
 *      that is a genuine stall and it is recorded as "failure" so LOOPING fires.
 * The volume is never hidden: it is a first-class row in the stage-outcome
 * ledger under its own result type, it is logged as a WARN naming the URL
 * shape, and it drives the prefix suppression, whose activation is logged too.
 */
export const UNUSABLE_INPUT_RESULT_TYPE = "unusable_input";

interface ClassifierRetirement {
  /** The candidate will never be fetched again. */
  terminal: boolean;
  /** The classifier said no content type can match this page at all. */
  unusableShape: boolean;
  /** Counts as unusable INPUT rather than a pipeline failure (see above). */
  unusableInput: boolean;
  prefix: string | null;
  prefixAlreadySuppressed: boolean;
  rejections: number;
}

/**
 * Retire a candidate the classifier rejected.
 *
 * The fetch bookkeeping above marks a successful fetch FETCHED — which is true,
 * it WAS fetched — but the freshness sweep re-opens FETCHED rows to DISCOVERED
 * when their re-read interval elapses (change-sensing `runFreshnessSweep`), so
 * a page that can never classify came back around forever. Marking it REJECTED
 * takes it out of that cycle: the sweep only re-opens FETCHED/BUILT, and
 * `discoverCandidate` never resets an existing row's status on rediscovery.
 *
 * Deliberately NOT on the first rejection: one bad read (a partial render, a
 * body the block parser mangled) deserves a second look after the freshness
 * interval. Two rejections of the same URL is a verdict. A URL whose shape is
 * already suppressed is retired immediately — the shape has already been proven
 * unusable by its siblings.
 *
 * This is the classifier path only. Transient FETCH failures (timeout, 5xx,
 * 429) are classified by `classifyFetchFailure` and keep retrying exactly as
 * they do today; nothing here touches them.
 */
async function retireClassifierRejection(
  prisma: PrismaClient,
  passId: string,
  candidate: {
    id: string;
    discoveredUrl: string;
    sourceHost: string;
    rejectionPattern: string | null;
  },
  readOutcome: { classifierContentType: string; rejectionReason: string | null },
  suppressedPrefixes: ReadonlySet<string>,
): Promise<ClassifierRetirement> {
  const {
    MAX_CLASSIFIER_REJECTIONS,
    UNCLASSIFIABLE_READ_TYPES,
    UNCLASSIFIABLE_REJECTION_PATTERN,
    isSuppressedUrlShape,
    urlShapePrefix,
  } = await import("./source-reputation");

  const unusableShape = UNCLASSIFIABLE_READ_TYPES.includes(readOutcome.classifierContentType);
  const prefix = urlShapePrefix(candidate.discoveredUrl);
  // The candidate was picked with these prefixes EXCLUDED, and the queued
  // backlog under them is retired on sight, so reaching here with a suppressed
  // shape means the suppression is not holding — a genuine loop, see below.
  const prefixAlreadySuppressed = isSuppressedUrlShape(candidate.discoveredUrl, suppressedPrefixes);
  // `fetchAttempts` was incremented to this value by the fetch bookkeeping just
  // above, and this line is only reached on a successful fetch, so it is the
  // count of times this URL has been fetched and handed to the classifier.
  // The COUNT of classifier rejections for this URL, not of fetch attempts: the
  // marker below is written on the first one, so finding it already there means
  // this is at least the second. Deliberately not `fetchAttempts`, which also
  // counts transient network failures — a page that timed out twice and then
  // classified badly once has been judged once, not three times.
  const rejectedBefore = candidate.rejectionPattern === UNCLASSIFIABLE_REJECTION_PATTERN;
  const rejections = rejectedBefore ? MAX_CLASSIFIER_REJECTIONS : 1;
  const terminal = prefixAlreadySuppressed || rejections >= MAX_CLASSIFIER_REJECTIONS;

  await prisma.candidateSourceUrl
    .update({
      where: { id: candidate.id },
      data: {
        status: terminal ? "REJECTED" : "FETCHED",
        rejectionReason: `classifier: ${readOutcome.rejectionReason ?? "rejected"}`,
        // The evidence `unclassifiablePrefixes` learns the URL SHAPE from.
        ...(unusableShape ? { rejectionPattern: UNCLASSIFIABLE_REJECTION_PATTERN } : {}),
      },
    })
    .catch(() => undefined);

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "SOURCE_READING",
    severity: "WARN",
    eventName: unusableShape ? "classifier_unusable_input" : "classifier_rejected_candidate",
    message: unusableShape
      ? `${candidate.discoveredUrl} matched no Via Fidei content type (${readOutcome.rejectionReason ?? "no reason"}). ${
          terminal
            ? "Candidate retired — it will not be fetched again"
            : `Candidate kept for one more look (${rejections}/${MAX_CLASSIFIER_REJECTIONS})`
        }${prefix ? `; URL shape ${prefix}` : ""}${prefixAlreadySuppressed ? " (shape already suppressed — counted as a real stall)" : ""}.`
      : `${candidate.discoveredUrl} was rejected by the classifier (${readOutcome.rejectionReason ?? "no reason"}).`,
    sourceHost: candidate.sourceHost,
    sourceUrl: candidate.discoveredUrl,
    safeMetadata: {
      candidateId: candidate.id,
      classifierContentType: readOutcome.classifierContentType,
      urlShapePrefix: prefix,
      prefixAlreadySuppressed,
      classifierRejections: rejections,
      terminal,
    },
  }).catch(() => undefined);

  return {
    terminal,
    unusableShape,
    unusableInput: unusableShape && !prefixAlreadySuppressed,
    prefix,
    prefixAlreadySuppressed,
    rejections,
  };
}

/**
 * Retire every QUEUED candidate that sits under a suppressed URL shape.
 *
 * Suppressing the shape at discovery stops NEW siblings arriving; it does
 * nothing about the ones already in the queue, and in production that backlog
 * is the loop: `https://gcatholic.org/dioceses/` links to thousands of
 * `/dioceses/diocese/*` pages and the crawler had been inserting them 100 at a
 * time for days. Draining them in one statement — rather than one wasted fetch
 * per pass for the next several thousand passes — is what actually clears the
 * SOURCE_FETCH condition.
 *
 * Only DISCOVERED / PRIORITIZED rows are touched (nothing mid-flight, nothing
 * already published), the reason is written to the row, and the sweep is
 * reversible in exactly the way the suppression is: it is driven by
 * `unclassifiablePrefixes`, so a shape that stops being suppressed is simply
 * discovered again. Fail-open.
 */
async function retireSuppressedCandidates(
  prisma: PrismaClient,
  passId: string,
  suppressedPrefixes: ReadonlySet<string>,
): Promise<number> {
  let retired = 0;
  if (typeof prisma.candidateSourceUrl?.updateMany !== "function") return 0;
  for (const prefix of suppressedPrefixes) {
    // `contains` is the SQL prefilter; pinning the host as well keeps a prefix
    // from ever matching a lookalike path on some other host.
    const result = await prisma.candidateSourceUrl
      .updateMany({
        where: {
          status: { in: ["DISCOVERED", "PRIORITIZED"] },
          sourceHost: { equals: prefix.split("/")[0], mode: "insensitive" },
          discoveredUrl: { contains: prefix, mode: "insensitive" },
        },
        data: {
          status: "REJECTED",
          rejectionReason: `URL shape ${prefix} matches no Via Fidei content type (classifier-rejected siblings, discovery suppressed).`,
        },
      })
      .catch(() => null);
    const count = result?.count ?? 0;
    if (count === 0) continue;
    retired += count;
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "SOURCE_READING",
      severity: "WARN",
      eventName: "fetch_queue_shape_retired",
      message: `Retired ${count} queued candidate(s) under the unclassifiable URL shape ${prefix} — they can never classify, so fetching them only burns passes.`,
      safeMetadata: { prefix, retired: count },
    }).catch(() => undefined);
  }
  return retired;
}

async function runSourceFetchRead(
  prisma: PrismaClient,
  passId: string,
  decision: BrainDecision,
): Promise<DispatchOutcome> {
  // Order by the candidate scorer's fetchPriority — the best safe
  // candidate first (spec §5).
  //
  // The eligibility clause is what stops the top-priority candidate from being
  // re-selected on EVERY pass while every candidate behind it starves: a row
  // that was just attempted (or was satisfied from cache) has to wait out its
  // backoff before it can be chosen again (WX-05 / WX-06).
  // URL shapes this worker has proven no content type can match (see
  // `unclassifiablePrefixes`). Two things happen with them here: the queued
  // backlog under them is retired in one sweep — otherwise the thousands of
  // /dioceses/diocese/* candidates already in the queue would keep being
  // fetched one per pass long after discovery stopped adding more — and the
  // picker excludes them so nothing under a suppressed shape is chosen while
  // the sweep catches up.
  const { suppressedUrlPrefixes: loadSuppressedPrefixes } = await import("./source-reputation");
  const suppressedPrefixes = await loadSuppressedPrefixes(prisma).catch(() => new Set<string>());
  if (suppressedPrefixes.size > 0) {
    await retireSuppressedCandidates(prisma, passId, suppressedPrefixes);
  }
  const notSuppressed =
    suppressedPrefixes.size > 0
      ? {
          NOT: [...suppressedPrefixes].map((prefix) => ({
            sourceHost: { equals: prefix.split("/")[0], mode: "insensitive" as const },
            discoveredUrl: { contains: prefix, mode: "insensitive" as const },
          })),
        }
      : {};

  const pickCandidate = (excludeHosts: string[]) =>
    prisma.candidateSourceUrl.findFirst({
      where: {
        status: { in: ["DISCOVERED", "PRIORITIZED"] },
        ...candidateFetchEligibility(new Date()),
        ...notSuppressed,
        ...(excludeHosts.length > 0 ? { sourceHost: { notIn: excludeHosts } } : {}),
      },
      orderBy: [{ fetchPriority: "desc" }, { predictedUsefulness: "desc" }, { createdAt: "asc" }],
    });

  // Reroute around hosts that are failing every fetch right now (see
  // blockedFetchHosts). Only when routing around them leaves nothing at all do
  // we fall back to the unfiltered queue — starving the stage would be a worse
  // failure than one more attempt on a bad host.
  const blockedHosts = await blockedFetchHosts(prisma);
  let candidate = blockedHosts.size > 0 ? await pickCandidate([...blockedHosts]) : null;
  const rerouted = candidate !== null;
  if (!candidate) candidate = await pickCandidate([]);
  if (candidate && (rerouted || blockedHosts.size > 0)) {
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "SOURCE_READING",
      severity: rerouted ? "INFO" : "WARN",
      eventName: rerouted ? "fetch_host_rerouted" : "fetch_all_hosts_blocked",
      message: rerouted
        ? `Routing around ${blockedHosts.size} failing host(s) — fetching ${candidate.sourceHost} instead.`
        : `Every eligible candidate is on a failing host (${[...blockedHosts].join(", ")}); retrying ${candidate.sourceHost} anyway.`,
      sourceHost: candidate.sourceHost,
      safeMetadata: { blockedHosts: [...blockedHosts], rerouted },
    }).catch(() => undefined);
  }
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
      select: { checksum: true, etag: true, lastModifiedHeader: true },
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

  // Adaptive acquisition (spec §16): choose the cheapest reader that can
  // plausibly answer, using what this worker has learned about the host, and
  // reuse the durable source read when nothing has changed. The plan is logged
  // so "why did it use a browser here?" always has an answer.
  const { planAcquisition, recordAcquisitionOutcome } = await import("./acquisition-planner");
  const { recordObservation } = await import("./change-sensing");
  const plan = await planAcquisition(prisma, {
    url: candidate.discoveredUrl,
    hints: {
      contentType: decision.contentType ?? candidate.predictedContentType ?? null,
      isPdf: /\.pdf($|\?)/i.test(candidate.discoveredUrl),
    },
  }).catch(() => null);

  if (plan && plan.satisfiedByCache && process.env.ADMIN_WORKER_SKIP_NETWORK !== "1") {
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "SOURCE_READING",
      severity: "INFO",
      eventName: "fetch_skipped_cache_fresh",
      message: `Skipped fetching ${candidate.discoveredUrl}: ${plan.sense.reason}`,
      sourceHost: candidate.sourceHost,
      sourceUrl: candidate.discoveredUrl,
      safeMetadata: {
        candidateId: candidate.id,
        rereadIntervalMs: plan.sense.rereadIntervalMs,
        lastReadAt: plan.sense.lastReadAt?.toISOString() ?? null,
      },
    }).catch(() => undefined);
    // The durable read for this URL already exists, so the candidate HAS been
    // fetched — mark it FETCHED. Leaving it DISCOVERED/PRIORITIZED made it the
    // top-priority candidate again on the very next pass, and (because a
    // validation probe keeps refreshing the freshness signal for hosts like
    // vatican.va) it could win that race forever while the rest of the queue
    // was never read (WX-05).
    await prisma.candidateSourceUrl
      .update({
        where: { id: candidate.id },
        data: { lastFetchedAt: new Date(), status: "FETCHED" },
      })
      .catch(() => undefined);
    return {
      stage: "SOURCE_FETCH",
      kind: "advanced",
      summary: `Reused the durable source read for ${candidate.discoveredUrl} (no change expected yet).`,
      metadata: { candidateId: candidate.id, url: candidate.discoveredUrl, cacheSatisfied: true },
    };
  }

  await writeAdminWorkerLog(prisma, {
    passId,
    category: "SOURCE_READING",
    severity: "INFO",
    eventName: "fetch_started",
    message: `Fetching ${candidate.discoveredUrl}${plan ? ` — ${plan.rationale}` : ""}.`,
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
    previousLastModified: previousFetch?.lastModifiedHeader ?? null,
    skipNetwork,
  });

  // Bookkeeping on the candidate row.
  //
  // A failed fetch is only REJECTED when the failure is a verdict about the
  // PAGE (unapproved host, binary, login wall, 404/410). A transient failure —
  // timeout, dropped network, 429, 5xx — leaves the candidate where it is so
  // the backoff above can retry it; only after MAX_TRANSIENT_FETCH_ATTEMPTS
  // does it reject. Rejecting on the first timeout silently destroyed every
  // candidate fetched during a rate-limit burst or a Wi-Fi blip (WX-06).
  const attempts = candidate.fetchAttempts + 1;
  const failureKind = fetched.succeeded
    ? null
    : classifyFetchFailure({
        errorClass: fetched.errorClass,
        rejectionReason: fetched.rejectionReason,
        httpStatus: fetched.httpStatus,
      });
  const transientRetryLeft = failureKind === "transient" && attempts < MAX_TRANSIENT_FETCH_ATTEMPTS;
  await prisma.candidateSourceUrl
    .update({
      where: { id: candidate.id },
      data: {
        fetchAttempts: attempts,
        lastFetchedAt: new Date(),
        status: fetched.succeeded ? "FETCHED" : transientRetryLeft ? candidate.status : "REJECTED",
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
    await recordAcquisitionOutcome(prisma, {
      url: candidate.discoveredUrl,
      method: "static-http",
      ok: false,
      contentType: decision.contentType ?? null,
      reason: fetched.rejectionReason ?? fetched.errorClass ?? "fetch_failed",
    }).catch(() => undefined);
    return {
      stage: "SOURCE_FETCH",
      kind: "repair-planned",
      summary: transientRetryLeft
        ? `Fetch failed transiently for ${candidate.discoveredUrl}: ${fetched.rejectionReason ?? fetched.errorMessage} — retry ${attempts}/${MAX_TRANSIENT_FETCH_ATTEMPTS} scheduled after backoff.`
        : `Fetch failed for ${candidate.discoveredUrl}: ${fetched.rejectionReason ?? fetched.errorMessage}.`,
      failed: 1,
      repairsPlanned: 1,
      metadata: {
        candidateId: candidate.id,
        url: candidate.discoveredUrl,
        errorClass: fetched.errorClass,
        failureKind,
        fetchAttempts: attempts,
        willRetry: transientRetryLeft,
      },
    };
  }

  // 304 / unchanged-checksum path — no body to read, but we count
  // this as advancing the chain because the previous source-read
  // row is still valid.
  if (fetched.unchanged) {
    await recordObservation(prisma, { url: candidate.discoveredUrl, changed: false }).catch(
      () => undefined,
    );
    await recordAcquisitionOutcome(prisma, {
      url: candidate.discoveredUrl,
      method: "conditional-http",
      ok: true,
      contentType: decision.contentType ?? null,
      reason: "304/unchanged checksum",
    }).catch(() => undefined);
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

  await recordObservation(prisma, { url: candidate.discoveredUrl, changed: true }).catch(
    () => undefined,
  );
  await recordAcquisitionOutcome(prisma, {
    url: candidate.discoveredUrl,
    method: "static-http",
    ok: !readOutcome.rejected,
    contentType: readOutcome.classifierContentType,
    reason: readOutcome.rejectionReason ?? "read ok",
    // A body that produced no usable prose is the signature of a JS-rendered
    // page: remember it so the planner escalates to the browser next time.
    observedJsOnly: readOutcome.rejected && readOutcome.acceptedBlocks === 0,
  }).catch(() => undefined);

  // A classifier rejection is a verdict about the PAGE, not a pipeline
  // failure — see `retireClassifierRejection`. It retires the candidate so the
  // same URL is not fetched again next pass, records the URL-shape evidence the
  // prefix suppression learns from, and decides whether this counts towards
  // LOOPING.
  const retirement = readOutcome.rejected
    ? await retireClassifierRejection(prisma, passId, candidate, readOutcome, suppressedPrefixes)
    : null;

  return {
    stage: "SOURCE_FETCH",
    kind: readOutcome.rejected ? "rejected" : "advanced",
    unusableInput: retirement?.unusableInput ?? false,
    summary: readOutcome.rejected
      ? `Fetched + read ${candidate.discoveredUrl}: rejected (${readOutcome.rejectionReason})${retirement?.terminal ? " — retired, it will not be fetched again" : ""}.`
      : `Fetched + read ${candidate.discoveredUrl}: ${readOutcome.classifierContentType} (conf ${readOutcome.classifierConfidence.toFixed(2)}).`,
    metadata: {
      candidateId: candidate.id,
      sourceReadId: readOutcome.sourceReadId,
      checksum: readOutcome.checksum,
      classifierContentType: readOutcome.classifierContentType,
      classifierConfidence: readOutcome.classifierConfidence,
      pipelineStageId: readOutcome.pipelineStageId,
      ...(retirement
        ? {
            classifierRejection: {
              terminal: retirement.terminal,
              unusableShape: retirement.unusableShape,
              urlShapePrefix: retirement.prefix,
              prefixAlreadySuppressed: retirement.prefixAlreadySuppressed,
              classifierRejections: retirement.rejections,
            },
          }
        : {}),
    },
    rejected: readOutcome.rejected ? 1 : 0,
  };
}

/**
 * Operator-supplied material has no external authority of its own, so it must
 * be corroborated by an approved source before it can publish (spec §13.9-10,
 * §22). The pipeline already enforces exactly that for any artifact with a
 * non-empty `validationNeeds`: cross-source verification gathers evidence, and
 * strict QA scores the validation dimension 0 without a MATCH.
 *
 * The catch is that most content types declare no validationNeeds at all, so an
 * operator file would otherwise sail through as its own sole witness. Widening
 * the needs for operator reads makes the promise the ingestion path logs
 * ("external corroboration required before publishing") the thing the existing
 * gate actually checks — no new gate, no second pipeline.
 */
function validationNeedsForRead(
  sourceHost: string,
  contentType: string,
  packageNeeds: string[],
): string[] {
  if (sourceHost !== OPERATOR_FILE_HOST) return packageNeeds;
  const required = REQUIRED_FACTS[contentType as keyof typeof REQUIRED_FACTS] ?? [];
  // Fall back to the title when a type declares no required facts: a corroborating
  // source must at least confirm the thing exists under that name.
  const fallback = required.length > 0 ? required : ["title"];
  return [...new Set([...packageNeeds, ...fallback])];
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
  // AdminWorkerPackageArtifact. We must pick a read WITHOUT an artifact — not
  // just the newest read — otherwise every older un-extracted read is
  // stranded. The scan runs oldest-first so the longest-waiting read is
  // processed next.
  //
  // Only WEB-EXTRACTABLE detected types are eligible: a read classified
  // UNUSABLE / WRONG (or any type without an extractor) can never yield an
  // artifact, so if it were selected it would be rejected without being
  // marked done and — being oldest — re-selected on every pass forever,
  // blocking the whole queue behind it (the EXTRACTION stuck loop). Filtering
  // here keeps those terminal reads out of the queue entirely.
  //
  // The set is WEB_EXTRACTION_CONTENT_TYPES, NOT EXTRACTABLE_CONTENT_TYPES:
  // curated/structured-built types (GUIDE, MARIAN_TITLE) are excluded because
  // arbitrary discovered pages of those types never yield a complete record, so
  // they would extract to `needs_repair` on every pass and loop with zero
  // successes (the "EXTRACTION LOOPING on GUIDE" escalation). They grow from the
  // curated knowledge base + structured ingestors instead.
  //
  // The scan is a DURABLE ROLLING CURSOR over (createdAt, id), not a fixed
  // "oldest 200" window. With the fixed window, once those 200 reads all had
  // artifacts the stage returned idle on every pass forever and read #201
  // onward was never extracted, while the brain kept scoring EXTRACTION
  // because reads-awaiting-extraction stayed > 0 (WX-01). Each pass resumes
  // where the last one stopped and wraps to the oldest read at the end, so a
  // pass either extracts something or provably advances the scan.
  const PAGE_SIZE = 200;
  const MAX_PAGES_PER_PASS = 25;
  type SourceReadRow = Awaited<ReturnType<typeof prisma.adminWorkerSourceRead.findMany>>[number];
  let cursor: ExtractionCursor | null = await loadExtractionCursor(prisma);
  let read: SourceReadRow | null = null;
  let pageRows: SourceReadRow[] = [];
  let wrapped = false;
  let pagesScanned = 0;
  let scannedRows = 0;
  while (pagesScanned < MAX_PAGES_PER_PASS) {
    pageRows = await prisma.adminWorkerSourceRead.findMany({
      where: {
        detectedContentType: { in: [...WEB_EXTRACTION_CONTENT_TYPES] },
        ...extractionCursorWhere(cursor),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: PAGE_SIZE,
    });
    pagesScanned += 1;
    if (pageRows.length === 0) {
      // End of the table. Wrap once so reads the scan skipped earlier (a
      // failed persist, a read created before the cursor) get another turn.
      if (!cursor || wrapped) break;
      cursor = null;
      wrapped = true;
      continue;
    }
    scannedRows += pageRows.length;
    const artifactReadIds = new Set(
      (
        await prisma.adminWorkerPackageArtifact
          .findMany({
            where: { sourceReadId: { in: pageRows.map((r) => r.id) } },
            select: { sourceReadId: true },
          })
          .catch(() => [] as Array<{ sourceReadId: string | null }>)
      ).map((a) => a.sourceReadId),
    );
    const found = pageRows.find((r) => !artifactReadIds.has(r.id));
    const advanceTo = found ?? pageRows[pageRows.length - 1];
    // Rows without a createdAt (test fakes) leave the cursor alone rather than
    // poisoning it with an invalid date.
    if (advanceTo.createdAt instanceof Date) {
      cursor = { at: advanceTo.createdAt, id: advanceTo.id };
    }
    if (found) {
      read = found;
      break;
    }
  }
  await saveExtractionCursor(prisma, cursor);
  if (!read) {
    return idle(
      "EXTRACTION",
      scannedRows === 0
        ? "No classified source-reads available for extraction."
        : `Scanned ${scannedRows} classified source-read(s) from the extraction cursor; all of them already have a package artifact.`,
    );
  }

  // Run the per-content-type extractor.
  const { extractByType } = await import("./extractors");
  const { buildContentPackage } = await import("./content-builder");
  // Extractor-strategy learning: recall how this (host, contentType) has
  // extracted before so the outcome is logged against its history.
  const { recallExtractorMemory, recordExtractorOutcome } = await import("./memory");
  const priorExtractor = read.detectedContentType
    ? await recallExtractorMemory(prisma, read.sourceHost, read.detectedContentType).catch(
        () => null,
      )
    : null;
  const detected = read.detectedContentType;
  // Defensive: the candidate query already restricts to extractable types,
  // but guard again so `detected` is a typed ExtractableContentType for the
  // extractor dispatch below (and so a future query change can't silently
  // reintroduce the poison-read loop).
  if (!isExtractableContentType(detected)) {
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
  // The page language travels WITH the extraction (PR-15). Without it every
  // extractor stamped `language: "en"`, so a Spanish USCCB prayer published as
  // English and the prayer-page toggle offered Latin over a Spanish text.
  const readLanguage = detectReadLanguage(read.sourceUrl, read.extractedText);
  const extractor = extractByType(detected, {
    url: read.sourceUrl,
    host: read.sourceHost,
    title: read.extractedTitle,
    headings: Array.isArray(read.extractedHeadings) ? (read.extractedHeadings as string[]) : [],
    bodyText: read.extractedText ?? "",
    blocks: blocks.length > 0 ? (blocks as never) : undefined,
    checksum: read.checksum,
    language: readLanguage,
  });

  // Deterministic extraction only. The Admin Worker never calls an external AI
  // API to fill fields — that would defeat the point of a self-contained worker.
  // When the deterministic extractor + structured-data blocks leave required
  // fields missing, the artifact is NOT force-completed: it stays EXTRACTED and a
  // reroute repair (below) moves the target to a DIFFERENT approved source on the
  // next pass. The worker escapes EXTRACTION by trying another source, not by
  // inventing fields.
  // The package title becomes the public title AND the slug, so it must name
  // the ENTITY, not the page: a raw `<title>` ("St. Francis of Assisi - Saints
  // & Angels - Catholic Online") published verbatim and split one entity into
  // two slugs across two sources (WX-09). PDFs have no `<title>` at all, and
  // content-builder's "Untitled" fallback gave every PDF of a type the same
  // duplicate key, so the second and all later ones were consumed as
  // DUPLICATEs of the first (WX-14). Prefer the cleaned page title, then a
  // title the extractor itself produced, then the document's own first heading
  // / URL path — and refuse to package when NOTHING names it.
  const packageTitle =
    cleanSourceTitle(read.extractedTitle, read.sourceHost) ??
    extractorFieldTitle(extractor.fields as Record<string, unknown>) ??
    deriveDocumentTitle({
      title: read.extractedTitle,
      url: read.sourceUrl,
      bodyText: read.extractedText,
      host: read.sourceHost,
    });
  if (!packageTitle) {
    // Consume the read (UNUSABLE is terminal and outside the extraction queue)
    // so an untitled document can never be re-selected forever, and never
    // becomes an "Untitled" artifact that swallows later documents.
    await prisma.adminWorkerSourceRead
      .update({ where: { id: read.id }, data: { detectedContentType: "UNUSABLE" } })
      .catch((err) => {
        reportQueryError("extraction.untitledRead", err);
        return null;
      });
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "CONTENT_BUILD",
      severity: "WARN",
      eventName: "extraction_untitled_source",
      message: `No title could be derived for ${read.sourceUrl} (no <title>, no extracted name, no usable heading/path) — read marked UNUSABLE instead of packaging it as "Untitled".`,
      sourceUrl: read.sourceUrl,
      sourceHost: read.sourceHost,
      contentType: detected,
      safeMetadata: { sourceReadId: read.id },
    }).catch(() => undefined);
    return {
      stage: "EXTRACTION",
      kind: "rejected",
      summary: `No derivable title for ${read.sourceUrl}; read marked UNUSABLE.`,
      rejected: 1,
      metadata: { sourceReadId: read.id, reason: "no_title" },
    };
  }

  const pkg = buildContentPackage({
    contentType: detected,
    extractor,
    title: packageTitle,
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

  // Artifacts are unique on (contentType, normalizedSlug, packageChecksum) —
  // effectively (type, normalized title). The SAME entity routinely arrives via
  // a second source-read: a mirror/alternate URL with the same title, or a
  // re-fetch of a page whose body changed (new checksum ⇒ new read row). A
  // blind `create` then throws P2002, and when that error was swallowed the
  // read never got an artifact, stayed the oldest classified read, and was
  // re-picked on EVERY pass — wedging the whole extraction stage on one poison
  // read while the funnel starved (the live "package artifact (?)" loop:
  // extraction logged CHECKLIST_READY every ~15s with 0 artifacts created and
  // 0 published). So: detect the duplicate FIRST, consume the redundant read,
  // and use the fresh extraction to HEAL a broken existing artifact when it
  // can. Any other persistence error is loud (reportQueryError) and returns
  // kind "failed" — never a silent fake success.
  const duplicateKey = {
    contentType: detected,
    normalizedSlug: pkg.normalizedSlug,
    packageChecksum: pkg.duplicateKeys.titleHash,
  };
  const consumeDuplicateRead = () =>
    prisma.adminWorkerSourceRead
      .update({ where: { id: read.id }, data: { detectedContentType: "DUPLICATE" } })
      .catch((err) => {
        reportQueryError("extraction.consumeDuplicateRead", err);
        return null;
      });

  let artifact: { id: string } | null = null;
  let existing = await prisma.adminWorkerPackageArtifact
    .findUnique({
      where: { contentType_normalizedSlug_packageChecksum: duplicateKey },
      select: { id: true, status: true, sourceReadId: true, missingFields: true },
    })
    .catch((err) => {
      reportQueryError("extraction.duplicateLookup", err);
      return null;
    });

  if (!existing) {
    try {
      artifact = await prisma.adminWorkerPackageArtifact.create({
        data: {
          sourceReadId: read.id,
          candidateUrlId: candidate?.id ?? null,
          contentType: detected,
          normalizedTitle: pkg.normalizedTitle,
          normalizedSlug: pkg.normalizedSlug,
          extractedFields: pkg.displayFields as never,
          fieldProvenance: pkg.fieldProvenance as never,
          missingFields: pkg.missingFields,
          validationNeeds: validationNeedsForRead(read.sourceHost, detected, pkg.validationNeeds),
          formattingMetadata: pkg.formattingMetadata as never,
          confidenceScore: pkg.confidenceByPackage,
          packageChecksum: pkg.duplicateKeys.titleHash,
          status,
          rejectionReason: pkg.rejectionReasons[0] ?? null,
          repairSuggestions: pkg.repairSuggestions,
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        // Raced with a concurrent create — fall through to the duplicate path.
        existing = await prisma.adminWorkerPackageArtifact
          .findUnique({
            where: { contentType_normalizedSlug_packageChecksum: duplicateKey },
            select: { id: true, status: true, sourceReadId: true, missingFields: true },
          })
          .catch(() => null);
      }
      if (!existing) {
        // A real persistence failure (schema drift, connection, constraint we
        // don't understand). Surface it loudly and report the stage as FAILED —
        // the old silent-null here is what masked the production wedge.
        reportQueryError("extraction.artifactCreate", err);
        const message = err instanceof Error ? err.message : String(err);
        return {
          stage: "EXTRACTION",
          kind: "failed",
          summary: `Extraction could not persist artifact for ${read.sourceUrl}: ${message.slice(0, 160)}`,
          failed: 1,
          metadata: { sourceReadId: read.id, error: message.slice(0, 500) },
        };
      }
    }
  }

  if (!artifact && existing) {
    // Duplicate: this entity already has an artifact (from another URL/read).
    // 1. Consume THIS read so it can never wedge the queue again — "DUPLICATE"
    //    is a terminal verdict like UNUSABLE/WRONG, outside
    //    WEB_EXTRACTION_CONTENT_TYPES, so the extraction picker and the brain's
    //    backlog count both skip it from now on.
    // 2. If the existing artifact is still broken pre-funnel (EXTRACTED /
    //    NEEDS_REPAIR / REJECTED) and THIS extraction is complete (no fatal, no
    //    missing fields), heal it in place: fresh fields + CHECKLIST_READY. A
    //    duplicate source is a second witness, not waste. Artifacts already in
    //    or past the funnel (CHECKLIST_READY → PUBLISHED, NEEDS_REVIEW) are
    //    never touched.
    await consumeDuplicateRead();
    const healable = ["EXTRACTED", "NEEDS_REPAIR", "REJECTED"].includes(existing.status);
    const newIsComplete = pkg.rejectionReasons.length === 0 && pkg.missingFields.length === 0;
    let healed = false;
    if (healable && newIsComplete) {
      healed = Boolean(
        await prisma.adminWorkerPackageArtifact
          .update({
            where: { id: existing.id },
            data: {
              extractedFields: pkg.displayFields as never,
              fieldProvenance: pkg.fieldProvenance as never,
              missingFields: [],
              validationNeeds: validationNeedsForRead(
                read.sourceHost,
                detected,
                pkg.validationNeeds,
              ),
              formattingMetadata: pkg.formattingMetadata as never,
              confidenceScore: pkg.confidenceByPackage,
              status: "CHECKLIST_READY",
              rejectionReason: null,
              repairSuggestions: [],
              gateDiagnosis: null,
            },
          })
          .catch((err) => {
            reportQueryError("extraction.duplicateHeal", err);
            return null;
          }),
      );
    }
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "extraction_duplicate",
      message: healed
        ? `Duplicate of artifact ${existing.id} (${existing.status}) — healed in place to CHECKLIST_READY from ${read.sourceUrl}.`
        : `Duplicate of artifact ${existing.id} (${existing.status}) — read ${read.id} consumed, artifact untouched.`,
      sourceUrl: read.sourceUrl,
      sourceHost: read.sourceHost,
      contentType: detected,
      safeMetadata: { artifactId: existing.id, existingStatus: existing.status, healed },
    }).catch(() => undefined);
    return {
      stage: "EXTRACTION",
      kind: healed ? "advanced" : "skipped",
      summary: healed
        ? `Duplicate extraction healed artifact ${existing.id} → CHECKLIST_READY (${read.sourceUrl}).`
        : `Duplicate of artifact ${existing.id} (${existing.status}); redundant read consumed.`,
      metadata: { artifactId: existing.id, duplicate: true, healed },
    };
  }

  // Feed source reputation — extraction success/failure (spec §16).
  const { pushReputation } = await import("./source-reputation-hooks");
  await pushReputation(prisma, {
    sourceHost: read.sourceHost,
    contentType: read.detectedContentType ?? undefined,
    stage: "extraction",
    ok: status !== "REJECTED",
    usefulness: pkg.confidenceByPackage,
  }).catch(() => undefined);

  // Extractor-strategy learning: record this extractor outcome per
  // (host, contentType) so later passes (and the brain) can prefer hosts
  // that reliably yield complete packages and back off from weak ones.
  await recordExtractorOutcome(prisma, {
    host: read.sourceHost,
    contentType: detected,
    fatal: status === "REJECTED",
    confidenceScore: pkg.confidenceByPackage,
    missingFields: pkg.missingFields,
  }).catch(() => undefined);

  // Missing required fields → the worker escapes EXTRACTION by SWITCHING SOURCES,
  // not by inventing fields with an external AI. It (1) files a durable repair
  // plan and (2) ACTIVELY reroutes: boosts the best unfetched candidate of the
  // same type on a DIFFERENT approved host so the next SOURCE_FETCH reads it.
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
    const { rerouteToAlternateSource } = await import("./repair");
    await rerouteToAlternateSource(prisma, {
      contentType: detected,
      failedHost: read.sourceHost,
      missingFields: pkg.missingFields,
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
      priorExtractorConfidence: priorExtractor?.confidence ?? null,
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

/**
 * Reroute the content types of artifacts that CHECKLIST_CREATION could not use.
 * Exported for the regression test; see the call site for why it exists.
 */
export async function rerouteInsufficientArtifacts(
  prisma: PrismaClient,
  passId: string,
  artifactIds: string[],
): Promise<number> {
  const artifacts = (await prisma.adminWorkerPackageArtifact
    .findMany({
      where: { id: { in: artifactIds } },
      select: { id: true, contentType: true, candidateUrlId: true },
    })
    .catch(() => [])) as Array<{ id: string; contentType: string; candidateUrlId: string | null }>;
  const { rerouteToAlternateSource } = await import("./repair");
  const seen = new Set<string>();
  let rerouted = 0;
  for (const artifact of artifacts) {
    if (seen.has(artifact.contentType)) continue;
    seen.add(artifact.contentType);
    // The host that produced the unusable package — so the reroute moves to a
    // genuinely different source rather than the same one again.
    const origin = artifact.candidateUrlId
      ? await prisma.candidateSourceUrl
          .findUnique({
            where: { id: artifact.candidateUrlId },
            select: { sourceHost: true },
          })
          .catch(() => null)
      : null;
    const out = await rerouteToAlternateSource(prisma, {
      contentType: artifact.contentType,
      failedHost: origin?.sourceHost ?? "",
    }).catch(() => null);
    if (out?.succeeded) rerouted += 1;
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "REPAIR",
      severity: "INFO",
      eventName: "checklist_insufficient_reroute",
      contentType: artifact.contentType,
      message: `Checklist creation could not use artifact ${artifact.id} (no provenance) — ${
        out?.reason ?? "reroute unavailable"
      }.`,
      safeMetadata: {
        artifactId: artifact.id,
        failedHost: origin?.sourceHost ?? null,
        reroutedTo: out?.reroutedTo ?? null,
      },
    }).catch(() => undefined);
  }
  return rerouted;
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

  // ESCAPE HATCH (the LOOPING escalation). An artifact skipped as
  // "insufficient" has no field provenance at all — the SOURCE it came from
  // never carried what a citation needs. Re-running this stage can only skip it
  // again, every pass, forever at zero successes. So when NOTHING advanced and
  // the blocker is insufficiency, reroute that content type to a different
  // approved source: the next extraction can then build a complete package
  // instead of this stage spinning on one that can never complete. Fail-open,
  // and it does not change the outcome kind — a skip is still honestly a skip.
  const insufficientIds = results
    .filter((r) => r.status === "skipped_insufficient")
    .map((r) => r.artifactId);
  if (advanced === 0 && insufficientIds.length > 0) {
    await rerouteInsufficientArtifacts(prisma, passId, insufficientIds).catch(() => undefined);
  }

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
    // This stage MOVES NOTHING: the artifact is already shaped like a complete
    // package, and the stage that advances it next is verification or strict
    // QA. Reporting "advanced / built 1" for an artifact it did not touch made
    // the same row look like fresh output on every pass, which told the
    // governor the pipeline was productive while the funnel was actually
    // parked. Report the honest gate instead — the governor can then redirect
    // to the stage that would really move it.
    const awaiting =
      (artifact.validationNeeds ?? []).length > 0 ? "cross-source verification" : "strict QA";
    await writeAdminWorkerLog(prisma, {
      passId,
      category: "CONTENT_BUILD",
      severity: "INFO",
      eventName: "build_from_artifact",
      message: `Package artifact ${artifact.id} (${artifact.contentType}) is BUILD_READY; awaiting ${awaiting}.`,
      contentType: artifact.contentType,
      safeMetadata: { artifactId: artifact.id, status: artifact.status, awaiting },
    });
    return {
      stage: "PACKAGE_BUILD",
      kind: "idle",
      summary: `Artifact ${artifact.id} is already built; awaiting ${awaiting}.`,
      metadata: { artifactId: artifact.id, source: "AdminWorkerPackageArtifact", awaiting },
    };
  }

  // Spec §1: there is no build/publish fallback. The only way an item
  // becomes a buildable package is the EXTRACTION stage materialising an
  // AdminWorkerPackageArtifact. With no BUILD_READY artifact,
  // PACKAGE_BUILD is idle.
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CONTENT_BUILD",
    severity: "INFO",
    eventName: "package_build_idle",
    message:
      "No BUILD_READY artifact; PACKAGE_BUILD idle. (Artifacts come from the EXTRACTION stage only.)",
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
/**
 * Coarse host → Catholic authority level for advisory claim resolution. The
 * Python brain owns the full authority ladder; this is just the seed signal so
 * it can weigh a validation source's claim. Conservative default: COMMUNITY.
 */
function hostAuthorityLevel(host: string): string {
  // Delegate to the shared classifier so cross-source claim weighting recognises
  // the full global Catholic source ecosystem (the explicit registry, the Holy
  // See `.va` TLD, and diocesan/order/university patterns for lesser-known
  // sources) rather than a handful of hard-coded hosts.
  return classifyHostAuthority(host);
}

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

/** Top Catholic authorities whose single source is strong enough to verify on. */
export async function runCrossSourceVerification(
  prisma: PrismaClient,
  passId: string,
): Promise<DispatchOutcome> {
  // Spec §5: verify package artifacts BEFORE publishing — not
  // already-published rows. The verifier picks the most recent
  // BUILD_READY artifact whose validation needs haven't been
  // recorded yet, looks up the right validation sources via the
  // resolver, and persists per-field evidence.

  // Human QA review is tracked via humanReviewQueue, not this stage; the
  // cross-source pass never blocks on it.
  const pending: number = 0;

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
      const { fetchAndCompareValidation, findCorpusValidationEvidence } =
        await import("./validation-fetcher");
      const { REQUIRED_FACTS } = await import("./cross-source-verifier");
      const fields = (artifact.extractedFields as Record<string, unknown>) ?? {};
      const skipNetwork = process.env.ADMIN_WORKER_SKIP_NETWORK === "1";
      // The artifact's own source host — a corpus witness must be INDEPENDENT,
      // so reads from this host are never counted as evidence for it.
      const primaryRead = artifact.sourceReadId
        ? await prisma.adminWorkerSourceRead
            .findUnique({ where: { id: artifact.sourceReadId }, select: { sourceHost: true } })
            .catch(() => null)
        : null;

      // Fetch validation for EXACTLY the fields the verifier will check
      // (REQUIRED_FACTS) — unioned with the package's validationNeeds.
      // Previously this fetched only validationNeeds while the verifier
      // checked REQUIRED_FACTS, so the two never lined up and every field
      // came back MISSING (a doctrinally-sensitive artifact could never
      // gather evidence and so could never publish).
      const requiredFacts =
        (REQUIRED_FACTS as Record<string, string[]>)[artifact.contentType] ?? [];
      // DERIVED fields are dropped: SAINT's feastMonth ("10") and
      // feastDayNumber ("4") are computed from feastDay, and a bare 1-2 digit
      // number cannot be substring-verified on any page (every page contains
      // it). They are verified exactly when their parent field is (WX-03).
      const fieldsToVerify = [...new Set([...requiredFacts, ...artifact.validationNeeds])].filter(
        (f) => derivedParentField(artifact.contentType, f) === null,
      );
      // A corroborating page is about the ENTITY, not the source page's title:
      // "St. Francis of Assisi - Saints & Angels - Catholic Online" appears on
      // exactly one host, so the corpus witness search could never hit.
      const entityHint = entityHintFor(artifact.contentType, fields, artifact.normalizedTitle);

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
        const rawExpectedValue = verifiableExpectedString(expected);
        if (!rawExpectedValue) continue;
        // Compare the form an INDEPENDENT page would actually print. The
        // extractor emits schema shapes — a feast day as "10-04", a name as
        // "Saint Francis of Assisi - Catholic Online" — that no real source
        // carries verbatim, so substring comparison could never MATCH and the
        // artifact looped verify → NEEDS_REPAIR → verify forever (WX-03).
        const variants = expectedValueVariants(artifact.contentType, field, rawExpectedValue);
        if (!variants.primary) continue;
        const expectedValue = variants.primary;
        const evidence = await fetchAndCompareValidation(prisma, {
          contentType: artifact.contentType,
          field,
          expectedValue: expectedValue.slice(0, 200),
          // Let one probe fetch be judged against every printable form.
          expectedValueVariants: variants.all.map((v) => v.slice(0, 200)),
          slugHint: artifact.normalizedSlug,
          maxSources: 2,
          skipNetwork,
        }).catch(() => [] as Awaited<ReturnType<typeof fetchAndCompareValidation>>);
        // Corpus fallback: when the live probes produced no MATCH for this
        // field, consult the worker's stored source-reads — an independent
        // approved host whose page states this fact about this entity is
        // cross-source evidence too (see findCorpusValidationEvidence). This
        // is what lets evidence-gathering converge as the corpus grows,
        // instead of sensitive artifacts parking NEEDS_REPAIR forever because
        // a handful of hardcoded probe URLs 404'd.
        if (!evidence.some((e) => e.matchStatus === "MATCH")) {
          // Try every comparable form of the fact: a stored read may state
          // "October 4" where the artifact holds "10-04".
          for (const variant of variants.all) {
            const corpus = await findCorpusValidationEvidence(prisma, {
              field,
              expectedValue: variant.slice(0, 200),
              entityHint,
              excludeHost: primaryRead?.sourceHost ?? null,
            }).catch(() => []);
            if (corpus.length > 0) {
              evidence.push(...corpus);
              break;
            }
          }
        }
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

      // Claim-level authority resolution (intelligence brain, ADVISORY). Build
      // claims from the candidate + each validation source and let the brain
      // resolve conflicts by Catholic authority (e.g. vatican.va outranks a
      // community source). Recorded to the audit trail (dashboard); it never
      // overrides the deterministic verifier outcome above. Fail-open +
      // brain-gated.
      try {
        const { isBrainEnabled } = await import("./intelligence");
        if (isBrainEnabled() && validationSources.length > 0) {
          const { resolveClaimWithAuthority } = await import("./intelligence");
          const { recordBrainCall } = await import("./intelligence/store");
          const claims: Array<{
            subject: string;
            predicate: string;
            value: string;
            authority_level: string;
            source: string;
          }> = [];
          const subject = artifact.normalizedSlug;
          // One claim per (validation source, field): each source's value
          // carries its host's Catholic authority, so the brain can adjudicate
          // disagreements by authority rather than by majority vote.
          for (const field of fieldsToVerify) {
            for (const vs of validationSources) {
              const v = vs.fields[field];
              if (v != null && v !== "")
                claims.push({
                  subject,
                  predicate: field,
                  value: String(v),
                  authority_level: hostAuthorityLevel(vs.host),
                  source: vs.host,
                });
            }
          }
          if (claims.length >= 2) {
            const env = await resolveClaimWithAuthority(claims);
            await recordBrainCall(prisma, "resolve_claim_with_authority", env, {
              contentType: artifact.contentType,
              entityId: artifact.id,
            });
          }
        }
      } catch {
        // Claim-level resolution is advisory — never break verification.
      }

      // Deterministic conflict adjudication (spec §19). Where two validation
      // sources assert DIFFERENT values for the same field, the worker records
      // both claims, compares source authority, then recency, then
      // corroboration — and escalates a genuinely unresolved disagreement to
      // review instead of quietly keeping whichever page it read first. The
      // adjudication is remembered, so the same disagreement is not
      // re-escalated every time the artifact is verified again.
      try {
        const { adjudicateAndRecord } = await import("./conflict-resolution");
        for (const field of fieldsToVerify) {
          const claims = validationSources
            .map((vs) => ({ host: vs.host, url: vs.url, value: vs.fields[field] }))
            .filter((c): c is { host: string; url: string; value: unknown } => {
              return c.value != null && String(c.value).trim() !== "";
            });
          const distinct = new Set(claims.map((c) => String(c.value).trim().toLowerCase()));
          if (claims.length < 2 || distinct.size < 2) continue;

          await adjudicateAndRecord(prisma, {
            field: `${artifact.contentType}.${field}`,
            contentType: artifact.contentType,
            contentTitle: artifact.normalizedTitle,
            passId,
            candidates: claims.map((c) => ({
              value: String(c.value),
              sourceUrl: c.url,
              sourceHost: c.host,
              authorityLevel: hostAuthorityLevel(c.host),
              corroborations: 1,
            })),
          });
        }
      } catch {
        // Conflict adjudication must never break the verification stage.
      }

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

    // Verification is by CROSS-SOURCE evidence only — no external AI confirmation.
    // An artifact clears when independent approved sources agree on its sensitive
    // facts (recorded as MATCH/PASS above). When they don't (unreachable or
    // disagreeing), the artifact stays blocked and routes to a validation repair
    // that rotates to another source, rather than being waved through by an AI.
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
      // Bounded rounds. The VALIDATION_EVIDENCE_MISSING repair resets the
      // artifact to BUILD_READY, which brings it straight back here — so
      // without a bound an entity no approved probe carries recycles through
      // verification forever, re-fetching the same pages every round (WX-03).
      // Each round leaves one durable plan row, so counting them counts the
      // rounds. Once the budget is spent the artifact is parked NEEDS_REVIEW:
      // it leaves every pipeline queue, publishes nothing (unverified content
      // never publishes), and is surfaced for a person.
      const priorRounds = await prisma.adminWorkerRepairPlan
        .count({ where: { kind: "VALIDATION_EVIDENCE_MISSING", failedEntity: artifact.id } })
        .catch(() => 0);
      const exhausted = priorRounds >= MAX_VERIFICATION_ROUNDS;
      if (!exhausted) {
        const { filePlan } = await import("./repair-plans");
        await filePlan(prisma, {
          kind: "VALIDATION_EVIDENCE_MISSING",
          failedEntity: artifact.id,
          repairAction: `Fetch + compare validation sources for ${missing.join(", ")} on ${artifact.contentType}/${artifact.normalizedSlug}.`,
          metadata: { artifactId: artifact.id, contentType: artifact.contentType, missing },
        }).catch(() => undefined);
      }
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: {
            status: exhausted ? "NEEDS_REVIEW" : "NEEDS_REPAIR",
            rejectionReason: exhausted
              ? `no cross-source evidence for ${missing.join(", ")} after ${priorRounds} verification round(s)`
              : `missing cross-source evidence for ${missing.join(", ")}`,
            gateDiagnosis: exhausted ? "VALIDATION_EVIDENCE_EXHAUSTED" : undefined,
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

export async function runStrictQA(prisma: PrismaClient, passId: string): Promise<DispatchOutcome> {
  // Spec §3: find BUILD_READY / VERIFICATION_READY artifacts without a
  // strict-QA result, score the 7 dimensions, persist the result via
  // recordStrictQA, and transition the artifact status:
  //   PASSED       → QA_PASSED
  //   NEEDS_REPAIR → NEEDS_REVIEW  (review-band hold; see below)
  //   FAILED       → REJECTED
  const { recordStrictQA, getStrictQAResult } = await import("./strict-qa");

  // Select exactly what this stage can actually score — the brain's own
  // predicate. Selecting every BUILD_READY row and then skipping the ones with
  // validationNeeds meant ten old artifacts cycling through verification could
  // fill the whole window, so newer QA-able artifacts were never scored and
  // nothing published even though the funnel "had" ready items (WX-10).
  const candidates = await prisma.adminWorkerPackageArtifact
    .findMany({
      where: {
        OR: [
          { status: "VERIFICATION_READY" },
          { status: "BUILD_READY", validationNeeds: { isEmpty: true } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    })
    .catch((err) => {
      // A schema/DB error here (e.g. P2022: a column the client selects is
      // missing from the deployed DB) must NOT be silently read as "no
      // artifacts" — that stalls the whole publish funnel invisibly. Log it
      // loudly; the schema-integrity rating + startup alert name the column.
      reportQueryError("STRICT_QA candidate fetch", err);
      return [] as Array<Awaited<ReturnType<typeof prisma.adminWorkerPackageArtifact.findFirst>>>;
    });

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
    //
    // A dimension that PASSES scores 1.0, not 0.9. The old flat 0.9 caps (plus
    // a flat 0.8 formatting default no extractor ever overrode) put the maximum
    // reachable finalScore at 0.79 + 0.15·confidence ≈ 0.92 — below the 0.95
    // doctrinal threshold, so every complete, corroborated APPARITION /
    // SACRAMENT / CHURCH_DOCUMENT artifact landed in the review band and none
    // could ever publish from the web path (WX-02). The bar is still real: a
    // thin artifact loses completeness + provenance proportionally, formatting
    // now reflects an actual markup/boilerplate check, and any zero dimension
    // is still a hard FAIL.
    const requiredCount = Math.max(provenance.length + missing.length, 1);
    const completenessScore = Math.max(0, Math.min(1, 1 - missing.length / requiredCount));
    const correctnessScore = Math.max(0, Math.min(1, artifact.confidenceScore ?? 0));
    const formattingMetadata = (artifact.formattingMetadata as Record<string, unknown>) ?? {};
    const formattingScore = formattingQualityScore(fields, formattingMetadata);
    const provenanceScore =
      provenance.length > 0 ? Math.min(1, provenance.length / requiredCount) : 0;

    // Validation evidence: look for a CrossSourceVerification row for
    // this artifact. If validationNeeds is empty, no evidence is required, but
    // the dimension stays at 0.9 — uncorroborated content is not as strong as
    // content two independent sources agree on.
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
      validationScore = verification > 0 ? 1 : 0;
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
    const duplicateSafetyScore = duplicate === 0 ? 1 : 0;

    // Public readiness: title + slug + payload present.
    const publicReadinessScore =
      artifact.normalizedTitle && artifact.normalizedSlug && Object.keys(fields).length > 0 ? 1 : 0;

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

export async function runPersistAndPublish(
  prisma: PrismaClient,
  _workerId: string,
  passId: string,
  opts: { allowSensitive?: boolean } = {},
): Promise<DispatchOutcome> {
  // Spec §13: PERSIST/PUBLIC_PUBLISH route through runPublishOrchestrator
  // when a BUILD_READY artifact exists. The orchestrator handles the
  // quality-gate, duplicate, slug, public-route, persistence, content-
  // goal refresh, search, sitemap, and cache side effects in one
  // transaction. When no artifact is ready the publish stage is idle —
  // there is no build/publish fallback.
  // Spec §6: publish reads QA_PASSED artifacts; the orchestrator gate
  // requires a passing AdminWorkerStrictQAResult.
  // Publish ONLY QA_PASSED artifacts. A BUILD_READY artifact has not yet
  // been through strict QA (it has no AdminWorkerStrictQAResult row), so
  // including it here caused the publish stage to pick it, fail the
  // strict-QA gate ("no AdminWorkerStrictQAResult row"), and wrongly
  // REJECT a perfectly good artifact that was simply waiting its turn at
  // the STRICT_QA stage.
  // Deterministic publish is decoupled from the Python brain: content that has
  // passed strict QA (+ stored cross-source evidence, enforced by the publish
  // orchestrator) is safe to publish regardless of brain mode. The ONLY carve-
  // out is doctrinally-sensitive content (APPARITION / SACRAMENT /
  // CHURCH_DOCUMENT), which still waits for the active brain — so when the caller
  // is degraded (`allowSensitive === false`) those types are skipped here.
  const { DOCTRINALLY_SENSITIVE_TYPES } = await import("./content-type-profiles");
  const artifact = await prisma.adminWorkerPackageArtifact
    .findFirst({
      where: {
        status: "QA_PASSED",
        ...(opts.allowSensitive === false
          ? { contentType: { notIn: [...DOCTRINALLY_SENSITIVE_TYPES] } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    })
    .catch(() => null);

  if (artifact) {
    const { runPublishOrchestrator } = await import("./publish-orchestrator");
    // Single source of truth: the content-type profile decides doctrinal
    // sensitivity (and thus whether the cross-source verifier is required).
    const { isDoctrinallySensitive } = await import("./content-type-profiles");
    const isDoctrinal = isDoctrinallySensitive(artifact.contentType);
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

    // The authority stamped on a published row must be the authority of the
    // host it came from. Every web artifact used to publish as "VATICAN"
    // regardless of source, which inflated the source-authority factor in the
    // quality score and lied to every reader of PublishedContent.authorityLevel
    // (WX-09). classifyHostAuthority returns VATICAN only for the Holy See.
    const sourceRead = artifact.sourceReadId
      ? await prisma.adminWorkerSourceRead
          .findUnique({
            where: { id: artifact.sourceReadId },
            select: { sourceHost: true, sourceUrl: true },
          })
          .catch(() => null)
      : null;
    const sourceHost = sourceRead?.sourceHost ?? null;
    const authorityLevel = sourceHost ? hostAuthorityLevel(sourceHost) : "COMMUNITY";

    // PRAYER: publish the SCHEMA payload, not the raw extractor fields. A web
    // prayer used to persist as {prayerTitle, prayerType, prayerText, category:
    // "PRAYER"} — no body, no slug, no citations, no language, and the literal
    // "PRAYER" printed as its category on the public rails — and it never went
    // through validatePayload, so schema rules (body length, ≥1 citation) were
    // bypassed on this path only (PR-04). A payload the schema refuses is NOT
    // published: it routes to repair like any other incomplete package.
    let publishPayload = artifact.extractedFields as Record<string, unknown>;
    if (publishableType === "PRAYER") {
      const prayerPayload = buildPrayerPublishPayload({
        fields: publishPayload,
        title: artifact.normalizedTitle,
        slug: artifact.normalizedSlug,
        host: sourceHost,
        sourceUrl: sourceRead?.sourceUrl ?? null,
      });
      if (!prayerPayload.ok) {
        const reason = `prayer payload failed schema validation: ${prayerPayload.errors.slice(0, 3).join("; ")}`;
        await prisma.adminWorkerPackageArtifact
          .update({
            where: { id: artifact.id },
            data: { status: "NEEDS_REPAIR", rejectionReason: reason.slice(0, 480) },
          })
          .catch(() => undefined);
        const { filePlan } = await import("./repair-plans");
        await filePlan(prisma, {
          kind: "EXTRACT_FAILED",
          failedEntity: artifact.id,
          repairAction: `Re-extract PRAYER/${artifact.normalizedSlug} from another approved source: ${reason}`,
          metadata: { artifactId: artifact.id, errors: prayerPayload.errors.slice(0, 10) },
        }).catch(() => undefined);
        await writeAdminWorkerLog(prisma, {
          passId,
          category: "PUBLISHING",
          severity: "WARN",
          eventName: "prayer_payload_invalid",
          message: `Refused to publish PRAYER/${artifact.normalizedSlug}: ${reason}`,
          contentType: "PRAYER",
          safeMetadata: { artifactId: artifact.id, errors: prayerPayload.errors.slice(0, 10) },
        }).catch(() => undefined);
        return {
          stage: "PUBLIC_PUBLISH",
          kind: "repair-planned",
          summary: reason,
          repairsPlanned: 1,
          metadata: { artifactId: artifact.id, reason: "prayer_payload_invalid" },
        };
      }
      publishPayload = prayerPayload.payload;
    }

    const result = await runPublishOrchestrator(prisma, {
      contentType: publishableType,
      contentId: artifact.checklistItemId ?? artifact.id,
      title: artifact.normalizedTitle,
      slug: artifact.normalizedSlug,
      payload: publishPayload as never,
      authorityLevel,
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
    const pubHost = sourceHost;
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
    let reviewRouted: ReviewRouting = "terminal";
    if (result.kind === "published") {
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: artifact.id },
          data: { status: "PUBLISHED", publishedContentId: result.publishedContentId },
        })
        .catch(() => undefined);
      const { clearRetryBudget } = await import("./human-review");
      await clearRetryBudget(prisma, "review", artifact.id);
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
      //
      // In autonomous mode a parked item is never looked at again, so a
      // "review" for a transient reason (brain offline, advisory panel, a
      // score just under the bar) was a permanent dead end. Route those on:
      // score-band reasons file a re-extraction repair (like the "repair"
      // branch); advisory/transient reasons stay NEEDS_REVIEW but carry a
      // backed-off retry the build-ready drain honours. Both are bounded by
      // the per-artifact retry budget; once spent, the item stays parked.
      reviewRouted = await routeReviewOutcome(prisma, {
        artifactId: artifact.id,
        contentType: publishableType,
        slug: artifact.normalizedSlug,
        reason: result.reason,
        finalScore: qualitySignal,
      });
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

    const reviewIsRepair = result.kind === "review" && reviewRouted === "repair";
    return {
      stage: "PUBLIC_PUBLISH",
      kind:
        result.kind === "published"
          ? "advanced"
          : result.kind === "blocked"
            ? "rejected"
            : result.kind === "duplicate"
              ? "idle"
              : result.kind === "repair" || reviewIsRepair
                ? "repair-planned"
                : "rejected",
      summary: `Publish orchestrator: ${result.kind} (${result.reason})${
        result.kind === "review" && reviewRouted !== "terminal"
          ? ` → autonomous ${reviewRouted}`
          : ""
      }.`,
      built: result.kind === "published" ? 1 : 0,
      published: result.kind === "published" ? 1 : 0,
      rejected: result.kind === "blocked" || (result.kind === "review" && !reviewIsRepair) ? 1 : 0,
      repairsPlanned: result.kind === "repair" || reviewIsRepair ? 1 : 0,
      metadata: {
        artifactId: artifact.id,
        kind: result.kind,
        reviewRouted: result.kind === "review" ? reviewRouted : undefined,
      },
    };
  }

  // Spec §6 follow-up: there is no publish fallback. A path that
  // bypasses strict QA + ContentQualityScore is forbidden. With no
  // BUILD_READY or QA_PASSED artifact, publishing is idle — content gets
  // built into an artifact first (PACKAGE_BUILD stage), strict-QA
  // processes it, then this stage publishes via runPublishOrchestrator.
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "PUBLISHING",
    severity: "INFO",
    eventName: "publish_pass_idle",
    message:
      "No BUILD_READY/QA_PASSED artifacts; publish stage idle. (Strict-QA + quality-score gate is enforced.)",
  });
  return idle(
    "PUBLIC_PUBLISH",
    "No artifacts ready; publish path requires a passing AdminWorkerStrictQAResult.",
  );
}

type ReviewRouting = "repair" | "retry" | "terminal";

/**
 * Autonomous routing for a publish outcome of "review" (finding: review
 * outcomes were terminal). Returns how the artifact was routed:
 *   - "repair": QUALITY_SCORE_FAILED plan filed + NEEDS_REPAIR (re-extraction)
 *   - "retry":  NEEDS_REVIEW with a backed-off retry the drain will honour
 *   - "terminal": NEEDS_REVIEW, left for a person (human-review mode, a
 *                 non-recoverable reason, or the retry budget is spent)
 */
async function routeReviewOutcome(
  prisma: PrismaClient,
  input: {
    artifactId: string;
    contentType: string;
    slug: string;
    reason: string;
    finalScore: number;
  },
): Promise<ReviewRouting> {
  const park = async (rejectionReason: string) => {
    await prisma.adminWorkerPackageArtifact
      .update({
        where: { id: input.artifactId },
        data: { status: "NEEDS_REVIEW", rejectionReason },
      })
      .catch(() => undefined);
  };

  const { requireHumanReview } = await import("./policy");
  if (requireHumanReview()) {
    await park(input.reason);
    return "terminal";
  }

  const { classifyReviewReason, consumeRetryBudget } = await import("./human-review");
  const { CONFIDENCE_THRESHOLDS } = await import("./decisions");
  const { route } = classifyReviewReason(input.reason);
  // A score under the human-review floor is a reject, not a review; never
  // spend repair effort on it.
  if (route === "terminal" || input.finalScore < CONFIDENCE_THRESHOLDS.humanReview) {
    await park(input.reason);
    return "terminal";
  }

  const budget = await consumeRetryBudget(prisma, "review", input.artifactId, {
    reason: input.reason,
  });
  if (!budget.allowed) {
    await park(
      `${input.reason} [retry budget spent after ${budget.attempts - 1} autonomous attempts]`,
    );
    return "terminal";
  }

  if (route === "repair") {
    const { filePlan } = await import("./repair-plans");
    await filePlan(prisma, {
      kind: "QUALITY_SCORE_FAILED",
      failedEntity: input.artifactId,
      repairAction: `Re-extract ${input.contentType}/${input.slug}; publish gate returned review (${input.reason}).`,
      metadata: {
        contentType: input.contentType,
        slug: input.slug,
        reason: input.reason,
        attempt: budget.attempts,
        origin: "review-band",
      },
    }).catch(() => undefined);
    await prisma.adminWorkerPackageArtifact
      .update({
        where: { id: input.artifactId },
        data: { status: "NEEDS_REPAIR", rejectionReason: input.reason },
      })
      .catch(() => undefined);
    return "repair";
  }

  // "retry": the drain re-queues it as QA_PASSED once nextRetryAt passes.
  await park(input.reason);
  return "retry";
}

/**
 * Call `delegate[method](arg)`, tolerating a client (or a test mock) that does
 * not have it. Every post-publish read is best-effort: verification coverage
 * must never be able to fail a dispatch.
 */
async function callOptional<T>(
  delegate: Record<string, unknown> | undefined,
  method: string,
  arg: unknown,
  fallback: T,
): Promise<T> {
  const fn = delegate?.[method];
  if (typeof fn !== "function") return fallback;
  try {
    return ((await (fn as (a?: unknown) => Promise<T>).call(delegate, arg)) ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Where the whole-catalog verification sweep has got to. */
const POST_PUBLISH_SWEEP_CURSOR_KEY = "post-publish-verify:sweep-offset";
const POST_PUBLISH_SWEEP_PAGE = 50;

/**
 * The next page of the whole-catalog verification sweep, advancing (and
 * wrapping) a durable offset. Fail-open: a memory-store error returns the
 * first page, which is still better than never looking past the newest rows.
 */
async function nextPostPublishSweepWindow(
  prisma: PrismaClient,
): Promise<Array<{ id: string; contentType: string; slug: string; title: string }>> {
  const where = {
    memoryType_memoryKey: {
      memoryType: "GENERIC" as const,
      memoryKey: POST_PUBLISH_SWEEP_CURSOR_KEY,
    },
  };
  const memory = prisma.adminWorkerMemory as unknown as Record<string, unknown> | undefined;
  const content = prisma.publishedContent as unknown as Record<string, unknown> | undefined;
  let offset = 0;
  const row = await callOptional<{ memoryValue?: unknown } | null>(
    memory,
    "findUnique",
    { where, select: { memoryValue: true } },
    null,
  );
  const v = row?.memoryValue;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const n = Number((v as Record<string, unknown>).offset);
    if (Number.isFinite(n) && n > 0) offset = Math.trunc(n);
  }
  const total = await callOptional<number>(content, "count", { where: { isPublished: true } }, 0);
  if (total === 0) return [];
  if (offset >= total) offset = 0;
  const page = await callOptional<
    Array<{ id: string; contentType: string; slug: string; title: string }>
  >(
    content,
    "findMany",
    {
      where: { isPublished: true },
      orderBy: { publishedAt: "asc" },
      skip: offset,
      take: POST_PUBLISH_SWEEP_PAGE,
      select: { id: true, contentType: true, slug: true, title: true },
    },
    [],
  );
  const nextOffset =
    offset + POST_PUBLISH_SWEEP_PAGE >= total ? 0 : offset + POST_PUBLISH_SWEEP_PAGE;
  await callOptional(
    memory,
    "upsert",
    {
      where,
      update: { memoryValue: { offset: nextOffset }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: POST_PUBLISH_SWEEP_CURSOR_KEY,
        memoryValue: { offset: nextOffset },
        lastUsedAt: new Date(),
      },
    },
    null,
  );
  return page;
}

async function runPostPublishVerify(
  prisma: PrismaClient,
  passId: string,
): Promise<DispatchOutcome> {
  const { verifyPublished } = await import("./post-publish-probe");
  const { FAIL_CONFIRMATION_GAP_MS } = await import("./post-publish");
  // The latest verification per item decides eligibility:
  //   - none          → verify
  //   - FAIL (first strike) older than the confirmation gap → re-probe, so the
  //                     two-strike rule can confirm or clear it
  //   - WARN older than a day → re-probe (it was "unverified", not verified)
  //   - anything else → already verified
  // Prisma's `distinct` honours `orderBy`, so this yields the newest row per
  // contentId.
  const latestRows = await prisma.postPublishVerification
    .findMany({
      distinct: ["contentId"],
      orderBy: { createdAt: "desc" },
      select: { contentId: true, result: true, createdAt: true },
    })
    .catch(() => [] as Array<{ contentId: string; result: string; createdAt: Date }>);
  const latestByContent = new Map(latestRows.map((r) => [r.contentId, r]));
  // How many times each row has come back WARN. A WARN is "unverified", not
  // "broken" — and post-publish-probe.ts degrades a missing or mismatched
  // origin to WARN on EVERY check, so an origin misconfiguration made all 50
  // rows in the window permanently eligible and the stage cycled them forever
  // at one per dispatch. Backing the re-probe off per strike turns that into a
  // handful of probes instead of an endless loop.
  const warnCounts = new Map<string, number>();
  const warnGroups = await callOptional<Array<{ contentId: string; _count: { _all: number } }>>(
    prisma.postPublishVerification as unknown as Record<string, unknown>,
    "groupBy",
    { by: ["contentId"], where: { result: "WARN" }, _count: { _all: true } },
    [],
  );
  for (const g of warnGroups) warnCounts.set(g.contentId, g._count._all);

  const now = Date.now();
  const WARN_REPROBE_MS = 24 * 60 * 60 * 1000;
  /** Cap the backoff so a row is still re-checked about weekly, not never. */
  const WARN_REPROBE_MAX_MULTIPLIER = 7;
  const eligible = (id: string): boolean => {
    const v = latestByContent.get(id);
    if (!v) return true;
    const age = now - new Date(v.createdAt).getTime();
    if (v.result === "FAIL") return age >= FAIL_CONFIRMATION_GAP_MS;
    if (v.result === "WARN") {
      const strikes = Math.max(1, warnCounts.get(id) ?? 1);
      return age >= WARN_REPROBE_MS * Math.min(strikes, WARN_REPROBE_MAX_MULTIPLIER);
    }
    return false;
  };

  // TWO windows, because "the newest 50 by publishedAt" can never reach the
  // rest of the catalog: whatever is in that window is re-probed forever while
  // the other ~3,400 published rows are never verified at all. The second
  // window walks the whole catalog on a durable cursor, so coverage is
  // eventual rather than never.
  const recent = await prisma.publishedContent.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: { id: true, contentType: true, slug: true, title: true },
  });
  const sweep = await nextPostPublishSweepWindow(prisma);
  const candidates = [...recent, ...sweep].filter(
    (row, i, all) => all.findIndex((r) => r.id === row.id) === i,
  );
  // Unconfirmed first strikes go first: they are the rows whose fate is open.
  const target =
    candidates.find((c) => latestByContent.get(c.id)?.result === "FAIL" && eligible(c.id)) ??
    candidates.find((c) => eligible(c.id));
  if (!target) {
    return idle("POST_PUBLISH_VERIFY", "All published content already verified.");
  }
  // Spec §14: production post-publish must perform a real HTTP
  // probe. `ADMIN_WORKER_SKIP_NETWORK=1` is honoured for tests so the
  // unit suite doesn't hit the network.
  const skipNetwork = process.env.ADMIN_WORKER_SKIP_NETWORK === "1";
  // A THROWN verification (DB blip while recording, unexpected error) is not
  // evidence about the page: it maps to WARN and never reaches the rollback
  // tree. Only a FAIL the probe itself confirmed (two strikes) does.
  const verification = await verifyPublished(prisma, {
    contentType: target.contentType,
    contentId: target.id,
    slug: target.slug,
    expectedTitle: target.title,
    skipNetwork,
  }).catch(
    (e) =>
      ({
        verificationId: "",
        result: "WARN" as const,
        observed: "WARN" as const,
        failureConfirmed: false,
        checks: {} as never,
        publicUrl: "",
        thrown: e instanceof Error ? e.message : String(e),
      }) as Awaited<ReturnType<typeof verifyPublished>> & { thrown?: string },
  );
  const thrown = (verification as { thrown?: string }).thrown;
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "POST_PUBLISH",
    severity: verification.result === "PASS" ? "INFO" : "WARN",
    eventName: "post_publish_verified",
    message: `Verified ${target.contentType}/${target.slug}: ${verification.result}${
      thrown ? ` (verification threw: ${thrown})` : ""
    }.`,
    contentType: target.contentType,
    relatedEntityId: target.id,
    safeMetadata: {
      result: verification.result,
      observed: verification.observed,
      failureConfirmed: verification.failureConfirmed,
      thrown: thrown ?? null,
    },
  });

  // Feed source reputation — post-publish success is the strongest
  // signal (spec §16). We pull the source host from the most recent
  // build job for this checklist item, best-effort. Only a confirmed FAIL
  // counts against the host: WARN means "unverified", not "broken".
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
      ok: verification.result !== "FAIL",
    }).catch(() => undefined);
  }

  // Spec §8: when post-publish verification fails, drive the decision
  // tree (repair → re-verify → unpublish → DELETED / HUMAN_REVIEW)
  // rather than just logging the failure. The reverify callback
  // re-runs verifyPublished so REPAIRED is only declared when the
  // public surface is actually fixed. This is the ONE place that
  // rolls back — verifyPublished itself never unpublishes.
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
      reason: `verifyPublished returned FAIL on ${failedCheck} (confirmed by two probes ≥ ${Math.round(
        FAIL_CONFIRMATION_GAP_MS / 60_000,
      )} min apart).`,
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

  // PASS = verified; WARN = unverified (transport / origin / secondary
  // surface) — neither is a rejection of the content. Only a confirmed
  // FAIL is.
  const displayed =
    verification.result === "PASS" ||
    (verification.checks as { publicPageCheck?: string } | undefined)?.publicPageCheck === "PASS";
  return {
    stage: "POST_PUBLISH_VERIFY",
    kind: verification.result === "FAIL" ? "rejected" : displayed ? "advanced" : "idle",
    summary: `Verified ${target.contentType}/${target.slug}: ${verification.result}${
      verification.result === "WARN" ? " (unverified — will re-probe)" : ""
    }.`,
    rejected: verification.result === "FAIL" ? 1 : 0,
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
  const { verifySitemap, liveProbeEnabled } = await import("./search-sitemap-cache-verifiers");
  const result = await verifySitemap(prisma, {
    contentType: target.contentType,
    slug: target.slug,
    probeLive: liveProbeEnabled(),
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

  const { verifyCacheFreshness, liveProbeEnabled } =
    await import("./search-sitemap-cache-verifiers");
  const result = await verifyCacheFreshness(prisma, {
    contentType: target.contentType,
    slug: target.slug,
    probeLive: liveProbeEnabled(),
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
        reconciled: orchestrator.plansReconciled,
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
  // Reporting bundles diagnostics + growth orchestrator + source coverage so
  // the admin UI always has fresh "why content isn't growing" and "where
  // source coverage is thin" panels (spec §22, §23).
  //
  // Both halves are THROTTLED. The governor's terminal fallback forces
  // REPORTING whenever it intervenes, and this stage used to run the whole
  // bundle unthrottled on every one of those passes: ~250 diagnostic queries
  // and one AdminWorkerGrowthSnapshot insert per goal, at the ~1s loop
  // cadence — growing that table without bound and spending the production
  // database on reporting instead of on fetching content (DG-5).
  const { maybeRunReportingPass } = await import("./reporting-pass");
  const reporting = await maybeRunReportingPass(prisma, { passId }).catch(() => null);
  const ratings = (await runThrottledDiagnostics(prisma)) ?? [];
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "REPORT",
    severity: "INFO",
    eventName: "diagnostics_dispatch",
    message: reporting?.ran
      ? `Reporting pass: ${ratings.length} ratings checked, ${reporting.growthAssessed} growth assessment(s) (${reporting.repairPlansFiled} repair plan(s)), ${reporting.coverageRows} coverage row(s).`
      : `Reporting pass: ${ratings.length} ratings checked; growth + coverage throttled (they run hourly).`,
    safeMetadata: {
      ratingsCount: ratings.length,
      growthAssessments: reporting?.growthAssessed ?? 0,
      repairPlansFiled: reporting?.repairPlansFiled ?? 0,
      coverageRows: reporting?.coverageRows ?? 0,
      throttled: !reporting?.ran,
    },
  });
  return {
    stage: "REPORTING",
    kind: "advanced",
    summary: reporting?.ran
      ? `Reporting pass: ${ratings.length} ratings, ${reporting.growthAssessed} growth, ${reporting.coverageRows} coverage row(s).`
      : `Reporting pass: ${ratings.length} ratings; growth + coverage throttled.`,
    metadata: {
      ratingsCount: ratings.length,
      growthAssessments: reporting?.growthAssessed ?? 0,
      repairPlansFiled: reporting?.repairPlansFiled ?? 0,
      throttled: !reporting?.ran,
    },
  };
}

/** Diagnostics are expensive (~50 ratings incl. full-row schema reads + an egress probe). */
const DIAGNOSTICS_THROTTLE_MS = 15 * 60 * 1000;
const DIAGNOSTICS_THROTTLE_KEY = "reporting-diagnostics-lastrun";

/**
 * Run the diagnostics bundle at most every 15 minutes; null when throttled.
 * Fail-open: a throttle-store error runs the diagnostics rather than skipping
 * them, because a stale ratings panel is the worse failure.
 */
async function runThrottledDiagnostics(prisma: PrismaClient): Promise<Array<unknown> | null> {
  const where = {
    memoryType_memoryKey: {
      memoryType: "GENERIC" as const,
      memoryKey: DIAGNOSTICS_THROTTLE_KEY,
    },
  };
  try {
    const row = await prisma.adminWorkerMemory
      .findUnique({ where, select: { lastUsedAt: true } })
      .catch(() => null);
    const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
    if (last > 0 && Date.now() - last < DIAGNOSTICS_THROTTLE_MS) return null;
    await prisma.adminWorkerMemory
      .upsert({
        where,
        update: { lastUsedAt: new Date() },
        create: {
          memoryType: "GENERIC",
          memoryKey: DIAGNOSTICS_THROTTLE_KEY,
          memoryValue: {},
          lastUsedAt: new Date(),
        },
      })
      .catch(() => undefined);
  } catch {
    // Throttle store unavailable — run the diagnostics rather than skip them.
  }
  const { runAdminWorkerDiagnostics } = await import("./diagnostics");
  return runAdminWorkerDiagnostics(prisma).catch(() => []);
}

async function runMaintenance(
  prisma: PrismaClient,
  passId: string,
  decision: BrainDecision,
): Promise<DispatchOutcome> {
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

  // Prayer language coverage. Drive Latin/Greek onto every published prayer
  // through the certified skill runtime (so it is recorded in the skill ledger +
  // capability matrix like any other certified work). When the Python final
  // brain is active (full autonomy) the worker BUILDS the authentic translation
  // itself with the deterministic liturgical engine and publishes it into the
  // prayer's payload; in safe-degraded mode it still reports coverage and routes
  // any genuine gap to review. Best-effort — never breaks the maintenance pass.
  const brainActive = decision.finalBrain === "python";
  let translationDetail = "prayer translations: skipped";
  try {
    const { runSkillPlan } = await import("./skills");
    const t = await runSkillPlan(prisma, {
      missionStage: "MAINTENANCE",
      intendedSkill: "ensure_prayer_translations",
      passId,
      brainActive,
      input: {},
    });
    const step = t.executed.find((e) => e.skill === "ensure_prayer_translations");
    translationDetail = `prayer translations: ${step?.outcome ?? (t.blocked ? "blocked" : "not executed")}`;
  } catch {
    // best-effort — translation coverage must never break the maintenance pass
  }

  const safe = JSON.parse(JSON.stringify({ cleanup, memoryDecay, reputationDecay }));
  await writeAdminWorkerLog(prisma, {
    passId,
    category: "CLEANUP",
    severity: "INFO",
    eventName: "maintenance_dispatch",
    message: `Maintenance: ${cleanup.staleCandidatesRemoved} stale candidate(s), ${cleanup.expiredReviewsClosed} expired review(s) closed; memory decayed=${memoryDecay.decayed}, pruned=${memoryDecay.pruned}; reputation decayed=${reputationDecay.decayed}, demoted=${reputationDecay.demoted}, retestable=${reputationDecay.retestable}; ${translationDetail}.`,
    safeMetadata: safe,
  });
  return {
    stage: "MAINTENANCE",
    kind: "advanced",
    summary: `Maintenance: cleanup + memory decay (${memoryDecay.decayed} rows) + reputation decay (${reputationDecay.decayed} rows, ${reputationDecay.demoted} demoted); ${translationDetail}.`,
    metadata: safe,
  };
}

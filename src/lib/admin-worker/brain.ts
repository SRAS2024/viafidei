/**
 * AdminWorkerBrain — the explicit coded intelligence of the Admin
 * Worker. Runs before every pass: gathers world state, scores every
 * possible action against that state, ranks them, and emits a
 * structured BrainDecision that explains exactly what the worker chose
 * to do next AND why it rejected the alternatives.
 *
 * Hard rules (spec sections 1, 4):
 *   - No AI APIs. Deterministic rules + scoring only.
 *   - Reads only stored state (DB rows + memory). Never invents facts.
 *   - Records every decision in AdminWorkerDecision (including the
 *     ranked alternatives list) so the operator can audit "why did
 *     the worker do that — and why not that other thing?" without
 *     re-running the pass.
 *
 * Architecture (spec §1):
 *   1. sampleWorld() reads world state into a flat WorldState.
 *   2. enumerateCandidateActions() generates every action the brain
 *      could take right now (one per priority ladder rung).
 *   3. scoreAction() assigns a value to each candidate based on:
 *        - urgency (security / health / no recent success)
 *        - content gap severity
 *        - source readiness (candidates / reputation / freshness)
 *        - expected package completeness
 *        - expected QA / publish likelihood
 *        - duplicate / legal / doctrinal risk (lowers score)
 *        - time since last growth / last successful pass
 *      A safety filter zeros the score of any action that would be
 *      unsafe given the current world (eg. PUBLISH while paused).
 *   4. The highest-scoring safe action becomes the chosen action;
 *      the rest become rankedAlternatives.
 *   5. brainExplanation summarises the choice; brainFailure is set
 *      when no safe action could be scored above zero.
 */

import type {
  AdminWorkerMode,
  AdminWorkerPassType,
  AdminWorkerPriority,
  AdminWorkerTaskType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { getAdminWorkerState } from "./state";
import { refreshContentGoals, nextPriorityContentType } from "./content-goals";
import { recordDecision } from "./decisions";
import { persistActionScores } from "./action-scores";
import { recordReasoningEdges } from "./reasoning-graph";
import { enumerateCandidateActions } from "./brain-candidates";
import { scoreAction } from "./brain-scoring";

/**
 * The pipeline stage the brain decided to advance. Mirrors the
 * mission planner stages so the action dispatcher knows which module
 * to invoke. Kept as a string union (not the DB enum) so the brain
 * stays testable without a Prisma client.
 */
export type BrainMissionStage =
  | "DISCOVERY"
  | "CANDIDATE_PRIORITIZATION"
  | "SOURCE_FETCH"
  | "SOURCE_READ"
  | "CLASSIFICATION"
  | "EXTRACTION"
  | "CHECKLIST_CREATION"
  | "CITATION_CREATION"
  | "PACKAGE_BUILD"
  | "CROSS_SOURCE_VERIFICATION"
  | "STRICT_QA"
  | "PERSISTENCE"
  | "PUBLIC_PUBLISH"
  | "POST_PUBLISH_VERIFY"
  | "SEARCH_VERIFY"
  | "SITEMAP_VERIFY"
  | "CACHE_REFRESH"
  | "REPAIR"
  | "HOMEPAGE_WORK"
  | "REPORTING"
  | "SECURITY_DEFENSE"
  | "MAINTENANCE"
  | "PAUSED";

/**
 * One candidate action the brain considered. The brain produces a
 * ranked list of these; the chosen action is the highest-scoring safe
 * member of the list. Every field is required so the audit view
 * always has the same shape.
 */
export interface BrainAction {
  actionType: AdminWorkerTaskType | "PAUSED";
  missionStage: BrainMissionStage;
  mode: AdminWorkerMode;
  priority: AdminWorkerPriority;
  passType: AdminWorkerPassType;
  contentType: string | null;
  sourceTarget: string | null;
  candidateUrl: string | null;
  expectedOutput: string;
  confidenceScore: number;
  riskScore: number;
  qualityExpectation: number;
  urgencyScore: number;
  sourceScore: number;
  repairScore: number;
  finalScore: number;
  fallbackAction: string | null;
  stopCondition: string | null;
  reasonSummary: string;
  rulesEvaluated: Record<string, unknown>;
  safe: boolean;
  rejectionReason: string | null;
}

/**
 * The structured decision object the brain emits. The chosen action
 * is the highest-scoring safe member of `rankedAlternatives`; the
 * rest are the rejected alternatives the admin UI surfaces under
 * "why not that?". `brainFailure` is non-null when no candidate
 * could be scored above zero.
 */
export interface BrainDecision {
  // Top-level convenience fields — same shape the prior brain emitted
  // so existing call sites keep working.
  chosenMode: AdminWorkerMode;
  chosenPriority: AdminWorkerPriority;
  chosenTaskType: AdminWorkerTaskType | null;
  passType: AdminWorkerPassType;
  contentType: string | null;
  sourceTarget: string | null;
  expectedResult: string;
  confidenceScore: number;
  riskScore: number;
  reason: string;
  fallbackAction: string | null;
  repairAction: string | null;
  rulesEvaluated: Record<string, unknown>;
  memoryUsed: Record<string, unknown>;
  sourceReputationUsed: Array<{ host: string; tier: string }>;
  // New action-engine fields.
  chosenAction: BrainAction;
  rankedAlternatives: BrainAction[];
  missionStage: BrainMissionStage;
  brainExplanation: string;
  brainFailure: string | null;
  /**
   * Which layer made the FINAL selection:
   *   - "python":   the Python brain (the final brain) chose the action.
   *   - "degraded": Python was unavailable/invalid → safe degraded mode.
   *   - "candidate": no final selector applied (candidate generation only;
   *      used by unit tests of the deterministic ranker).
   */
  finalBrain?: "python" | "degraded" | "candidate";
}

/**
 * Hook that lets the Python brain make the FINAL action selection over the
 * TS-generated candidate set. Returns the chosen action + which layer
 * decided. The loop always supplies this; the deterministic ranker
 * (`decide`) only generates + sub-scores candidates.
 */
export type FinalActionSelector = (input: {
  world: WorldState;
  decision: BrainDecision;
  passId?: string;
}) => Promise<{
  chosen: BrainAction;
  source: "python" | "degraded";
  failure?: string | null;
} | null>;

/**
 * Stages that are safe to run when the Python brain is unavailable — they
 * never autonomously publish public content. Degraded mode is restricted
 * to these (spec: safe degraded mode does diagnostics, security defense,
 * reporting, and repair, but NOT autonomous content publishing).
 */
export const SAFE_DEGRADED_STAGES: ReadonlySet<BrainMissionStage> = new Set([
  "SECURITY_DEFENSE",
  "REPAIR",
  "REPORTING",
  "MAINTENANCE",
  "PAUSED",
]);

/** Pick the best safe, non-publishing action for degraded mode. */
export function safeDegradedAction(decision: BrainDecision): BrainAction {
  const safe = decision.rankedAlternatives
    .filter((a) => SAFE_DEGRADED_STAGES.has(a.missionStage) && a.safe)
    .sort((a, b) => b.finalScore - a.finalScore);
  const pick =
    safe[0] ??
    decision.rankedAlternatives.find((a) => a.missionStage === "MAINTENANCE") ??
    decision.rankedAlternatives[decision.rankedAlternatives.length - 1] ??
    decision.chosenAction;
  return {
    ...pick,
    reasonSummary: `Safe degraded mode (PYTHON_BRAIN_UNAVAILABLE): ${pick.reasonSummary}`,
    fallbackAction: "maintenance",
  };
}

/** Re-derive the decision's top-level fields from a newly-chosen action. */
export function applyFinalChosen(
  decision: BrainDecision,
  chosen: BrainAction,
  source: "python" | "degraded",
  failure?: string | null,
): BrainDecision {
  return {
    ...decision,
    chosenMode: chosen.mode,
    chosenPriority: chosen.priority,
    chosenTaskType: chosen.actionType === "PAUSED" ? null : chosen.actionType,
    passType: chosen.passType,
    contentType: chosen.contentType,
    sourceTarget: chosen.sourceTarget,
    expectedResult: chosen.expectedOutput,
    confidenceScore: chosen.confidenceScore,
    riskScore: chosen.riskScore,
    reason: chosen.reasonSummary,
    fallbackAction: chosen.fallbackAction,
    repairAction: chosen.missionStage === "REPAIR" ? chosen.expectedOutput : null,
    chosenAction: chosen,
    missionStage: chosen.missionStage,
    brainFailure: failure ?? decision.brainFailure,
    finalBrain: source,
  };
}

export interface WorldState {
  pendingBuildJobs: number;
  failedBuildJobs: number;
  runningBuildJobs: number;
  contentGoalGap: number;
  contentGoalContentType: string | null;
  pausedSources: number;
  trustedSources: number;
  reviewQueuePending: number;
  recentSecurityBreaches24h: number;
  homepageScore: number;
  isPaused: boolean;
  pausedReason: string | null;
  heartbeatAgeMs: number;
  lastSuccessAgeMs: number | null;
  lastFailureAgeMs: number | null;
  currentBlocker: string | null;
  candidateUrlsAvailable: number;
  pendingRepairPlans: number;
  pipelineStagesBlocked: number;
  // New world signals for richer scoring.
  unclassifiedReads: number;
  // Content-pipeline ladder signals (in-flight artifacts by state) so
  // the brain can select EVERY stage from extraction through publish and
  // drain in-flight items to public content rather than stalling.
  readsAwaitingExtraction: number;
  artifactsAwaitingChecklist: number;
  artifactsAwaitingBuild: number;
  artifactsAwaitingVerification: number;
  artifactsAwaitingQA: number;
  artifactsAwaitingPublish: number;
  publishedButUnverified: number;
  pendingQAReviews: number;
  contentGoalsAtGoalCount: number;
  contentGoalsBelowGoalCount: number;
  timeSinceLastGrowthMs: number | null;
  topSourceReputation: Array<{ host: string; tier: string }>;
}

/**
 * Sample the world state the brain needs to make a decision. Each
 * field is a count or a small scalar; the brain doesn't load full
 * rows so a pass stays cheap even when the queues are large.
 */
export async function sampleWorld(prisma: PrismaClient): Promise<WorldState> {
  await refreshContentGoals(prisma).catch(() => undefined);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    state,
    pendingBuildJobs,
    failedBuildJobs,
    runningBuildJobs,
    pausedSources,
    trustedSources,
    reviewQueuePending,
    recentSecurityBreaches24h,
    recentHomepageScore,
    candidateUrlsAvailable,
    pendingRepairPlans,
    pipelineStagesBlocked,
    nextGoal,
    unclassifiedReads,
    publishedTotal,
    classifiedReads,
    artifactsFromReads,
    artifactsChecklistReady,
    artifactsBuildReady,
    artifactsBuildReadyNeedsValidation,
    artifactsBuildOrVerification,
    artifactsQaPassed,
    verifiedDistinct,
    pendingQAReviews,
    contentGoalsAtGoal,
    contentGoalsBelowGoal,
    recentGrowth,
    topReputation,
  ] = await Promise.all([
    getAdminWorkerState(prisma),
    prisma.workerBuildJob.count({ where: { status: "pending" } }),
    prisma.workerBuildJob.count({ where: { status: "failed" } }),
    prisma.workerBuildJob.count({ where: { status: "running" } }),
    prisma.adminWorkerSourceReputation.count({ where: { paused: true } }),
    prisma.adminWorkerSourceReputation.count({ where: { reputationTier: "TRUSTED" } }),
    prisma.humanReviewQueue.count({ where: { status: "PENDING" } }),
    prisma.securityEvent.count({
      where: {
        classification: "Breach",
        createdAt: { gte: since24h },
      },
    }),
    prisma.homepageQualityScore.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.candidateSourceUrl.count({ where: { status: { in: ["DISCOVERED", "PRIORITIZED"] } } }),
    prisma.adminWorkerRepairPlan.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    prisma.adminWorkerPipelineStage.count({ where: { status: "BLOCKED" } }),
    nextPriorityContentType(prisma),
    prisma.adminWorkerSourceRead.count({ where: { detectedContentType: null } }),
    prisma.publishedContent.count({ where: { isPublished: true } }).catch(() => 0),
    // Content-pipeline ladder counts (artifacts by state).
    prisma.adminWorkerSourceRead
      .count({ where: { detectedContentType: { not: null } } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { sourceReadId: { not: null } } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { status: "CHECKLIST_READY" } })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "BUILD_READY" } }).catch(() => 0),
    prisma.adminWorkerPackageArtifact
      .count({ where: { status: "BUILD_READY", validationNeeds: { isEmpty: false } } })
      .catch(() => 0),
    // Artifacts STRICT_QA will actually process: VERIFICATION_READY (cross-
    // source done) plus BUILD_READY artifacts that need NO validation
    // evidence. BUILD_READY-with-validation-needs is deliberately excluded
    // — strict QA skips those (they must be cross-source-verified first),
    // so counting them here would make the brain pick STRICT_QA and idle.
    prisma.adminWorkerPackageArtifact
      .count({
        where: {
          OR: [
            { status: "VERIFICATION_READY" },
            { status: "BUILD_READY", validationNeeds: { isEmpty: true } },
          ],
        },
      })
      .catch(() => 0),
    prisma.adminWorkerPackageArtifact.count({ where: { status: "QA_PASSED" } }).catch(() => 0),
    prisma.postPublishVerification
      .findMany({ select: { contentId: true }, distinct: ["contentId"] })
      .catch(() => [] as Array<{ contentId: string }>),
    prisma.checklistQAReport
      .count({ where: { needsHumanReview: true, reviewedAt: null } })
      .catch(() => 0),
    prisma.contentGoal.count({ where: { status: { in: ["GOAL_MET", "MAINTENANCE"] } } }),
    prisma.contentGoal.count({
      where: { status: { in: ["NOT_STARTED", "IN_PROGRESS", "NEAR_GOAL"] } },
    }),
    prisma.publishedContent
      .findFirst({
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        select: { publishedAt: true },
      })
      .catch(() => null),
    prisma.adminWorkerSourceReputation
      .findMany({
        where: { reputationTier: { in: ["TRUSTED", "GOOD"] } },
        orderBy: [{ contentBuildSuccessRate: "desc" }, { lastScoreUpdate: "desc" }],
        take: 5,
        select: { sourceHost: true, reputationTier: true },
      })
      .catch(() => [] as Array<{ sourceHost: string; reputationTier: string }>),
  ]);

  const now = Date.now();
  return {
    pendingBuildJobs,
    failedBuildJobs,
    runningBuildJobs,
    contentGoalGap: nextGoal?.gap ?? 0,
    contentGoalContentType: nextGoal?.contentType ?? null,
    pausedSources,
    trustedSources,
    reviewQueuePending,
    recentSecurityBreaches24h,
    homepageScore: recentHomepageScore?.finalScore ?? 1,
    isPaused: state.paused,
    pausedReason: state.pausedReason,
    heartbeatAgeMs: state.lastHeartbeatAt ? now - state.lastHeartbeatAt.getTime() : Infinity,
    lastSuccessAgeMs: state.lastSuccessfulAt ? now - state.lastSuccessfulAt.getTime() : null,
    lastFailureAgeMs: state.lastFailedAt ? now - state.lastFailedAt.getTime() : null,
    currentBlocker: state.currentBlocker,
    candidateUrlsAvailable,
    pendingRepairPlans,
    pipelineStagesBlocked,
    unclassifiedReads,
    // Reads classified but not yet extracted into an artifact.
    readsAwaitingExtraction: Math.max(0, classifiedReads - artifactsFromReads),
    artifactsAwaitingChecklist: artifactsChecklistReady,
    artifactsAwaitingBuild: artifactsBuildReady,
    artifactsAwaitingVerification: artifactsBuildReadyNeedsValidation,
    artifactsAwaitingQA: artifactsBuildOrVerification,
    artifactsAwaitingPublish: artifactsQaPassed,
    publishedButUnverified: Math.max(0, publishedTotal - verifiedDistinct.length),
    pendingQAReviews,
    contentGoalsAtGoalCount: contentGoalsAtGoal,
    contentGoalsBelowGoalCount: contentGoalsBelowGoal,
    timeSinceLastGrowthMs: recentGrowth?.publishedAt
      ? now - recentGrowth.publishedAt.getTime()
      : null,
    topSourceReputation: topReputation.map((r) => ({
      host: r.sourceHost,
      tier: r.reputationTier,
    })),
  };
}

export function rankActions(
  world: WorldState,
  feedback: ExecutionFeedback = { recentFailedStages: {}, recentlyAdvanced: new Set() },
): BrainAction[] {
  const scored = enumerateCandidateActions(world)
    .map((a) => scoreAction(a, world))
    .map((a) => applyExecutionFeedback(a, feedback));
  return [...scored].sort((a, b) => {
    if (a.safe !== b.safe) return a.safe ? -1 : 1;
    return b.finalScore - a.finalScore;
  });
}

/**
 * Execution feedback the brain uses to adjust ranking based on
 * recent real outcomes (spec §12 + §10 follow-up). Populated by
 * sampleExecutionFeedback().
 *
 * Pass rates are last-7-day signals drawn directly from the durable
 * tables (AdminWorkerStrictQAResult, ContentQualityScore, etc.). A
 * stage with a poor recent pass rate is penalised so the brain
 * rotates to a healthier path; a stage with a strong pass rate gets
 * a small boost.
 */
export interface ExecutionFeedback {
  /** Per-mission-stage count of recent failed dispatches. */
  recentFailedStages: Record<string, number>;
  /** Stages that recently advanced — the brain prefers fresh winners. */
  recentlyAdvanced: Set<string>;
  /** Spec §10: 0..1 pass rate of the strict-QA stage over the last 7d. */
  strictQAPassRate?: number;
  /** Spec §10: 0..1 pass rate of ContentQualityScore over the last 7d. */
  qualityScorePassRate?: number;
  /** Spec §10: 0..1 pass rate of publishing over the last 7d. */
  publishPassRate?: number;
  /** Spec §10: 0..1 pass rate of post-publish verification over the last 7d. */
  postPublishPassRate?: number;
  /** Spec §10: 0..1 pass rate of repair plans over the last 7d. */
  repairPassRate?: number;
}

/**
 * Map a mission stage to the relevant outcome rate the brain should
 * read when scoring that stage. Returns null when no specific rate
 * applies (e.g. SECURITY_DEFENSE, PAUSED).
 */
function passRateForStage(stage: string, feedback: ExecutionFeedback): number | null {
  switch (stage) {
    case "STRICT_QA":
      return feedback.strictQAPassRate ?? null;
    case "PERSISTENCE":
    case "PUBLIC_PUBLISH":
      // Publish depends on the upstream quality score gating it.
      return Math.min(feedback.qualityScorePassRate ?? 1, feedback.publishPassRate ?? 1);
    case "POST_PUBLISH_VERIFY":
    case "SEARCH_VERIFY":
    case "SITEMAP_VERIFY":
    case "CACHE_REFRESH":
      return feedback.postPublishPassRate ?? null;
    case "REPAIR":
      return feedback.repairPassRate ?? null;
    default:
      return null;
  }
}

function applyExecutionFeedback(action: BrainAction, feedback: ExecutionFeedback): BrainAction {
  if (!action.safe) return action;
  const failed = feedback.recentFailedStages[action.missionStage] ?? 0;
  // Action fatigue: subtract 5 points per consecutive recent failure
  // (caps at -20 so the action can still win when its baseline is
  // very high).
  const fatigue = Math.min(20, failed * 5);
  const advancedBonus = feedback.recentlyAdvanced.has(action.missionStage) ? 3 : 0;

  // Spec §10: pass-rate influence. A 0.5 pass rate is neutral; below
  // it penalises (the stage is unreliable), above it boosts (the
  // stage is winning). Range: -8 to +5.
  const passRate = passRateForStage(action.missionStage, feedback);
  const passRateAdjustment =
    passRate == null ? 0 : Math.max(-8, Math.min(5, Math.round((passRate - 0.5) * 10)));

  return {
    ...action,
    finalScore: action.finalScore - fatigue + advancedBonus + passRateAdjustment,
    rulesEvaluated: {
      ...action.rulesEvaluated,
      executionFeedback: {
        fatigue,
        advancedBonus,
        recentFailures: failed,
        passRate: passRate ?? null,
        passRateAdjustment,
      },
    },
  };
}

/**
 * Sample the last N dispatch outcomes to build the ExecutionFeedback
 * the brain consults. Best-effort: missing logs degrade gracefully
 * to an empty feedback structure.
 */
export async function sampleExecutionFeedback(
  prisma: PrismaClient,
  windowSize = 25,
): Promise<ExecutionFeedback> {
  const recent = await prisma.adminWorkerLog
    .findMany({
      where: { eventName: "stage_dispatched" },
      orderBy: { createdAt: "desc" },
      take: windowSize,
      select: { safeMetadata: true },
    })
    .catch(() => [] as Array<{ safeMetadata: unknown }>);

  const recentlyAdvanced = new Set<string>();

  for (const row of recent) {
    const meta = row.safeMetadata as Record<string, unknown> | null;
    if (!meta || typeof meta !== "object") continue;
    const kind = typeof meta.kind === "string" ? meta.kind : null;
    // The stage_dispatched log puts the stage inside the message;
    // we use the kind to attribute fatigue.
    if (!kind) continue;
    if (kind === "failed" || kind === "rejected") {
      // We don't know the exact mission stage here without parsing;
      // skip per-stage attribution and rely on the brain decision
      // log for accurate per-stage failure attribution.
    } else if (kind === "advanced") {
      // Likewise — kind alone doesn't tell us the stage. Per-stage
      // attribution requires the brain decision row which carries
      // missionStage.
    }
  }

  const recentDecisions = await prisma.adminWorkerDecision
    .findMany({
      where: { decisionType: "brain_pass", missionStage: { not: null } },
      orderBy: { createdAt: "desc" },
      take: windowSize,
      select: { missionStage: true },
    })
    .catch(() => [] as Array<{ missionStage: string | null }>);

  // Join brain decisions with their downstream stage_dispatched log
  // to attribute failures per missionStage. We approximate by
  // counting consecutive decisions choosing the same stage — the
  // assumption is that if the brain keeps picking the same stage
  // and growth isn't happening, that stage is failing.
  const stageRuns: Record<string, number> = {};
  let prev: string | null = null;
  let run = 0;
  for (const d of recentDecisions) {
    if (!d.missionStage) continue;
    if (d.missionStage === prev) {
      run += 1;
    } else {
      run = 1;
      prev = d.missionStage;
    }
    if (run >= 3) {
      stageRuns[d.missionStage] = (stageRuns[d.missionStage] ?? 0) + 1;
    }
  }

  // Spec §10: sample real outcome signals from the durable tables.
  // The brain consults pass rates so a chronically failing stage gets
  // demoted in ranking even when it has been re-tried fewer times.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    strictQaTotal,
    strictQaPassed,
    qualityTotal,
    qualityPassed,
    publishedRecent,
    publishBlocks,
    postPublishTotal,
    postPublishPassed,
    repairTotal,
    repairSucceeded,
  ] = await Promise.all([
    prisma.adminWorkerStrictQAResult.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerStrictQAResult
      .count({ where: { createdAt: { gte: since }, status: "PASSED" } })
      .catch(() => 0),
    prisma.contentQualityScore.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.contentQualityScore
      .count({ where: { createdAt: { gte: since }, finalScore: { gte: 0.8 } } })
      .catch(() => 0),
    prisma.publishedContent
      .count({ where: { publishedAt: { gte: since }, isPublished: true } })
      .catch(() => 0),
    prisma.adminWorkerLog
      .count({
        where: {
          createdAt: { gte: since },
          eventName: { in: ["publish_orchestrator_blocked", "publish_pass_idle"] },
        },
      })
      .catch(() => 0),
    prisma.postPublishVerification.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.postPublishVerification
      .count({ where: { createdAt: { gte: since }, result: "PASS" } })
      .catch(() => 0),
    prisma.adminWorkerRepairPlan
      .count({ where: { createdAt: { gte: since }, status: { in: ["SUCCEEDED", "FAILED"] } } })
      .catch(() => 0),
    prisma.adminWorkerRepairPlan
      .count({ where: { createdAt: { gte: since }, status: "SUCCEEDED" } })
      .catch(() => 0),
  ]);

  const rate = (passed: number, total: number): number | undefined =>
    total === 0 ? undefined : passed / total;
  const publishAttempts = publishedRecent + publishBlocks;

  return {
    recentFailedStages: stageRuns,
    recentlyAdvanced,
    strictQAPassRate: rate(strictQaPassed, strictQaTotal),
    qualityScorePassRate: rate(qualityPassed, qualityTotal),
    publishPassRate: rate(publishedRecent, publishAttempts),
    postPublishPassRate: rate(postPublishPassed, postPublishTotal),
    repairPassRate: rate(repairSucceeded, repairTotal),
  };
}

/**
 * Compose the BrainDecision from the ranked alternatives. When the
 * worker is paused the PAUSED action wins regardless of score; when
 * no action could score above zero we set brainFailure and fall back
 * to maintenance.
 */
export function decide(
  world: WorldState,
  feedback: ExecutionFeedback = { recentFailedStages: {}, recentlyAdvanced: new Set() },
): BrainDecision {
  const ranked = rankActions(world, feedback);

  // Pause overrides everything else — the operator pulled the brake.
  const chosen = world.isPaused
    ? (ranked.find((a) => a.missionStage === "PAUSED") ?? ranked[0])
    : (ranked.find((a) => a.safe && a.finalScore > 0) ?? ranked.find((a) => a.safe) ?? ranked[0]);

  const allUnsafe = ranked.every((a) => !a.safe || a.finalScore === 0);
  const brainFailure =
    allUnsafe && !world.isPaused
      ? "Brain could not find any safe action that scored above zero. Falling back to maintenance."
      : null;

  // Tag the chosen action so the diff with rejected alternatives is
  // visible to the admin UI.
  const rejected = ranked.filter((a) => a !== chosen);
  const topRejected = rejected.slice(0, 3);
  const explanation = buildExplanation(chosen, topRejected, world);

  return {
    chosenMode: chosen.mode,
    chosenPriority: chosen.priority,
    chosenTaskType: chosen.actionType === "PAUSED" ? null : chosen.actionType,
    passType: chosen.passType,
    contentType: chosen.contentType,
    sourceTarget: chosen.sourceTarget,
    expectedResult: chosen.expectedOutput,
    confidenceScore: chosen.confidenceScore,
    riskScore: chosen.riskScore,
    reason: chosen.reasonSummary,
    fallbackAction: chosen.fallbackAction,
    repairAction: chosen.missionStage === "REPAIR" ? chosen.expectedOutput : null,
    rulesEvaluated: chosen.rulesEvaluated,
    memoryUsed: { trustedSources: world.trustedSources },
    sourceReputationUsed: world.topSourceReputation,
    chosenAction: chosen,
    rankedAlternatives: ranked,
    missionStage: chosen.missionStage,
    brainExplanation: explanation,
    brainFailure,
  };
}

/**
 * Human-readable summary explaining the choice + the strongest
 * rejected alternative. The admin UI surfaces this verbatim.
 */
function buildExplanation(chosen: BrainAction, rejected: BrainAction[], world: WorldState): string {
  const lines: string[] = [];
  lines.push(
    `Chose ${chosen.missionStage} (score ${chosen.finalScore.toFixed(1)}, urgency ${chosen.urgencyScore.toFixed(1)}, risk ${chosen.riskScore.toFixed(2)}): ${chosen.reasonSummary}`,
  );
  if (rejected.length === 0) {
    lines.push("No alternative actions considered.");
  } else {
    lines.push("Rejected alternatives:");
    for (const r of rejected) {
      const why = r.rejectionReason ?? `lower score (${r.finalScore.toFixed(1)})`;
      lines.push(`  • ${r.missionStage}: ${why}`);
    }
  }
  if (world.contentGoalContentType && world.contentGoalGap > 0) {
    lines.push(
      `Largest content gap: ${world.contentGoalContentType} (gap ${world.contentGoalGap}).`,
    );
  }
  return lines.join("\n");
}

/**
 * High-level entry point. Samples the world, ranks actions, picks the
 * best safe action, and records the decision (with ranked
 * alternatives) in AdminWorkerDecision.
 */
export async function runBrain(
  prisma: PrismaClient,
  opts: { passId?: string; finalSelect?: FinalActionSelector } = {},
): Promise<BrainDecision> {
  const [world, feedback] = await Promise.all([
    sampleWorld(prisma),
    sampleExecutionFeedback(prisma).catch(
      () => ({ recentFailedStages: {}, recentlyAdvanced: new Set<string>() }) as ExecutionFeedback,
    ),
  ]);
  // The deterministic ranker only GENERATES + sub-scores candidates now.
  const candidateDecision = { ...decide(world, feedback), finalBrain: "candidate" as const };

  // The Python brain is the FINAL action selector. The loop always supplies
  // `finalSelect`; if it returns a choice we use it (python or safe-degraded
  // mode), otherwise we degrade to a safe action — never the legacy TS argmax
  // for autonomous content work.
  let decision: BrainDecision = candidateDecision;
  if (opts.finalSelect) {
    const picked = await opts
      .finalSelect({ world, decision: candidateDecision, passId: opts.passId })
      .catch(() => null);
    decision = picked
      ? applyFinalChosen(candidateDecision, picked.chosen, picked.source, picked.failure)
      : applyFinalChosen(
          candidateDecision,
          safeDegradedAction(candidateDecision),
          "degraded",
          "PYTHON_BRAIN_UNAVAILABLE",
        );
  }

  const { id: decisionId } = await recordDecision(prisma, {
    passId: opts.passId,
    decisionType: "brain_pass",
    inputSummary: JSON.stringify(world).slice(0, 480),
    // Spec §13: persist the memory + source-reputation the brain
    // consulted so the command center can show "what memory / source
    // reputation influenced the action" without a separate column.
    rulesEvaluated: {
      ...decision.rulesEvaluated,
      memoryUsed: decision.memoryUsed,
      sourceReputationUsed: decision.sourceReputationUsed,
    } as Prisma.InputJsonValue,
    chosenAction: `${decision.chosenMode}:${decision.chosenPriority}`,
    confidence: decision.confidenceScore,
    reason: decision.reason,
    fallbackAction: decision.fallbackAction ?? undefined,
    rankedAlternatives: decision.rankedAlternatives.map((a) => ({
      missionStage: a.missionStage,
      actionType: a.actionType,
      mode: a.mode,
      priority: a.priority,
      passType: a.passType,
      contentType: a.contentType,
      sourceTarget: a.sourceTarget,
      candidateUrl: a.candidateUrl,
      expectedOutput: a.expectedOutput,
      confidenceScore: a.confidenceScore,
      riskScore: a.riskScore,
      qualityExpectation: a.qualityExpectation,
      urgencyScore: a.urgencyScore,
      sourceScore: a.sourceScore,
      repairScore: a.repairScore,
      finalScore: a.finalScore,
      fallbackAction: a.fallbackAction,
      stopCondition: a.stopCondition,
      reasonSummary: a.reasonSummary,
      rulesEvaluated: a.rulesEvaluated,
      safe: a.safe,
      rejectionReason: a.rejectionReason,
    })) as Prisma.InputJsonValue,
    brainExplanation: decision.brainExplanation,
    brainFailure: decision.brainFailure ?? undefined,
    riskScore: decision.riskScore,
    expectedResult: decision.expectedResult,
    contentType: decision.contentType ?? undefined,
    missionStage: decision.missionStage,
  });

  // Spec §5-7: persist every ranked action (not only the selected one)
  // to AdminWorkerActionScore so the command center + Worker Reasoning
  // view + Developer Audit can show "why this action and why not the
  // others" from durable, queryable rows.
  await persistActionScores(prisma, decision, { decisionId, passId: opts.passId }).catch(
    () => undefined,
  );

  // Spec §23-45 + §48: record the brain's reasoning as graph edges so
  // the decision is explainable later. The chosen action is connected to
  // its mission stage with "selected because <reason>"; the strongest
  // rejected alternative is connected with "rejected because <reason>".
  const chosen = decision.chosenAction;
  const topRejected = decision.rankedAlternatives.find((a) => a !== chosen);
  await recordReasoningEdges(prisma, [
    {
      contentType: decision.contentType,
      passId: opts.passId,
      decisionId,
      from: { type: "BRAIN_DECISION", id: decisionId, label: "brain pass" },
      to: { type: "ACTION", label: chosen.missionStage },
      relation: "SELECTED_BECAUSE",
      explanation: chosen.reasonSummary,
      confidence: chosen.confidenceScore,
    },
    ...(topRejected
      ? [
          {
            contentType: decision.contentType,
            passId: opts.passId,
            decisionId,
            from: { type: "BRAIN_DECISION" as const, id: decisionId, label: "brain pass" },
            to: { type: "ACTION" as const, label: topRejected.missionStage },
            relation: "REJECTED_BECAUSE" as const,
            explanation:
              topRejected.rejectionReason ??
              `lower score (${topRejected.finalScore.toFixed(1)} vs ${chosen.finalScore.toFixed(1)})`,
            confidence: topRejected.confidenceScore,
          },
        ]
      : []),
  ]).catch(() => undefined);

  return decision;
}

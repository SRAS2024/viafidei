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
    prisma.adminWorkerPackageArtifact
      .count({ where: { status: { in: ["BUILD_READY", "VERIFICATION_READY"] } } })
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

/**
 * Build the candidate action list. One BrainAction per primitive
 * pipeline stage / mode the brain can choose. Scoring (next step)
 * picks the best one.
 */
function enumerateCandidateActions(world: WorldState): BrainAction[] {
  const ct = world.contentGoalContentType;
  return [
    // Paused — only fires when the operator pulled the pause toggle.
    {
      actionType: "PAUSED",
      missionStage: "PAUSED",
      mode: "PAUSED",
      priority: "SECURITY_THREAT",
      passType: "SECURITY",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Security defender stays online; nothing else runs.",
      confidenceScore: 1,
      riskScore: 0,
      qualityExpectation: 1,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: null,
      stopCondition: "operator resumes the worker",
      reasonSummary: `Worker paused${world.pausedReason ? ` (${world.pausedReason})` : ""}.`,
      rulesEvaluated: { isPaused: world.isPaused, pausedReason: world.pausedReason },
      safe: true,
      rejectionReason: null,
    },
    // Security defense — confirmed breach in the last 24h.
    {
      actionType: "SECURITY_DEFENSE",
      missionStage: "SECURITY_DEFENSE",
      mode: "SECURITY_DEFENSE",
      priority: "SECURITY_THREAT",
      passType: "SECURITY",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Defender records actions for confirmed breaches; bans confirmed attackers.",
      confidenceScore: 0.95,
      riskScore: 0.2,
      qualityExpectation: 0.9,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "log + escalate",
      stopCondition: "no security breaches in last 24h",
      reasonSummary: `${world.recentSecurityBreaches24h} confirmed security breach(es) in 24h.`,
      rulesEvaluated: { recentSecurityBreaches24h: world.recentSecurityBreaches24h },
      safe: true,
      rejectionReason: null,
    },
    // Worker health repair — stale heartbeat or active blocker.
    {
      actionType: "REPAIR",
      missionStage: "REPAIR",
      mode: "REPAIR",
      priority: "WORKER_HEALTH",
      passType: "SOURCE_REPAIR",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Clear worker blocker / refresh heartbeat / unstick queue.",
      confidenceScore: 0.85,
      riskScore: 0.25,
      qualityExpectation: 0.7,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "diagnostics",
      stopCondition: "heartbeat fresh and no active blocker",
      reasonSummary: world.currentBlocker
        ? `Active blocker: ${world.currentBlocker}.`
        : `Heartbeat stale (${Math.round(world.heartbeatAgeMs / 1000)}s).`,
      rulesEvaluated: {
        heartbeatAgeMs: world.heartbeatAgeMs,
        currentBlocker: world.currentBlocker,
      },
      safe: true,
      rejectionReason: null,
    },
    // Discovery — content goal has gap and no candidate URLs ready.
    {
      actionType: "DISCOVER_SOURCE",
      missionStage: "DISCOVERY",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_GOAL",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: `Surface candidate URLs for ${ct ?? "the highest-gap content type"}.`,
      confidenceScore: 0.75,
      riskScore: 0.15,
      qualityExpectation: 0.5,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "maintenance",
      stopCondition: "candidateUrlsAvailable above min threshold",
      reasonSummary: `Discovery for ${ct ?? "any type"}: gap=${world.contentGoalGap}, candidates=${world.candidateUrlsAvailable}.`,
      rulesEvaluated: {
        contentGoalGap: world.contentGoalGap,
        candidateUrlsAvailable: world.candidateUrlsAvailable,
      },
      safe: true,
      rejectionReason: null,
    },
    // Source read — candidates available, no source-read row yet for them.
    {
      actionType: "READ_SOURCE",
      missionStage: "SOURCE_FETCH",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_GOAL",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Fetch + parse the highest-priority candidate; write source-read row.",
      confidenceScore: 0.8,
      riskScore: 0.15,
      qualityExpectation: 0.6,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "discovery",
      stopCondition: "candidate becomes FETCHED",
      reasonSummary: `${world.candidateUrlsAvailable} candidates ready to fetch.`,
      rulesEvaluated: { candidateUrlsAvailable: world.candidateUrlsAvailable },
      safe: true,
      rejectionReason: null,
    },
    // Classification — source-read rows exist with no detected type.
    {
      actionType: "CLASSIFY_CONTENT",
      missionStage: "CLASSIFICATION",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_GOAL",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Classify unclassified source-reads.",
      confidenceScore: 0.8,
      riskScore: 0.1,
      qualityExpectation: 0.65,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "discovery",
      stopCondition: "no unclassified source-reads",
      reasonSummary: `${world.unclassifiedReads} unclassified source-reads.`,
      rulesEvaluated: { unclassifiedReads: world.unclassifiedReads },
      safe: true,
      rejectionReason: null,
    },
    // Extraction — classified reads exist that have no package artifact.
    {
      actionType: "BUILD_CONTENT",
      missionStage: "EXTRACTION",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_BUILD",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Extract a package artifact from a classified source-read.",
      confidenceScore: 0.82,
      riskScore: 0.12,
      qualityExpectation: 0.75,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "classification",
      stopCondition: "no classified reads awaiting extraction",
      reasonSummary: `${world.readsAwaitingExtraction} classified read(s) awaiting extraction.`,
      rulesEvaluated: { readsAwaitingExtraction: world.readsAwaitingExtraction },
      safe: true,
      rejectionReason: null,
    },
    // Checklist + citations — CHECKLIST_READY artifacts need checklist
    // items + citations created before they can be built/published.
    {
      actionType: "BUILD_CONTENT",
      missionStage: "CHECKLIST_CREATION",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_BUILD",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Create checklist items + citations for CHECKLIST_READY artifacts.",
      confidenceScore: 0.85,
      riskScore: 0.1,
      qualityExpectation: 0.8,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "extraction",
      stopCondition: "no CHECKLIST_READY artifacts",
      reasonSummary: `${world.artifactsAwaitingChecklist} artifact(s) awaiting checklist + citations.`,
      rulesEvaluated: { artifactsAwaitingChecklist: world.artifactsAwaitingChecklist },
      safe: true,
      rejectionReason: null,
    },
    // Build — pending build jobs or content-type gap with candidates available.
    {
      actionType: "BUILD_CONTENT",
      missionStage: "PACKAGE_BUILD",
      mode: "CONSTANT_FILL",
      priority: world.pendingBuildJobs > 0 ? "CONTENT_BUILD" : "CONTENT_GOAL",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Run a build cycle: pick the next job, build a package.",
      confidenceScore: 0.9,
      riskScore: 0.15,
      qualityExpectation: 0.75,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "maintenance",
      stopCondition: "no pending build jobs",
      reasonSummary: `Build queue: ${world.pendingBuildJobs} pending, ${world.runningBuildJobs} running.`,
      rulesEvaluated: {
        pendingBuildJobs: world.pendingBuildJobs,
        contentGoalGap: world.contentGoalGap,
      },
      safe: true,
      rejectionReason: null,
    },
    // Validate / cross-source verify — QA reports waiting on review.
    {
      actionType: "CROSS_SOURCE_VERIFY",
      missionStage: "CROSS_SOURCE_VERIFICATION",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_VALIDATION",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Run cross-source verifier on sensitive fields; record evidence.",
      confidenceScore: 0.75,
      riskScore: 0.1,
      qualityExpectation: 0.7,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "human review",
      stopCondition: "no artifacts awaiting validation evidence and no pending QA reviews",
      reasonSummary: `${world.artifactsAwaitingVerification} artifact(s) awaiting cross-source evidence; ${world.pendingQAReviews} QA review(s) pending.`,
      rulesEvaluated: {
        artifactsAwaitingVerification: world.artifactsAwaitingVerification,
        pendingQAReviews: world.pendingQAReviews,
      },
      safe: true,
      rejectionReason: null,
    },
    // Strict QA — BUILD_READY / VERIFICATION_READY artifacts need their
    // durable strict-QA result before they can publish (mandatory gate).
    {
      actionType: "VALIDATE_CONTENT",
      missionStage: "STRICT_QA",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_VALIDATION",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Score strict QA on built artifacts; pass/repair/reject.",
      confidenceScore: 0.85,
      riskScore: 0.1,
      qualityExpectation: 0.85,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "repair",
      stopCondition: "no artifacts awaiting strict QA",
      reasonSummary: `${world.artifactsAwaitingQA} artifact(s) awaiting strict QA.`,
      rulesEvaluated: { artifactsAwaitingQA: world.artifactsAwaitingQA },
      safe: true,
      rejectionReason: null,
    },
    // Publish — QA-passed artifacts go public through the orchestrator.
    // Highest content-side urgency: this is the stage that actually
    // closes the content-goal gap, so the brain drains it first.
    {
      actionType: "PUBLISH_CONTENT",
      missionStage: "PUBLIC_PUBLISH",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_BUILD",
      passType: "CONTENT_GOAL",
      contentType: ct,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Publish QA-passed artifacts via the publish orchestrator.",
      confidenceScore: 0.9,
      riskScore: 0.15,
      qualityExpectation: 0.9,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "strict QA",
      stopCondition: "no QA-passed artifacts awaiting publish",
      reasonSummary: `${world.artifactsAwaitingPublish} QA-passed artifact(s) awaiting publish.`,
      rulesEvaluated: { artifactsAwaitingPublish: world.artifactsAwaitingPublish },
      safe: true,
      rejectionReason: null,
    },
    // Post-publish verification — published items missing verification.
    {
      actionType: "POST_PUBLISH_VERIFY",
      missionStage: "POST_PUBLISH_VERIFY",
      mode: "CONSTANT_FILL",
      priority: "CONTENT_VALIDATION",
      passType: "CONTENT_GOAL",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Probe public URL + check tab placement, search, sitemap, cache.",
      confidenceScore: 0.8,
      riskScore: 0.1,
      qualityExpectation: 0.8,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "maintenance",
      stopCondition: "all published content verified",
      reasonSummary: `${world.publishedButUnverified} published items missing verification.`,
      rulesEvaluated: { publishedButUnverified: world.publishedButUnverified },
      safe: true,
      rejectionReason: null,
    },
    // Source repair — failed jobs / pending repair plans.
    {
      actionType: "REPAIR",
      missionStage: "REPAIR",
      mode: "REPAIR",
      priority: "SOURCE_REPAIR",
      passType: "SOURCE_REPAIR",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Drain failed build jobs + execute pending repair plans.",
      confidenceScore: 0.75,
      riskScore: 0.25,
      qualityExpectation: 0.6,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "diagnostics",
      stopCondition: "no failed jobs and no pending repair plans",
      reasonSummary: `${world.failedBuildJobs} failed jobs, ${world.pendingRepairPlans} repair plans.`,
      rulesEvaluated: {
        failedBuildJobs: world.failedBuildJobs,
        pendingRepairPlans: world.pendingRepairPlans,
        pipelineStagesBlocked: world.pipelineStagesBlocked,
      },
      safe: true,
      rejectionReason: null,
    },
    // Homepage redesign — score below threshold.
    {
      actionType: "UPDATE_HOMEPAGE",
      missionStage: "HOMEPAGE_WORK",
      mode: "HOMEPAGE",
      priority: "HOMEPAGE",
      passType: "HOMEPAGE",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "File a homepage draft to lift the score.",
      confidenceScore: 0.7,
      riskScore: 0.3,
      qualityExpectation: 0.65,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "maintenance",
      stopCondition: "homepage score >= 0.65",
      reasonSummary: `Homepage score ${world.homepageScore.toFixed(2)}.`,
      rulesEvaluated: { homepageScore: world.homepageScore },
      safe: true,
      rejectionReason: null,
    },
    // Diagnostics — no recent success.
    {
      actionType: "DIAGNOSTICS",
      missionStage: "REPORTING",
      mode: "DIAGNOSTICS",
      priority: "DIAGNOSTICS",
      passType: "DIAGNOSTICS",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Run a full diagnostic sweep.",
      confidenceScore: 0.6,
      riskScore: 0.1,
      qualityExpectation: 0.5,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: "maintenance",
      stopCondition: "fresh successful pass recorded",
      reasonSummary:
        world.lastSuccessAgeMs == null
          ? "No successful pass on record."
          : `Last success ${Math.round(world.lastSuccessAgeMs / 60_000)}m ago.`,
      rulesEvaluated: { lastSuccessAgeMs: world.lastSuccessAgeMs },
      safe: true,
      rejectionReason: null,
    },
    // Maintenance — the floor action; safe to run any time.
    {
      actionType: "CLEANUP",
      missionStage: "MAINTENANCE",
      mode: "MAINTENANCE",
      priority: "MAINTENANCE",
      passType: "AUTONOMOUS",
      contentType: null,
      sourceTarget: null,
      candidateUrl: null,
      expectedOutput: "Run cleanup pass; trim stale candidates and closed reviews.",
      confidenceScore: 0.5,
      riskScore: 0.05,
      qualityExpectation: 0.4,
      urgencyScore: 0,
      sourceScore: 0,
      repairScore: 0,
      finalScore: 0,
      fallbackAction: null,
      stopCondition: "next pass",
      reasonSummary: "Floor maintenance pass.",
      rulesEvaluated: {},
      safe: true,
      rejectionReason: null,
    },
  ];
}

/** Hours since `ms` capped to [0, 168]. */
function hoursSinceCapped(ms: number | null): number {
  if (ms == null) return 168;
  return Math.min(168, Math.max(0, ms / 3_600_000));
}

/**
 * Score a single candidate action against the current world. The
 * scoring engine assigns:
 *   - urgencyScore   how time-critical the work is (security, health,
 *                    no growth in days)
 *   - sourceScore    how prepared the source side is (candidates,
 *                    reputation, freshness)
 *   - repairScore    how badly the worker needs to repair itself
 *   - qualityExpectation chance the action produces a publishable result
 * A safety filter zeros the score (and sets rejectionReason) for
 * actions that would be unsafe given the world (eg. PUBLISH while
 * paused; BUILD with no candidate URLs).
 */
function scoreAction(action: BrainAction, world: WorldState): BrainAction {
  let urgency = 0;
  let sourceScore = 0;
  let repairScore = 0;
  let quality = action.qualityExpectation;
  let safe = true;
  let rejection: string | null = null;

  switch (action.missionStage) {
    case "PAUSED":
      if (!world.isPaused) {
        safe = false;
        rejection = "Worker is not paused.";
      }
      urgency = world.isPaused ? 100 : 0;
      break;
    case "SECURITY_DEFENSE":
      urgency = world.recentSecurityBreaches24h * 50;
      if (world.recentSecurityBreaches24h === 0) {
        safe = false;
        rejection = "No confirmed breaches in last 24h.";
      }
      break;
    case "REPAIR":
      if (action.priority === "WORKER_HEALTH") {
        const stale = world.heartbeatAgeMs > 5 * 60_000;
        urgency = stale ? 40 : 0;
        if (world.currentBlocker) urgency += 30;
        repairScore = (stale ? 0.4 : 0) + (world.currentBlocker ? 0.5 : 0);
        if (!stale && !world.currentBlocker) {
          safe = false;
          rejection = "Heartbeat fresh and no blocker.";
        }
      } else {
        urgency = Math.min(20, world.failedBuildJobs * 2 + world.pendingRepairPlans * 3);
        repairScore =
          0.4 + Math.min(0.4, world.failedBuildJobs * 0.05 + world.pendingRepairPlans * 0.08);
        if (world.failedBuildJobs === 0 && world.pendingRepairPlans === 0) {
          safe = false;
          rejection = "No failed jobs or pending repair plans.";
        }
      }
      break;
    case "DISCOVERY": {
      const gap = world.contentGoalGap;
      const noCandidates = world.candidateUrlsAvailable === 0;
      const noGrowth = hoursSinceCapped(world.timeSinceLastGrowthMs);
      const queueIsDoingWork = world.pendingBuildJobs > 0 || world.runningBuildJobs > 0;
      // Drain before discover: when items are already in flight (reads to
      // extract, artifacts awaiting checklist / verification / QA /
      // publish, or candidates still to fetch), pushing those to public
      // content closes the gap faster than discovering more sources — and
      // hammering discovery while in-flight work waits is the churn that
      // starves the pipeline. Discovery stays a low floor in that state.
      const inFlight =
        world.candidateUrlsAvailable +
        world.readsAwaitingExtraction +
        world.artifactsAwaitingChecklist +
        world.artifactsAwaitingVerification +
        world.artifactsAwaitingQA +
        world.artifactsAwaitingPublish;
      urgency =
        inFlight > 0
          ? 2
          : (gap > 0 ? Math.min(20, gap * 1.5) : 0) +
            (noCandidates && !queueIsDoingWork ? 15 : 0) +
            // Only push discovery hard when the queue isn't already
            // working — otherwise let the build engine drain first.
            (queueIsDoingWork ? 0 : Math.min(10, noGrowth / 24));
      sourceScore = noCandidates ? 0.2 : 0.6;
      if (gap <= 0) {
        safe = false;
        rejection = "All content goals met — discovery not needed.";
      }
      break;
    }
    case "SOURCE_FETCH": {
      const trusted = world.trustedSources;
      // Fetching available candidates is the path that closes the gap
      // when raw candidates exist. Scale urgency with both the number of
      // ready candidates and the gap pressure so SOURCE_FETCH outranks
      // both DISCOVERY (don't keep discovering when you have unfetched
      // candidates) and PACKAGE_BUILD (you can't build before you fetch).
      urgency =
        world.candidateUrlsAvailable === 0
          ? 0
          : Math.min(48, world.candidateUrlsAvailable * 6 + (world.contentGoalGap > 0 ? 12 : 0));
      sourceScore = 0.5 + Math.min(0.4, trusted * 0.05);
      quality = world.candidateUrlsAvailable === 0 ? 0 : quality;
      if (world.candidateUrlsAvailable === 0) {
        safe = false;
        rejection = "No candidates available to fetch.";
      }
      break;
    }
    case "CLASSIFICATION": {
      urgency = Math.min(20, world.unclassifiedReads * 1.5);
      sourceScore = world.unclassifiedReads > 0 ? 0.7 : 0;
      if (world.unclassifiedReads === 0) {
        safe = false;
        rejection = "All source-reads already classified.";
      }
      break;
    }
    case "EXTRACTION": {
      urgency =
        world.readsAwaitingExtraction > 0
          ? Math.min(42, 26 + world.readsAwaitingExtraction * 4)
          : 0;
      sourceScore = world.readsAwaitingExtraction > 0 ? 0.7 : 0;
      quality = world.readsAwaitingExtraction > 0 ? 0.78 : quality;
      if (world.readsAwaitingExtraction === 0) {
        safe = false;
        rejection = "No classified reads awaiting extraction.";
      }
      break;
    }
    case "CHECKLIST_CREATION": {
      urgency =
        world.artifactsAwaitingChecklist > 0
          ? Math.min(46, 30 + world.artifactsAwaitingChecklist * 4)
          : 0;
      sourceScore = world.artifactsAwaitingChecklist > 0 ? 0.75 : 0;
      quality = world.artifactsAwaitingChecklist > 0 ? 0.82 : quality;
      if (world.artifactsAwaitingChecklist === 0) {
        safe = false;
        rejection = "No CHECKLIST_READY artifacts awaiting checklist + citations.";
      }
      break;
    }
    case "STRICT_QA": {
      urgency =
        world.artifactsAwaitingQA > 0 ? Math.min(58, 40 + world.artifactsAwaitingQA * 4) : 0;
      sourceScore = world.artifactsAwaitingQA > 0 ? 0.8 : 0;
      quality = world.artifactsAwaitingQA > 0 ? 0.85 : quality;
      if (world.artifactsAwaitingQA === 0) {
        safe = false;
        rejection = "No artifacts awaiting strict QA.";
      }
      break;
    }
    case "PUBLIC_PUBLISH": {
      // The stage that actually closes the content-goal gap — drain it
      // first so in-flight, QA-passed artifacts reach the public site
      // before the worker starts new discovery work.
      urgency =
        world.artifactsAwaitingPublish > 0
          ? Math.min(70, 50 + world.artifactsAwaitingPublish * 5)
          : 0;
      sourceScore = world.artifactsAwaitingPublish > 0 ? 0.85 : 0;
      quality = world.artifactsAwaitingPublish > 0 ? 0.9 : quality;
      if (world.artifactsAwaitingPublish === 0) {
        safe = false;
        rejection = "No QA-passed artifacts awaiting publish.";
      }
      break;
    }
    case "PACKAGE_BUILD": {
      const gap = world.contentGoalGap;
      // PACKAGE_BUILD only drains LEGACY pending build jobs. BUILD_READY
      // package artifacts are advanced directly by CROSS_SOURCE_VERIFICATION
      // (when they carry validation needs) and STRICT_QA — runPackageBuild
      // is a deferring no-op for them, so letting it compete for
      // BUILD_READY artifacts just makes the brain spin on a stage that
      // can't advance the item. Gate strictly on pending jobs.
      urgency =
        world.pendingBuildJobs > 0 ? Math.min(60, world.pendingBuildJobs * 8 + gap * 1.5) : 0;
      sourceScore = world.pendingBuildJobs > 0 ? 0.8 : 0.1;
      quality = world.pendingBuildJobs > 0 ? 0.85 : quality;
      if (world.pendingBuildJobs === 0) {
        safe = false;
        rejection =
          "No pending build jobs (BUILD_READY artifacts advance via QA, not PACKAGE_BUILD).";
      }
      break;
    }
    case "CROSS_SOURCE_VERIFICATION": {
      // Sensitive content (saint feast day, novena day count, sacrament
      // identity, …) MUST gather stored cross-source evidence BEFORE
      // strict QA — otherwise the validation dimension scores zero and
      // the artifact fails QA. So this stage out-ranks STRICT_QA whenever
      // a BUILD_READY artifact still needs validation evidence.
      const needsVerification = world.artifactsAwaitingVerification;
      urgency =
        needsVerification > 0
          ? Math.min(62, 46 + needsVerification * 4)
          : Math.min(20, world.pendingQAReviews * 4);
      quality = needsVerification > 0 || world.pendingQAReviews > 0 ? 0.85 : quality;
      if (needsVerification === 0 && world.pendingQAReviews === 0) {
        safe = false;
        rejection = "No artifacts awaiting cross-source evidence and no pending QA reviews.";
      }
      break;
    }
    case "POST_PUBLISH_VERIFY":
      urgency = Math.min(20, world.publishedButUnverified * 0.5);
      quality = 0.9;
      if (world.publishedButUnverified === 0) {
        safe = false;
        rejection = "All published content already verified.";
      }
      break;
    case "HOMEPAGE_WORK":
      urgency = world.homepageScore < 0.65 ? 15 : 0;
      quality = 0.65;
      if (world.homepageScore >= 0.65) {
        safe = false;
        rejection = `Homepage score ${world.homepageScore.toFixed(2)} already above threshold.`;
      }
      break;
    case "REPORTING":
      urgency = world.lastSuccessAgeMs == null ? 25 : world.lastSuccessAgeMs > 60 * 60_000 ? 15 : 0;
      quality = 0.5;
      if (world.lastSuccessAgeMs != null && world.lastSuccessAgeMs <= 60 * 60_000) {
        safe = false;
        rejection = "Recent successful pass — diagnostics not urgent.";
      }
      break;
    case "MAINTENANCE":
      urgency = 1;
      sourceScore = 0;
      quality = 0.4;
      break;
    default:
      break;
  }

  // Doctrinal-sensitivity risk bump: actions that publish or persist
  // doctrinally sensitive content carry higher risk by default; the
  // brain prefers verification-heavy actions when verification is due.
  const doctrinalSensitive =
    action.missionStage === "PUBLIC_PUBLISH" || action.missionStage === "PERSISTENCE";
  const baseRisk = doctrinalSensitive ? action.riskScore + 0.1 : action.riskScore;

  // Final score combines the dimensions. Urgency dominates so the
  // brain reaches for the most time-critical safe action first; the
  // other dimensions break ties.
  const finalScore = safe
    ? urgency + sourceScore * 5 + repairScore * 4 + quality * 3 - baseRisk * 2
    : 0;

  return {
    ...action,
    urgencyScore: urgency,
    sourceScore,
    repairScore,
    qualityExpectation: quality,
    riskScore: baseRisk,
    finalScore,
    safe,
    rejectionReason: rejection,
  };
}

/**
 * Build the ranked alternatives list. Highest finalScore first. Unsafe
 * actions stay in the list (so the audit view can show "considered
 * but unsafe") but always sort behind any safe action.
 *
 * Spec §12 follow-up: applyFatigue lets the brain back off from a
 * mission stage that has been failing repeatedly. If we see the same
 * stage in the most recent N decisions with no advancement, its
 * urgency is decayed so the brain rotates to a different action.
 */
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
  opts: { passId?: string } = {},
): Promise<BrainDecision> {
  const [world, feedback] = await Promise.all([
    sampleWorld(prisma),
    sampleExecutionFeedback(prisma).catch(
      () => ({ recentFailedStages: {}, recentlyAdvanced: new Set<string>() }) as ExecutionFeedback,
    ),
  ]);
  const decision = decide(world, feedback);

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

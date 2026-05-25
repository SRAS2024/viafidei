/**
 * AdminWorkerBrain — the explicit coded intelligence of the Admin
 * Worker. Runs before every pass: gathers world state, evaluates rules,
 * and emits a structured BrainDecision that explains exactly what the
 * worker chose to do next and why.
 *
 * Hard rules (spec sections 1, 4):
 *   - No AI APIs. Deterministic rules + scoring only.
 *   - Reads only stored state (DB rows + memory). Never invents facts.
 *   - Records every decision in AdminWorkerDecision so the operator
 *     can audit "why did the worker do that?" without re-running.
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

/**
 * The structured decision object the brain emits. Every field is
 * required (some may be null) so the audit view always has the same
 * shape. Spec §2.
 */
export interface BrainDecision {
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
}

/**
 * Sample the world state the brain needs to make a decision. Each
 * field is a count or a small scalar; the brain doesn't load full
 * rows so a pass stays cheap even when the queues are large.
 */
export async function sampleWorld(prisma: PrismaClient): Promise<WorldState> {
  await refreshContentGoals(prisma).catch(() => undefined);
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
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.homepageQualityScore.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.candidateSourceUrl.count({ where: { status: { in: ["DISCOVERED", "PRIORITIZED"] } } }),
    prisma.adminWorkerRepairPlan.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    prisma.adminWorkerPipelineStage.count({ where: { status: "BLOCKED" } }),
    nextPriorityContentType(prisma),
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
  };
}

/**
 * Deterministic brain. Given a sampled world, picks the next best
 * action by walking a priority ladder.
 *
 * Priority order (spec section 2):
 *   1. confirmed security threat response
 *   2. worker health + queue recovery
 *   3. content types below threshold
 *   4. failed source repair
 *   5. content package building
 *   6. content validation
 *   7. public publishing
 *   8. homepage maintenance
 *   9. diagnostics and reporting
 *  10. scheduled cleanup
 *  11. scheduled maintenance
 */
export function decide(world: WorldState): BrainDecision {
  if (world.isPaused) {
    return {
      chosenMode: "PAUSED",
      chosenPriority: "SECURITY_THREAT",
      chosenTaskType: "SECURITY_DEFENSE",
      passType: "SECURITY",
      contentType: null,
      sourceTarget: null,
      expectedResult: "Security defender stays online; nothing else runs.",
      confidenceScore: 1,
      riskScore: 0,
      reason: `Admin Worker is paused${world.pausedReason ? ` (${world.pausedReason})` : ""}.`,
      fallbackAction: null,
      repairAction: null,
      rulesEvaluated: { isPaused: true },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 1. Security threat.
  if (world.recentSecurityBreaches24h > 0) {
    return {
      chosenMode: "SECURITY_DEFENSE",
      chosenPriority: "SECURITY_THREAT",
      chosenTaskType: "SECURITY_DEFENSE",
      passType: "SECURITY",
      contentType: null,
      sourceTarget: null,
      expectedResult: "Defender records actions for recent breaches.",
      confidenceScore: 0.95,
      riskScore: 0.2,
      reason: `${world.recentSecurityBreaches24h} confirmed security breach(es) in the last 24h.`,
      fallbackAction: null,
      repairAction: null,
      rulesEvaluated: { recentSecurityBreaches24h: world.recentSecurityBreaches24h },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 2. Worker health / queue recovery.
  const heartbeatStale = world.heartbeatAgeMs > 5 * 60_000;
  if (heartbeatStale || world.currentBlocker) {
    return {
      chosenMode: "REPAIR",
      chosenPriority: "WORKER_HEALTH",
      chosenTaskType: "REPAIR",
      passType: "SOURCE_REPAIR",
      contentType: null,
      sourceTarget: null,
      expectedResult: "Repair stuck queue / heartbeat / current blocker.",
      confidenceScore: 0.8,
      riskScore: 0.3,
      reason: heartbeatStale
        ? `Heartbeat is ${Math.round(world.heartbeatAgeMs / 1000)}s stale.`
        : `Blocker active: ${world.currentBlocker}.`,
      fallbackAction: "diagnostics",
      repairAction: heartbeatStale ? "log heartbeat + signal restart" : "clear blocker",
      rulesEvaluated: {
        heartbeatAgeMs: world.heartbeatAgeMs,
        currentBlocker: world.currentBlocker,
      },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 3. Content type below threshold.
  if (world.contentGoalGap > 0) {
    return {
      chosenMode: "CONSTANT_FILL",
      chosenPriority: "CONTENT_GOAL",
      chosenTaskType: world.candidateUrlsAvailable > 0 ? "BUILD_CONTENT" : "DISCOVER_SOURCE",
      passType: "CONTENT_GOAL",
      contentType: world.contentGoalContentType,
      sourceTarget: null,
      expectedResult: `Close gap of ${world.contentGoalGap} for ${world.contentGoalContentType ?? "content"}.`,
      confidenceScore: 0.85,
      riskScore: 0.2,
      reason: `Content gap of ${world.contentGoalGap} on ${world.contentGoalContentType ?? "unknown"}.`,
      fallbackAction: "diagnostics",
      repairAction: null,
      rulesEvaluated: {
        contentGoalGap: world.contentGoalGap,
        contentGoalContentType: world.contentGoalContentType,
        candidateUrlsAvailable: world.candidateUrlsAvailable,
      },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 4. Failed-source repair.
  if (world.failedBuildJobs > 0 || world.pendingRepairPlans > 0) {
    return {
      chosenMode: "REPAIR",
      chosenPriority: "SOURCE_REPAIR",
      chosenTaskType: "REPAIR",
      passType: "SOURCE_REPAIR",
      contentType: null,
      sourceTarget: null,
      expectedResult: "Clear failed build jobs + execute pending repair plans.",
      confidenceScore: 0.75,
      riskScore: 0.25,
      reason: `${world.failedBuildJobs} failed build(s), ${world.pendingRepairPlans} pending repair plan(s).`,
      fallbackAction: "diagnostics",
      repairAction: "execute repair plans",
      rulesEvaluated: {
        failedBuildJobs: world.failedBuildJobs,
        pendingRepairPlans: world.pendingRepairPlans,
      },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 5. Pending build jobs (the queue is non-empty).
  if (world.pendingBuildJobs > 0) {
    return {
      chosenMode: "CONSTANT_FILL",
      chosenPriority: "CONTENT_BUILD",
      chosenTaskType: "BUILD_CONTENT",
      passType: "CONTENT_GOAL",
      contentType: null,
      sourceTarget: null,
      expectedResult: `Drain ${world.pendingBuildJobs} pending build job(s).`,
      confidenceScore: 0.9,
      riskScore: 0.15,
      reason: `${world.pendingBuildJobs} pending build job(s) on the queue.`,
      fallbackAction: "maintenance",
      repairAction: null,
      rulesEvaluated: { pendingBuildJobs: world.pendingBuildJobs },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 8. Homepage maintenance.
  if (world.homepageScore < 0.65) {
    return {
      chosenMode: "HOMEPAGE",
      chosenPriority: "HOMEPAGE",
      chosenTaskType: "UPDATE_HOMEPAGE",
      passType: "HOMEPAGE",
      contentType: null,
      sourceTarget: null,
      expectedResult: "File a homepage draft to improve the score.",
      confidenceScore: 0.7,
      riskScore: 0.3,
      reason: `Homepage score ${world.homepageScore.toFixed(2)} below 0.65 threshold.`,
      fallbackAction: "maintenance",
      repairAction: null,
      rulesEvaluated: { homepageScore: world.homepageScore },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 9. Diagnostics.
  if (world.lastSuccessAgeMs == null || world.lastSuccessAgeMs > 60 * 60_000) {
    return {
      chosenMode: "DIAGNOSTICS",
      chosenPriority: "DIAGNOSTICS",
      chosenTaskType: "DIAGNOSTICS",
      passType: "DIAGNOSTICS",
      contentType: null,
      sourceTarget: null,
      expectedResult: "Run a full diagnostic sweep.",
      confidenceScore: 0.6,
      riskScore: 0.1,
      reason: "No recent successful pass; running diagnostics.",
      fallbackAction: "maintenance",
      repairAction: null,
      rulesEvaluated: { lastSuccessAgeMs: world.lastSuccessAgeMs },
      memoryUsed: {},
      sourceReputationUsed: [],
    };
  }

  // 11. Maintenance default.
  return {
    chosenMode: "MAINTENANCE",
    chosenPriority: "MAINTENANCE",
    chosenTaskType: "CLEANUP",
    passType: "AUTONOMOUS",
    contentType: null,
    sourceTarget: null,
    expectedResult: "Run cleanup pass; goals met.",
    confidenceScore: 0.5,
    riskScore: 0.05,
    reason: "All goals met, no failures, no urgent work. Maintenance pass.",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {
      contentGoalGap: 0,
      pendingBuildJobs: 0,
      homepageScore: world.homepageScore,
    },
    memoryUsed: {},
    sourceReputationUsed: [],
  };
}

/**
 * High-level entry point. Samples the world, runs the brain, and
 * records the decision in AdminWorkerDecision so the audit view can
 * surface it later.
 */
export async function runBrain(
  prisma: PrismaClient,
  opts: { passId?: string } = {},
): Promise<BrainDecision> {
  const world = await sampleWorld(prisma);
  const decision = decide(world);

  await recordDecision(prisma, {
    passId: opts.passId,
    decisionType: "brain_pass",
    inputSummary: JSON.stringify(world).slice(0, 480),
    rulesEvaluated: decision.rulesEvaluated as Prisma.InputJsonValue,
    chosenAction: `${decision.chosenMode}:${decision.chosenPriority}`,
    confidence: decision.confidenceScore,
    reason: decision.reason,
    fallbackAction: decision.fallbackAction ?? undefined,
  });

  return decision;
}

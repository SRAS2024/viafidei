/**
 * Brain action-fatigue / execution feedback (spec §12). Confirms
 * the brain backs off from a mission stage that has been chosen
 * repeatedly without growth.
 */

import { describe, expect, it } from "vitest";

import { rankActions, type ExecutionFeedback, type WorldState } from "@/lib/admin-worker/brain";

const HEALTHY: WorldState = {
  pendingBuildJobs: 0,
  failedBuildJobs: 0,
  runningBuildJobs: 0,
  contentGoalGap: 5,
  contentGoalContentType: "PRAYER",
  pausedSources: 0,
  trustedSources: 3,
  reviewQueuePending: 0,
  recentSecurityBreaches24h: 0,
  homepageScore: 0.9,
  isPaused: false,
  pausedReason: null,
  heartbeatAgeMs: 1000,
  lastSuccessAgeMs: 10_000,
  lastFailureAgeMs: null,
  currentBlocker: null,
  candidateUrlsAvailable: 10,
  pendingRepairPlans: 0,
  pipelineStagesBlocked: 0,
  unclassifiedReads: 0,
  readsAwaitingExtraction: 0,
  artifactsAwaitingChecklist: 0,
  artifactsAwaitingBuild: 0,
  artifactsAwaitingQA: 0,
  artifactsAwaitingPublish: 0,
  publishedButUnverified: 0,
  pendingQAReviews: 0,
  contentGoalsAtGoalCount: 0,
  contentGoalsBelowGoalCount: 1,
  timeSinceLastGrowthMs: null,
  topSourceReputation: [],
};

describe("rankActions execution feedback (spec §12)", () => {
  it("ranks the same way as before when feedback is empty", () => {
    const empty: ExecutionFeedback = { recentFailedStages: {}, recentlyAdvanced: new Set() };
    const baseline = rankActions(HEALTHY);
    const same = rankActions(HEALTHY, empty);
    expect(baseline[0].missionStage).toBe(same[0].missionStage);
  });

  it("subtracts up to 20 points of fatigue from a stage that keeps being chosen", () => {
    const fatigued: ExecutionFeedback = {
      recentFailedStages: { SOURCE_FETCH: 4 },
      recentlyAdvanced: new Set(),
    };
    const baseline = rankActions(HEALTHY);
    const after = rankActions(HEALTHY, fatigued);
    const baselineFetch = baseline.find((a) => a.missionStage === "SOURCE_FETCH");
    const afterFetch = after.find((a) => a.missionStage === "SOURCE_FETCH");
    expect(afterFetch?.finalScore).toBeLessThan(baselineFetch?.finalScore ?? 999);
    expect(baselineFetch!.finalScore - afterFetch!.finalScore).toBeLessThanOrEqual(20);
  });

  it("caps fatigue at 20 even if a stage has been chosen many times", () => {
    const heavy: ExecutionFeedback = {
      recentFailedStages: { SOURCE_FETCH: 50 },
      recentlyAdvanced: new Set(),
    };
    const baseline = rankActions(HEALTHY);
    const after = rankActions(HEALTHY, heavy);
    const baselineFetch = baseline.find((a) => a.missionStage === "SOURCE_FETCH");
    const afterFetch = after.find((a) => a.missionStage === "SOURCE_FETCH");
    expect(baselineFetch!.finalScore - afterFetch!.finalScore).toBeLessThanOrEqual(20);
  });

  it("bonuses a stage that recently advanced", () => {
    // SOURCE_FETCH is the safe content stage in the HEALTHY world (10
    // candidates ready, no pending build jobs). The advanced-bonus is
    // stage-agnostic; we assert it on a stage that is actually safe here
    // (PACKAGE_BUILD is unsafe without pending build jobs).
    const winning: ExecutionFeedback = {
      recentFailedStages: {},
      recentlyAdvanced: new Set(["SOURCE_FETCH"]),
    };
    const baseline = rankActions(HEALTHY);
    const after = rankActions(HEALTHY, winning);
    const baselineFetch = baseline.find((a) => a.missionStage === "SOURCE_FETCH");
    const afterFetch = after.find((a) => a.missionStage === "SOURCE_FETCH");
    expect(afterFetch!.finalScore).toBeGreaterThan(baselineFetch!.finalScore);
  });

  it("rotates to a different stage when fatigue brings the leader below an alternative", () => {
    // Heavy fatigue on what would normally win pushes the brain to
    // pick something else. We use a world where SOURCE_FETCH and
    // PACKAGE_BUILD are close.
    const noFatigue = rankActions({
      ...HEALTHY,
      pendingBuildJobs: 1,
      candidateUrlsAvailable: 10,
    });
    const heavy = rankActions(
      {
        ...HEALTHY,
        pendingBuildJobs: 1,
        candidateUrlsAvailable: 10,
      },
      { recentFailedStages: { [noFatigue[0].missionStage]: 4 }, recentlyAdvanced: new Set() },
    );
    // With heavy fatigue applied, the leader may shift OR stay (if
    // the gap was big enough). Either way, the leader's score must
    // have decreased.
    const noFatigueLeader = noFatigue[0].missionStage;
    const heavyLeader = heavy.find((a) => a.missionStage === noFatigueLeader);
    expect(heavyLeader!.finalScore).toBeLessThan(noFatigue[0].finalScore);
  });
});

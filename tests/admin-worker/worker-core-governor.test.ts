/**
 * Governor ladder (audit DG-2): POST_PUBLISH_VERIFY — a ~3,400-item queue of
 * already-public rows drained one per pass — must never outrank SOURCE_FETCH
 * when candidates sit unfetched, and its "successes" must not mask a growth
 * stall.
 */
import { describe, expect, it } from "vitest";

import type { WorldState } from "@/lib/admin-worker/brain";
import { computeGovernorVerdict, type GovernorOutcomeRow } from "@/lib/admin-worker/governor";

function world(overrides: Partial<WorldState> = {}): WorldState {
  return {
    pendingBuildJobs: 0,
    failedBuildJobs: 0,
    runningBuildJobs: 0,
    contentGoalGap: 7203,
    contentGoalContentType: "SAINT",
    pausedSources: 0,
    trustedSources: 0,
    reviewQueuePending: 0,
    recentSecurityBreaches24h: 0,
    homepageScore: 1,
    isPaused: false,
    pausedReason: null,
    heartbeatAgeMs: 0,
    lastSuccessAgeMs: 0,
    lastFailureAgeMs: null,
    currentBlocker: null,
    candidateUrlsAvailable: 600,
    candidatesNeedingPrioritization: 0,
    pendingRepairPlans: 0,
    pipelineStagesBlocked: 0,
    unclassifiedReads: 0,
    readsAwaitingExtraction: 0,
    artifactsAwaitingChecklist: 0,
    artifactsAwaitingBuild: 0,
    artifactsAwaitingVerification: 0,
    artifactsAwaitingQA: 0,
    artifactsAwaitingPublish: 0,
    publishedButUnverified: 3400,
    pendingQAReviews: 0,
    contentGoalsAtGoalCount: 0,
    contentGoalsBelowGoalCount: 1,
    timeSinceLastGrowthMs: null,
    topSourceReputation: [],
    ...overrides,
  };
}

const BASE = { windowMinutes: 15, minSamples: 3, maxEntityRetries: 3 };

function rows(stage: string, n: number, resultType: string): GovernorOutcomeRow[] {
  return Array.from({ length: n }, () => ({
    stage,
    resultType,
    result: resultType === "success" ? "advanced" : "idle",
    entityId: null,
  }));
}

describe("governor ladder vs POST_PUBLISH_VERIFY", () => {
  it("forces SOURCE_FETCH over POST_PUBLISH_VERIFY when candidates sit unfetched", () => {
    const v = computeGovernorVerdict({
      world: world(),
      chosenStage: "EXTRACTION",
      rows: [...rows("EXTRACTION", 3, "no_op"), ...rows("POST_PUBLISH_VERIFY", 2, "success")],
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.forcedStage).toBe("SOURCE_FETCH");
  });

  it("verify successes do NOT mask a growth stall", () => {
    // Only verify has "advanced" in the window; nothing moved toward NEW content.
    const v = computeGovernorVerdict({
      world: world(),
      chosenStage: "DISCOVERY",
      rows: [...rows("POST_PUBLISH_VERIFY", 4, "success"), ...rows("DISCOVERY", 2, "no_op")],
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.reason).toMatch(/growth stalled/);
  });

  it("still falls back to POST_PUBLISH_VERIFY when nothing else downstream has work", () => {
    const v = computeGovernorVerdict({
      world: world({ candidateUrlsAvailable: 0 }),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 3, "no_op"),
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.forcedStage).toBe("POST_PUBLISH_VERIFY");
  });
});

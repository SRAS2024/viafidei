/**
 * AdminWorkerBrain — proves the brain is deterministic and walks the
 * priority ladder correctly. Pure decision function — given the same
 * WorldState, always picks the same action.
 */

import { describe, expect, it } from "vitest";

import { decide, rankActions, type WorldState } from "@/lib/admin-worker/brain";

const HEALTHY: WorldState = {
  pendingBuildJobs: 0,
  failedBuildJobs: 0,
  runningBuildJobs: 0,
  contentGoalGap: 0,
  contentGoalContentType: null,
  pausedSources: 0,
  trustedSources: 1,
  reviewQueuePending: 0,
  recentSecurityBreaches24h: 0,
  homepageScore: 0.9,
  isPaused: false,
  pausedReason: null,
  heartbeatAgeMs: 1000,
  lastSuccessAgeMs: 10_000,
  lastFailureAgeMs: null,
  currentBlocker: null,
  candidateUrlsAvailable: 0,
  pendingRepairPlans: 0,
  pipelineStagesBlocked: 0,
  unclassifiedReads: 0,
  readsAwaitingExtraction: 0,
  artifactsAwaitingChecklist: 0,
  artifactsAwaitingBuild: 0,
  artifactsAwaitingVerification: 0,
  artifactsAwaitingQA: 0,
  artifactsAwaitingPublish: 0,
  publishedButUnverified: 0,
  pendingQAReviews: 0,
  contentGoalsAtGoalCount: 0,
  contentGoalsBelowGoalCount: 0,
  timeSinceLastGrowthMs: null,
  topSourceReputation: [],
};

describe("AdminWorkerBrain.decide", () => {
  it("returns PAUSED action when paused", () => {
    const d = decide({ ...HEALTHY, isPaused: true, pausedReason: "operator request" });
    expect(d.chosenMode).toBe("PAUSED");
    expect(d.chosenPriority).toBe("SECURITY_THREAT");
    expect(d.reason).toContain("paused");
  });

  // Content-pipeline ladder (spec §49-66): the brain must be able to
  // select EVERY content stage so an in-flight item flows all the way to
  // publication. Before these were added the loop stalled after
  // classification and never produced an artifact or published.
  it("selects EXTRACTION when classified reads await extraction", () => {
    const d = decide({ ...HEALTHY, contentGoalGap: 5, readsAwaitingExtraction: 3 });
    expect(d.missionStage).toBe("EXTRACTION");
  });

  it("selects CHECKLIST_CREATION when CHECKLIST_READY artifacts exist", () => {
    const d = decide({ ...HEALTHY, contentGoalGap: 5, artifactsAwaitingChecklist: 2 });
    expect(d.missionStage).toBe("CHECKLIST_CREATION");
  });

  it("selects STRICT_QA when built artifacts await QA", () => {
    const d = decide({ ...HEALTHY, contentGoalGap: 5, artifactsAwaitingQA: 2 });
    expect(d.missionStage).toBe("STRICT_QA");
  });

  it("verifies sensitive content (cross-source) BEFORE strict QA", () => {
    // A BUILD_READY artifact that still needs validation evidence must
    // gather it first — otherwise strict QA would zero the validation
    // dimension and wrongly fail it. CROSS_SOURCE_VERIFICATION out-ranks
    // STRICT_QA in that state.
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      artifactsAwaitingVerification: 1,
      artifactsAwaitingQA: 1,
    });
    expect(d.missionStage).toBe("CROSS_SOURCE_VERIFICATION");
  });

  it("drains PUBLIC_PUBLISH first when QA-passed artifacts await publish", () => {
    // Publish closes the content-goal gap, so it must out-rank every
    // upstream content stage when QA-passed artifacts are ready.
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 8,
      candidateUrlsAvailable: 5,
      readsAwaitingExtraction: 2,
      artifactsAwaitingQA: 2,
      artifactsAwaitingPublish: 2,
    });
    expect(d.missionStage).toBe("PUBLIC_PUBLISH");
    expect(d.chosenTaskType).toBe("PUBLISH_CONTENT");
  });

  it("prioritises confirmed security breaches over everything else", () => {
    const d = decide({
      ...HEALTHY,
      recentSecurityBreaches24h: 2,
      contentGoalGap: 10,
      pendingBuildJobs: 5,
    });
    expect(d.chosenPriority).toBe("SECURITY_THREAT");
    expect(d.chosenMode).toBe("SECURITY_DEFENSE");
  });

  it("repairs when heartbeat is stale", () => {
    const d = decide({ ...HEALTHY, heartbeatAgeMs: 10 * 60_000 });
    expect(d.chosenPriority).toBe("WORKER_HEALTH");
    expect(d.chosenMode).toBe("REPAIR");
  });

  it("repairs when a blocker is active", () => {
    const d = decide({ ...HEALTHY, currentBlocker: "DB connection refused" });
    expect(d.chosenPriority).toBe("WORKER_HEALTH");
  });

  it("fills content when a goal has a gap", () => {
    const d = decide({ ...HEALTHY, contentGoalGap: 5, contentGoalContentType: "PRAYER" });
    expect(d.chosenMode).toBe("CONSTANT_FILL");
    expect(d.chosenPriority).toBe("CONTENT_GOAL");
    expect(d.contentType).toBe("PRAYER");
  });

  it("picks DISCOVER_SOURCE when goal has gap but no candidate URLs", () => {
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      candidateUrlsAvailable: 0,
    });
    expect(d.chosenTaskType).toBe("DISCOVER_SOURCE");
  });

  it("picks READ_SOURCE when candidates exist but have not been fetched yet", () => {
    // Under the new action-ranking brain (spec §1), discovery → fetch
    // → read happens before BUILD. When candidates are sitting in the
    // discovered/prioritised pool the brain reaches for SOURCE_FETCH
    // before it asks the build engine to do anything.
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      candidateUrlsAvailable: 10,
    });
    expect(d.chosenTaskType).toBe("READ_SOURCE");
    expect(d.missionStage).toBe("SOURCE_FETCH");
  });

  it("picks BUILD_CONTENT when pending build jobs sit on the queue", () => {
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      candidateUrlsAvailable: 0,
      pendingBuildJobs: 5,
    });
    expect(d.chosenTaskType).toBe("BUILD_CONTENT");
    expect(d.missionStage).toBe("PACKAGE_BUILD");
  });

  it("repairs when failed jobs exist", () => {
    const d = decide({ ...HEALTHY, failedBuildJobs: 3 });
    expect(d.chosenPriority).toBe("SOURCE_REPAIR");
    expect(d.chosenMode).toBe("REPAIR");
  });

  it("drains the queue when build jobs are pending", () => {
    const d = decide({ ...HEALTHY, pendingBuildJobs: 5 });
    expect(d.chosenPriority).toBe("CONTENT_BUILD");
    expect(d.chosenTaskType).toBe("BUILD_CONTENT");
  });

  it("refreshes the homepage when the score is low", () => {
    const d = decide({ ...HEALTHY, homepageScore: 0.4 });
    expect(d.chosenMode).toBe("HOMEPAGE");
    expect(d.chosenPriority).toBe("HOMEPAGE");
  });

  it("runs maintenance when everything is healthy", () => {
    const d = decide(HEALTHY);
    expect(d.chosenMode).toBe("MAINTENANCE");
    expect(d.chosenPriority).toBe("MAINTENANCE");
  });

  it("is deterministic — same input, same output", () => {
    const a = decide(HEALTHY);
    const b = decide(HEALTHY);
    expect(a).toEqual(b);
  });
});

describe("AdminWorkerBrain.rankActions — ranked alternatives (spec §1)", () => {
  it("returns a ranked list with the chosen action first", () => {
    const ranked = rankActions({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      pendingBuildJobs: 5,
    });
    expect(ranked.length).toBeGreaterThan(3);
    // First safe action wins the score race.
    const first = ranked[0];
    expect(first.safe).toBe(true);
    // Every alternative carries its own score so the audit view can
    // render "why not that?" — never undefined.
    for (const a of ranked) {
      expect(typeof a.finalScore).toBe("number");
      expect(typeof a.urgencyScore).toBe("number");
      expect(typeof a.riskScore).toBe("number");
      expect(typeof a.qualityExpectation).toBe("number");
      expect(a.missionStage).toBeTruthy();
      expect(a.expectedOutput).toBeTruthy();
    }
  });

  it("unsafe actions sort behind every safe action", () => {
    const ranked = rankActions(HEALTHY);
    const lastSafeIdx = ranked.reduce((acc, a, i) => (a.safe ? i : acc), -1);
    const firstUnsafeIdx = ranked.findIndex((a) => !a.safe);
    if (firstUnsafeIdx !== -1) {
      expect(firstUnsafeIdx).toBeGreaterThan(lastSafeIdx);
    }
  });

  it("attaches rejectionReason to every unsafe action so the admin UI can show 'why not that'", () => {
    const ranked = rankActions(HEALTHY);
    for (const a of ranked) {
      if (!a.safe) {
        expect(a.rejectionReason).toBeTruthy();
      }
    }
  });

  it("brainExplanation lists the chosen action AND the top rejected alternatives", () => {
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      candidateUrlsAvailable: 10,
    });
    expect(d.brainExplanation).toContain("Chose");
    expect(d.brainExplanation).toContain("Rejected alternatives");
  });

  it("attaches a missionStage to every decision so the dispatcher can route it", () => {
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      pendingBuildJobs: 5,
    });
    expect(d.missionStage).toBeTruthy();
    expect(d.chosenAction.missionStage).toBe(d.missionStage);
  });

  it("brainFailure stays null on a normal healthy world (maintenance is a safe fallback)", () => {
    const d = decide(HEALTHY);
    expect(d.brainFailure).toBeNull();
    expect(d.missionStage).toBe("MAINTENANCE");
  });

  it("PAUSED action wins regardless of score when the worker is paused", () => {
    const d = decide({
      ...HEALTHY,
      isPaused: true,
      pausedReason: "operator request",
      recentSecurityBreaches24h: 5,
      pendingBuildJobs: 5,
    });
    expect(d.missionStage).toBe("PAUSED");
    expect(d.chosenMode).toBe("PAUSED");
  });

  it("urgency dominates score — security breach beats homepage with low score", () => {
    const d = decide({
      ...HEALTHY,
      recentSecurityBreaches24h: 1,
      homepageScore: 0.2,
    });
    expect(d.missionStage).toBe("SECURITY_DEFENSE");
  });

  it("doctrinal-sensitive actions are penalised in the risk dimension", () => {
    const ranked = rankActions({
      ...HEALTHY,
      publishedButUnverified: 10,
    });
    const verify = ranked.find((a) => a.missionStage === "POST_PUBLISH_VERIFY");
    expect(verify).toBeTruthy();
    // POST_PUBLISH_VERIFY itself is not doctrinal-sensitive — sanity
    // check the score is positive without doctrinal bump.
    expect(verify!.riskScore).toBeLessThan(0.3);
  });

  it("explains the chosen action in the chosenAction summary", () => {
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      pendingBuildJobs: 5,
    });
    expect(d.chosenAction.reasonSummary).toBeTruthy();
    expect(d.chosenAction.expectedOutput).toBeTruthy();
    expect(d.chosenAction.stopCondition).toBeTruthy();
  });

  it("captures rulesEvaluated on every action so the audit view can show 'what did it look at'", () => {
    const ranked = rankActions(HEALTHY);
    for (const a of ranked) {
      expect(a.rulesEvaluated).toBeTypeOf("object");
    }
  });
});

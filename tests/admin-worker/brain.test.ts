/**
 * AdminWorkerBrain — proves the brain is deterministic and walks the
 * priority ladder correctly. Pure decision function — given the same
 * WorldState, always picks the same action.
 */

import { describe, expect, it } from "vitest";

import { decide, type WorldState } from "@/lib/admin-worker/brain";

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
};

describe("AdminWorkerBrain.decide", () => {
  it("returns PAUSED action when paused", () => {
    const d = decide({ ...HEALTHY, isPaused: true, pausedReason: "operator request" });
    expect(d.chosenMode).toBe("PAUSED");
    expect(d.chosenPriority).toBe("SECURITY_THREAT");
    expect(d.reason).toContain("paused");
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

  it("picks BUILD_CONTENT when candidates exist", () => {
    const d = decide({
      ...HEALTHY,
      contentGoalGap: 5,
      contentGoalContentType: "PRAYER",
      candidateUrlsAvailable: 10,
    });
    expect(d.chosenTaskType).toBe("BUILD_CONTENT");
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

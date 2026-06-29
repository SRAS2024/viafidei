/**
 * The pipeline governor. It reads the per-stage outcome ledger over a short
 * window and forces productive forward movement when the worker fixates on a
 * non-productive stage or content growth stalls — without ever bypassing a
 * QA/publish gate. These cover the deterministic verdict logic (injected rows,
 * no DB), the env toggle, and the evaluateGovernor IO seam.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type { WorldState } from "@/lib/admin-worker/brain";
import {
  computeGovernorVerdict,
  evaluateGovernor,
  governorEnabled,
  type GovernorOutcomeRow,
} from "@/lib/admin-worker/governor";

function world(overrides: Partial<WorldState> = {}): WorldState {
  return {
    pendingBuildJobs: 0,
    failedBuildJobs: 0,
    runningBuildJobs: 0,
    contentGoalGap: 0,
    contentGoalContentType: null,
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
    candidateUrlsAvailable: 0,
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
    publishedButUnverified: 0,
    pendingQAReviews: 0,
    contentGoalsAtGoalCount: 0,
    contentGoalsBelowGoalCount: 0,
    timeSinceLastGrowthMs: null,
    topSourceReputation: [],
    ...overrides,
  };
}

function rows(
  stage: string,
  n: number,
  resultType: string,
  entityId: string | null = null,
): GovernorOutcomeRow[] {
  const result =
    resultType === "success"
      ? "advanced"
      : resultType === "needs_repair"
        ? "repair-planned"
        : "idle";
  return Array.from({ length: n }, () => ({ stage, resultType, result, entityId }));
}

const BASE = { windowMinutes: 15, minSamples: 3, maxEntityRetries: 3 };

describe("computeGovernorVerdict", () => {
  it("leaves a stage that is advancing alone", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 10, artifactsAwaitingQA: 5 }),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 4, "success"),
      ...BASE,
    });
    expect(v.intervene).toBe(false);
  });

  it("does not intervene below the minimum sample count", () => {
    const v = computeGovernorVerdict({
      world: world(),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 2, "needs_repair"),
      ...BASE,
    });
    expect(v.intervene).toBe(false);
  });

  it("forces the highest-priority productive downstream stage when extraction fixates", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 10, artifactsAwaitingQA: 5 }),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 3, "needs_repair", "read-1"),
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.fixatedStage).toBe("EXTRACTION");
    expect(v.forcedStage).toBe("STRICT_QA");
    expect(v.reason).toMatch(/EXTRACTION/);
  });

  it("never intervenes when paused", () => {
    const v = computeGovernorVerdict({
      world: world({ isPaused: true, contentGoalGap: 99, artifactsAwaitingQA: 5 }),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 5, "needs_repair"),
      ...BASE,
    });
    expect(v.intervene).toBe(false);
  });

  it("prefers PUBLIC_PUBLISH over QA when publishable work waits", () => {
    const v = computeGovernorVerdict({
      world: world({ artifactsAwaitingQA: 5, artifactsAwaitingPublish: 2 }),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 3, "no_op"),
      ...BASE,
    });
    expect(v.forcedStage).toBe("PUBLIC_PUBLISH");
  });

  it("forces a terminal diagnostic stage when nothing downstream is productive", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 40 }), // all queues empty
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 3, "needs_repair"),
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.forcedStage).toBe("REPORTING"); // no repair work pending
  });

  it("never forces into a stage that has only spun (no advance) in the window", () => {
    const v = computeGovernorVerdict({
      world: world({ artifactsAwaitingQA: 5 }), // only QA has queued work
      chosenStage: "EXTRACTION",
      rows: [...rows("EXTRACTION", 3, "needs_repair"), ...rows("STRICT_QA", 3, "needs_repair")],
      ...BASE,
    });
    // STRICT_QA only spun → ineligible → falls through to a terminal stage.
    expect(v.forcedStage).not.toBe("STRICT_QA");
    expect(["REPAIR", "REPORTING", "MAINTENANCE"]).toContain(v.forcedStage);
  });

  it("still forces a stage that advanced at least once even if it also spun", () => {
    const v = computeGovernorVerdict({
      world: world({ artifactsAwaitingQA: 5 }),
      chosenStage: "EXTRACTION",
      rows: [
        ...rows("EXTRACTION", 3, "needs_repair"),
        ...rows("STRICT_QA", 2, "needs_repair"),
        ...rows("STRICT_QA", 1, "success"), // advanced once → eligible
      ],
      ...BASE,
    });
    expect(v.forcedStage).toBe("STRICT_QA");
  });

  it("breaks a growth stall while the brain idles on operational work", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 50 }),
      chosenStage: "REPORTING", // operational, never itself 'fixated'
      rows: rows("REPORTING", 4, "no_op"),
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.forcedStage).toBe("MAINTENANCE"); // chosen was REPORTING → drop to MAINTENANCE
    expect(v.reason).toMatch(/stall/i);
  });

  it("prefers REPAIR as the terminal when repair work is pending", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 5, pendingRepairPlans: 2 }),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 3, "no_op"),
      ...BASE,
    });
    expect(v.forcedStage).toBe("REPAIR");
  });

  it("surfaces a poison entity processed past the retry limit", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 5 }),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 3, "needs_repair", "read-poison"),
      ...BASE,
    });
    expect(v.exhaustedEntityId).toBe("read-poison");
  });

  it("does not treat a healthy operational pass as a stall when goals are met", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 0 }),
      chosenStage: "REPORTING",
      rows: rows("REPORTING", 5, "no_op"),
      ...BASE,
    });
    expect(v.intervene).toBe(false);
  });
});

describe("governorEnabled", () => {
  const KEY = "ADMIN_WORKER_GOVERNOR_ENABLED";
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[KEY];
    delete process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it("defaults ON", () => {
    expect(governorEnabled()).toBe(true);
  });
  it.each(["0", "false", "off", "no"])("is disabled by %s", (v) => {
    process.env[KEY] = v;
    expect(governorEnabled()).toBe(false);
  });
});

describe("evaluateGovernor (IO seam)", () => {
  const KEY = "ADMIN_WORKER_GOVERNOR_ENABLED";
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[KEY];
    delete process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it("returns no intervention when disabled (and never touches the DB)", async () => {
    process.env[KEY] = "0";
    const prisma = {
      adminWorkerStageOutcome: { findMany: vi.fn() },
    } as unknown as PrismaClient;
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "EXTRACTION" },
      world: world({ contentGoalGap: 10 }),
      recentOutcomes: rows("EXTRACTION", 5, "needs_repair"),
    });
    expect(v.intervene).toBe(false);
  });

  it("computes a verdict from injected rows + world without querying the DB", async () => {
    const findMany = vi.fn();
    const prisma = { adminWorkerStageOutcome: { findMany } } as unknown as PrismaClient;
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "EXTRACTION", finalBrain: "python" },
      world: world({ artifactsAwaitingQA: 3 }),
      recentOutcomes: rows("EXTRACTION", 3, "needs_repair"),
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(v.intervene).toBe(true);
    expect(v.forcedStage).toBe("STRICT_QA");
  });

  it("reads the stage-outcome ledger when rows are not injected", async () => {
    const findMany = vi.fn(async () => rows("EXTRACTION", 3, "needs_repair"));
    const prisma = { adminWorkerStageOutcome: { findMany } } as unknown as PrismaClient;
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "EXTRACTION", finalBrain: "python" },
      world: world({ artifactsAwaitingPublish: 1 }),
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(v.intervene).toBe(true);
    expect(v.forcedStage).toBe("PUBLIC_PUBLISH");
  });

  it("stays out entirely in safe degraded mode (respects the no-publish contract)", async () => {
    const findMany = vi.fn();
    const prisma = { adminWorkerStageOutcome: { findMany } } as unknown as PrismaClient;
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "EXTRACTION", finalBrain: "degraded" },
      world: world({ contentGoalGap: 99, artifactsAwaitingQA: 5 }),
      recentOutcomes: rows("EXTRACTION", 5, "needs_repair"),
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(v.intervene).toBe(false);
  });
});

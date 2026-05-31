/**
 * Spec §10: the brain consults real outcome pass rates from the
 * durable tables so a chronically-failing stage gets demoted in
 * ranking and a winning stage gets a small boost.
 */

import { describe, expect, it, vi } from "vitest";

import { rankActions, sampleExecutionFeedback, type WorldState } from "@/lib/admin-worker/brain";

// World has publishedButUnverified > 0 so POST_PUBLISH_VERIFY is
// enumerated (the brain only adds it when there's work for it).
const HEALTHY_WORLD: WorldState = {
  pendingBuildJobs: 5,
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
  candidateUrlsAvailable: 5,
  pendingRepairPlans: 0,
  pipelineStagesBlocked: 0,
  unclassifiedReads: 0,
  readsAwaitingExtraction: 0,
  artifactsAwaitingChecklist: 0,
  artifactsAwaitingBuild: 0,
  artifactsAwaitingQA: 0,
  artifactsAwaitingPublish: 0,
  publishedButUnverified: 3,
  pendingQAReviews: 0,
  contentGoalsAtGoalCount: 0,
  contentGoalsBelowGoalCount: 1,
  timeSinceLastGrowthMs: null,
  topSourceReputation: [{ host: "vatican.va", tier: "TRUSTED" }],
};

describe("brain applies pass-rate feedback to ranking (spec §10)", () => {
  it("penalises POST_PUBLISH_VERIFY when postPublishPassRate is very low", () => {
    const baseline = rankActions(HEALTHY_WORLD, {
      recentFailedStages: {},
      recentlyAdvanced: new Set(),
    });
    const baselinePP = baseline.find((a) => a.missionStage === "POST_PUBLISH_VERIFY");

    const penalised = rankActions(HEALTHY_WORLD, {
      recentFailedStages: {},
      recentlyAdvanced: new Set(),
      postPublishPassRate: 0.0,
    });
    const penalisedPP = penalised.find((a) => a.missionStage === "POST_PUBLISH_VERIFY");

    expect(baselinePP).toBeDefined();
    expect(penalisedPP).toBeDefined();
    expect(penalisedPP!.finalScore).toBeLessThan(baselinePP!.finalScore);
  });

  it("boosts POST_PUBLISH_VERIFY when postPublishPassRate is high", () => {
    const baseline = rankActions(HEALTHY_WORLD, {
      recentFailedStages: {},
      recentlyAdvanced: new Set(),
    });
    const baselinePP = baseline.find((a) => a.missionStage === "POST_PUBLISH_VERIFY");

    const boosted = rankActions(HEALTHY_WORLD, {
      recentFailedStages: {},
      recentlyAdvanced: new Set(),
      postPublishPassRate: 1.0,
    });
    const boostedPP = boosted.find((a) => a.missionStage === "POST_PUBLISH_VERIFY");

    expect(baselinePP).toBeDefined();
    expect(boostedPP).toBeDefined();
    expect(boostedPP!.finalScore).toBeGreaterThan(baselinePP!.finalScore);
  });

  it("records the pass rate and adjustment in rulesEvaluated.executionFeedback", () => {
    const ranked = rankActions(HEALTHY_WORLD, {
      recentFailedStages: {},
      recentlyAdvanced: new Set(),
      postPublishPassRate: 0.2,
    });
    const pp = ranked.find((a) => a.missionStage === "POST_PUBLISH_VERIFY");
    expect(pp).toBeDefined();
    const evald = pp!.rulesEvaluated as Record<string, unknown>;
    const ef = evald.executionFeedback as Record<string, unknown> | undefined;
    expect(ef?.passRate).toBeCloseTo(0.2, 2);
    expect(ef?.passRateAdjustment).toBeLessThan(0);
  });
});

describe("sampleExecutionFeedback reads pass rates from durable tables (spec §10)", () => {
  it("returns pass rates derived from AdminWorkerStrictQAResult + ContentQualityScore + PostPublishVerification + AdminWorkerRepairPlan", async () => {
    const prisma = {
      adminWorkerLog: {
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
      },
      adminWorkerDecision: { findMany: vi.fn(async () => []) },
      adminWorkerStrictQAResult: {
        count: vi.fn(async (args: { where: { status?: string } }) => (args.where.status ? 8 : 10)),
      },
      contentQualityScore: {
        count: vi.fn(async (args: { where: { finalScore?: unknown } }) =>
          args.where.finalScore ? 6 : 10,
        ),
      },
      publishedContent: { count: vi.fn(async () => 7) },
      postPublishVerification: {
        count: vi.fn(async (args: { where: { result?: string } }) => (args.where.result ? 9 : 10)),
      },
      adminWorkerRepairPlan: {
        count: vi.fn(async (args: { where: { status?: unknown } }) => {
          const status = args.where.status;
          if (typeof status === "object" && status && "in" in status) return 10;
          if (typeof status === "string") return 5;
          return 10;
        }),
      },
    } as unknown as Parameters<typeof sampleExecutionFeedback>[0];

    const feedback = await sampleExecutionFeedback(prisma);
    expect(feedback.strictQAPassRate).toBeCloseTo(0.8);
    expect(feedback.qualityScorePassRate).toBeCloseTo(0.6);
    expect(feedback.postPublishPassRate).toBeCloseTo(0.9);
    expect(feedback.repairPassRate).toBeCloseTo(0.5);
  });

  it("returns undefined pass rates when no rows exist (zero/zero)", async () => {
    const prisma = {
      adminWorkerLog: {
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
      },
      adminWorkerDecision: { findMany: vi.fn(async () => []) },
      adminWorkerStrictQAResult: { count: vi.fn(async () => 0) },
      contentQualityScore: { count: vi.fn(async () => 0) },
      publishedContent: { count: vi.fn(async () => 0) },
      postPublishVerification: { count: vi.fn(async () => 0) },
      adminWorkerRepairPlan: { count: vi.fn(async () => 0) },
    } as unknown as Parameters<typeof sampleExecutionFeedback>[0];

    const feedback = await sampleExecutionFeedback(prisma);
    expect(feedback.strictQAPassRate).toBeUndefined();
    expect(feedback.qualityScorePassRate).toBeUndefined();
    expect(feedback.postPublishPassRate).toBeUndefined();
    expect(feedback.repairPassRate).toBeUndefined();
  });
});

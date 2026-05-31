/**
 * Developer Audit data collection (spec §19). Confirms
 * collectDeveloperAuditData() actually populates every new
 * section's data — not just lists section names.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/diagnostics", () => ({
  runAdminWorkerDiagnostics: vi.fn(async () => [{ name: "brain", score: 0.9, status: "pass" }]),
  summarizeRatings: vi.fn(() => ({ pass: 1, warn: 0, fail: 0 })),
}));

vi.mock("@/lib/admin-worker/passes", () => ({
  listRecentPasses: vi.fn(async () => []),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  listAdminWorkerLogs: vi.fn(async () => []),
}));

import { collectDeveloperAuditData } from "@/lib/admin-worker/report-generator";

function makePrisma() {
  return {
    adminWorkerDecision: {
      findMany: vi.fn(async () => [
        {
          id: "d1",
          createdAt: new Date(),
          chosenAction: "CONSTANT_FILL:CONTENT_GOAL",
          missionStage: "DISCOVERY",
          contentType: "PRAYER",
          confidence: 0.85,
          riskScore: 0.15,
          reason: "Closing gap.",
          brainExplanation: "Chose DISCOVERY because…",
          brainFailure: null,
        },
      ]),
    },
    adminWorkerPipelineStage: {
      findMany: vi.fn(async () => [
        {
          id: "p1",
          pipelineKey: "key1",
          stageName: "DISCOVERY",
          status: "SUCCEEDED",
          contentType: "PRAYER",
          failureReason: null,
          createdAt: new Date(),
        },
      ]),
    },
    contentGoal: {
      findMany: vi.fn(async () => [
        {
          contentType: "PRAYER",
          minimumTarget: 50,
          desiredTarget: 100,
          currentValidCount: 30,
          gapCount: 20,
          status: "IN_PROGRESS",
        },
      ]),
    },
    adminWorkerGrowthSnapshot: {
      findMany: vi.fn(async () => [
        {
          contentType: "PRAYER",
          status: "SLOW_24H",
          gap: 20,
          growth24h: 0,
          growth7d: 3,
          recommendation: "Boost discovery.",
          createdAt: new Date(),
        },
      ]),
    },
    adminWorkerSourceCoverage: {
      findMany: vi.fn(async () => [
        {
          contentType: "PRAYER",
          coverageScore: 0.85,
          blockedByCoverage: false,
          blockReason: null,
        },
      ]),
    },
    adminWorkerSourceReputation: {
      findMany: vi.fn(async () => [
        {
          sourceHost: "vatican.va",
          contentType: null,
          reputationTier: "TRUSTED",
          publicPublishRate: 0.9,
          qaPassRate: 0.95,
          fetchSuccessRate: 0.98,
          paused: false,
        },
      ]),
    },
    adminWorkerMemory: {
      findMany: vi.fn(async () => [
        {
          memoryType: "SOURCE_PRIORITY",
          memoryKey: "vatican.va",
          confidence: 0.85,
          successCount: 17,
          failureCount: 3,
          lastUsedAt: new Date(),
        },
      ]),
    },
    adminWorkerRepairPlan: {
      findMany: vi.fn(async () => [
        {
          id: "rp1",
          kind: "CACHE_FAILED",
          status: "SUCCEEDED",
          attempts: 1,
          maxAttempts: 5,
          finalResult: "cache flagged",
          createdAt: new Date(),
        },
      ]),
    },
    postPublishVerification: {
      findMany: vi.fn(async () => [
        {
          contentType: "PRAYER",
          contentId: "id1",
          slug: "our-father",
          result: "PASS",
          errorMessage: null,
          createdAt: new Date(),
        },
      ]),
    },
    adminWorkerState: {
      findUnique: vi.fn(async () => ({ currentBlocker: "Source vatican.va paused" })),
    },
    // Spec §3 + §4 + §1 follow-up: audit data includes strict-QA,
    // ContentQualityScore, and structured-block stats.
    adminWorkerStrictQAResult: {
      findMany: vi.fn(async () => [
        {
          id: "qa-1",
          contentType: "PRAYER",
          status: "PASSED",
          finalScore: 0.92,
          blockingReasons: [],
          createdAt: new Date(),
        },
      ]),
    },
    contentQualityScore: {
      findMany: vi.fn(async () => [
        {
          id: "q-1",
          contentType: "PRAYER",
          contentId: "ci-1",
          finalScore: 0.88,
          createdAt: new Date(),
        },
      ]),
    },
    adminWorkerSourceBlock: {
      count: vi.fn(async () => 42),
      groupBy: vi.fn(async () => [
        { blockType: "PARAGRAPH", _count: { _all: 30 } },
        { blockType: "PRAYER", _count: { _all: 5 } },
      ]),
    },
    // Spec §7 + §450: rejected alternatives the brain considered.
    adminWorkerActionScore: {
      findMany: vi.fn(async () => [
        {
          decisionId: "d1",
          missionStage: "MAINTENANCE",
          actionType: "CLEANUP",
          actionScore: 1,
          rejectedReason: "Lower score (1.0).",
          createdAt: new Date(),
        },
      ]),
    },
    // Spec §23-45 + §451: reasoning graph edges.
    adminWorkerReasoningGraph: {
      findMany: vi.fn(async () => [
        {
          contentType: "PRAYER",
          fromNodeType: "QUALITY_SCORE",
          toNodeType: "PUBLISHED_CONTENT",
          relation: "PUBLISH_ALLOWED_BECAUSE",
          explanation: "strict QA + quality passed",
          createdAt: new Date(),
        },
      ]),
    },
  } as unknown as Parameters<typeof collectDeveloperAuditData>[0];
}

describe("collectDeveloperAuditData — spec §19 sections populated", () => {
  it("returns brain decisions in the audit data", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.brainDecisions.length).toBe(1);
    expect(data.brainDecisions[0].missionStage).toBe("DISCOVERY");
    expect(data.brainDecisions[0].brainExplanation).toContain("DISCOVERY");
  });

  it("returns pipeline stage history", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.pipelineStages.length).toBe(1);
    expect(data.pipelineStages[0].stageName).toBe("DISCOVERY");
  });

  it("returns content goal progress", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.contentGoals.length).toBe(1);
    expect(data.contentGoals[0].gapCount).toBe(20);
  });

  it("returns growth snapshots", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.growthSnapshots.length).toBe(1);
    expect(data.growthSnapshots[0].status).toBe("SLOW_24H");
  });

  it("returns source coverage rows", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.sourceCoverage.length).toBe(1);
    expect(data.sourceCoverage[0].contentType).toBe("PRAYER");
  });

  it("returns source reputation rows", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.sourceReputation.length).toBe(1);
    expect(data.sourceReputation[0].reputationTier).toBe("TRUSTED");
  });

  it("returns memory rows", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.recentMemory.length).toBe(1);
    expect(data.recentMemory[0].confidence).toBe(0.85);
  });

  it("returns repair plans", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.repairPlans.length).toBe(1);
    expect(data.repairPlans[0].kind).toBe("CACHE_FAILED");
  });

  it("returns post-publish verification rows", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.postPublishVerifications.length).toBe(1);
    expect(data.postPublishVerifications[0].result).toBe("PASS");
  });

  it("surfaces current blockers from worker state", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.currentBlockers.length).toBeGreaterThan(0);
    expect(data.currentBlockers[0]).toContain("paused");
  });

  it("returns rejected alternatives the brain considered (spec §7 + §450)", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.rejectedAlternatives.length).toBe(1);
    expect(data.rejectedAlternatives[0].missionStage).toBe("MAINTENANCE");
    expect(data.rejectedAlternatives[0].rejectedReason).toBeTruthy();
  });

  it("returns reasoning graph edges (spec §23-45 + §451)", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.reasoningGraph.length).toBe(1);
    expect(data.reasoningGraph[0].relation).toBe("PUBLISH_ALLOWED_BECAUSE");
    expect(data.reasoningGraph[0].explanation).toContain("quality passed");
  });

  it("supports LAST_24_HOURS, LAST_7_DAYS, LAST_30_DAYS periods", async () => {
    for (const period of ["LAST_24_HOURS", "LAST_7_DAYS", "LAST_30_DAYS"] as const) {
      const data = await collectDeveloperAuditData(makePrisma(), period);
      expect(data.period).toBe(period);
    }
  });
});

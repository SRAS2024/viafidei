/**
 * Spec §3 + §4 + §1 follow-up: Developer Audit data now includes
 * strict-QA results, ContentQualityScore rows, and structured-block
 * stats so the audit reader can see exactly which artifacts passed,
 * needed repair, or were rejected.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/diagnostics", () => ({
  runAdminWorkerDiagnostics: vi.fn(async () => []),
  summarizeRatings: vi.fn(() => ({
    overall: "pass" as const,
    pass: 0,
    warn: 0,
    fail: 0,
    total: 0,
    topFailures: [],
    topWarnings: [],
  })),
}));

vi.mock("@/lib/admin-worker/passes", () => ({
  listRecentPasses: vi.fn(async () => []),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  listAdminWorkerLogs: vi.fn(async () => []),
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/why-no-growth", () => ({
  diagnoseWhyNoGrowth: vi.fn(async () => ({
    blocker: "NONE",
    blockerExplanation: "All clear",
    exactTable: "n/a",
    nextAutomaticRepair: null,
    nextWorkerDecision: "next pass",
    checks: [],
  })),
}));

import { collectDeveloperAuditData } from "@/lib/admin-worker/report-generator";

function makePrisma() {
  return {
    adminWorkerDecision: { findMany: vi.fn(async () => []) },
    adminWorkerPipelineStage: { findMany: vi.fn(async () => []) },
    contentGoal: { findMany: vi.fn(async () => []) },
    adminWorkerGrowthSnapshot: { findMany: vi.fn(async () => []) },
    adminWorkerSourceCoverage: { findMany: vi.fn(async () => []) },
    adminWorkerSourceReputation: { findMany: vi.fn(async () => []) },
    adminWorkerMemory: { findMany: vi.fn(async () => []) },
    adminWorkerRepairPlan: { findMany: vi.fn(async () => []) },
    postPublishVerification: { findMany: vi.fn(async () => []) },
    adminWorkerState: { findUnique: vi.fn(async () => null) },
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
        {
          id: "qa-2",
          contentType: "APPARITION",
          status: "NEEDS_REPAIR",
          finalScore: 0.7,
          blockingReasons: ["validation dimension is zero"],
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
      count: vi.fn(async (args: { where?: { isRejected?: boolean } } = {}) =>
        args.where?.isRejected ? 5 : 100,
      ),
      groupBy: vi.fn(async () => [
        { blockType: "PARAGRAPH", _count: { _all: 70 } },
        { blockType: "PRAYER", _count: { _all: 10 } },
        { blockType: "HEADING", _count: { _all: 20 } },
      ]),
    },
  } as unknown as Parameters<typeof collectDeveloperAuditData>[0];
}

describe("Developer Audit includes strict-QA + quality-score + block stats (spec §3, §4, §1)", () => {
  it("populates strictQAResults with PASSED + NEEDS_REPAIR rows", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.strictQAResults.length).toBe(2);
    expect(data.strictQAResults.map((r) => r.status)).toEqual(
      expect.arrayContaining(["PASSED", "NEEDS_REPAIR"]),
    );
    expect(data.strictQAResults[1].blockingReasons).toContain("validation dimension is zero");
  });

  it("populates qualityScores with finalScore + contentType", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.qualityScores.length).toBe(1);
    expect(data.qualityScores[0].finalScore).toBe(0.88);
    expect(data.qualityScores[0].contentType).toBe("PRAYER");
  });

  it("populates structuredBlockStats with total + rejected + per-type counts", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.structuredBlockStats.total).toBe(100);
    expect(data.structuredBlockStats.rejected).toBe(5);
    expect(data.structuredBlockStats.perType.length).toBe(3);
    const paragraph = data.structuredBlockStats.perType.find((p) => p.blockType === "PARAGRAPH");
    expect(paragraph?.count).toBe(70);
  });
});

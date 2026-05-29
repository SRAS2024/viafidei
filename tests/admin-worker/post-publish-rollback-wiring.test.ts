/**
 * Spec §8: when the dispatcher's POST_PUBLISH_VERIFY stage finds a
 * FAIL it must drive the rollback decision tree (repair → reverify →
 * unpublish → DELETED/HUMAN_REVIEW). The previous implementation just
 * logged the failure and moved on.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/post-publish-probe", () => ({
  verifyPublished: vi.fn(),
}));

vi.mock("@/lib/admin-worker/post-publish-rollback", () => ({
  decideAndExecuteRollback: vi.fn(async () => ({
    kind: "HUMAN_REVIEW",
    repairAttempted: "cache refresh",
    rollbackAction: "unpublished + filed for review",
    humanReviewFiled: true,
    reason: "test",
  })),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(),
  CONTENT_TYPE_STRATEGIES: {},
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { verifyPublished } from "@/lib/admin-worker/post-publish-probe";
import { decideAndExecuteRollback } from "@/lib/admin-worker/post-publish-rollback";
import type { BrainDecision } from "@/lib/admin-worker/brain";

function decision(): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "POST_PUBLISH_VERIFY",
    passType: "CONTENT_GOAL",
    contentType: "PRAYER",
    sourceTarget: null,
    expectedResult: "verify",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: "POST_PUBLISH_VERIFY" },
    rankedAlternatives: [],
    missionStage: "POST_PUBLISH_VERIFY",
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

function makePrisma() {
  return {
    postPublishVerification: {
      findMany: vi.fn(async () => []),
    },
    publishedContent: {
      findMany: vi.fn(async () => [
        { id: "p1", contentType: "PRAYER", slug: "our-father", title: "Our Father" },
      ]),
    },
    workerBuildJob: { findFirst: vi.fn(async () => null) },
  } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"];
}

describe("runPostPublishVerify drives the rollback decision tree on FAIL (spec §8)", () => {
  it("calls decideAndExecuteRollback when verification fails", async () => {
    vi.mocked(decideAndExecuteRollback).mockClear();
    vi.mocked(verifyPublished).mockResolvedValueOnce({
      verificationId: "v1",
      result: "FAIL",
      publicUrl: "https://example.com/prayers/our-father",
      checks: {
        publicPageCheck: "FAIL",
        titleCheck: "PASS",
        bodyMarkerCheck: "PASS",
        tabPlacementCheck: "PASS",
        searchCheck: "PASS",
        sitemapCheck: "PASS",
        cacheCheck: "PASS",
        contentGoalCheck: "PASS",
      } as never,
    });
    const out = await executeMissionStage({
      prisma: makePrisma(),
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.kind).toBe("rejected");
    expect(vi.mocked(decideAndExecuteRollback)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(decideAndExecuteRollback).mock.calls[0][1];
    expect(call.failedCheck).toBe("public_route");
    expect(typeof call.reverify).toBe("function");
  });

  it("does NOT call decideAndExecuteRollback when verification passes", async () => {
    vi.mocked(decideAndExecuteRollback).mockClear();
    vi.mocked(verifyPublished).mockResolvedValueOnce({
      verificationId: "v2",
      result: "PASS",
      publicUrl: "https://example.com/prayers/our-father",
      checks: {
        publicPageCheck: "PASS",
        titleCheck: "PASS",
        bodyMarkerCheck: "PASS",
        tabPlacementCheck: "PASS",
        searchCheck: "PASS",
        sitemapCheck: "PASS",
        cacheCheck: "PASS",
        contentGoalCheck: "PASS",
      } as never,
    });
    const out = await executeMissionStage({
      prisma: makePrisma(),
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.kind).toBe("advanced");
    expect(vi.mocked(decideAndExecuteRollback)).not.toHaveBeenCalled();
  });

  it("picks the first FAIL check from the verification map", async () => {
    vi.mocked(decideAndExecuteRollback).mockClear();
    vi.mocked(verifyPublished).mockResolvedValueOnce({
      verificationId: "v3",
      result: "FAIL",
      publicUrl: "x",
      checks: {
        publicPageCheck: "PASS",
        titleCheck: "PASS",
        bodyMarkerCheck: "FAIL",
        tabPlacementCheck: "PASS",
        searchCheck: "PASS",
        sitemapCheck: "PASS",
        cacheCheck: "PASS",
        contentGoalCheck: "PASS",
      } as never,
    });
    await executeMissionStage({
      prisma: makePrisma(),
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    const call = vi.mocked(decideAndExecuteRollback).mock.calls[0][1];
    expect(call.failedCheck).toBe("body_marker");
  });
});

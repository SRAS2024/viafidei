/**
 * Spec §6 follow-up: the legacy runOneBuildCycle publish fallback was
 * removed from the PUBLIC_PUBLISH dispatcher stage. With no
 * BUILD_READY / QA_PASSED artifact, the stage must return idle (so
 * the strict-QA + ContentQualityScore gates can't be bypassed).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(),
  CONTENT_TYPE_STRATEGIES: {},
}));

vi.mock("@/lib/worker", () => ({
  runOneBuildCycle: vi.fn(async () => {
    throw new Error(
      "runOneBuildCycle must not be invoked from PUBLIC_PUBLISH — the legacy fallback was removed.",
    );
  }),
}));

vi.mock("@/lib/admin-worker/planner", () => ({
  planAndEnqueue: vi.fn(async () => ({ enqueued: 0, contentType: null, reason: "noop" })),
}));

vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(),
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { runOneBuildCycle } from "@/lib/worker";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import type { BrainDecision } from "@/lib/admin-worker/brain";

function decision(): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "PUBLISH_CONTENT",
    passType: "CONTENT_GOAL",
    contentType: null,
    sourceTarget: null,
    expectedResult: "publish",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: "PUBLIC_PUBLISH" },
    rankedAlternatives: [],
    missionStage: "PUBLIC_PUBLISH",
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

function makePrisma() {
  return {
    adminWorkerPackageArtifact: {
      findFirst: vi.fn(async () => null),
    },
  } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"];
}

describe("PUBLIC_PUBLISH no longer falls back to runOneBuildCycle (spec §6)", () => {
  it("returns idle when no artifact is BUILD_READY / QA_PASSED — does NOT call runOneBuildCycle", async () => {
    vi.mocked(runOneBuildCycle).mockClear();
    vi.mocked(runPublishOrchestrator).mockClear();
    const out = await executeMissionStage({
      prisma: makePrisma(),
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.kind).toBe("idle");
    expect(vi.mocked(runOneBuildCycle)).not.toHaveBeenCalled();
    expect(vi.mocked(runPublishOrchestrator)).not.toHaveBeenCalled();
  });
});

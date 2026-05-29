/**
 * Spec §3.4: every dispatcher stage return must carry the full uniform
 * result shape — stage name, action taken, input entity, output
 * entity, advanced count, rejected count, repaired count, blocker,
 * next stage, logs created. This test drives a real stage and asserts
 * all fields are populated by the enrichment wrapper.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(async () => ({
    surfaced: 3,
    rejected: 1,
    hostsSkipped: [],
    strategies: [],
    errors: [],
  })),
  CONTENT_TYPE_STRATEGIES: {},
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import type { BrainDecision } from "@/lib/admin-worker/brain";

function decision(stage: string): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "DISCOVER_SOURCE",
    passType: "CONTENT_GOAL",
    contentType: "PRAYER",
    sourceTarget: null,
    expectedResult: "discover",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: stage, candidateUrl: "https://vatican.va/x" },
    rankedAlternatives: [],
    missionStage: stage,
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

const REQUIRED_FIELDS = [
  "stage",
  "actionTaken",
  "inputEntity",
  "outputEntity",
  "advancedCount",
  "rejectedCount",
  "repairedCount",
  "blocker",
  "nextStage",
  "logsCreated",
];

describe("dispatcher outcome carries the full §3.4 result shape", () => {
  it("populates every required field on a DISCOVERY outcome", async () => {
    const prisma = { adminWorkerLog: {} } as never as Parameters<
      typeof executeMissionStage
    >[0]["prisma"];
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("DISCOVERY"),
    });
    for (const f of REQUIRED_FIELDS) {
      expect(out, `missing field: ${f}`).toHaveProperty(f);
    }
    expect(out.stage).toBe("DISCOVERY");
    expect(out.nextStage).toBe("CANDIDATE_PRIORITIZATION");
    expect(typeof out.actionTaken).toBe("string");
    expect(out.advancedCount).toBeGreaterThanOrEqual(1);
    expect(out.logsCreated).toBeGreaterThanOrEqual(1);
  });

  it("sets a blocker and failed kind when a handler throws", async () => {
    // A prisma that throws inside the handler triggers the catch path.
    const prisma = {
      get adminWorkerPackageArtifact() {
        throw new Error("boom");
      },
    } as never as Parameters<typeof executeMissionStage>[0]["prisma"];
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("PACKAGE_BUILD"),
    });
    expect(out.kind).toBe("failed");
    expect(out.blocker).toBeTruthy();
    expect(out.nextStage).toBe("CROSS_SOURCE_VERIFICATION");
  });

  it("chains nextStage through the artifact pipeline", async () => {
    const cases: Array<[string, string | null]> = [
      ["STRICT_QA", "PERSISTENCE"],
      ["PUBLIC_PUBLISH", "POST_PUBLISH_VERIFY"],
      ["CACHE_REFRESH", null],
      ["REPAIR", "DISCOVERY"],
    ];
    for (const [stage, next] of cases) {
      const prisma = {
        get adminWorkerPackageArtifact() {
          throw new Error("force-catch");
        },
      } as never as Parameters<typeof executeMissionStage>[0]["prisma"];
      const out = await executeMissionStage({
        prisma,
        workerId: "w1",
        passId: "p1",
        decision: decision(stage),
      });
      expect(out.nextStage).toBe(next);
    }
  });
});

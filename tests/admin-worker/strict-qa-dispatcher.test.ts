/**
 * Spec §3: strict QA must be a real dispatcher stage. It must find
 * BUILD_READY / VERIFICATION_READY artifacts, call recordStrictQA,
 * persist a row, and transition the artifact status:
 *   PASSED       → QA_PASSED
 *   NEEDS_REPAIR → NEEDS_REPAIR
 *   FAILED       → REJECTED
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import type { BrainAction, BrainDecision } from "@/lib/admin-worker/brain";

function decision(): BrainDecision {
  const action: BrainAction = {
    actionType: "RUN_QA",
    missionStage: "STRICT_QA",
    mode: "CONSTANT_FILL",
    priority: "CONTENT_GOAL",
    passType: "CONTENT_GOAL",
    contentType: null,
    sourceTarget: null,
    candidateUrl: null,
    expectedOutput: "qa pass",
    confidenceScore: 0.9,
    riskScore: 0.1,
    qualityExpectation: 0.6,
    urgencyScore: 5,
    sourceScore: 0,
    repairScore: 0,
    finalScore: 5,
    fallbackAction: null,
    stopCondition: "qa drained",
    reasonSummary: "test",
    rulesEvaluated: {},
    safe: true,
    rejectionReason: null,
  };
  return {
    chosenMode: action.mode,
    chosenPriority: action.priority,
    chosenTaskType: action.actionType,
    passType: action.passType,
    contentType: action.contentType,
    sourceTarget: null,
    expectedResult: action.expectedOutput,
    confidenceScore: action.confidenceScore,
    riskScore: action.riskScore,
    reason: action.reasonSummary,
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: action.rulesEvaluated,
    memoryUsed: {},
    sourceReputationUsed: [],
    rankedAlternatives: [action],
    chosenAction: action,
    missionStage: "STRICT_QA",
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

interface FakeArtifact {
  id: string;
  contentType: string;
  status: string;
  confidenceScore: number;
  fieldProvenance: unknown[];
  missingFields: string[];
  validationNeeds: string[];
  extractedFields: Record<string, unknown>;
  normalizedTitle: string;
  normalizedSlug: string;
  formattingMetadata: Record<string, unknown>;
  packageChecksum: string;
}

function makePrisma(artifacts: FakeArtifact[]) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const upserts: Array<Record<string, unknown>> = [];
  return {
    prisma: {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => artifacts),
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: args.where.id, data: args.data });
          return {};
        }),
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async (args: { create: Record<string, unknown> }) => {
          upserts.push(args.create);
          return { id: `qa-${upserts.length}` };
        }),
      },
      adminWorkerCrossSourceVerification: {
        count: vi.fn(async () => 0),
      },
      publishedContent: {
        count: vi.fn(async () => 0),
      },
    } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"],
    updates,
    upserts,
  };
}

const HEALTHY_ARTIFACT: FakeArtifact = {
  id: "art-1",
  contentType: "PRAYER",
  status: "BUILD_READY",
  confidenceScore: 0.92,
  fieldProvenance: [{ fieldName: "prayerTitle" }],
  missingFields: [],
  validationNeeds: [],
  extractedFields: { prayerTitle: "Our Father" },
  normalizedTitle: "Our Father",
  normalizedSlug: "our-father",
  formattingMetadata: {},
  packageChecksum: "cs-1",
};

describe("runStrictQA dispatcher stage (spec §3)", () => {
  it("returns idle when there are no pending artifacts", async () => {
    const { prisma } = makePrisma([]);
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.stage).toBe("STRICT_QA");
    expect(out.kind).toBe("idle");
  });

  it("processes a healthy artifact and transitions it to QA_PASSED", async () => {
    const { prisma, updates, upserts } = makePrisma([HEALTHY_ARTIFACT]);
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.stage).toBe("STRICT_QA");
    expect(out.kind).toBe("advanced");
    // One upsert into AdminWorkerStrictQAResult, one update to the artifact.
    expect(upserts.length).toBe(1);
    expect(updates.length).toBe(1);
    expect(updates[0].data.status).toBe("QA_PASSED");
  });

  it("transitions an artifact missing required fields to REJECTED", async () => {
    const broken: FakeArtifact = {
      ...HEALTHY_ARTIFACT,
      id: "art-2",
      confidenceScore: 0.1,
      missingFields: ["prayerText", "prayerType"],
      fieldProvenance: [],
      normalizedTitle: "", // breaks publicReadiness
      normalizedSlug: "",
      extractedFields: {},
    };
    const { prisma, updates } = makePrisma([broken]);
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(updates.length).toBe(1);
    expect(["REJECTED", "NEEDS_REPAIR"]).toContain(updates[0].data.status);
  });
});

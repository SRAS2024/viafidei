/**
 * Action-score persistence + explanation (spec §5-8). Proves the brain
 * stores EVERY ranked action (not only the selected one), with all the
 * required per-action fields, and that the structured explanation
 * answers the five spec §8 questions.
 */

import { describe, expect, it, vi } from "vitest";

import {
  persistActionScores,
  buildActionExplanation,
  explainCurrentAction,
} from "@/lib/admin-worker/action-scores";
import type { BrainAction, BrainDecision } from "@/lib/admin-worker/brain";

function action(overrides: Partial<BrainAction>): BrainAction {
  return {
    actionType: "DISCOVER_SOURCE",
    missionStage: "DISCOVERY",
    mode: "CONSTANT_FILL",
    priority: "CONTENT_GOAL",
    passType: "CONTENT_GOAL",
    contentType: "PRAYER",
    sourceTarget: "vatican.va",
    candidateUrl: "https://www.vatican.va/prayers/our-father",
    expectedOutput: "Surface candidate URLs for PRAYER.",
    confidenceScore: 0.8,
    riskScore: 0.1,
    qualityExpectation: 0.6,
    urgencyScore: 12,
    sourceScore: 0.5,
    repairScore: 0,
    finalScore: 20,
    fallbackAction: "maintenance",
    stopCondition: "candidateUrlsAvailable above min threshold",
    reasonSummary: "Discovery for PRAYER: gap=5.",
    rulesEvaluated: {},
    safe: true,
    rejectionReason: null,
    ...overrides,
  };
}

function decision(chosen: BrainAction, ranked: BrainAction[]): BrainDecision {
  return {
    chosenMode: chosen.mode,
    chosenPriority: chosen.priority,
    chosenTaskType: chosen.actionType === "PAUSED" ? null : chosen.actionType,
    passType: chosen.passType,
    contentType: chosen.contentType,
    sourceTarget: chosen.sourceTarget,
    expectedResult: chosen.expectedOutput,
    confidenceScore: chosen.confidenceScore,
    riskScore: chosen.riskScore,
    reason: chosen.reasonSummary,
    fallbackAction: chosen.fallbackAction,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: chosen,
    rankedAlternatives: ranked,
    missionStage: chosen.missionStage,
    brainExplanation: "explanation",
    brainFailure: null,
  };
}

describe("persistActionScores (spec §5-7)", () => {
  it("writes one row per ranked action, marking only the chosen one selected", async () => {
    const chosen = action({ missionStage: "DISCOVERY", finalScore: 20 });
    const rejected = action({
      missionStage: "MAINTENANCE",
      actionType: "CLEANUP",
      finalScore: 1,
      reasonSummary: "Floor maintenance.",
      rejectionReason: null,
    });
    const d = decision(chosen, [chosen, rejected]);

    let captured: { data: unknown[] } | null = null;
    const prisma = {
      adminWorkerActionScore: {
        createMany: vi.fn(async (args: { data: unknown[] }) => {
          captured = args;
          return { count: args.data.length };
        }),
      },
    } as unknown as Parameters<typeof persistActionScores>[0];

    const count = await persistActionScores(prisma, d, { decisionId: "dec-1", passId: "pass-1" });
    expect(count).toBe(2);
    expect(captured).not.toBeNull();
    const rows = (captured as unknown as { data: Array<Record<string, unknown>> }).data;

    // Spec §6: every ranked action stored.
    expect(rows).toHaveLength(2);
    // Spec §7: every required field present on the chosen row.
    const chosenRow = rows.find((r) => r.selected === true)!;
    expect(chosenRow.actionType).toBe("DISCOVER_SOURCE");
    expect(chosenRow.missionStage).toBe("DISCOVERY");
    expect(chosenRow.targetContentType).toBe("PRAYER");
    expect(chosenRow.targetSource).toBe("vatican.va");
    expect(chosenRow.targetCandidate).toContain("our-father");
    expect(chosenRow.expectedOutput).toBeTruthy();
    expect(chosenRow.actionScore).toBe(20);
    expect(chosenRow.confidenceScore).toBe(0.8);
    expect(chosenRow.riskScore).toBe(0.1);
    expect(chosenRow.sourceScore).toBe(0.5);
    expect(chosenRow.qualityExpectation).toBe(0.6);
    expect(chosenRow.reason).toBeTruthy();
    expect(chosenRow.rejectedReason).toBeNull();
    expect(chosenRow.decisionId).toBe("dec-1");
    expect(chosenRow.passId).toBe("pass-1");

    // Spec §7.14: the rejected action carries a rejectedReason.
    const rejectedRow = rows.find((r) => r.selected === false)!;
    expect(rejectedRow.rejectedReason).toBeTruthy();
  });

  it("never throws when the DB write fails (best-effort)", async () => {
    const a = action({});
    const d = decision(a, [a]);
    const prisma = {
      adminWorkerActionScore: {
        createMany: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as unknown as Parameters<typeof persistActionScores>[0];
    await expect(persistActionScores(prisma, d)).resolves.toBe(0);
  });
});

describe("buildActionExplanation (spec §8)", () => {
  it("answers the five explanation questions", () => {
    const chosen = action({ missionStage: "DISCOVERY", fallbackAction: "maintenance" });
    const rejected = action({
      missionStage: "PUBLIC_PUBLISH",
      actionType: "BUILD_CONTENT",
      finalScore: 0,
      safe: false,
      rejectionReason: "All content goals met — discovery not needed.",
    });
    const d = decision(chosen, [chosen, rejected]);

    const exp = buildActionExplanation(d, ["learned: vatican.va is reliable for PRAYER"]);
    // §8.1 why chosen
    expect(exp.whyChosen).toContain("DISCOVERY");
    // §8.2 why rejected alternatives
    expect(exp.whyRejectedAlternatives).toHaveLength(1);
    expect(exp.whyRejectedAlternatives[0].reason).toContain("goals met");
    // §8.3 what it expects
    expect(exp.whatItExpects).toBe(chosen.expectedOutput);
    // §8.4 what if it fails
    expect(exp.whatIfItFails.toLowerCase()).toContain("fall back");
    // §8.5 what it learned last pass
    expect(exp.whatItLearnedLastPass).toContain("learned: vatican.va is reliable for PRAYER");
  });
});

describe("explainCurrentAction (spec §8 wired)", () => {
  it("returns null when no action score has been recorded", async () => {
    const prisma = {
      adminWorkerActionScore: { findFirst: vi.fn(async () => null) },
    } as unknown as Parameters<typeof explainCurrentAction>[0];
    expect(await explainCurrentAction(prisma)).toBeNull();
  });

  it("composes the explanation from the latest selected action + memory", async () => {
    const prisma = {
      adminWorkerActionScore: {
        findFirst: vi.fn(async () => ({
          decisionId: "dec-1",
          missionStage: "PACKAGE_BUILD",
          actionScore: 30,
          urgencyScore: 18,
          riskScore: 0.15,
          confidenceScore: 0.9,
          reason: "Build queue: 2 pending.",
          expectedOutput: "Build a package.",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        })),
        findMany: vi.fn(async () => [
          {
            actionType: "DISCOVER_SOURCE",
            missionStage: "DISCOVERY",
            rejectedReason: "lower score (12.0)",
          },
        ]),
      },
      adminWorkerMemory: {
        findMany: vi.fn(async () => [
          {
            memoryType: "SOURCE_PRIORITY",
            memoryKey: "vatican.va",
            confidence: 0.82,
            successCount: 9,
            failureCount: 1,
          },
        ]),
      },
    } as unknown as Parameters<typeof explainCurrentAction>[0];

    const exp = await explainCurrentAction(prisma);
    expect(exp).not.toBeNull();
    expect(exp!.whyChosen).toContain("PACKAGE_BUILD");
    expect(exp!.whyRejectedAlternatives[0].missionStage).toBe("DISCOVERY");
    expect(exp!.whatItExpects).toBe("Build a package.");
    expect(exp!.whatItLearnedLastPass[0]).toContain("vatican.va");
  });
});

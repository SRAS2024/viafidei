/**
 * Exact stage-outcome ledger — proves the dispatcher's enriched outcome
 * is mapped to a precise AdminWorkerStageOutcome row and that the brain's
 * per-stage reliability is aggregated from real outcomes.
 */

import { describe, expect, it, vi } from "vitest";

import {
  recordStageOutcome,
  resultTypeForKind,
  summarizeStageReliability,
  toStageOutcome,
} from "@/lib/admin-worker/stage-outcomes";
import type { BrainDecision } from "@/lib/admin-worker/brain";
import type { DispatchOutcome } from "@/lib/admin-worker/dispatcher";

const decision = {
  missionStage: "EXTRACTION",
  contentType: "PRAYER",
  confidenceScore: 0.81,
  chosenAction: { actionType: "BUILD_CONTENT", contentType: "PRAYER", fallbackAction: "DISCOVERY" },
} as unknown as BrainDecision;

describe("resultTypeForKind", () => {
  it("buckets dispatch kinds into coarse outcome types", () => {
    expect(resultTypeForKind("advanced")).toBe("success");
    expect(resultTypeForKind("repair-planned")).toBe("needs_repair");
    expect(resultTypeForKind("rejected")).toBe("failure");
    expect(resultTypeForKind("failed")).toBe("failure");
    expect(resultTypeForKind("idle")).toBe("no_op");
    expect(resultTypeForKind("skipped")).toBe("no_op");
  });
});

describe("toStageOutcome", () => {
  it("maps an advanced outcome to a precise row", () => {
    const outcome: DispatchOutcome = {
      stage: "EXTRACTION",
      kind: "advanced",
      summary: "extracted prayer fields",
      actionTaken: "extract",
      inputEntity: "read-1",
      outputEntity: "artifact-1",
      nextStage: "CHECKLIST_CREATION",
      advancedCount: 1,
    };
    const row = toStageOutcome(outcome, decision, 42);
    expect(row.stage).toBe("EXTRACTION");
    expect(row.result).toBe("advanced");
    expect(row.resultType).toBe("success");
    expect(row.entityId).toBe("artifact-1");
    expect(row.entityType).toBe("output_entity");
    expect(row.contentType).toBe("PRAYER");
    expect(row.downstreamStage).toBe("CHECKLIST_CREATION");
    expect(row.durationMs).toBe(42);
    expect(row.confidenceBefore).toBe(0.81);
    expect(row.repairCreated).toBe(false);
    expect(row.nextAction).toBe("advance_to:CHECKLIST_CREATION");
  });

  it("flags repair-created and uses the fallback as next action on failure", () => {
    const repair = toStageOutcome(
      { stage: "STRICT_QA", kind: "repair-planned", summary: "qa weak", repairedCount: 1 },
      decision,
      10,
    );
    expect(repair.resultType).toBe("needs_repair");
    expect(repair.repairCreated).toBe(true);
    expect(repair.nextAction).toBe("execute_repair");

    const failed = toStageOutcome(
      { stage: "SOURCE_FETCH", kind: "failed", summary: "timeout", blocker: "timeout" },
      decision,
      5,
    );
    expect(failed.resultType).toBe("failure");
    expect(failed.failureReason).toBe("timeout");
    expect(failed.nextAction).toBe("DISCOVERY"); // chosenAction.fallbackAction
  });
});

describe("recordStageOutcome", () => {
  it("writes a row and never throws on a failing store", async () => {
    const create = vi.fn(async () => ({ id: "so-1" }));
    const prisma = { adminWorkerStageOutcome: { create } } as never;
    await recordStageOutcome(prisma, {
      stage: "EXTRACTION",
      result: "advanced",
      resultType: "success",
      durationMs: 1,
    });
    expect(create).toHaveBeenCalledOnce();

    const throwing = {
      adminWorkerStageOutcome: {
        create: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as never;
    await expect(
      recordStageOutcome(throwing, {
        stage: "EXTRACTION",
        result: "failed",
        resultType: "failure",
        durationMs: 1,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("summarizeStageReliability", () => {
  it("aggregates exact per-stage success/failure + avg duration", async () => {
    const rows = [
      { stage: "EXTRACTION", resultType: "success", durationMs: 100 },
      { stage: "EXTRACTION", resultType: "failure", durationMs: 200 },
      { stage: "EXTRACTION", resultType: "needs_repair", durationMs: 300 },
      { stage: "SOURCE_FETCH", resultType: "success", durationMs: 50 },
    ];
    const prisma = {
      adminWorkerStageOutcome: { findMany: vi.fn(async () => rows) },
    } as never;
    const out = await summarizeStageReliability(prisma, { sinceHours: 24 });
    const extraction = out.find((s) => s.stage === "EXTRACTION")!;
    expect(extraction.total).toBe(3);
    expect(extraction.successes).toBe(1);
    expect(extraction.failures).toBe(1);
    expect(extraction.needsRepair).toBe(1);
    expect(extraction.successRate).toBeCloseTo(1 / 3, 5);
    expect(extraction.avgDurationMs).toBeCloseTo(200, 5);
  });
});

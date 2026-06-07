/**
 * The Python brain is the FINAL action selector; TypeScript validates +
 * executes and falls into SAFE DEGRADED mode (never a legacy TS brain)
 * when the Python brain is unavailable, invalid, or picks a disallowed /
 * unsafe action.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/intelligence/store", () => ({
  recordBrainCall: vi.fn(async () => "call-1"),
}));
vi.mock("@/lib/admin-worker/stage-outcomes", () => ({
  summarizeStageReliability: vi.fn(async () => []),
}));

const brainState = vi.hoisted(() => ({
  enabled: true,
  select: null as null | (() => Promise<unknown>),
}));
vi.mock("@/lib/admin-worker/intelligence", () => ({
  isBrainEnabled: () => brainState.enabled,
  selectAction: () => (brainState.select ? brainState.select() : Promise.resolve(null)),
}));

import {
  applyFinalChosen,
  safeDegradedAction,
  SAFE_DEGRADED_STAGES,
  type BrainAction,
  type BrainDecision,
  type BrainMissionStage,
} from "@/lib/admin-worker/brain";
import { BrainFinalDecisionSchema } from "@/lib/admin-worker/intelligence/contracts";
import { pythonFinalSelector } from "@/lib/admin-worker/final-brain";

function action(stage: BrainMissionStage, over: Partial<BrainAction> = {}): BrainAction {
  return {
    actionType: "BUILD_CONTENT" as never,
    missionStage: stage,
    mode: "CONTENT_GROWTH" as never,
    priority: "CONTENT" as never,
    passType: "CONTENT" as never,
    contentType: null,
    sourceTarget: null,
    candidateUrl: null,
    expectedOutput: `do ${stage}`,
    confidenceScore: 0.7,
    riskScore: 0.1,
    qualityExpectation: 0.7,
    urgencyScore: 0.5,
    sourceScore: 0.5,
    repairScore: 0,
    finalScore: 0.6,
    fallbackAction: "maintenance",
    stopCondition: null,
    reasonSummary: `reason ${stage}`,
    rulesEvaluated: {},
    safe: true,
    rejectionReason: null,
    ...over,
  };
}

function decision(ranked: BrainAction[]): BrainDecision {
  return {
    chosenMode: "CONTENT_GROWTH" as never,
    chosenPriority: "CONTENT" as never,
    chosenTaskType: "BUILD_CONTENT" as never,
    passType: "CONTENT" as never,
    contentType: null,
    sourceTarget: null,
    expectedResult: "x",
    confidenceScore: 0.6,
    riskScore: 0.1,
    reason: "x",
    fallbackAction: "maintenance",
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: ranked[0],
    rankedAlternatives: ranked,
    missionStage: ranked[0].missionStage,
    brainExplanation: "x",
    brainFailure: null,
    finalBrain: "candidate",
  };
}

const world = { isPaused: false, topSourceReputation: [] } as never;
const fakePrisma = {
  adminWorkerDecision: { findMany: vi.fn(async () => []) },
} as never;

function pythonResult(missionStage: string, over: Record<string, unknown> = {}) {
  return {
    ok: true,
    result: {
      selected_action: missionStage,
      mission_stage: missionStage,
      action_type: "BUILD_CONTENT",
      expected_result: "advance",
      final_score: 0.8,
      confidence_score: 0.8,
      risk_score: 0.1,
      urgency_score: 0.6,
      source_score: 0.5,
      quality_expectation: 0.7,
      repair_likelihood: 0,
      rejected_alternatives: [],
      reasoning: "python chose it",
      ...over,
    },
  };
}

afterEach(() => {
  brainState.enabled = true;
  brainState.select = null;
  vi.clearAllMocks();
});

describe("BrainFinalDecisionSchema", () => {
  it("parses a valid snake_case decision into camelCase", () => {
    const parsed = BrainFinalDecisionSchema.safeParse(pythonResult("DISCOVERY").result);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.missionStage).toBe("DISCOVERY");
      expect(parsed.data.confidenceScore).toBe(0.8);
      expect(parsed.data.rejectedAlternatives).toEqual([]);
    }
  });

  it("rejects an invalid decision shape (missing required fields)", () => {
    const parsed = BrainFinalDecisionSchema.safeParse({ selected_action: "DISCOVERY" });
    expect(parsed.success).toBe(false);
  });
});

describe("safeDegradedAction", () => {
  it("never returns a content-publishing stage", () => {
    const d = decision([
      action("PUBLIC_PUBLISH", { finalScore: 0.95 }),
      action("REPORTING", { finalScore: 0.3 }),
      action("MAINTENANCE", { finalScore: 0.2 }),
    ]);
    const safe = safeDegradedAction(d);
    expect(SAFE_DEGRADED_STAGES.has(safe.missionStage)).toBe(true);
    expect(safe.missionStage).not.toBe("PUBLIC_PUBLISH");
    expect(safe.reasonSummary).toContain("degraded");
  });
});

describe("pythonFinalSelector", () => {
  const ranked = [
    action("DISCOVERY", { finalScore: 0.6 }),
    action("REPORTING", { finalScore: 0.4 }),
    action("PUBLIC_PUBLISH", { finalScore: 0.9, safe: false }),
  ];

  it("returns the Python-selected safe candidate as the final choice", async () => {
    brainState.select = async () => pythonResult("DISCOVERY");
    const sel = pythonFinalSelector(fakePrisma);
    const out = await sel({ world, decision: decision(ranked), passId: "p1" });
    expect(out).not.toBeNull();
    expect(out!.source).toBe("python");
    expect(out!.chosen.missionStage).toBe("DISCOVERY");
  });

  it("degrades (null) when the Python brain is disabled — never legacy", async () => {
    brainState.enabled = false;
    const out = await pythonFinalSelector(fakePrisma)({ world, decision: decision(ranked) });
    expect(out).toBeNull();
  });

  it("degrades (null) on an invalid decision shape", async () => {
    brainState.select = async () => ({ ok: true, result: { selected_action: "DISCOVERY" } });
    const out = await pythonFinalSelector(fakePrisma)({ world, decision: decision(ranked) });
    expect(out).toBeNull();
  });

  it("rejects a Python action that is not an allowed candidate", async () => {
    brainState.select = async () => pythonResult("INVENTED_STAGE");
    const out = await pythonFinalSelector(fakePrisma)({ world, decision: decision(ranked) });
    expect(out).toBeNull();
  });

  it("rejects a Python action that maps to an UNSAFE candidate (safety gate)", async () => {
    brainState.select = async () => pythonResult("PUBLIC_PUBLISH");
    const out = await pythonFinalSelector(fakePrisma)({ world, decision: decision(ranked) });
    expect(out).toBeNull();
  });

  it("degrades (null) when the brain call returns no envelope", async () => {
    brainState.select = async () => null;
    const out = await pythonFinalSelector(fakePrisma)({ world, decision: decision(ranked) });
    expect(out).toBeNull();
  });
});

describe("Python final brain — rejections are logged + no legacy fallback (spec)", () => {
  const ranked = [
    action("DISCOVERY", { finalScore: 0.6 }),
    action("REPORTING", { finalScore: 0.4 }),
    action("PUBLIC_PUBLISH", { finalScore: 0.99, safe: false }),
  ];

  it("logs PYTHON_BRAIN_UNAVAILABLE and returns null (never a TS final decision) when Python is unavailable (spec §9)", async () => {
    const { writeAdminWorkerLog } = await import("@/lib/admin-worker/logs");
    brainState.enabled = false;
    const out = await pythonFinalSelector(fakePrisma)({
      world,
      decision: decision(ranked),
      passId: "p1",
    });
    // null => the worker enters safe degraded mode; it does NOT pick a TS action
    expect(out).toBeNull();
    expect(vi.mocked(writeAdminWorkerLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventName: "python_brain_unavailable" }),
    );
  });

  it("rejects AND logs an invalid Python decision shape (spec §10)", async () => {
    const { writeAdminWorkerLog } = await import("@/lib/admin-worker/logs");
    brainState.select = async () => ({ ok: true, result: { selected_action: "DISCOVERY" } });
    const out = await pythonFinalSelector(fakePrisma)({
      world,
      decision: decision(ranked),
      passId: "p1",
    });
    expect(out).toBeNull();
    expect(vi.mocked(writeAdminWorkerLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventName: "python_brain_invalid_decision" }),
    );
  });

  it("rejects AND logs an unsafe Python selected action (safety gate) (spec §11)", async () => {
    const { writeAdminWorkerLog } = await import("@/lib/admin-worker/logs");
    brainState.select = async () => pythonResult("PUBLIC_PUBLISH"); // unsafe candidate in `ranked`
    const out = await pythonFinalSelector(fakePrisma)({
      world,
      decision: decision(ranked),
      passId: "p1",
    });
    expect(out).toBeNull();
    expect(vi.mocked(writeAdminWorkerLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventName: "python_brain_rejected_action" }),
    );
  });

  it("rejects AND logs a Python action that is not an allowed candidate (spec §11)", async () => {
    const { writeAdminWorkerLog } = await import("@/lib/admin-worker/logs");
    brainState.select = async () => pythonResult("INVENTED_STAGE");
    const out = await pythonFinalSelector(fakePrisma)({
      world,
      decision: decision(ranked),
      passId: "p1",
    });
    expect(out).toBeNull();
    expect(vi.mocked(writeAdminWorkerLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventName: "python_brain_rejected_action" }),
    );
  });

  it("does NOT override a valid SAFE Python choice with its own higher-scored candidate (spec §13)", async () => {
    // DISCOVERY scores 0.6 (TS top); Python deliberately picks the lower-scored
    // but safe REPORTING. TypeScript must execute Python's choice, not its argmax.
    brainState.select = async () => pythonResult("REPORTING");
    const out = await pythonFinalSelector(fakePrisma)({
      world,
      decision: decision(ranked),
      passId: "p1",
    });
    expect(out).not.toBeNull();
    expect(out!.source).toBe("python");
    expect(out!.chosen.missionStage).toBe("REPORTING");
  });
});

describe("brain assembly: Python selects → executed; unavailable → safe degraded (spec §9, §12, §14)", () => {
  // These mirror runBrain's exact assembly in brain.ts:
  //   picked  => applyFinalChosen(candidate, picked.chosen, "python")
  //   !picked => applyFinalChosen(candidate, safeDegradedAction(candidate), "degraded")
  const ranked = [
    action("DISCOVERY", { finalScore: 0.6 }),
    action("REPORTING", { finalScore: 0.4 }),
    action("PUBLIC_PUBLISH", { finalScore: 0.99 }), // highest score: a TS argmax would pick this
  ];

  it("a valid Python-selected action becomes the executed action, tagged python (spec §12)", () => {
    const final = applyFinalChosen(decision(ranked), action("REPORTING"), "python");
    expect(final.finalBrain).toBe("python");
    expect(final.missionStage).toBe("REPORTING");
  });

  it("when Python is unavailable the executed action is SAFE degraded — never publish, never the TS argmax (spec §9, §14)", () => {
    const base = decision(ranked);
    const final = applyFinalChosen(
      base,
      safeDegradedAction(base),
      "degraded",
      "PYTHON_BRAIN_UNAVAILABLE",
    );
    expect(final.finalBrain).toBe("degraded");
    expect(SAFE_DEGRADED_STAGES.has(final.missionStage)).toBe(true);
    // PUBLIC_PUBLISH was the highest-scored candidate; a legacy TS argmax would
    // have executed it. Safe degraded mode must NOT publish content.
    expect(final.missionStage).not.toBe("PUBLIC_PUBLISH");
  });
});

describe("applyFinalChosen", () => {
  it("re-derives top-level fields + tags the final brain source", () => {
    const d = decision([action("DISCOVERY"), action("REPORTING")]);
    const next = applyFinalChosen(d, action("REPORTING"), "python");
    expect(next.missionStage).toBe("REPORTING");
    expect(next.finalBrain).toBe("python");
  });
});

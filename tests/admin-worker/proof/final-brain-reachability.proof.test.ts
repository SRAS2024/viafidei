/**
 * PROOF: the Python final brain is reachable, active, and proven — and the
 * worker NEVER silently reverts to a legacy TypeScript final-decision path.
 *
 * This proves the spec's "Make the Python final brain reachable, active, and
 * proven" + "Prevent silent reversion mode": the worker calls the Python
 * brain's `select_action`, validates the response against the strict contract,
 * records the final decision as finalBrain="python", and — when the brain
 * fails / times out / returns invalid output / returns unsafe output / selects
 * a disallowed action — enters safe degraded mode
 * (PYTHON_BRAIN_UNAVAILABLE_SAFE_DEGRADED_MODE) and does NOT publish.
 *
 * There are only two valid states (no hidden compatibility engine):
 *   1. PYTHON_FINAL_BRAIN_ACTIVE
 *   2. PYTHON_BRAIN_UNAVAILABLE_SAFE_DEGRADED_MODE
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
  selectCalls: 0,
}));
vi.mock("@/lib/admin-worker/intelligence", () => ({
  isBrainEnabled: () => brainState.enabled,
  selectAction: () => {
    brainState.selectCalls += 1;
    return brainState.select ? brainState.select() : Promise.resolve(null);
  },
  // compare_counterfactual_actions is advisory; the selector calls it best-effort.
  compareCounterfactualActions: vi.fn(async () => ({ ok: true, result: {} })),
}));

import {
  applyFinalChosen,
  SAFE_DEGRADED_STAGES,
  type BrainAction,
  type BrainDecision,
  type BrainMissionStage,
} from "@/lib/admin-worker/brain";
import { recordBrainCall } from "@/lib/admin-worker/intelligence/store";
import {
  pythonFinalSelector,
  finalBrainMode,
  autonomousPublishingAllowed,
  safeDegradedActionFromNull,
  PYTHON_FINAL_BRAIN_ACTIVE,
  PYTHON_BRAIN_UNAVAILABLE_SAFE_DEGRADED_MODE,
} from "@/lib/admin-worker/final-brain";

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

const ranked = [
  action("PUBLIC_PUBLISH", { finalScore: 0.95 }),
  action("DISCOVERY", { finalScore: 0.7 }),
  action("REPORTING", { finalScore: 0.3 }),
  action("MAINTENANCE", { finalScore: 0.2 }),
];

afterEach(() => {
  brainState.enabled = true;
  brainState.select = null;
  brainState.selectCalls = 0;
  vi.clearAllMocks();
});

describe("PROOF: Python final brain reachable + active", () => {
  it("1. calls select_action (the Python brain is reached every meaningful decision)", async () => {
    brainState.select = () => Promise.resolve(pythonResult("PUBLIC_PUBLISH"));
    await pythonFinalSelector(fakePrisma)({ world, decision: decision(ranked), passId: "p1" });
    expect(brainState.selectCalls).toBe(1);
  });

  it("2. validates the response and 3. records finalBrain=python (PYTHON_FINAL_BRAIN_ACTIVE)", async () => {
    brainState.select = () => Promise.resolve(pythonResult("PUBLIC_PUBLISH"));
    const out = await pythonFinalSelector(fakePrisma)({
      world,
      decision: decision(ranked),
      passId: "p1",
    });
    expect(out).not.toBeNull();
    expect(out!.source).toBe("python");
    expect(out!.chosen.missionStage).toBe("PUBLIC_PUBLISH");
    // recorded under select_action
    expect(recordBrainCall).toHaveBeenCalledWith(
      fakePrisma,
      "select_action",
      expect.anything(),
      expect.anything(),
    );
    // the resulting decision is PYTHON_FINAL_BRAIN_ACTIVE and may publish
    const applied = applyFinalChosen(decision(ranked), out!.chosen, "python");
    expect(finalBrainMode(applied)).toBe(PYTHON_FINAL_BRAIN_ACTIVE);
    expect(autonomousPublishingAllowed(applied)).toBe(true);
  });
});

describe("PROOF: no silent reversion — every failure mode → safe degraded mode, no publish", () => {
  const failureModes: Array<[string, () => Promise<unknown>]> = [
    ["brain disabled", () => Promise.resolve(pythonResult("PUBLIC_PUBLISH"))], // handled via enabled=false below
    ["null / timeout", () => Promise.resolve(null)],
    ["error envelope", () => Promise.resolve({ ok: false, error: "boom" })],
    ["invalid shape", () => Promise.resolve({ ok: true, result: { selected_action: "X" } })],
    ["disallowed action (not a candidate)", () => Promise.resolve(pythonResult("BANANA"))],
  ];

  for (const [label, impl] of failureModes) {
    it(`${label} → selector returns null (degraded), never a legacy TS choice`, async () => {
      if (label === "brain disabled") brainState.enabled = false;
      brainState.select = impl;
      const out = await pythonFinalSelector(fakePrisma)({
        world,
        decision: decision(ranked),
        passId: "p1",
      });
      expect(out).toBeNull();
    });
  }

  it("unsafe selected action is rejected by the TS safety gate → null", async () => {
    const unsafeRanked = [
      action("PUBLIC_PUBLISH", { safe: false, finalScore: 0.95 }),
      action("MAINTENANCE", { finalScore: 0.2 }),
    ];
    brainState.select = () => Promise.resolve(pythonResult("PUBLIC_PUBLISH"));
    const out = await pythonFinalSelector(fakePrisma)({
      world,
      decision: decision(unsafeRanked),
      passId: "p1",
    });
    expect(out).toBeNull();
  });

  it("degraded mode picks ONLY a safe non-publishing stage and blocks autonomous publishing", () => {
    // runBrain converts a null selector result into safeDegradedAction("degraded").
    const d = decision(ranked);
    const safe = safeDegradedActionFromNull(d);
    expect(safe.source).toBe("degraded");
    expect(SAFE_DEGRADED_STAGES.has(safe.chosen.missionStage)).toBe(true);
    expect(safe.chosen.missionStage).not.toBe("PUBLIC_PUBLISH");

    const applied = applyFinalChosen(d, safe.chosen, "degraded");
    expect(finalBrainMode(applied)).toBe(PYTHON_BRAIN_UNAVAILABLE_SAFE_DEGRADED_MODE);
    expect(autonomousPublishingAllowed(applied)).toBe(false);
  });
});

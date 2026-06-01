/**
 * Spec §5-7 + §23-45: runBrain must persist EVERY ranked action to
 * AdminWorkerActionScore (not only the chosen one) and record reasoning
 * edges explaining the choice + the strongest rejected alternative.
 */

import { describe, expect, it, vi } from "vitest";

const recordDecision = vi.fn(async () => ({ id: "decision-1" }));

vi.mock("@/lib/admin-worker/decisions", () => ({
  recordDecision: (...args: unknown[]) => recordDecision(...args),
  CONFIDENCE_THRESHOLDS: { publish: 0.8, publishDoctrinal: 0.95 },
}));

vi.mock("@/lib/admin-worker/state", () => ({
  getAdminWorkerState: vi.fn(async () => ({
    id: "singleton",
    paused: false,
    pausedReason: null,
    currentMode: "CONSTANT_FILL",
    currentPriority: "CONTENT_GOAL",
    currentBlocker: null,
    lastHeartbeatAt: new Date(),
    lastSuccessfulAt: new Date(),
    lastFailedAt: null,
    recoveryAction: null,
  })),
}));

vi.mock("@/lib/admin-worker/content-goals", () => ({
  refreshContentGoals: vi.fn(async () => undefined),
  nextPriorityContentType: vi.fn(async () => ({ contentType: "PRAYER", gap: 5 })),
}));

import { runBrain } from "@/lib/admin-worker/brain";

function defaultModel() {
  return {
    count: vi.fn(async () => 0),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    aggregate: vi.fn(async () => ({})),
    groupBy: vi.fn(async () => []),
    upsert: vi.fn(async () => ({ id: "x" })),
    update: vi.fn(async () => ({ id: "x" })),
    create: vi.fn(async () => ({ id: "x" })),
    createMany: vi.fn(async (args: { data: unknown[] }) => ({ count: args.data.length })),
  };
}

describe("runBrain persists action scores + reasoning edges", () => {
  it("writes one AdminWorkerActionScore per ranked action and reasoning edges", async () => {
    const actionScoreCreateMany = vi.fn(async (args: { data: unknown[] }) => ({
      count: args.data.length,
    }));
    const reasoningCreate = vi.fn(async () => ({ id: "edge" }));

    const overrides: Record<string, Record<string, unknown>> = {
      adminWorkerSourceReputation: {
        ...defaultModel(),
        findMany: vi.fn(async () => [{ sourceHost: "vatican.va", reputationTier: "TRUSTED" }]),
      },
      homepageQualityScore: {
        ...defaultModel(),
        findFirst: vi.fn(async () => ({ finalScore: 0.9 })),
      },
      adminWorkerActionScore: { ...defaultModel(), createMany: actionScoreCreateMany },
      adminWorkerReasoningGraph: { ...defaultModel(), create: reasoningCreate },
    };
    const prisma = new Proxy(
      {},
      {
        get(_t, prop: string) {
          return prop in overrides ? overrides[prop] : defaultModel();
        },
      },
    ) as unknown as Parameters<typeof runBrain>[0];

    const decision = await runBrain(prisma, { passId: "pass-1" });

    // Spec §6: every ranked action persisted.
    expect(actionScoreCreateMany).toHaveBeenCalledTimes(1);
    const rows = actionScoreCreateMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows.length).toBe(decision.rankedAlternatives.length);
    expect(rows.length).toBeGreaterThan(1);
    // Exactly one selected; it carries the chosen mission stage.
    const selected = rows.filter((r) => r.selected === true);
    expect(selected).toHaveLength(1);
    expect(selected[0].missionStage).toBe(decision.missionStage);
    expect(selected[0].decisionId).toBe("decision-1");
    expect(selected[0].passId).toBe("pass-1");
    // Non-selected rows carry a rejected reason (spec §7.14).
    const rejected = rows.filter((r) => r.selected === false);
    expect(rejected.every((r) => typeof r.rejectedReason === "string")).toBe(true);

    // Spec §39-45: reasoning edges recorded (selected + rejected).
    expect(reasoningCreate).toHaveBeenCalled();
    const relations = reasoningCreate.mock.calls.map(
      (c) => (c[0] as { data: { relation: string } }).data.relation,
    );
    expect(relations).toContain("SELECTED_BECAUSE");
  });
});

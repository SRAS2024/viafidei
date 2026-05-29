/**
 * Spec §13: the brain must persist the memory + source reputation it
 * consulted so the command center can show "what memory / source
 * reputation influenced the action". runBrain folds memoryUsed +
 * sourceReputationUsed into the recorded rulesEvaluated JSON.
 */

import { describe, expect, it, vi } from "vitest";

const recordDecision = vi.fn(async () => ({ id: "d1" }));

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
  nextPriorityContentType: vi.fn(async () => "PRAYER"),
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
  };
}

function makePrisma() {
  // Models needing tailored return values.
  const overrides: Record<string, Record<string, unknown>> = {
    adminWorkerSourceReputation: {
      ...defaultModel(),
      findMany: vi.fn(async () => [{ sourceHost: "vatican.va", reputationTier: "TRUSTED" }]),
    },
    homepageQualityScore: {
      ...defaultModel(),
      findFirst: vi.fn(async () => ({ finalScore: 0.9 })),
    },
  };
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop in overrides) return overrides[prop];
        return defaultModel();
      },
    },
  ) as unknown as Parameters<typeof runBrain>[0];
}

describe("runBrain persists memory + reputation influences (spec §13)", () => {
  it("includes memoryUsed and sourceReputationUsed in the recorded rulesEvaluated", async () => {
    recordDecision.mockClear();
    await runBrain(makePrisma(), { passId: "p1" });
    expect(recordDecision).toHaveBeenCalledTimes(1);
    const recorded = recordDecision.mock.calls[0][1] as {
      rulesEvaluated: Record<string, unknown>;
    };
    expect(recorded.rulesEvaluated).toHaveProperty("memoryUsed");
    expect(recorded.rulesEvaluated).toHaveProperty("sourceReputationUsed");
    const rep = recorded.rulesEvaluated.sourceReputationUsed as Array<{ host: string }>;
    expect(Array.isArray(rep)).toBe(true);
    expect(rep[0]?.host).toBe("vatican.va");
  });
});

/**
 * Self-monitoring composer — pins that it derives the right warnings from the
 * underlying signals (extract-without-publish), stays silent when the worker is
 * paused, and reports productive when content is moving forward. The composed
 * sources (state, world, stage reliability) are mocked; only the direct counts
 * come from the prisma stub.
 */
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getAdminWorkerState: vi.fn(),
  sampleWorld: vi.fn(),
  summarizeStageReliability: vi.fn(async () => []),
}));

vi.mock("@/lib/admin-worker/state", () => ({ getAdminWorkerState: h.getAdminWorkerState }));
vi.mock("@/lib/admin-worker/brain", () => ({ sampleWorld: h.sampleWorld }));
vi.mock("@/lib/admin-worker/stage-outcomes", () => ({
  summarizeStageReliability: h.summarizeStageReliability,
}));

import { buildSelfAssessment } from "@/lib/admin-worker/self-assessment";

function world(overrides: Record<string, unknown> = {}) {
  return {
    lastSuccessAgeMs: 5000,
    heartbeatAgeMs: 2000,
    timeSinceLastGrowthMs: 3000,
    contentGoalContentType: "PRAYER",
    readsAwaitingExtraction: 10,
    artifactsAwaitingBuild: 5,
    artifactsAwaitingVerification: 10,
    artifactsAwaitingQA: 8,
    artifactsAwaitingPublish: 7,
    ...overrides,
  };
}

function makePrisma(opts: {
  published: number;
  stageCounts: Array<{ stage: string; resultType: string; _count: { _all: number } }>;
  quality?: Array<{ passed: boolean }>;
}) {
  return {
    publishedContent: { count: vi.fn(async () => opts.published) },
    adminWorkerStageOutcome: { groupBy: vi.fn(async () => opts.stageCounts) },
    contentQualityScore: { findMany: vi.fn(async () => opts.quality ?? []) },
  } as never;
}

describe("buildSelfAssessment", () => {
  it("flags EXTRACTING_WITHOUT_PUBLISHING when work is built but nothing publishes", async () => {
    h.getAdminWorkerState.mockResolvedValue({
      paused: false,
      currentMode: "CONSTANT_FILL",
      currentTask: "build PRAYER",
      currentBlocker: null,
    });
    h.sampleWorld.mockResolvedValue(world());
    const prisma = makePrisma({
      published: 0,
      stageCounts: [{ stage: "EXTRACTION", resultType: "success", _count: { _all: 30 } }],
    });

    const a = await buildSelfAssessment(prisma);
    expect(a.workerLive).toBe(true);
    expect(a.publishedDelta).toBe(0);
    expect(a.extractionsInWindow).toBe(30);
    expect(a.publishesInWindow).toBe(0);
    expect(a.warnings.map((w) => w.kind)).toContain("EXTRACTING_WITHOUT_PUBLISHING");
    expect(a.productive).toBe(false);
  });

  it("raises no warnings when the worker is paused", async () => {
    h.getAdminWorkerState.mockResolvedValue({
      paused: true,
      currentMode: "PAUSED",
      currentTask: null,
      currentBlocker: null,
    });
    h.sampleWorld.mockResolvedValue(world());
    const prisma = makePrisma({
      published: 0,
      stageCounts: [{ stage: "EXTRACTION", resultType: "success", _count: { _all: 30 } }],
    });
    const a = await buildSelfAssessment(prisma);
    expect(a.paused).toBe(true);
    expect(a.warnings).toHaveLength(0);
  });

  it("reports productive when content published in the window", async () => {
    h.getAdminWorkerState.mockResolvedValue({
      paused: false,
      currentMode: "CONSTANT_FILL",
      currentTask: null,
      currentBlocker: null,
    });
    h.sampleWorld.mockResolvedValue(world());
    const prisma = makePrisma({
      published: 6,
      stageCounts: [
        { stage: "EXTRACTION", resultType: "success", _count: { _all: 6 } },
        { stage: "PUBLIC_PUBLISH", resultType: "success", _count: { _all: 6 } },
      ],
    });
    const a = await buildSelfAssessment(prisma);
    expect(a.publishedDelta).toBe(6);
    expect(a.publishesInWindow).toBe(6);
    expect(a.productive).toBe(true);
    expect(a.warnings).toHaveLength(0);
  });
});

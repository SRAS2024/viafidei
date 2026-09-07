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

  it("does NOT flag EXTRACTING_WITHOUT_PUBLISHING while PublishedContent is growing", async () => {
    // The drain + ingest lanes publish most content and never write a
    // PUBLIC_PUBLISH stage outcome, so `publishesInWindow` is 0 while hundreds
    // publish. The PublishedContent delta is the real measure — no warning,
    // and no admin email, while it moves.
    h.getAdminWorkerState.mockResolvedValue({
      paused: false,
      currentMode: "CONSTANT_FILL",
      currentTask: "build PRAYER",
      currentBlocker: null,
    });
    h.sampleWorld.mockResolvedValue(world());
    const prisma = makePrisma({
      published: 300,
      stageCounts: [{ stage: "EXTRACTION", resultType: "success", _count: { _all: 30 } }],
    });
    const a = await buildSelfAssessment(prisma);
    expect(a.publishesInWindow).toBe(0);
    expect(a.publishedDelta).toBe(300);
    expect(a.warnings.map((w) => w.kind)).not.toContain("EXTRACTING_WITHOUT_PUBLISHING");
    expect(a.productive).toBe(true);
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

  it("does NOT flag LOOPING for a purely idle (no_op) stage", async () => {
    // A stage that ran 30× but only idled (no failures/needs-repair) is not
    // looping — it just had nothing to do. `total`/`successRate` include no_op,
    // so keying off successRate would misfire; keying off failures+needsRepair
    // must not.
    h.getAdminWorkerState.mockResolvedValue({
      paused: false,
      currentMode: "CONSTANT_FILL",
      currentTask: null,
      currentBlocker: null,
    });
    h.sampleWorld.mockResolvedValue(world());
    h.summarizeStageReliability.mockResolvedValueOnce([
      {
        stage: "PUBLIC_PUBLISH",
        total: 30,
        successes: 0,
        failures: 0,
        needsRepair: 0,
        successRate: 0,
        avgDurationMs: 0,
      },
    ]);
    const prisma = makePrisma({ published: 0, stageCounts: [] });
    const a = await buildSelfAssessment(prisma);
    expect(a.warnings.map((w) => w.kind)).not.toContain("LOOPING");
  });

  it("flags LOOPING when a stage fails/needs-repair repeatedly with no successes", async () => {
    h.getAdminWorkerState.mockResolvedValue({
      paused: false,
      currentMode: "CONSTANT_FILL",
      currentTask: null,
      currentBlocker: null,
    });
    h.sampleWorld.mockResolvedValue(world());
    h.summarizeStageReliability.mockResolvedValueOnce([
      {
        stage: "EXTRACTION",
        total: 10,
        successes: 0,
        failures: 8,
        needsRepair: 0,
        successRate: 0,
        avgDurationMs: 5,
      },
    ]);
    const prisma = makePrisma({ published: 0, stageCounts: [] });
    const a = await buildSelfAssessment(prisma);
    expect(a.warnings.map((w) => w.kind)).toContain("LOOPING");
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

/**
 * The worker's own account of itself must include its MAINTENANCE state — the
 * owner asked for the self-maintenance work to be reported like any other work.
 * It is read from the sweep's persisted rows, never re-sensed, and it is
 * deliberately not a WorkerWarning (governance's KIND_ACTION is exhaustive over
 * WarningKind; maintenance state belongs in the report, not in the decision
 * that pauses the loop).
 */
describe("buildSelfAssessment — self-maintenance state", () => {
  function stateAndWorld() {
    h.getAdminWorkerState.mockResolvedValue({
      paused: false,
      currentMode: "CONSTANT_FILL",
      currentTask: "build PRAYER",
      currentBlocker: null,
    });
    h.sampleWorld.mockResolvedValue(world());
  }

  it("carries the sweep's persisted snapshot", async () => {
    stateAndWorld();
    const now = Date.now();
    const prisma = {
      ...(makePrisma({ published: 3, stageCounts: [] }) as unknown as Record<string, unknown>),
      adminWorkerMemory: {
        findMany: vi.fn(async () => [
          {
            memoryKey: "self-maintenance:last-run",
            memoryValue: { at: now - 60_000 },
            lastUsedAt: new Date(now),
          },
        ]),
      },
      adminWorkerLog: { findMany: vi.fn(async () => []) },
    } as never;

    const a = await buildSelfAssessment(prisma);
    expect(a.selfMaintenance?.everRan).toBe(true);
    expect(a.selfMaintenance?.healthy).toBe(true);
    expect(a.selfMaintenance?.conditions).toEqual([]);
    // Maintenance state never manufactures a productivity warning.
    expect(a.warnings).toEqual([]);
  });

  it("degrades to null rather than failing the assessment", async () => {
    stateAndWorld();
    const prisma = {
      ...(makePrisma({ published: 3, stageCounts: [] }) as unknown as Record<string, unknown>),
      adminWorkerMemory: {
        findMany: vi.fn(async () => {
          throw new Error("relation does not exist");
        }),
      },
      adminWorkerLog: { findMany: vi.fn(async () => []) },
    } as never;

    const a = await buildSelfAssessment(prisma);
    // Reader is fail-open, so the assessment still completes with a summary
    // that simply reports "not swept".
    expect(a.selfMaintenance?.everRan).toBe(false);
    expect(a.productive).toBe(true);
  });
});

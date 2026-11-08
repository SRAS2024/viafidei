/**
 * Loop mode dispatch — proves the central loop actually runs the
 * correct module for each mode (spec §2 + §18). Uses a mocked Prisma
 * + module mocks so the test stays in the unit suite.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => ({}));

// The real brain, except that a test can have its decision name a stage the
// dispatcher no longer has a handler for.
const leftover = vi.hoisted(() => ({ stage: null as string | null }));
vi.mock("@/lib/admin-worker/brain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/brain")>();
  return {
    ...actual,
    runBrain: async (...args: Parameters<typeof actual.runBrain>) => {
      const decision = await actual.runBrain(...args);
      return leftover.stage ? { ...decision, missionStage: leftover.stage } : decision;
    },
  };
});

vi.mock("@/lib/admin-worker/monthly-report-job", () => ({
  runMonthlyReportJobIfDue: vi.fn(async () => ({
    ran: false,
    reason: "Not the last day of the month.",
  })),
}));

vi.mock("@/lib/admin-worker/cleanup", () => ({
  runCleanupPass: vi.fn(async () => ({
    staleCandidatesRemoved: 0,
    expiredReviewsClosed: 0,
  })),
}));

vi.mock("@/lib/admin-worker/repair", () => ({
  recoverStuckQueue: vi.fn(async () => ({
    kind: "queue_stuck",
    attempted: false,
    succeeded: true,
    reason: "no stuck jobs",
  })),
}));

import { runOnePass } from "@/lib/admin-worker/loop";
import { runMonthlyReportJobIfDue } from "@/lib/admin-worker/monthly-report-job";
import { runCleanupPass } from "@/lib/admin-worker/cleanup";

function makePrisma(opts: { pendingJobs?: number; failedJobs?: number; gap?: number } = {}) {
  return {
    adminWorkerState: {
      upsert: vi.fn(async () => ({
        id: "singleton",
        currentMode: "SETUP",
        currentPriority: "WORKER_HEALTH",
        currentGoal: null,
        currentTask: null,
        lastHeartbeatAt: new Date(),
        lastSuccessfulAt: new Date(),
        lastFailedAt: null,
        currentBlocker: null,
        recoveryAction: null,
        workerVersion: "0.1",
        paused: false,
        pausedReason: null,
        pausedByUsername: null,
        pausedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn(async () => ({})),
    },
    workerBuildJob: {
      count: vi.fn(async ({ where }: { where: { status: string } }) => {
        if (where.status === "pending") return opts.pendingJobs ?? 0;
        if (where.status === "failed") return opts.failedJobs ?? 0;
        return 0;
      }),
    },
    adminWorkerSourceReputation: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    humanReviewQueue: { count: vi.fn(async () => 0) },
    securityEvent: { count: vi.fn(async () => 0) },
    candidateSourceUrl: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
      update: vi.fn(async () => ({})),
    },
    adminWorkerRepairPlan: { count: vi.fn(async () => 0) },
    adminWorkerPipelineStage: { count: vi.fn(async () => 0) },
    adminWorkerSourceRead: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
    },
    // Content-pipeline ladder signals (brain reads artifact counts by state).
    adminWorkerPackageArtifact: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
    },
    publishedContent: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
    },
    postPublishVerification: {
      findMany: vi.fn(async () => []),
    },
    contentGoal: {
      findMany: vi.fn(async () =>
        opts.gap ? [{ contentType: "PRAYER", gapCount: opts.gap, priority: 10 }] : [],
      ),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    adminWorkerPass: {
      create: vi.fn(async () => ({ id: "p1", startedAt: new Date() })),
      update: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => ({ startedAt: new Date() })),
    },
    adminWorkerDecision: { create: vi.fn(async () => ({ id: "d1" })) },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
  } as unknown as Parameters<typeof runOnePass>[0];
}

// runOnePass pulls in the brain, the governor and every lane module, so the
// first test in this file pays a large one-off transform cost. On an idle
// machine that is well under a second; with the full suite saturating every
// core it can exceed the 5 s default, which is a scheduling artifact rather
// than a real regression. The generous timeout applies to the whole file.
describe("runOnePass — mode dispatch", { timeout: 30_000 }, () => {
  it("runs the cleanup pass when nothing else has work", async () => {
    const prisma = makePrisma({});
    // Force MAINTENANCE by leaving every world signal idle. The brain
    // walks its priority ladder (security → health → goal → repair →
    // queue → diagnostics → maintenance) and lands on MAINTENANCE when
    // nothing else has work. The dispatch then MUST call runCleanupPass.
    vi.mocked(runCleanupPass).mockClear();
    await runOnePass(prisma, "test-worker");
    expect(runCleanupPass).toHaveBeenCalledTimes(1);
  });

  it("closes out a pass whose decision names the removed HOMEPAGE_WORK stage", async () => {
    // Nothing reads a stage back out of a stored row to run it, but production
    // may still hold rows that name HOMEPAGE_WORK. Should a decision ever carry
    // it again, the pass ends like any stage with no handler: idle and
    // SUCCEEDED, nothing thrown, and nothing left over for the next pass to retry.
    leftover.stage = "HOMEPAGE_WORK";
    try {
      const prisma = makePrisma({});
      const outcome = await runOnePass(prisma, "test-worker");
      expect(outcome.failed).toBe(0);
      expect(outcome.idle).toBe(true);
      const closes = vi
        .mocked(prisma.adminWorkerPass.update)
        .mock.calls.map((call) => (call[0] as { data: Record<string, unknown> }).data);
      expect(closes).toContainEqual(
        expect.objectContaining({
          status: "SUCCEEDED",
          summary: "HOMEPAGE_WORK: No dispatcher registered for HOMEPAGE_WORK.",
        }),
      );
    } finally {
      leftover.stage = null;
    }
  });

  it("does not run the monthly report when no priority selects REPORTING", async () => {
    vi.mocked(runMonthlyReportJobIfDue).mockClear();
    const prisma = makePrisma({});
    await runOnePass(prisma, "test-worker");
    // Under the current selector REPORTING is never the chosen mode unless
    // the operator forces it. The monthly report is NOT dispatched through
    // the brain's stage selection at all — it runs from the always-on
    // reporting LANE every pass (self-gated + idempotent per month), plus a
    // best-effort check at worker startup. This documents that the DISPATCH
    // path stays out of it.
    expect(runMonthlyReportJobIfDue).not.toHaveBeenCalled();
  });

  it("logs a paused message and returns early when state.paused = true", async () => {
    const prisma = makePrisma({});
    // Force paused state by tweaking the upsert mock.
    (prisma.adminWorkerState.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "singleton",
      currentMode: "PAUSED",
      currentPriority: "WORKER_HEALTH",
      paused: true,
      pausedReason: "operator request",
      lastHeartbeatAt: new Date(),
    });
    const outcome = await runOnePass(prisma, "test-worker");
    expect(outcome.idle).toBe(true);
    expect(outcome.built).toBe(0);
  });
});

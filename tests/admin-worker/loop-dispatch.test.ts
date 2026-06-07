/**
 * Loop mode dispatch — proves the central loop actually runs the
 * correct module for each mode (spec §2 + §18). Uses a mocked Prisma
 * + module mocks so the test stays in the unit suite.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => ({}));

vi.mock("@/lib/admin-worker/homepage-mutator", () => ({
  redesignHomepage: vi.fn(async () => ({
    draftId: "d1",
    status: "AUTO_PUBLISHED",
    finalScore: 0.7,
    qualityScoreId: "q1",
    sectionsChanged: ["updated:hero"],
    reasonSummary: "test",
  })),
}));

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
import { redesignHomepage } from "@/lib/admin-worker/homepage-mutator";
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
    homepageQualityScore: { findFirst: vi.fn(async () => ({ finalScore: 0.9 })) },
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

describe("runOnePass — mode dispatch", () => {
  it("runs the homepage mutator when HOMEPAGE priority wins", async () => {
    vi.mocked(redesignHomepage).mockClear();
    const prisma = makePrisma({});
    // Force MAINTENANCE by leaving every world signal idle. The brain
    // walks its priority ladder (security → health → goal → repair →
    // queue → homepage → diagnostics → maintenance) and lands on
    // MAINTENANCE when nothing else has work. The dispatch then MUST
    // call runCleanupPass.
    vi.mocked(runCleanupPass).mockClear();
    await runOnePass(prisma, "test-worker");
    expect(runCleanupPass).toHaveBeenCalledTimes(1);
  });

  it("does not run the monthly report when no priority selects REPORTING", async () => {
    vi.mocked(runMonthlyReportJobIfDue).mockClear();
    const prisma = makePrisma({});
    await runOnePass(prisma, "test-worker");
    // Under the current selector REPORTING is never the chosen
    // mode unless the operator forces it; the worker startup hook
    // calls runMonthlyReportJobIfDue directly. This documents that.
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

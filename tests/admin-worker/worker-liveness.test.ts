/**
 * Worker liveness resilience. A pass row is created RUNNING at the top of the
 * loop; if the process dies mid-pass the row is orphaned as RUNNING forever
 * (the "Last pass … (status: RUNNING)" the developer audit flagged) and a
 * single throw used to kill the whole loop. These pin the three fixes:
 *   1. reapStaleRunningPasses closes orphaned RUNNING rows at startup.
 *   2. runOnePass ALWAYS reaches a terminal status, even on a mid-pass throw.
 *   3. runAdminWorkerLoop survives a throwing pass and keeps going.
 */
import { describe, expect, it, vi } from "vitest";

import { reapStaleRunningPasses } from "@/lib/admin-worker/passes";
import { runAdminWorkerLoop, runOnePass } from "@/lib/admin-worker/loop";

describe("reapStaleRunningPasses", () => {
  it("fails RUNNING passes older than the cutoff and leaves fresh ones", async () => {
    let captured: { where?: unknown; data?: Record<string, unknown> } = {};
    const prisma = {
      adminWorkerPass: {
        updateMany: vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => {
          captured = args;
          return { count: 2 };
        }),
      },
    } as unknown as Parameters<typeof reapStaleRunningPasses>[0];

    const reaped = await reapStaleRunningPasses(prisma);
    expect(reaped).toBe(2);
    const where = captured.where as { status: string; startedAt: { lt: Date } };
    expect(where.status).toBe("RUNNING");
    expect(where.startedAt.lt).toBeInstanceOf(Date);
    // Cutoff is ~10 minutes in the past.
    expect(Date.now() - where.startedAt.lt.getTime()).toBeGreaterThanOrEqual(9 * 60 * 1000);
    expect(captured.data?.status).toBe("FAILED");
    expect(captured.data?.completedAt).toBeInstanceOf(Date);
    expect(String(captured.data?.errorMessage)).toMatch(/reaped/i);
  });

  it("is fail-open: returns 0 when the update throws", async () => {
    const prisma = {
      adminWorkerPass: {
        updateMany: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as unknown as Parameters<typeof reapStaleRunningPasses>[0];
    expect(await reapStaleRunningPasses(prisma)).toBe(0);
  });

  it("honours a custom stale window", async () => {
    let cutoff: Date | null = null;
    const prisma = {
      adminWorkerPass: {
        updateMany: vi.fn(async (args: { where: { startedAt: { lt: Date } } }) => {
          cutoff = args.where.startedAt.lt;
          return { count: 0 };
        }),
      },
    } as unknown as Parameters<typeof reapStaleRunningPasses>[0];
    await reapStaleRunningPasses(prisma, { staleMs: 60 * 1000 });
    expect(cutoff).not.toBeNull();
    // ~1 minute window, not the 10-minute default.
    expect(Date.now() - (cutoff as unknown as Date).getTime()).toBeLessThan(5 * 60 * 1000);
  });
});

/** Minimal Prisma stub sufficient to drive runOnePass through a full pass. */
function makePrisma(overrides: Record<string, unknown> = {}) {
  const passUpdate = vi.fn(async () => ({}));
  return {
    __passUpdate: passUpdate,
    adminWorkerState: {
      update: vi.fn(async () => ({})),
      upsert: vi.fn(async () => ({
        id: "singleton",
        currentMode: "SETUP",
        currentPriority: "WORKER_HEALTH",
        paused: false,
        pausedReason: null,
        lastHeartbeatAt: new Date(),
        lastSuccessfulAt: new Date(),
        lastFailedAt: null,
        currentBlocker: null,
      })),
    },
    workerBuildJob: { count: vi.fn(async () => 0) },
    adminWorkerSourceReputation: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
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
    adminWorkerSourceRead: { count: vi.fn(async () => 0), findFirst: vi.fn(async () => null) },
    adminWorkerPackageArtifact: { count: vi.fn(async () => 0), findFirst: vi.fn(async () => null) },
    publishedContent: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      groupBy: vi.fn(async () => []),
    },
    postPublishVerification: { findMany: vi.fn(async () => []) },
    contentGoal: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    adminWorkerPass: {
      create: vi.fn(async () => ({ id: "p1", startedAt: new Date() })),
      update: passUpdate,
      findUnique: vi.fn(async () => ({ startedAt: new Date() })),
    },
    adminWorkerDecision: { create: vi.fn(async () => ({ id: "d1" })) },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
    adminWorkerStageOutcome: { create: vi.fn(async () => ({ id: "so1" })) },
    ...overrides,
  } as unknown as Parameters<typeof runOnePass>[0];
}

describe("runOnePass — never leaves a pass RUNNING", () => {
  it("marks the pass FAILED (not RUNNING) when a mid-pass write throws", async () => {
    // adminWorkerState.update succeeds for the heartbeat (first call) then
    // throws — so the throw lands AFTER startPass (on setPriority/setMode),
    // inside the pass-critical try. The finally/catch must still close the row.
    let calls = 0;
    const update = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return {}; // heartbeat
      throw new Error("state write failed mid-pass");
    });
    const prisma = makePrisma();
    (prisma as unknown as { adminWorkerState: { update: unknown } }).adminWorkerState.update =
      update;

    const outcome = await runOnePass(prisma, "test-worker");
    expect(outcome.failed).toBeGreaterThan(0);

    const passUpdate = (prisma as unknown as { __passUpdate: ReturnType<typeof vi.fn> })
      .__passUpdate;
    // completePass ran, and never left the row RUNNING.
    expect(passUpdate).toHaveBeenCalled();
    const statuses = passUpdate.mock.calls.map(
      (c) => (c[0] as { data: { status?: string } }).data.status,
    );
    expect(statuses.some((s) => s === "FAILED")).toBe(true);
    expect(statuses.every((s) => s !== "RUNNING")).toBe(true);
  });
});

describe("runAdminWorkerLoop — a throwing pass never kills the loop", () => {
  it("continues past a pass that throws and reports the failure count", async () => {
    // Make the very first thing in a pass (writeHeartbeat) throw on EVERY pass.
    // Without loop isolation this rejects the whole loop; with it, the loop
    // counts the failure and keeps going.
    const prisma = makePrisma({
      adminWorkerState: {
        update: vi.fn(async () => {
          throw new Error("heartbeat write failed");
        }),
        upsert: vi.fn(async () => ({ paused: false, lastHeartbeatAt: new Date() })),
      },
    });

    const result = await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 2,
      idleBackoffMs: 0,
      workerId: "test-loop",
    });
    expect(result.passes).toBe(2);
    expect(result.failed).toBe(2);
  });
});

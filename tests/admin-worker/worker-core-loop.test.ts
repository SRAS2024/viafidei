/**
 * Worker-loop liveness + efficiency (audit LIVE-2/3/5/7):
 *   - a background heartbeat + lease renew runs on a timer, independent of
 *     pass progress, and is cleared when the loop exits;
 *   - the loop reports WHY it stopped (switch OFF / lease lost) so the
 *     supervisor treats it as an intended stop;
 *   - a hung dispatch is bounded by a watchdog and recorded as a failed stage;
 *   - the in-flight pass id is tracked so a SIGTERM can close it honestly;
 *   - goals are seeded only when the table is empty, refreshed once per pass;
 *   - idle passes back off adaptively instead of hot-looping.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/execution-host", () => ({
  readExecutionStatus: vi.fn(async () => ({
    known: true,
    switch: { on: true },
    lease: null,
  })),
  renewExecutionLease: vi.fn(async () => "renewed"),
}));

vi.mock("@/lib/admin-worker/dispatcher", () => ({
  executeMissionStage: vi.fn(async () => ({
    stage: "MAINTENANCE",
    kind: "idle",
    summary: "nothing to do",
  })),
}));

import { readExecutionStatus, renewExecutionLease } from "@/lib/admin-worker/execution-host";
import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import {
  abandonCurrentPass,
  getCurrentPassId,
  runAdminWorkerLoop,
  runOnePass,
} from "@/lib/admin-worker/loop";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Minimal Prisma stub sufficient to drive a full pass (mirrors worker-liveness). */
function makePrisma(opts: { paused?: boolean; stateDelayMs?: number; goalRows?: number } = {}) {
  const heartbeat = vi.fn(async () => ({}));
  const passUpdate = vi.fn(async () => ({}));
  const goalUpsert = vi.fn(async () => ({}));
  const stageOutcomeCreate = vi.fn(async () => ({ id: "so1" }));
  const groupBy = vi.fn(async () => []);
  return {
    __heartbeat: heartbeat,
    __passUpdate: passUpdate,
    __goalUpsert: goalUpsert,
    __stageOutcomeCreate: stageOutcomeCreate,
    __groupBy: groupBy,
    adminWorkerState: {
      update: heartbeat,
      upsert: vi.fn(async () => {
        if (opts.stateDelayMs) await sleep(opts.stateDelayMs);
        return {
          id: "singleton",
          currentMode: "SETUP",
          currentPriority: "WORKER_HEALTH",
          paused: opts.paused ?? false,
          pausedReason: null,
          lastHeartbeatAt: new Date(),
          lastSuccessfulAt: new Date(),
          lastFailedAt: null,
          currentBlocker: null,
        };
      }),
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
      groupBy,
    },
    postPublishVerification: { findMany: vi.fn(async () => []) },
    contentGoal: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      upsert: goalUpsert,
      count: vi.fn(async () => opts.goalRows ?? 15),
    },
    adminWorkerPass: {
      create: vi.fn(async () => ({ id: "p1", startedAt: new Date() })),
      update: passUpdate,
      findUnique: vi.fn(async () => ({ startedAt: new Date() })),
    },
    adminWorkerDecision: {
      create: vi.fn(async () => ({ id: "d1" })),
      findMany: vi.fn(async () => []),
    },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
    adminWorkerStageOutcome: { create: stageOutcomeCreate, findMany: vi.fn(async () => []) },
  } as unknown as Parameters<typeof runOnePass>[0] & {
    __heartbeat: ReturnType<typeof vi.fn>;
    __passUpdate: ReturnType<typeof vi.fn>;
    __goalUpsert: ReturnType<typeof vi.fn>;
    __stageOutcomeCreate: ReturnType<typeof vi.fn>;
    __groupBy: ReturnType<typeof vi.fn>;
  };
}

afterEach(() => {
  vi.mocked(readExecutionStatus).mockReset();
  vi.mocked(readExecutionStatus).mockResolvedValue({
    known: true,
    switch: { on: true },
    lease: null,
  } as never);
  vi.mocked(renewExecutionLease).mockReset();
  vi.mocked(renewExecutionLease).mockResolvedValue("renewed");
  vi.mocked(executeMissionStage).mockReset();
  vi.mocked(executeMissionStage).mockResolvedValue({
    stage: "MAINTENANCE",
    kind: "idle",
    summary: "nothing to do",
  } as never);
  delete process.env.ADMIN_WORKER_DISPATCH_TIMEOUT_MS;
});

describe("background heartbeat", () => {
  it("writes heartbeats + renews the lease on a timer while a pass is in flight", async () => {
    // A paused pass returns early, but getAdminWorkerState is slowed to 250ms
    // so the 30ms heartbeat timer must fire several times DURING the pass.
    const prisma = makePrisma({ paused: true, stateDelayMs: 250 });
    await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 1,
      idleBackoffMs: 0,
      workerId: "hb-worker",
      heartbeatIntervalMs: 30,
    });
    // 1 heartbeat from the pass itself + >=3 from the timer.
    expect(prisma.__heartbeat.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(vi.mocked(renewExecutionLease)).toHaveBeenCalledWith(prisma, "hb-worker");
    // Cleared on exit: no further heartbeats after the loop returned.
    const after = prisma.__heartbeat.mock.calls.length;
    await sleep(100);
    expect(prisma.__heartbeat.mock.calls.length).toBe(after);
  });
});

describe("stop reasons", () => {
  it("returns stopReason 'switch_off' when the master switch reads OFF", async () => {
    vi.mocked(readExecutionStatus).mockResolvedValue({
      known: true,
      switch: { on: false },
      lease: null,
    } as never);
    const prisma = makePrisma({ paused: true });
    const result = await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 5,
      idleBackoffMs: 0,
      workerId: "w",
      heartbeatIntervalMs: 0,
    });
    expect(result.stopReason).toBe("switch_off");
    expect(result.passes).toBe(0);
  });

  it("returns stopReason 'lease_lost' when the lease belongs to another runtime", async () => {
    vi.mocked(renewExecutionLease).mockResolvedValue("lost");
    const prisma = makePrisma({ paused: true });
    const result = await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 5,
      idleBackoffMs: 0,
      workerId: "w",
      heartbeatIntervalMs: 0,
    });
    expect(result.stopReason).toBe("lease_lost");
  });

  it("keeps running (no stopReason) when the database is unreachable", async () => {
    vi.mocked(readExecutionStatus).mockResolvedValue({ known: false } as never);
    const prisma = makePrisma({ paused: true });
    const result = await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 2,
      idleBackoffMs: 0,
      workerId: "w",
      heartbeatIntervalMs: 0,
    });
    expect(result.stopReason).toBeUndefined();
    expect(result.passes).toBe(2);
  });
});

describe("dispatch watchdog", () => {
  it("bounds a hung dispatch, records a failed stage outcome, and still closes the pass", async () => {
    process.env.ADMIN_WORKER_DISPATCH_TIMEOUT_MS = "60";
    vi.mocked(executeMissionStage).mockImplementation(() => new Promise(() => undefined));
    const prisma = makePrisma();
    const outcome = await runOnePass(prisma, "wd-worker");
    expect(outcome.failed).toBeGreaterThanOrEqual(1);
    const failedOutcome = prisma.__stageOutcomeCreate.mock.calls.find(
      (c) => (c[0] as { data: { resultType: string } }).data.resultType === "failure",
    );
    expect(failedOutcome).toBeDefined();
    expect(
      String((failedOutcome![0] as { data: { failureReason: string } }).data.failureReason),
    ).toMatch(/dispatch watchdog/);
    const statuses = prisma.__passUpdate.mock.calls.map(
      (c) => (c[0] as { data: { status?: string } }).data.status,
    );
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((s) => s !== "RUNNING")).toBe(true);
  });
});

describe("in-flight pass tracking", () => {
  it("exposes the current pass id during dispatch and clears it afterwards", async () => {
    let seen: string | null = "unset";
    vi.mocked(executeMissionStage).mockImplementation(async () => {
      seen = getCurrentPassId();
      return { stage: "MAINTENANCE", kind: "idle", summary: "ok" } as never;
    });
    const prisma = makePrisma();
    await runOnePass(prisma, "w");
    expect(seen).toBe("p1");
    expect(getCurrentPassId()).toBeNull();
    expect(await abandonCurrentPass(prisma, "stopped by operator")).toBe(false);
  });

  it("abandonCurrentPass closes the in-flight pass as FAILED with the reason", async () => {
    const prisma = makePrisma();
    vi.mocked(executeMissionStage).mockImplementation(async () => {
      await abandonCurrentPass(prisma, "stopped by operator");
      return { stage: "MAINTENANCE", kind: "idle", summary: "ok" } as never;
    });
    await runOnePass(prisma, "w");
    const abandoned = prisma.__passUpdate.mock.calls.find(
      (c) =>
        (c[0] as { data: { errorMessage?: string } }).data.errorMessage === "stopped by operator",
    );
    expect(abandoned).toBeDefined();
    expect((abandoned![0] as { data: { status: string } }).data.status).toBe("FAILED");
  });
});

describe("per-pass bookkeeping cost", () => {
  it("seeds goals only when the table is empty", async () => {
    const empty = makePrisma({ goalRows: 0 });
    await runOnePass(empty, "w");
    expect(empty.__goalUpsert).toHaveBeenCalled();

    const seeded = makePrisma({ goalRows: 15 });
    await runOnePass(seeded, "w");
    expect(seeded.__goalUpsert).not.toHaveBeenCalled();
  });

  it("refreshes content goals exactly once per pass (world sampled once)", async () => {
    const prisma = makePrisma();
    await runOnePass(prisma, "w");
    expect(prisma.__groupBy).toHaveBeenCalledTimes(1);
  });
});

describe("adaptive idle backoff", () => {
  it("doubles the idle sleep up to the cap across consecutive idle passes", async () => {
    const prisma = makePrisma({ paused: true });
    const started = Date.now();
    await runAdminWorkerLoop(prisma, {
      oneShot: false,
      maxPasses: 4,
      idleBackoffMs: 20,
      idleBackoffMaxMs: 80,
      workerId: "w",
      heartbeatIntervalMs: 0,
    });
    // Sleeps: 20 + 40 + 80 + 80 = 220ms (a fixed 20ms backoff would be 80ms).
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(200);
    expect(elapsed).toBeLessThan(2000);
  });
});

/**
 * Worker loop liveness.
 *
 * Pins the fix for the worker heartbeat blocker:
 *   - the worker stays alive and keeps polling when the queue is
 *     empty (it no longer exits during the idle sleep);
 *   - it writes a heartbeat immediately on startup;
 *   - a failed initial heartbeat write is logged and aborts startup
 *     loudly instead of being silently swallowed;
 *   - pending jobs are leased and processed when the worker is alive.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/dispatch", () => ({
  runJobByKind: vi.fn(),
}));

import { runWorkerLoop } from "@/lib/ingestion/queue/worker";
import { runJobByKind } from "@/lib/ingestion/queue/dispatch";
import { __resetContentTypePauseCache } from "@/lib/data/content-type-pause";
import { logger } from "@/lib/observability/logger";

beforeEach(() => {
  resetPrismaMock();
  __resetContentTypePauseCache();
  prismaMock.contentTypePause.findMany.mockResolvedValue([]);
  vi.mocked(runJobByKind).mockReset();
});

describe("worker loop liveness", () => {
  it("keeps polling when the queue is empty instead of exiting", async () => {
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.workerHeartbeat.upsert.mockResolvedValue({});
    // Three empty polls, then throw to break the otherwise-infinite
    // loop so the test can make assertions on it.
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("stop-empty-queue-test"));

    await expect(runWorkerLoop({ workerId: "w-empty", idleSleepMs: 1 })).rejects.toThrow(
      "stop-empty-queue-test",
    );

    // Four polls (3 empty + 1 throwing) — the loop did NOT exit after
    // the first empty poll, which is the regression this guards.
    expect(prismaMock.$queryRawUnsafe.mock.calls.length).toBe(4);
    // Initial heartbeat plus one idle heartbeat per empty cycle.
    expect(prismaMock.workerHeartbeat.upsert.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("writes a heartbeat immediately on startup, before leasing a job", async () => {
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.workerHeartbeat.upsert.mockResolvedValue({});
    prismaMock.workerHeartbeat.delete.mockResolvedValue({});
    prismaMock.$queryRawUnsafe.mockResolvedValue([]);

    await runWorkerLoop({ workerId: "w-start", oneShot: true });

    const firstUpsert = prismaMock.workerHeartbeat.upsert.mock.calls[0][0];
    expect(firstUpsert.where).toEqual({ workerId: "w-start" });
    expect(firstUpsert.create.status).toBe("idle");
    expect(firstUpsert.create.metadata).toEqual({ processType: "worker" });
  });

  it("fails fast and logs an error when the initial heartbeat write fails", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.workerHeartbeat.upsert.mockRejectedValue(new Error("heartbeat db unreachable"));

    await expect(runWorkerLoop({ workerId: "w-hbfail", oneShot: true })).rejects.toThrow(
      "heartbeat db unreachable",
    );

    expect(errorSpy).toHaveBeenCalledWith(
      "ingestion.worker.heartbeat_write_failed",
      expect.objectContaining({ workerId: "w-hbfail" }),
    );
    errorSpy.mockRestore();
  });

  it("leases and processes a pending job when the worker is alive", async () => {
    vi.mocked(runJobByKind).mockResolvedValue({ ok: true });
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.ingestionJobQueue.update.mockResolvedValue({});
    prismaMock.workerHeartbeat.upsert.mockResolvedValue({});
    prismaMock.workerHeartbeat.delete.mockResolvedValue({});
    const jobRow = {
      id: "q-1",
      sourceId: null,
      jobId: null,
      jobName: "discovery-test",
      jobKind: "source_discovery",
      contentType: "Prayer",
      status: "running",
      priority: 100,
      attempts: 1,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      leasedBy: "w-job",
      errorMessage: null,
      lastError: null,
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.$queryRawUnsafe.mockResolvedValue([jobRow]);

    const result = await runWorkerLoop({ workerId: "w-job", maxJobs: 1 });

    expect(result.processed).toBe(1);
    expect(runJobByKind).toHaveBeenCalledTimes(1);
  });
});

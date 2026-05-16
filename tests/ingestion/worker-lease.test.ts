import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  leaseNextJob,
  recoverStaleJobs,
  releaseLease,
  DEFAULT_LEASE_DURATION_MS,
  DEFAULT_STALE_LEASE_GRACE_MS,
} from "@/lib/ingestion/queue/queue";

beforeEach(() => {
  resetPrismaMock();
});

describe("worker lease behavior", () => {
  it("leaseNextJob runs the atomic CTE UPDATE and returns null when no row matches", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValue([]);
    const result = await leaseNextJob({ workerId: "worker-1" });
    expect(result).toBeNull();
    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalled();
  });

  it("leaseNextJob returns the leased row when one is available", async () => {
    const row = {
      id: "q1",
      sourceId: null,
      jobId: null,
      jobName: "test-adapter",
      contentType: "Prayer",
      status: "running",
      priority: 100,
      attempts: 1,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      leaseExpiresAt: new Date(Date.now() + DEFAULT_LEASE_DURATION_MS),
      leasedBy: "worker-1",
      errorMessage: null,
      lastError: null,
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.$queryRawUnsafe.mockResolvedValue([row]);
    const result = await leaseNextJob({ workerId: "worker-1" });
    expect(result?.id).toBe("q1");
    expect(result?.status).toBe("running");
    expect(result?.leasedBy).toBe("worker-1");
  });

  it("recoverStaleJobs returns rows whose lease expired before the grace window", async () => {
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 3 });
    const recovered = await recoverStaleJobs();
    expect(recovered).toBe(3);
    const call = prismaMock.ingestionJobQueue.updateMany.mock.calls[0][0];
    expect(call.where.status).toBe("running");
    expect(call.where.leaseExpiresAt).toBeDefined();
    // The cutoff is `now - DEFAULT_STALE_LEASE_GRACE_MS`.
    const cutoff = call.where.leaseExpiresAt.lt as Date;
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - DEFAULT_STALE_LEASE_GRACE_MS + 100);
  });

  it("releaseLease only flips running rows back to pending", async () => {
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 1 });
    await releaseLease("q1");
    const call = prismaMock.ingestionJobQueue.updateMany.mock.calls[0][0];
    expect(call.where.status).toBe("running");
    expect(call.where.id).toBe("q1");
    expect(call.data.status).toBe("pending");
  });

  it("recoverStaleJobs returns 0 when nothing is stale", async () => {
    prismaMock.ingestionJobQueue.updateMany.mockResolvedValue({ count: 0 });
    const recovered = await recoverStaleJobs();
    expect(recovered).toBe(0);
  });
});

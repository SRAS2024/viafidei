import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { pruneQueueHistory, queueLatencySnapshot } from "@/lib/ingestion/queue/queue";

beforeEach(() => {
  resetPrismaMock();
});

describe("pruneQueueHistory", () => {
  it("uses different cutoffs for completed vs failed", async () => {
    prismaMock.ingestionJobQueue.deleteMany.mockResolvedValue({ count: 0 });
    const now = new Date("2026-05-16T00:00:00Z");
    await pruneQueueHistory({
      completedRetentionDays: 30,
      failedRetentionDays: 90,
      now,
    });
    expect(prismaMock.ingestionJobQueue.deleteMany).toHaveBeenCalledTimes(3);
    const calls = prismaMock.ingestionJobQueue.deleteMany.mock.calls.map((c) => c[0].where);
    expect(calls[0].status).toBe("completed");
    expect(calls[2].status).toBe("failed");
    // Failed cutoff should be older than completed cutoff.
    expect(calls[0].finishedAt.lt.getTime()).toBeGreaterThan(calls[2].finishedAt.lt.getTime());
  });
});

describe("queueLatencySnapshot", () => {
  it("returns null ages when there are no pending rows", async () => {
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    const result = await queueLatencySnapshot();
    expect(result.oldestPendingAgeMs).toBeNull();
    expect(result.oldestRetryingAgeMs).toBeNull();
    expect(result.avgWaitMs).toBeNull();
  });

  it("computes oldest pending age when one exists", async () => {
    const oldPending = new Date(Date.now() - 60 * 60 * 1000);
    prismaMock.ingestionJobQueue.findFirst
      .mockResolvedValueOnce({ runAt: oldPending })
      .mockResolvedValueOnce(null);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    const result = await queueLatencySnapshot();
    expect(result.oldestPendingAgeMs).toBeGreaterThan(50 * 60 * 1000);
  });
});

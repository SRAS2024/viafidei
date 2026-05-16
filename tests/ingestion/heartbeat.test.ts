import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  writeHeartbeat,
  listWorkerHealth,
  hasHealthyWorker,
  removeHeartbeat,
} from "@/lib/ingestion/queue/heartbeat";

beforeEach(() => {
  resetPrismaMock();
});

describe("worker heartbeat", () => {
  it("writeHeartbeat upserts the row", async () => {
    prismaMock.workerHeartbeat.upsert.mockResolvedValue({});
    await writeHeartbeat({
      workerId: "w1",
      startedAt: new Date("2026-05-16T00:00:00Z"),
      processedCount: 5,
      failedCount: 0,
      retryCount: 1,
      status: "running",
    });
    expect(prismaMock.workerHeartbeat.upsert).toHaveBeenCalled();
    const call = prismaMock.workerHeartbeat.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ workerId: "w1" });
    expect(call.create.processedCount).toBe(5);
  });

  it("listWorkerHealth marks workers stale after >90s", async () => {
    const now = new Date("2026-05-16T12:00:00Z");
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([
      {
        workerId: "fresh",
        startedAt: new Date("2026-05-16T11:00:00Z"),
        lastHeartbeatAt: new Date(now.getTime() - 10_000),
        processedCount: 3,
        failedCount: 0,
        retryCount: 0,
        currentJobId: null,
        status: "idle",
      },
      {
        workerId: "old",
        startedAt: new Date("2026-05-16T10:00:00Z"),
        lastHeartbeatAt: new Date(now.getTime() - 5 * 60_000),
        processedCount: 100,
        failedCount: 1,
        retryCount: 2,
        currentJobId: null,
        status: "running",
      },
    ]);
    const workers = await listWorkerHealth(now);
    expect(workers).toHaveLength(2);
    expect(workers[0].isStale).toBe(false);
    expect(workers[1].isStale).toBe(true);
  });

  it("hasHealthyWorker returns true when at least one fresh worker exists", async () => {
    prismaMock.workerHeartbeat.count.mockResolvedValue(1);
    expect(await hasHealthyWorker()).toBe(true);
    prismaMock.workerHeartbeat.count.mockResolvedValue(0);
    expect(await hasHealthyWorker()).toBe(false);
  });

  it("removeHeartbeat swallows already-removed rows", async () => {
    prismaMock.workerHeartbeat.delete.mockRejectedValue(new Error("not found"));
    await expect(removeHeartbeat("missing")).resolves.toBeUndefined();
  });
});

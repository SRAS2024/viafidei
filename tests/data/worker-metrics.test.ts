import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listWorkerMetrics } from "@/lib/data/worker-metrics";

beforeEach(() => {
  resetPrismaMock();
});

describe("worker metrics", () => {
  it("returns empty when no workers exist", async () => {
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([]);
    expect(await listWorkerMetrics()).toEqual([]);
  });

  it("computes failure rate + retry rate over 24h", async () => {
    const now = new Date();
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([
      {
        workerId: "w1",
        startedAt: new Date(now.getTime() - 3600_000),
        lastHeartbeatAt: now,
        processedCount: 10,
        failedCount: 1,
        retryCount: 2,
        currentJobId: null,
        status: "idle",
        hostname: "host",
        version: null,
      },
    ]);
    prismaMock.ingestionJobQueue.groupBy.mockImplementation((args: { by: string[] }) => {
      if (args.by.includes("leasedBy") && args.by.includes("status")) {
        return Promise.resolve([
          { leasedBy: "w1", status: "completed", _count: { _all: 7 } },
          { leasedBy: "w1", status: "failed", _count: { _all: 1 } },
          { leasedBy: "w1", status: "retrying", _count: { _all: 2 } },
        ]);
      }
      return Promise.resolve([{ leasedBy: "w1", _avg: { durationMs: 2500 } }]);
    });
    const metrics = await listWorkerMetrics(now);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].processed).toBe(7);
    expect(metrics[0].failed).toBe(1);
    expect(metrics[0].retried).toBe(2);
    expect(metrics[0].avgDurationMs).toBe(2500);
    expect(metrics[0].failureRate).toBeCloseTo(0.1, 5);
    expect(metrics[0].retryRate).toBeCloseTo(0.2, 5);
  });

  it("reports idleSinceMs for idle workers", async () => {
    const now = new Date("2026-05-16T12:00:00Z");
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([
      {
        workerId: "w1",
        startedAt: new Date(now.getTime() - 3600_000),
        lastHeartbeatAt: new Date(now.getTime() - 5000),
        processedCount: 0,
        failedCount: 0,
        retryCount: 0,
        currentJobId: null,
        status: "idle",
        hostname: null,
        version: null,
      },
    ]);
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
    const metrics = await listWorkerMetrics(now);
    expect(metrics[0].idleSinceMs).toBe(5000);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  getQueueHealthSummary,
  getPublicQueueHealth,
  detectStallSignals,
} from "@/lib/data/queue-health";

beforeEach(() => {
  resetPrismaMock();
});

describe("getQueueHealthSummary", () => {
  it("flags pendingJobsButNoWorker when pending > 0 but no healthy worker", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 5 } },
    ]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([]);
    prismaMock.workerHeartbeat.count.mockResolvedValue(0);
    const r = await getQueueHealthSummary();
    expect(r.pendingJobsButNoWorker).toBe(true);
    expect(r.counts.pending).toBe(5);
    expect(r.workersAlive).toBe(0);
  });

  it("does not flag when healthy worker exists", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 2 } },
    ]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([
      {
        workerId: "w1",
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
        processedCount: 1,
        failedCount: 0,
        retryCount: 0,
        currentJobId: null,
        status: "running",
      },
    ]);
    prismaMock.workerHeartbeat.count.mockResolvedValue(1);
    const r = await getQueueHealthSummary();
    expect(r.pendingJobsButNoWorker).toBe(false);
    expect(r.hasHealthyWorker).toBe(true);
  });
});

describe("getPublicQueueHealth (sanitized)", () => {
  it("returns only summary counters", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([
      { status: "running", _count: { _all: 1 } },
    ]);
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([]);
    const r = await getPublicQueueHealth();
    expect(Object.keys(r).sort()).toEqual(
      ["failed", "pending", "retrying", "running", "workersAlive"].sort(),
    );
    expect(r.running).toBe(1);
    // None of the public keys should be a payload, body, or token.
    for (const key of Object.keys(r)) {
      expect(/payload|token|secret|cookie/i.test(key)).toBe(false);
    }
  });
});

describe("detectStallSignals", () => {
  it("flags contentBelowTargetButNoJobs when pending=0 and worker healthy", async () => {
    const r = await detectStallSignals({
      contentTypesBelowTarget: ["prayers"],
      pendingCount: 0,
      workerHealthy: true,
      completionsLastHourCount: 0,
      contentGrowthLastHour: 0,
    });
    expect(r.contentBelowTargetButNoJobs).toBe(true);
  });

  it("flags jobsEnqueuedButNotProcessed when pending>0 and no worker", async () => {
    const r = await detectStallSignals({
      contentTypesBelowTarget: ["prayers"],
      pendingCount: 5,
      workerHealthy: false,
      completionsLastHourCount: 0,
      contentGrowthLastHour: 0,
    });
    expect(r.jobsEnqueuedButNotProcessed).toBe(true);
  });

  it("flags jobsCompletedButContentNotGrowing", async () => {
    const r = await detectStallSignals({
      contentTypesBelowTarget: ["prayers"],
      pendingCount: 0,
      workerHealthy: true,
      completionsLastHourCount: 10,
      contentGrowthLastHour: 0,
    });
    expect(r.jobsCompletedButContentNotGrowing).toBe(true);
  });
});

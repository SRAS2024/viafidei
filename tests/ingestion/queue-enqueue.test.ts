import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  enqueueJob,
  retryFailedJob,
  countQueueByStatus,
  failJob,
  PRIORITY_NORMAL,
  PRIORITY_CONTENT_THRESHOLD_UNMET,
} from "@/lib/ingestion/queue/queue";

beforeEach(() => {
  resetPrismaMock();
});

describe("durable queue — enqueueJob", () => {
  it("creates a new pending row when no duplicate exists", async () => {
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobQueue.create.mockResolvedValue({
      id: "q1",
      sourceId: null,
      jobId: null,
      jobName: "test-adapter",
      contentType: "Prayer",
      status: "pending",
      priority: PRIORITY_NORMAL,
      attempts: 0,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: null,
      finishedAt: null,
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: null,
      lastError: null,
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await enqueueJob({
      jobName: "test-adapter",
      contentType: "Prayer",
    });
    expect(result.status).toBe("pending");
    expect(prismaMock.ingestionJobQueue.create).toHaveBeenCalled();
  });

  it("updates the existing row instead of creating a duplicate", async () => {
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue({
      id: "q1",
      jobName: "test-adapter",
      contentType: "Prayer",
      status: "pending",
      priority: 200,
      runAt: new Date(Date.now() + 60_000),
      sourceId: null,
      jobId: null,
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      attempts: 0,
      maxAttempts: 5,
      startedAt: null,
      finishedAt: null,
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: null,
      lastError: null,
      sentToReviewAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.ingestionJobQueue.update.mockImplementation(
      async ({ data }: { data: { priority: number } }) => ({
        id: "q1",
        sourceId: null,
        jobId: null,
        jobName: "test-adapter",
        contentType: "Prayer",
        status: "pending",
        priority: data.priority,
        attempts: 0,
        maxAttempts: 5,
        runAt: new Date(),
        startedAt: null,
        finishedAt: null,
        leaseExpiresAt: null,
        leasedBy: null,
        errorMessage: null,
        lastError: null,
        payload: null,
        triggeredBy: "automatic",
        actorUsername: null,
        sentToReviewAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await enqueueJob({
      jobName: "test-adapter",
      contentType: "Prayer",
      priority: PRIORITY_CONTENT_THRESHOLD_UNMET, // 10 — lower than the existing 200
    });
    expect(prismaMock.ingestionJobQueue.create).not.toHaveBeenCalled();
    expect(prismaMock.ingestionJobQueue.update).toHaveBeenCalled();
    const updateCall = prismaMock.ingestionJobQueue.update.mock.calls[0][0];
    // Priority should be lowered to the new (lower) value.
    expect(updateCall.data.priority).toBe(PRIORITY_CONTENT_THRESHOLD_UNMET);
  });
});

describe("durable queue — failJob retry behavior", () => {
  function failableRow(attempts: number, maxAttempts: number) {
    return {
      id: "q1",
      jobName: "test-adapter",
      contentType: "Prayer",
      status: "running",
      priority: PRIORITY_NORMAL,
      attempts,
      maxAttempts,
      runAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      leasedBy: "worker-1",
      errorMessage: null,
      lastError: null,
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      sourceId: null,
      jobId: null,
      sentToReviewAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  it("schedules a retry with backoff when attempts < maxAttempts", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue(failableRow(1, 5));
    prismaMock.ingestionJobQueue.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...failableRow(1, 5),
        status: data.status as string,
        runAt: data.runAt as Date,
      }),
    );
    const outcome = await failJob("q1", "temporary upstream 503");
    expect(outcome.status).toBe("retrying");
    expect(outcome.nextRunAt).not.toBeNull();
  });

  it("marks failed + sets sentToReviewAt when maxAttempts reached", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue(failableRow(5, 5));
    prismaMock.ingestionJobQueue.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...failableRow(5, 5),
        status: data.status as string,
        sentToReviewAt: (data.sentToReviewAt as Date | null) ?? null,
      }),
    );
    const outcome = await failJob("q1", "permanent 404 after 5 retries");
    expect(outcome.status).toBe("failed");
    // The admin review log row is written via DataManagementLog.createMany.
    expect(prismaMock.dataManagementLog.createMany).toHaveBeenCalled();
  });
});

describe("durable queue — countQueueByStatus", () => {
  it("returns zero counts when no rows match", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
    const counts = await countQueueByStatus();
    expect(counts.pending).toBe(0);
    expect(counts.running).toBe(0);
    expect(counts.failed).toBe(0);
  });

  it("maps groupBy rows to the status union", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 3 } },
      { status: "failed", _count: { _all: 1 } },
    ]);
    const counts = await countQueueByStatus();
    expect(counts.pending).toBe(3);
    expect(counts.failed).toBe(1);
    expect(counts.running).toBe(0);
  });
});

describe("durable queue — retryFailedJob", () => {
  it("returns null for non-failed rows", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      status: "completed",
    });
    const result = await retryFailedJob("q1");
    expect(result).toBeNull();
  });

  it("resets attempts to 0 and status to pending for failed rows", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      jobName: "test-adapter",
      contentType: "Prayer",
      status: "failed",
      priority: PRIORITY_NORMAL,
      attempts: 5,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: null,
      finishedAt: new Date(),
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: "5 attempts exhausted",
      lastError: "503",
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      sourceId: null,
      jobId: null,
      sentToReviewAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.ingestionJobQueue.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "q1",
        jobName: "test-adapter",
        contentType: "Prayer",
        status: data.status as string,
        priority: PRIORITY_NORMAL,
        attempts: data.attempts as number,
        maxAttempts: 5,
        runAt: data.runAt as Date,
        startedAt: null,
        finishedAt: null,
        leaseExpiresAt: null,
        leasedBy: null,
        errorMessage: null,
        lastError: "503",
        payload: null,
        triggeredBy: data.triggeredBy as string,
        actorUsername: data.actorUsername as string | null,
        sourceId: null,
        jobId: null,
        sentToReviewAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const result = await retryFailedJob("q1", "admin");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("pending");
    expect(result?.attempts).toBe(0);
    expect(result?.triggeredBy).toBe("manual");
    expect(result?.actorUsername).toBe("admin");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ username: "admin" }),
}));
vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));
// The admin-gate helper consults these — keep them stubbed so the
// test stays focused on the queue endpoints.
vi.mock("@/lib/security/security-event-store", () => ({
  isDeviceBanned: vi.fn().mockResolvedValue(false),
  recordBannedDeviceHit: vi.fn(),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));

import { POST as retryPost } from "@/app/api/admin/ingestion/queue/retry/route";
import { POST as cancelPost } from "@/app/api/admin/ingestion/queue/cancel/route";
import { POST as sourcePausePost } from "@/app/api/admin/ingestion/sources/pause/route";
import { POST as jobPausePost } from "@/app/api/admin/ingestion/jobs/pause/route";
import { POST as ctPausePost } from "@/app/api/admin/ingestion/content-types/pause/route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://test/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://test",
      "x-forwarded-host": "test",
      "x-forwarded-proto": "http",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetPrismaMock();
});

describe("admin queue API — retry", () => {
  it("re-enqueues a failed row", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      jobName: "test",
      contentType: "Prayer",
      status: "failed",
      priority: 100,
      attempts: 5,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: null,
      finishedAt: new Date(),
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: "503",
      lastError: "503",
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: new Date(),
      sourceId: null,
      jobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.ingestionJobQueue.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "q1",
        jobName: "test",
        contentType: "Prayer",
        status: data.status as string,
        priority: 100,
        attempts: data.attempts as number,
        maxAttempts: 5,
        runAt: new Date(),
        startedAt: null,
        finishedAt: null,
        leaseExpiresAt: null,
        leasedBy: null,
        errorMessage: null,
        lastError: null,
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
    const res = await retryPost(makeReq({ jobQueueId: "q1" }));
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown row", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue(null);
    const res = await retryPost(makeReq({ jobQueueId: "missing" }));
    expect(res.status).toBe(404);
  });
});

describe("admin queue API — cancel", () => {
  it("cancels a pending row", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      status: "pending",
    });
    prismaMock.ingestionJobQueue.update.mockResolvedValue({});
    const res = await cancelPost(makeReq({ jobQueueId: "q1", reason: "test" }));
    expect(res.status).toBe(200);
  });

  it("refuses to cancel a completed row", async () => {
    prismaMock.ingestionJobQueue.findUnique.mockResolvedValue({
      id: "q1",
      status: "completed",
    });
    const res = await cancelPost(makeReq({ jobQueueId: "q1", reason: "test" }));
    expect(res.status).toBe(404);
  });
});

describe("admin source pause API", () => {
  it("pause sets pausedAt", async () => {
    prismaMock.ingestionSource.update.mockResolvedValue({});
    const res = await sourcePausePost(
      makeReq({ sourceId: "src1", action: "pause", reason: "test" }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.ingestionSource.update).toHaveBeenCalled();
  });

  it("resume clears pausedAt", async () => {
    prismaMock.ingestionSource.update.mockResolvedValue({});
    const res = await sourcePausePost(makeReq({ sourceId: "src1", action: "resume" }));
    expect(res.status).toBe(200);
    const updateCall = prismaMock.ingestionSource.update.mock.calls.at(-1)![0];
    expect(updateCall.data.pausedAt).toBeNull();
  });
});

describe("admin job pause API", () => {
  it("pause sets pausedAt on IngestionJob", async () => {
    prismaMock.ingestionJob.update.mockResolvedValue({});
    const res = await jobPausePost(makeReq({ jobId: "job1", action: "pause", reason: "test" }));
    expect(res.status).toBe(200);
    expect(prismaMock.ingestionJob.update).toHaveBeenCalled();
  });

  it("resume clears pausedAt on IngestionJob", async () => {
    prismaMock.ingestionJob.update.mockResolvedValue({});
    const res = await jobPausePost(makeReq({ jobId: "job1", action: "resume" }));
    expect(res.status).toBe(200);
    const updateCall = prismaMock.ingestionJob.update.mock.calls.at(-1)![0];
    expect(updateCall.data.pausedAt).toBeNull();
  });
});

describe("admin content-type pause API", () => {
  it("pause upserts the row", async () => {
    prismaMock.contentTypePause.upsert.mockResolvedValue({});
    const res = await ctPausePost(
      makeReq({ contentType: "Saint", action: "pause", reason: "test" }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.contentTypePause.upsert).toHaveBeenCalled();
  });

  it("resume deletes the row", async () => {
    prismaMock.contentTypePause.deleteMany.mockResolvedValue({ count: 1 });
    const res = await ctPausePost(makeReq({ contentType: "Saint", action: "resume" }));
    expect(res.status).toBe(200);
  });

  it("rejects invalid content type", async () => {
    const res = await ctPausePost(makeReq({ contentType: "NotAType", action: "pause" }));
    expect(res.status).toBe(400);
  });
});

describe("admin auth gate", () => {
  it("returns 401 when admin session is missing", async () => {
    const { requireAdmin } = await import("@/lib/auth");
    vi.mocked(requireAdmin).mockResolvedValueOnce(null);
    const res = await retryPost(makeReq({ jobQueueId: "q1" }));
    expect(res.status).toBe(401);
  });
});

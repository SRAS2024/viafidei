/**
 * Migration-script idempotency. The script calls
 * `enqueueDueIngestionJobs()`; the planner's dedupe key ensures a
 * second run with the same active queue rows enqueues nothing new.
 *
 * This exercises the planner directly (which is what the script
 * does) with a stable set of inputs so we can assert that the
 * second run produces 0 new enqueues.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({
  readAdminEmail: vi.fn().mockReturnValue(null),
  sendCriticalFailureAlert: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  sendBiweeklyAdminReport: vi.fn(),
  sendMonthlyArchiveCleanupReport: vi.fn(),
  sendMonthlyErrorReport: vi.fn(),
  sendMonthlySourceQualityReport: vi.fn(),
  sendThresholdMilestoneAlert: vi.fn(),
  sendSecurityBreachAlert: vi.fn(),
  buildTextPdfBase64: vi.fn().mockReturnValue(""),
  CONTENT_TYPE_ROWS: [],
}));

import { enqueueDueIngestionJobs } from "@/lib/ingestion/queue/planner";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.contentTypePause.findMany.mockResolvedValue([]);
});

const fakeJob = {
  id: "job1",
  jobName: "test-adapter",
  sourceId: "src1",
  targetEntity: "Prayer",
  isActive: true,
  pausedAt: null,
  pausedReason: null,
  batchSizeLimit: null,
  schedule: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  source: {
    id: "src1",
    name: "Vatican",
    host: "vatican.va",
    tier: 1,
    pausedAt: null,
    pausedReason: null,
    healthState: "active",
    exhaustedAt: null,
  },
};

describe("migration script idempotency", () => {
  it("a second planner run with the same active rows enqueues nothing new", async () => {
    prismaMock.prayer.count.mockResolvedValue(0);
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);
    prismaMock.ingestionJob.findMany.mockResolvedValue([fakeJob]);
    prismaMock.dailyIngestionCounter.findUnique.mockResolvedValue(null);
    prismaMock.dailyIngestionCounter.upsert.mockResolvedValue({});

    // First run — no active rows yet. Planner enqueues 1.
    prismaMock.ingestionJobQueue.findMany.mockResolvedValueOnce([]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValueOnce(null);
    prismaMock.ingestionJobQueue.create.mockResolvedValue({
      id: "q1",
      sourceId: "src1",
      jobId: "job1",
      jobName: "test-adapter",
      jobKind: "source_discovery",
      dedupeKey: "ingest|job1|src1|test-adapter|Prayer|constant",
      contentType: "Prayer",
      status: "pending",
      priority: 10,
      attempts: 0,
      maxAttempts: 5,
      runAt: new Date(),
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      leaseExpiresAt: null,
      leasedBy: null,
      errorMessage: null,
      lastError: null,
      payload: null,
      triggeredBy: "automatic",
      actorUsername: null,
      sentToReviewAt: null,
      cancelRequestedAt: null,
      cancelReason: null,
      canceledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const first = await enqueueDueIngestionJobs();
    expect(first.jobsEnqueued).toBe(1);

    // Second run — the row already exists with the stable dedupe key.
    // Planner finds it via findMany and reports skipped.
    prismaMock.ingestionJobQueue.findMany.mockResolvedValueOnce([
      {
        jobName: "test-adapter",
        dedupeKey: "ingest|job1|src1|test-adapter|Prayer|constant",
        contentType: "Prayer",
        sourceId: "src1",
      },
    ]);
    const second = await enqueueDueIngestionJobs();
    expect(second.jobsEnqueued).toBe(0);
    expect(second.jobsSkippedAlreadyQueued).toBe(1);
  });
});

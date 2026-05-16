import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({
  readAdminEmail: vi.fn().mockReturnValue(null),
  sendCriticalFailureAlert: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  sendBiweeklyAdminReport: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  sendMonthlyArchiveCleanupReport: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  sendMonthlyErrorReport: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  sendMonthlySourceQualityReport: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  sendThresholdMilestoneAlert: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  sendSecurityBreachAlert: vi.fn().mockResolvedValue({ ok: true, delivery: "skipped" }),
  buildTextPdfBase64: vi.fn().mockReturnValue(""),
  CONTENT_TYPE_ROWS: [],
}));

import { enqueueDueIngestionJobs } from "@/lib/ingestion/queue/planner";
import { appConfig } from "@/lib/config";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.contentTypePause.findMany.mockResolvedValue([]);
});

function fakeJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...overrides,
  };
}

describe("planner — threshold-unmet promotes priority", () => {
  it("enqueues at PRIORITY_CONTENT_THRESHOLD_UNMET for tier 1 source below target", async () => {
    prismaMock.prayer.count.mockResolvedValue(0);
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prismaMock.ingestionJob.findMany.mockResolvedValue([fakeJob()]);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.dailyIngestionCounter.findUnique.mockResolvedValue(null);
    prismaMock.dailyIngestionCounter.upsert.mockResolvedValue({});
    prismaMock.ingestionJobQueue.create.mockResolvedValue({
      id: "q1",
      sourceId: "src1",
      jobId: "job1",
      jobName: "test-adapter",
      jobKind: "source_ingest",
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

    const summary = await enqueueDueIngestionJobs();
    expect(summary.dbError).toBe(false);
    expect(summary.mode).toBe("constant");
    expect(summary.jobsEnqueued).toBe(1);
    expect(summary.promotedToConstant).toBe(1);
  });
});

describe("planner — DB error stays in constant mode", () => {
  it("never assigns maintenance priority when threshold counts fail", async () => {
    prismaMock.prayer.count.mockRejectedValue(new Error("connection refused"));
    prismaMock.ingestionJob.findMany.mockResolvedValue([fakeJob()]);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.dailyIngestionCounter.findUnique.mockResolvedValue(null);
    prismaMock.dailyIngestionCounter.upsert.mockResolvedValue({});
    prismaMock.ingestionJobQueue.create.mockResolvedValue({
      id: "q1",
      sourceId: "src1",
      jobId: "job1",
      jobName: "test-adapter",
      jobKind: "source_ingest",
      dedupeKey: "x",
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
    const summary = await enqueueDueIngestionJobs();
    expect(summary.dbError).toBe(true);
    expect(summary.mode).toBe("constant");
    expect(summary.assignedToMaintenance).toBe(0);
  });
});

describe("planner — fill cap, source pause, content-type pause", () => {
  it("skips paused source", async () => {
    prismaMock.prayer.count.mockResolvedValue(appConfig.ingestion.targets.prayers);
    prismaMock.saint.count.mockResolvedValue(appConfig.ingestion.targets.saints);
    prismaMock.parish.count.mockResolvedValue(appConfig.ingestion.targets.parishes);
    prismaMock.liturgyEntry.count.mockResolvedValue(appConfig.ingestion.targets.churchDocuments);
    prismaMock.spiritualLifeGuide.count
      .mockResolvedValueOnce(appConfig.ingestion.targets.sacraments)
      .mockResolvedValueOnce(appConfig.ingestion.targets.consecrations);
    prismaMock.ingestionJob.findMany.mockResolvedValue([
      fakeJob({ source: { ...fakeJob().source, pausedAt: new Date() } }),
    ]);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    const summary = await enqueueDueIngestionJobs();
    expect(summary.jobsSkippedSourcePaused).toBe(1);
    expect(summary.jobsEnqueued).toBe(0);
  });

  it("respects fill cap", async () => {
    prismaMock.prayer.count.mockResolvedValue(0);
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prismaMock.ingestionJob.findMany.mockResolvedValue([
      fakeJob({ id: "j1" }),
      fakeJob({ id: "j2" }),
      fakeJob({ id: "j3" }),
    ]);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.dailyIngestionCounter.findUnique.mockResolvedValue(null);
    prismaMock.dailyIngestionCounter.upsert.mockResolvedValue({});
    prismaMock.ingestionJobQueue.create.mockResolvedValue({
      id: "q",
      sourceId: "src1",
      jobId: "job1",
      jobName: "test-adapter",
      jobKind: "source_ingest",
      dedupeKey: "x",
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
    const summary = await enqueueDueIngestionJobs({ fillCap: 2 });
    expect(summary.jobsEnqueued).toBe(2);
    expect(summary.jobsSkippedFillCap).toBeGreaterThanOrEqual(1);
  });
});

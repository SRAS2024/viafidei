/**
 * Tests that the planner demotes priority based on source health
 * — blocked sources are skipped entirely, failing/low_quality/stale
 * sources get a priority penalty even if their tier would normally
 * give them a high score.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({
  readAdminEmail: vi.fn().mockReturnValue(null),
  sendCriticalFailureAlert: vi.fn(),
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

function jobRow(
  overrides: Record<string, unknown> = {},
  sourceOverrides: Record<string, unknown> = {},
) {
  return {
    id: (overrides.id as string) ?? "job1",
    jobName: (overrides.jobName as string) ?? "test-adapter",
    sourceId: (overrides.sourceId as string) ?? "src1",
    targetEntity: (overrides.targetEntity as string) ?? "Prayer",
    isActive: true,
    pausedAt: null,
    pausedReason: null,
    batchSizeLimit: null,
    schedule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: {
      id: (sourceOverrides.id as string) ?? "src1",
      name: "Test source",
      host: "test.example.com",
      tier: 1,
      pausedAt: null,
      pausedReason: null,
      healthState: "active",
      exhaustedAt: null,
      ...sourceOverrides,
    },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  prismaMock.contentTypePause.findMany.mockResolvedValue([]);
  // Below-target content so the planner promotes priority.
  prismaMock.prayer.count.mockResolvedValue(0);
  prismaMock.saint.count.mockResolvedValue(0);
  prismaMock.parish.count.mockResolvedValue(0);
  prismaMock.liturgyEntry.count.mockResolvedValue(0);
  prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);
  prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.dailyIngestionCounter.findUnique.mockResolvedValue(null);
  prismaMock.dailyIngestionCounter.upsert.mockResolvedValue({});
});

describe("planner source-health priority demotion", () => {
  it("skips blocked sources entirely", async () => {
    prismaMock.ingestionJob.findMany.mockResolvedValue([jobRow({}, { healthState: "blocked" })]);
    const summary = await enqueueDueIngestionJobs();
    expect(summary.jobsSkippedSourceUnhealthy).toBe(1);
    expect(summary.jobsEnqueued).toBe(0);
  });

  it("skips exhausted sources", async () => {
    prismaMock.ingestionJob.findMany.mockResolvedValue([jobRow({}, { exhaustedAt: new Date() })]);
    const summary = await enqueueDueIngestionJobs();
    expect(summary.jobsSkippedSourceExhausted).toBe(1);
    expect(summary.jobsEnqueued).toBe(0);
  });

  it("demotes failing tier-1 sources below normal priority", async () => {
    prismaMock.ingestionJob.findMany.mockResolvedValue([jobRow({}, { healthState: "failing" })]);
    let createdPriority: number | undefined;
    prismaMock.ingestionJobQueue.create.mockImplementation(
      async ({ data }: { data: { priority: number } }) => {
        createdPriority = data.priority;
        return {
          id: "q1",
          sourceId: "src1",
          jobId: "job1",
          jobName: "test-adapter",
          jobKind: "source_ingest",
          dedupeKey: "x",
          contentType: "Prayer",
          status: "pending",
          priority: data.priority,
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
        };
      },
    );
    const summary = await enqueueDueIngestionJobs();
    expect(summary.jobsEnqueued).toBe(1);
    // Failing source demotion is +100. Tier-1 below-target base is
    // PRIORITY_CONTENT_THRESHOLD_UNMET (10). Expected priority = 110.
    expect(createdPriority).toBe(110);
  });
});

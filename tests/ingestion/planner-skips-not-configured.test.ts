/**
 * Spec #2 / #26.3: every active source either has a valid discovery
 * method or is marked `not_configured`. The planner must skip
 * `not_configured` sources — they cannot enqueue jobs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { enqueueDueIngestionJobs } from "@/lib/ingestion/queue/planner";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.contentTypePause.findMany.mockResolvedValue([]);
  prismaMock.contentTypeBudget?.findFirst?.mockResolvedValue?.(null);
});

function makeJob(overrides: { configurationStatus: string | null }) {
  return {
    id: "job-1",
    sourceId: "src-1",
    jobName: "vatican.prayers",
    targetEntity: "Prayer",
    schedule: null,
    isActive: true,
    pausedAt: null,
    pausedReason: null,
    batchSizeLimit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: {
      id: "src-1",
      host: "vatican.va",
      name: "Vatican",
      tier: 1,
      pausedAt: null,
      exhaustedAt: null,
      healthState: "healthy",
      discoveryFeedUrl: null,
      discoveryMethod:
        overrides.configurationStatus === "not_configured" ? "not_configured" : "sitemap",
      configurationStatus: overrides.configurationStatus,
      isActive: true,
    },
  };
}

describe("planner skips not_configured sources", () => {
  it("does NOT enqueue jobs whose source is configurationStatus='not_configured'", async () => {
    prismaMock.ingestionJob.findMany.mockResolvedValue([
      makeJob({ configurationStatus: "not_configured" }),
    ]);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    let enqueueCalls = 0;
    prismaMock.ingestionJobQueue.create.mockImplementation(async () => {
      enqueueCalls += 1;
      return {};
    });

    const summary = await enqueueDueIngestionJobs();

    expect(summary.jobsSkippedSourceNotConfigured).toBe(1);
    expect(summary.jobsEnqueued).toBe(0);
    expect(enqueueCalls).toBe(0);
  });

  it("DOES enqueue jobs whose source is configurationStatus='factory_native'", async () => {
    prismaMock.ingestionJob.findMany.mockResolvedValue([
      makeJob({ configurationStatus: "factory_native" }),
    ]);
    prismaMock.ingestionJobQueue.findMany.mockResolvedValue([]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.sourceQualityScore.findUnique.mockResolvedValue(null);
    let enqueueCalls = 0;
    prismaMock.ingestionJobQueue.create.mockImplementation(async () => {
      enqueueCalls += 1;
      return {};
    });
    prismaMock.queueAuditLog.create.mockResolvedValue({});

    const summary = await enqueueDueIngestionJobs();

    expect(summary.jobsSkippedSourceNotConfigured).toBe(0);
    expect(enqueueCalls).toBeGreaterThan(0);
  });
});

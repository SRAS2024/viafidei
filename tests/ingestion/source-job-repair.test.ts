/**
 * Source job repair.
 *
 * Pins section 11: factory-ready sources with zero active queue jobs
 * get a missing `source_discovery` job; sources that already have an
 * active job are skipped (no duplicates); paused / not_configured
 * sources are respected.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/queue", () => ({
  enqueueJob: vi.fn(),
}));

import { runSourceJobRepair, getSourceJobCoverage } from "@/lib/ingestion/queue/source-job-repair";
import { enqueueJob } from "@/lib/ingestion/queue/queue";

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    host: "a.example.org",
    pausedAt: null,
    configurationStatus: "factory_native",
    discoveryFeedUrl: "https://a.example.org/sitemap.xml",
    dailyCap: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  vi.mocked(enqueueJob).mockReset();
});

describe("runSourceJobRepair", () => {
  it("creates a missing source_discovery job for a factory-ready source with zero jobs", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([source()]);
    prismaMock.ingestionJobQueue.count.mockResolvedValue(0);

    const report = await runSourceJobRepair();

    expect(report.factoryReadySources).toBe(1);
    expect(report.sourcesWithZeroJobs).toBe(1);
    expect(report.discoveryJobsCreated).toBe(1);
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobKind: "source_discovery", sourceId: "s1" }),
    );
  });

  it("avoids duplicates — skips a source that already has an active job", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([source()]);
    prismaMock.ingestionJobQueue.count.mockResolvedValue(1);

    const report = await runSourceJobRepair();

    expect(report.sourcesWithActiveJobs).toBe(1);
    expect(report.discoveryJobsCreated).toBe(0);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("respects paused and not_configured sources", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      source({ id: "paused", host: "p.org", pausedAt: new Date() }),
      source({
        id: "nc",
        host: "n.org",
        configurationStatus: "not_configured",
        discoveryFeedUrl: null,
      }),
    ]);
    prismaMock.ingestionJobQueue.count.mockResolvedValue(0);

    const report = await runSourceJobRepair();

    expect(report.skippedPaused).toBe(1);
    expect(report.skippedNotConfigured).toBe(1);
    expect(report.discoveryJobsCreated).toBe(0);
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});

describe("getSourceJobCoverage", () => {
  it("reports the fraction of factory-ready sources with zero active jobs", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
      { id: "s4" },
    ]);
    // Only s1 has an active job.
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([{ sourceId: "s1" }]);

    const coverage = await getSourceJobCoverage();

    expect(coverage.factoryReadySources).toBe(4);
    expect(coverage.sourcesWithZeroJobs).toBe(3);
    expect(coverage.zeroJobRatio).toBeCloseTo(0.75);
  });
});

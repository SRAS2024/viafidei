/**
 * Regression: every admin metric carries a data-source badge and
 * a last-updated timestamp.
 *
 * The spec is explicit: "Add a data source badge to every admin
 * metric. Add last updated timestamps to every admin metric."
 *
 * The audit drives each canonical helper and asserts every produced
 * row exposes a `dataSource` (or `dataSources`) field and a
 * `lastUpdatedAt` / `generatedAt` / equivalent timestamp.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/heartbeat", () => ({
  hasHealthyWorker: vi.fn().mockResolvedValue(true),
  listWorkerHealth: vi.fn().mockResolvedValue([
    {
      workerId: "worker-test",
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
      ageMs: 1_000,
      isStale: false,
      status: "idle",
      processedCount: 0,
      failedCount: 0,
      retryCount: 0,
      currentJobId: null,
      hostname: "test-host",
      version: null,
      processType: "worker",
    },
  ]),
}));

beforeEach(() => {
  resetPrismaMock();
  prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  prismaMock.ingestionJobQueue.count.mockResolvedValue(0);
  prismaMock.contentPackageBuildLog.count.mockResolvedValue(0);
  prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);
  prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
  prismaMock.sourceDocument.findMany.mockResolvedValue([]);
  prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
  prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
  prismaMock.securityEvent.findFirst.mockResolvedValue(null);
  prismaMock.ingestionSource.count.mockResolvedValue(0);
  prismaMock.prayer.count.mockResolvedValue(0);
  prismaMock.prayer.findMany.mockResolvedValue([]);
  prismaMock.saint.count.mockResolvedValue(0);
  prismaMock.saint.findMany.mockResolvedValue([]);
});

describe("data source badges and last-updated timestamps", () => {
  it("production readiness cards carry dataSource and lastUpdatedAt", async () => {
    const { getProductionReadinessReport } = await import("@/lib/diagnostics/production-readiness");
    const report = await getProductionReadinessReport();
    expect(report.generatedAt).toBeInstanceOf(Date);
    for (const card of report.cards) {
      expect(typeof card.dataSource).toBe("string");
      expect(card.dataSource.length).toBeGreaterThan(0);
      expect(card.lastUpdatedAt).toBeInstanceOf(Date);
    }
  });

  it("content growth rows carry dataSources and lastUpdatedAt", async () => {
    const { getContentGrowthRowForType } = await import("@/lib/data/content-growth-dashboard");
    const row = await getContentGrowthRowForType("Prayer");
    expect(Array.isArray(row.dataSources)).toBe(true);
    expect(row.dataSources.length).toBeGreaterThan(0);
    expect(row.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it("pipeline-broken-here report carries generatedAt + per-entry threshold", async () => {
    const { getPipelineBrokenHereReport } = await import("@/lib/diagnostics/pipeline-broken-here");
    const report = await getPipelineBrokenHereReport();
    expect(report.generatedAt).toBeInstanceOf(Date);
    for (const entry of report.entries) {
      expect(typeof entry.thresholdMs).toBe("number");
      expect(typeof entry.automaticNextAction).toBe("string");
    }
  });
});

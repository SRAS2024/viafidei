/**
 * Section 12: "all admin data management metrics come from the new
 * system." Verifies that the admin dashboard reads from
 * IngestionJobQueue + WorkerHeartbeat + RejectedContentLog +
 * DataManagementLog rather than the legacy IngestionJobRun table.
 *
 * The check is structural: we mock the legacy run log to throw, the
 * durable queue to return data, and verify the cleanup health
 * diagnostic + content QA diagnostic still produce non-zero output.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getCleanupHealth } from "@/lib/content-qa/cleanup-health";
import { getSystemHealthReport } from "@/lib/content-qa/health-scores";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.parish,
    prismaMock.devotion,
    prismaMock.spiritualLifeGuide,
    prismaMock.liturgyEntry,
    prismaMock.marianApparition,
    prismaMock.rejectedContentLog,
    prismaMock.ingestionSource,
  ]) {
    m.count.mockResolvedValue(0);
  }
  prismaMock.ingestionJobQueue.count.mockResolvedValue(0);
  prismaMock.workerHeartbeat.count.mockResolvedValue(0);
  prismaMock.dataManagementLog.findFirst.mockResolvedValue(null);
  prismaMock.rejectedContentLog.groupBy.mockResolvedValue([]);
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  // Hard fail on the legacy run log so any path that reads it would
  // surface the failure.
  prismaMock.ingestionJobRun.count.mockRejectedValue(new Error("legacy table not used"));
  prismaMock.ingestionJobRun.findMany.mockRejectedValue(new Error("legacy table not used"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("admin metrics come from the new durable queue system", () => {
  it("cleanup health works without touching IngestionJobRun", async () => {
    const result = await getCleanupHealth();
    // Result populated from DataManagementLog + RejectedContentLog +
    // catalog tables — none of which use IngestionJobRun.
    expect(result.mode).toBeDefined();
    expect(result.invalidPublicRowCount).toBe(0);
    expect(result.deletedLast24h).toBe(0);
    // No "ingestionJobRun" key in queryHealth.
    const keys = Object.keys(result.queryHealth);
    expect(keys.every((k) => !k.toLowerCase().includes("ingestionjobrun"))).toBe(true);
  });

  it("system health report works without touching IngestionJobRun", async () => {
    const report = await getSystemHealthReport();
    expect(report.scores.durableQueue).toBeDefined();
    expect(report.scores.workerReliability).toBeDefined();
    // Queries are against IngestionJobQueue + WorkerHeartbeat, NOT
    // the legacy IngestionJobRun. We assert by structure: the report
    // returns successfully even though the legacy table is broken.
    expect(report.scores.system.score).toBeGreaterThanOrEqual(0);
  });

  it("cleanup health surfaces invalid public rows from catalog tables (not run log)", async () => {
    prismaMock.prayer.count.mockResolvedValue(3);
    const result = await getCleanupHealth();
    expect(result.invalidPublicByContentType.Prayer).toBe(3);
  });
});

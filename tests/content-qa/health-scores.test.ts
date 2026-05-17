/**
 * System health scores. Verifies each component score reacts to its
 * underlying signals and that a failing input produces a non-healthy
 * score without throwing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getSystemHealthReport } from "@/lib/content-qa/health-scores";

beforeEach(() => {
  resetPrismaMock();
  // Default: healthy catalog with no pending work.
  prismaMock.ingestionJobQueue.count.mockResolvedValue(0);
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.workerHeartbeat.count.mockImplementation(
    async ({ where }: { where: { lastHeartbeatAt?: { gte?: Date; lt?: Date } } }) => {
      if (where?.lastHeartbeatAt?.gte) return 1;
      return 0;
    },
  );
  prismaMock.ingestionSource.count.mockResolvedValue(0);
  prismaMock.prayer.count.mockResolvedValue(0);
  prismaMock.saint.count.mockResolvedValue(0);
  prismaMock.parish.count.mockResolvedValue(0);
  prismaMock.marianApparition.count.mockResolvedValue(0);
  prismaMock.devotion.count.mockResolvedValue(0);
  prismaMock.liturgyEntry.count.mockResolvedValue(0);
  prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);
  prismaMock.dataManagementLog.findFirst.mockResolvedValue({
    createdAt: new Date(),
  });
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getSystemHealthReport", () => {
  it("returns a healthy contentQA score when all signals are clean", async () => {
    const report = await getSystemHealthReport();
    expect(report.scores.contentQA.score).toBeGreaterThanOrEqual(70);
  });

  it("flags workerReliability as fail when pending jobs but no active workers", async () => {
    prismaMock.ingestionJobQueue.count.mockResolvedValue(5);
    prismaMock.workerHeartbeat.count.mockResolvedValue(0);
    const report = await getSystemHealthReport();
    expect(report.scores.workerReliability.status).toBe("fail");
    expect(report.scores.workerReliability.score).toBe(0);
  });

  it("flags contentQA as stale when no CLEANUP DataManagementLog row exists", async () => {
    prismaMock.dataManagementLog.findFirst.mockResolvedValue(null);
    const report = await getSystemHealthReport();
    // Stale flag drops the score by 30 points from a baseline of 100.
    expect(report.scores.contentQA.score).toBeLessThanOrEqual(70);
  });

  it("flags publicRendering when invalid public rows exist", async () => {
    prismaMock.prayer.count.mockResolvedValue(10);
    const report = await getSystemHealthReport();
    expect(report.scores.publicRendering.score).toBeLessThan(100);
    expect(report.scores.publicRendering.signals.Prayer).toBe(10);
  });

  it("reports the worst-component score as the system score", async () => {
    prismaMock.ingestionJobQueue.count.mockResolvedValue(5);
    prismaMock.workerHeartbeat.count.mockResolvedValue(0);
    const report = await getSystemHealthReport();
    expect(report.scores.system.score).toBe(0);
    expect(report.scores.system.signals.worstComponent).toBe("Worker reliability");
  });

  it("never throws even when every query fails — sets hasQueryFailures=true", async () => {
    prismaMock.ingestionJobQueue.count.mockRejectedValue(new Error("db down"));
    prismaMock.workerHeartbeat.count.mockRejectedValue(new Error("db down"));
    prismaMock.ingestionSource.count.mockRejectedValue(new Error("db down"));
    prismaMock.prayer.count.mockRejectedValue(new Error("db down"));
    prismaMock.dataManagementLog.findFirst.mockRejectedValue(new Error("db down"));
    const report = await getSystemHealthReport();
    expect(report.scores.system.hasQueryFailures).toBe(true);
  });

  it("includes every required score key", async () => {
    const report = await getSystemHealthReport();
    expect(report.scores.system).toBeDefined();
    expect(report.scores.contentQA).toBeDefined();
    expect(report.scores.durableQueue).toBeDefined();
    expect(report.scores.sourceQuality).toBeDefined();
    expect(report.scores.workerReliability).toBeDefined();
    expect(report.scores.thresholdGrowth).toBeDefined();
    expect(report.scores.publicRendering).toBeDefined();
  });
});

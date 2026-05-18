/**
 * Growth intelligence stall-detection tests. The runGrowthIntelligence
 * function periodically scans recent queue / build / QA / public-count
 * signals and either (a) auto-remediates or (b) raises an admin alert.
 *
 * Each test sets up exactly one stall signal and asserts that
 * runGrowthIntelligence flags it. The spec calls out seven detectors
 * — these tests cover the ones the function implements today.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
const reportCriticalFailureMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/data/admin-notifications", () => ({
  reportCriticalFailure: (...args: unknown[]) => reportCriticalFailureMock(...args),
}));
const enqueueJobMock = vi.fn().mockResolvedValue({ id: "q-stall" });
vi.mock("@/lib/ingestion/queue", () => ({
  enqueueJob: (...args: unknown[]) => enqueueJobMock(...args),
}));

import { runGrowthIntelligence } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
  reportCriticalFailureMock.mockClear();
  enqueueJobMock.mockClear();
  // Default: no stalls — every count is zero.
  prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
  prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
  prismaMock.sourceQualityScore.findMany.mockResolvedValue([]);
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.parish,
    prismaMock.devotion,
    prismaMock.liturgyEntry,
    prismaMock.spiritualLifeGuide,
  ]) {
    m.count.mockResolvedValue(0);
  }
});

describe("growth intelligence — stall detectors", () => {
  it("detects 'running-no-builds' when jobs are running but no builds happen", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([
      { status: "running", _count: { _all: 8 } },
    ]);
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);
    const report = await runGrowthIntelligence();
    expect(report.signalsDetected).toContain("running-no-builds");
    expect(report.remediationsApplied).toContain("re-enqueued content_revalidate sweep");
    expect(enqueueJobMock).toHaveBeenCalled();
  });

  it("detects 'qa-rejection-spike' when QA failures exceed half of successful builds", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([
      { buildStatus: "built_complete_package", _count: { _all: 10 } },
    ]);
    prismaMock.rejectedContentLog.count.mockResolvedValue(20); // 200% of builds
    const report = await runGrowthIntelligence();
    expect(report.signalsDetected).toContain("qa-rejection-spike");
    expect(report.adminAlertsFired).toContain("qa-rejection-spike");
    expect(reportCriticalFailureMock).toHaveBeenCalledTimes(1);
  });

  it("detects 'duplicate-heavy' sources and demotes them", async () => {
    prismaMock.sourceQualityScore.findMany.mockImplementation(
      async ({ where }: { where?: { duplicateCount?: unknown; fetchedCount?: unknown } }) => {
        // Only respond to the dup query, not the exhausted query.
        if (where && where.duplicateCount) {
          return [
            {
              sourceId: "src-dups",
              contentType: "Prayer",
              buildSuccessCount: 10,
              buildFailureCount: 50,
              duplicateCount: 50, // 50/(60) = 83% > 70% threshold
              wrongContentCount: 0,
              qaPassCount: 0,
              qaFailCount: 0,
              fetchedCount: 60,
            },
          ];
        }
        return [];
      },
    );
    let updatedTier: number | undefined;
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: { tier?: number; exhaustedAt?: Date } }) => {
        if (data.tier !== undefined) updatedTier = data.tier;
        return {};
      },
    );

    const report = await runGrowthIntelligence();
    expect(report.signalsDetected).toContainEqual(expect.stringMatching(/^duplicate-heavy:/));
    expect(updatedTier).toBe(3);
  });

  it("detects 'possibly-exhausted' sources (heavy fetch, near-zero builds)", async () => {
    prismaMock.sourceQualityScore.findMany.mockImplementation(
      async ({ where }: { where?: { fetchedCount?: unknown } }) => {
        if (where && where.fetchedCount) {
          return [
            {
              sourceId: "src-exhausted",
              contentType: "Prayer",
              buildSuccessCount: 1,
              buildFailureCount: 10,
              duplicateCount: 0,
              wrongContentCount: 0,
              qaPassCount: 0,
              qaFailCount: 0,
              fetchedCount: 500,
            },
          ];
        }
        return [];
      },
    );
    let exhaustedAt: Date | undefined;
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: { exhaustedAt?: Date } }) => {
        if (data.exhaustedAt) exhaustedAt = data.exhaustedAt;
        return {};
      },
    );

    const report = await runGrowthIntelligence();
    expect(report.signalsDetected).toContainEqual(expect.stringMatching(/^possibly-exhausted:/));
    expect(exhaustedAt).toBeInstanceOf(Date);
  });

  it("reports 'public-grew' when current public count exceeds the historical count by >5", async () => {
    // First-pass count (current): 50 per content type → 350 total.
    let firstCall = true;
    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockImplementation(async () => {
        const v = firstCall ? 50 : 0;
        return v;
      });
    }
    // The growth-intel function calls count() twice (current vs prior).
    // We flip firstCall after the first batch of 7 calls.
    let totalCalls = 0;
    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockImplementation(async () => {
        totalCalls += 1;
        if (totalCalls <= 7) return 50; // current count
        return 0; // prior count
      });
    }
    const report = await runGrowthIntelligence();
    expect(report.signalsDetected).toContain("public-grew");
  });

  it("returns an empty signal set when the system is healthy", async () => {
    // All defaults from beforeEach: no jobs, no builds, no rejections.
    const report = await runGrowthIntelligence();
    expect(report.signalsDetected).toEqual([]);
    expect(report.remediationsApplied).toEqual([]);
    expect(report.adminAlertsFired).toEqual([]);
  });
});

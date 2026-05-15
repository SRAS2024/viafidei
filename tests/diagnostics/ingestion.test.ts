import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/site-settings", () => ({
  getDataManagementSettings: vi.fn(),
}));

import { loadIngestionLiveSnapshot, runIngestionDiagnostics } from "@/lib/diagnostics/ingestion";
import { getDataManagementSettings } from "@/lib/data/site-settings";

const settingsMock = vi.mocked(getDataManagementSettings);

beforeEach(() => {
  resetPrismaMock();
  settingsMock.mockReset();
  settingsMock.mockResolvedValue({ autoCleanupEnabled: true, hardDeleteAfterDays: 30 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadIngestionLiveSnapshot", () => {
  it("reports status=blocked when auto-cleanup is on but no runs exist", async () => {
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.count.mockResolvedValue(0);
    const snap = await loadIngestionLiveSnapshot();
    expect(snap.status).toBe("blocked");
    expect(snap.totalRuns24h).toBe(0);
    expect(snap.failedRuns24h).toBe(0);
    expect(snap.lastRun).toBeNull();
  });

  it("reports status=disabled when auto-cleanup is off", async () => {
    settingsMock.mockResolvedValue({ autoCleanupEnabled: false, hardDeleteAfterDays: 30 });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.count.mockResolvedValue(0);
    const snap = await loadIngestionLiveSnapshot();
    expect(snap.status).toBe("disabled");
  });

  it("reports status=failing when the most recent run failed", async () => {
    prismaMock.ingestionJobRun.findFirst
      .mockResolvedValueOnce({
        id: "run-1",
        status: "FAILED",
        startedAt: new Date(),
        finishedAt: null,
        recordsSeen: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 1,
        recordsReviewRequired: 0,
        errorMessage: "upstream 503",
        job: { jobName: "vatican.encyclicals", source: { name: "Vatican" } },
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "run-1", startedAt: new Date() });
    prismaMock.ingestionJobRun.count
      .mockResolvedValueOnce(3) // totalRuns24h
      .mockResolvedValueOnce(1); // failedRuns24h

    const snap = await loadIngestionLiveSnapshot();
    expect(snap.status).toBe("failing");
    expect(snap.lastRun?.errorMessage).toBe("upstream 503");
  });

  it("reports status=active when the most recent run succeeded with healthy 24h totals", async () => {
    const recent = new Date();
    prismaMock.ingestionJobRun.findFirst
      .mockResolvedValueOnce({
        id: "run-2",
        status: "SUCCESS",
        startedAt: recent,
        finishedAt: new Date(recent.getTime() + 5000),
        recordsSeen: 10,
        recordsCreated: 5,
        recordsUpdated: 0,
        recordsSkipped: 5,
        recordsFailed: 0,
        recordsReviewRequired: 0,
        errorMessage: null,
        job: { jobName: "vatican.encyclicals", source: { name: "Vatican" } },
      })
      .mockResolvedValueOnce({ id: "run-2", startedAt: recent })
      .mockResolvedValueOnce(null);
    prismaMock.ingestionJobRun.count.mockResolvedValueOnce(8).mockResolvedValueOnce(0);

    const snap = await loadIngestionLiveSnapshot();
    expect(snap.status).toBe("active");
    expect(snap.lastRun?.recordsCreated).toBe(5);
  });

  it("reports status=stale when the last successful run is older than 48h", async () => {
    const stale = new Date(Date.now() - 72 * 60 * 60 * 1000);
    prismaMock.ingestionJobRun.findFirst
      .mockResolvedValueOnce({
        id: "run-3",
        status: "SUCCESS",
        startedAt: stale,
        finishedAt: stale,
        recordsSeen: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 0,
        recordsReviewRequired: 0,
        errorMessage: null,
        job: { jobName: "vatican.encyclicals", source: { name: "Vatican" } },
      })
      .mockResolvedValueOnce({ id: "run-3", startedAt: stale })
      .mockResolvedValueOnce(null);
    prismaMock.ingestionJobRun.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const snap = await loadIngestionLiveSnapshot();
    expect(snap.status).toBe("stale");
  });
});

describe("runIngestionDiagnostics", () => {
  it("returns one section with multiple diagnostic results", async () => {
    settingsMock.mockResolvedValue({ autoCleanupEnabled: true, hardDeleteAfterDays: 30 });
    prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
    prismaMock.ingestionJobRun.count.mockResolvedValue(0);
    // Content counts: zero across the board.
    prismaMock.prayer.count.mockResolvedValue(0);
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.marianApparition.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.devotion.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);
    prismaMock.dataManagementLog.groupBy.mockResolvedValue([]);

    const section = await runIngestionDiagnostics();
    expect(section.id).toBe("ingestion");
    expect(section.results.length).toBeGreaterThanOrEqual(5);
    // Every result has the required pass/warn/fail/skipped fields.
    for (const r of section.results) {
      expect(r.severity).toMatch(/pass|warn|fail|skipped/);
      expect(r.ranAt).toBeTypeOf("string");
      expect(r.requestId).toBeTypeOf("string");
      expect(r.summary).toBeTypeOf("string");
    }
  });
});

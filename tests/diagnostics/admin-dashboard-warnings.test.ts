/**
 * Admin dashboard warnings — verifies each warning fires only under
 * its trigger condition.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getDashboardWarnings } from "@/lib/diagnostics";

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
    prismaMock.ingestionJobQueue,
    prismaMock.ingestionJobRun,
    prismaMock.dataManagementLog,
    prismaMock.rejectedContentLog,
  ]) {
    m.count.mockResolvedValue(0);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getDashboardWarnings", () => {
  it("returns no warnings when the dashboard is healthy", async () => {
    const warnings = await getDashboardWarnings();
    expect(warnings).toEqual([]);
  });

  it("fires raw_vs_valid_X when raw rows > valid packages + 5", async () => {
    prismaMock.prayer.count.mockImplementation(async (args?: { where?: unknown }) => {
      if (!args?.where) return 100; // raw rows
      return 50; // valid where = STRICT_PUBLIC_WHERE_CLAUSE
    });
    const warnings = await getDashboardWarnings();
    const raw = warnings.find((w) => w.key === "raw_vs_valid_Prayer");
    expect(raw).toBeDefined();
    expect(raw?.severity).toBe("warn");
  });

  it("does not fire raw_vs_valid when raw ≈ valid", async () => {
    prismaMock.prayer.count.mockImplementation(async (args?: { where?: unknown }) => {
      if (!args?.where) return 50;
      return 50;
    });
    const warnings = await getDashboardWarnings();
    expect(warnings.find((w) => w.key === "raw_vs_valid_Prayer")).toBeUndefined();
  });

  it("fires rejection_spike when last-hour deletes are 5x the prior 23h avg", async () => {
    let call = 0;
    prismaMock.rejectedContentLog.count.mockImplementation(async () => {
      call += 1;
      if (call === 1) return 60; // last hour
      if (call === 2) return 23; // prior 23h
      return 0;
    });
    const warnings = await getDashboardWarnings();
    expect(warnings.find((w) => w.key === "rejection_spike")).toBeDefined();
  });

  it("fires running_but_not_producing when jobs completed but no ADDs", async () => {
    prismaMock.ingestionJobQueue.count.mockImplementation(async (args?: { where?: unknown }) => {
      // Distinguish the runningButNot vs metricsZero query by where shape.
      const where = (args?.where ?? {}) as Record<string, unknown>;
      if (where.status === "completed") return 10;
      return 0;
    });
    prismaMock.dataManagementLog.count.mockResolvedValue(0);
    const warnings = await getDashboardWarnings();
    expect(warnings.find((w) => w.key === "running_but_not_producing")).toBeDefined();
  });

  it("fires metrics_zero_queue_has_rows when queue is non-empty but run log is empty", async () => {
    prismaMock.ingestionJobQueue.count.mockImplementation(async (args?: { where?: unknown }) => {
      if (!args?.where) return 5; // total queue count
      return 0; // any filtered call
    });
    prismaMock.ingestionJobRun.count.mockResolvedValue(0);
    const warnings = await getDashboardWarnings();
    expect(warnings.find((w) => w.key === "metrics_zero_queue_has_rows")).toBeDefined();
  });
});

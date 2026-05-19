/**
 * Tab-level diagnostics tests.
 *
 * The report produces one row per public tab with the spec-listed
 * fields. We mock Prisma counts so the test pins:
 *   - every tab gets a row
 *   - growth stall reason flips to no_public_rows when public=0
 *   - growth stall reason flips to more_hidden_than_public when hidden>public
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getTabDiagnosticsReport, TAB_KEYS } from "@/lib/diagnostics/tab-diagnostics";

beforeEach(() => {
  resetPrismaMock();
});

describe("getTabDiagnosticsReport()", () => {
  it("produces a row for every spec tab", async () => {
    // Default counts: 0 for everything.
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
      m.findFirst.mockResolvedValue(null);
    }
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
    const report = await getTabDiagnosticsReport();
    const tabs = report.rows.map((r) => r.tab);
    for (const want of TAB_KEYS) {
      expect(tabs).toContain(want);
    }
  });

  it("reports no_public_rows when a tab has zero public rows", async () => {
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
      m.findFirst.mockResolvedValue(null);
    }
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
    const report = await getTabDiagnosticsReport();
    for (const row of report.rows) {
      expect(row.growthStallReason).toBe("no_public_rows");
    }
  });

  it("reports more_hidden_than_public when hidden count exceeds public count", async () => {
    // We dispatch on the where clause: hidden uses `OR` for the
    // publicRenderReady / threshold-eligible flag check; public is
    // the `status: PUBLISHED + publicRenderReady: true + threshold
    // eligible: true` triple; threshold is just isThresholdEligible.
    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockImplementation(async (args?: unknown) => {
        const where = (args as { where?: Record<string, unknown> })?.where ?? {};
        if (Array.isArray((where as { OR?: unknown[] }).OR)) return 10; // hidden
        if ((where as { publicRenderReady?: boolean }).publicRenderReady === true) return 2; // public
        return 2; // threshold
      });
      m.findFirst.mockResolvedValue(null);
    }
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
    const report = await getTabDiagnosticsReport();
    expect(report.rows.every((r) => r.growthStallReason === "more_hidden_than_public")).toBe(true);
  });
});

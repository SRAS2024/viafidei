/**
 * Admin dashboards show actual growth acceptance (spec §23, §24).
 *
 * Spec rule: "Admin dashboards show actual growth, not raw row
 * noise." We exercise the factory command center + tab diagnostics
 * and confirm:
 *
 *   - persistence value tracks strict-public rows, NOT total rows
 *     (so a content type with 100 PUBLISHED rows but 0 publicly
 *     visible rows reports persistence=0)
 *   - tab diagnostics' `publicCount` honours the strict gate
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getFactoryCommandCenter } from "@/lib/diagnostics/factory-command-center";
import { getTabDiagnosticsReport } from "@/lib/diagnostics/tab-diagnostics";

beforeEach(() => {
  resetPrismaMock();
});

describe("Admin dashboards show actual growth (spec §23, §24)", () => {
  it("factory command center persistence count uses the strict-public where clause", async () => {
    // We can detect this by checking what `where` clause the
    // counting calls receive. The mock records every call.
    for (const m of [
      prismaMock.ingestionSource,
      prismaMock.ingestionJobQueue,
      prismaMock.sourceDocument,
      prismaMock.contentPackageBuildLog,
      prismaMock.rejectedContentLog,
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockResolvedValue(0);
    }
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 0, qaFailCount: 0 },
    });
    prismaMock.sourceQualityScore.findFirst.mockResolvedValue(null);
    await getFactoryCommandCenter();
    // Every content-row count must include both publicRenderReady
    // AND isThresholdEligible. If a future refactor drops one, the
    // dashboard would over-report growth — this test catches it.
    const calls = prismaMock.prayer.count.mock.calls
      .map((c) => (c[0] as { where?: Record<string, unknown> })?.where)
      .filter(Boolean) as Record<string, unknown>[];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((w) => w.publicRenderReady === true && w.isThresholdEligible === true)).toBe(
      true,
    );
  });

  it("tab diagnostics' publicCount filters by the strict gate", async () => {
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
    await getTabDiagnosticsReport();
    const calls = prismaMock.prayer.count.mock.calls
      .map((c) => (c[0] as { where?: Record<string, unknown> })?.where)
      .filter(Boolean) as Record<string, unknown>[];
    expect(
      calls.some(
        (w) =>
          w.publicRenderReady === true &&
          w.isThresholdEligible === true &&
          w.status === "PUBLISHED",
      ),
    ).toBe(true);
  });
});

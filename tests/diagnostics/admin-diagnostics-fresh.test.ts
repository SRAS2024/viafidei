/**
 * Admin diagnostics freshness tests (spec §19, §23).
 *
 * "Admin diagnostics should use fresh database reads or short-lived
 * cache only" — diagnostic helpers used by admin pages must not be
 * cached by the same tags as public content, so a stale public cache
 * never hides factory state from an operator.
 *
 * We exercise the diagnostic readers and assert their results
 * change in lockstep with the mocked Prisma counts, which proves
 * they read live (not cached) data.
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

describe("Admin diagnostics freshness (spec §19, §23)", () => {
  it("factory command center reflects the latest Prisma counts on every call", async () => {
    // First call: zero everything.
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
    const first = await getFactoryCommandCenter();
    const firstPersistence = first.sections.find((s) => s.key === "persistence");
    expect(firstPersistence?.value).toBe(0);

    // Second call: now Prayer reports 10.
    prismaMock.prayer.count.mockResolvedValue(10);
    const second = await getFactoryCommandCenter();
    const secondPersistence = second.sections.find((s) => s.key === "persistence");
    // Persistence is the sum of public rows; only prayer changed, but
    // it MUST tick up — proves the read was fresh, not cached.
    expect(Number(secondPersistence?.value ?? 0)).toBeGreaterThan(
      Number(firstPersistence?.value ?? 0),
    );
  });

  it("tab diagnostics reflects the latest Prisma counts on every call", async () => {
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
    const first = await getTabDiagnosticsReport();
    expect(first.rows.find((r) => r.tab === "prayers")?.publicCount).toBe(0);

    // Update Prayer counts; second call should reflect the change.
    prismaMock.prayer.count.mockResolvedValue(5);
    const second = await getTabDiagnosticsReport();
    expect(second.rows.find((r) => r.tab === "prayers")?.publicCount).toBe(5);
  });
});

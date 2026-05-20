/**
 * Per-content-type production readiness.
 *
 * Proves production readiness verifies every major public tab — not
 * just Prayer:
 *   1. One readiness row per major content type (all twelve).
 *   2. A content type with no factory-ready source fails its source
 *      check and is counted in `typesWithNoSource`.
 *   3. A public tab whose strict query throws fails `publicDisplay`
 *      and is counted in `tabsCannotLoad` — never a false pass.
 *   4. A fully wired content type passes every check.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  getContentTypeReadinessReport,
  READINESS_CONTENT_TYPES,
} from "@/lib/diagnostics/content-type-readiness";

const STRICT_MODELS = [
  "prayer",
  "saint",
  "marianApparition",
  "parish",
  "devotion",
  "spiritualLifeGuide",
  "liturgyEntry",
] as const;

/** A source the planner counts as factory-ready for every content type. */
function factoryReadySource(): Record<string, unknown> {
  return {
    isActive: true,
    pausedAt: null,
    role: "primary_content_source",
    discoveryMethod: "sitemap",
    canIngestPrayers: true,
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestParishes: true,
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestSacraments: true,
    canIngestRosaryGuides: true,
    canIngestConsecrations: true,
    canIngestSpiritualGuides: true,
    canIngestLiturgy: true,
    canIngestHistory: true,
  };
}

function armStrictCounts(value: number): void {
  for (const model of STRICT_MODELS) {
    prismaMock[model].count.mockResolvedValue(value);
  }
}

beforeEach(() => {
  resetPrismaMock();
});

describe("getContentTypeReadinessReport", () => {
  it("returns one readiness row per major content type", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    armStrictCounts(0);
    const report = await getContentTypeReadinessReport();
    expect(report.rows.length).toBe(12);
    expect(report.rows.map((r) => r.contentType).sort()).toEqual(
      [...READINESS_CONTENT_TYPES].sort(),
    );
  });

  it("fails the source check for content types with no factory-ready source", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    armStrictCounts(0);
    const report = await getContentTypeReadinessReport();
    expect(report.typesWithNoSource).toBe(12);
    const prayer = report.rows.find((r) => r.contentType === "Prayer");
    expect(prayer?.checks.sourceConfigured).toBe("fail");
    expect(prayer?.severity).toBe("fail");
  });

  it("fails public display when the strict tab query cannot load", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue(
      Array.from({ length: 5 }, factoryReadySource),
    );
    armStrictCounts(4);
    prismaMock.prayer.count.mockRejectedValue(new Error("db down"));
    const report = await getContentTypeReadinessReport();
    expect(report.tabsCannotLoad).toBeGreaterThanOrEqual(1);
    const prayer = report.rows.find((r) => r.contentType === "Prayer");
    expect(prayer?.checks.publicDisplay).toBe("fail");
    expect(prayer?.strictPublicCount).toBeNull();
    expect(prayer?.severity).toBe("fail");
  });

  it("passes every check for a fully wired content type", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue(
      Array.from({ length: 5 }, factoryReadySource),
    );
    armStrictCounts(6);
    const report = await getContentTypeReadinessReport();
    const prayer = report.rows.find((r) => r.contentType === "Prayer");
    expect(prayer?.checks.sourceConfigured).toBe("pass");
    expect(prayer?.checks.publicDisplay).toBe("pass");
    expect(prayer?.checks.cacheTag).toBe("pass");
    // Prayer has a canary fixture that builds cleanly.
    expect(prayer?.checks.canaryBuild).toBe("pass");
    expect(prayer?.severity).toBe("pass");
    expect(report.tabsCannotLoad).toBe(0);
  });
});

/**
 * Baseline content seeder tests (spec §21, §23).
 *
 * Pins:
 *   - one fixture per spec content type (Prayer / Saint / Devotion /
 *     Sacrament / Liturgy / History — Parish is optional and absent
 *     from the baseline list)
 *   - every fixture carries the required fields
 *   - seedBaselineContent() walks every fixture exactly once and
 *     emits one result entry per fixture
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/data/admin-notifications", () => ({
  reportCriticalFailure: vi.fn(),
  sendThresholdCheckFailedWarning: vi.fn(),
}));

import { BASELINE_SEED_FIXTURES, seedBaselineContent } from "@/lib/content-factory/baseline-seed";

beforeEach(() => {
  resetPrismaMock();
  // Make persist succeed for every content type
  prismaMock.prayer.findFirst.mockResolvedValue(null);
  prismaMock.prayer.create.mockResolvedValue({ id: "p", slug: "x" });
  prismaMock.saint.findFirst.mockResolvedValue(null);
  prismaMock.saint.create.mockResolvedValue({ id: "s", slug: "x" });
  prismaMock.devotion.findFirst.mockResolvedValue(null);
  prismaMock.devotion.create.mockResolvedValue({ id: "d", slug: "x" });
  prismaMock.spiritualLifeGuide.findFirst.mockResolvedValue(null);
  prismaMock.spiritualLifeGuide.create.mockResolvedValue({ id: "g", slug: "x" });
  prismaMock.liturgyEntry.findFirst.mockResolvedValue(null);
  prismaMock.liturgyEntry.create.mockResolvedValue({ id: "l", slug: "x" });
  prismaMock.contentPackageBuildLog.create.mockResolvedValue({ id: "log" });
  prismaMock.sourceQualityScore.upsert.mockResolvedValue({
    id: "sq",
    buildSuccessCount: 1,
    buildFailureCount: 0,
    qaPassCount: 1,
    qaFailCount: 0,
    duplicateCount: 0,
    wrongContentCount: 0,
    deletedCount: 0,
    autoPaused: false,
  });
});

describe("BASELINE_SEED_FIXTURES", () => {
  it("covers every spec-listed baseline content type", () => {
    const types = new Set(BASELINE_SEED_FIXTURES.map((f) => f.contentType));
    expect(types.has("Prayer")).toBe(true);
    expect(types.has("Saint")).toBe(true);
    expect(types.has("Devotion")).toBe(true);
    expect(types.has("Sacrament")).toBe(true);
    expect(types.has("Liturgy")).toBe(true);
    expect(types.has("History")).toBe(true);
  });

  it("every fixture carries the required fields", () => {
    for (const fx of BASELINE_SEED_FIXTURES) {
      expect(fx.slug).toMatch(/^[a-z0-9-]+$/);
      expect(fx.title.length).toBeGreaterThan(0);
      expect(fx.rawBody.length).toBeGreaterThan(50);
      expect(fx.sourceUrl).toMatch(/^https?:\/\//);
      expect(fx.sourceHost).toBeTruthy();
      expect(fx.sourcePurpose).toMatch(/^canIngest/);
    }
  });
});

describe("seedBaselineContent()", () => {
  it("returns one result per fixture", async () => {
    const results = await seedBaselineContent();
    expect(results.length).toBe(BASELINE_SEED_FIXTURES.length);
  });

  it("each result carries a decision string", async () => {
    const results = await seedBaselineContent();
    for (const r of results) {
      expect(typeof r.decision).toBe("string");
      expect(r.decision.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Seven-day production content growth report.
 *
 * Proves:
 *   1. The production growth score starts at 100 and subtracts every
 *      spec-listed penalty — a healthy pipeline scores 100, a dead one
 *      scores 0.
 *   2. Each penalty fires for exactly its pipeline-break condition.
 *   3. Daily growth targets resolve from config.
 *   4. The report returns one row per content type with the twelve
 *      spec metrics, the four daily charts, and 24h / 7d warnings.
 *   5. A failed window scan surfaces an `errors` entry and `null`
 *      metrics — never a false zero.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  computeProductionGrowthScore,
  dailyGrowthTargetFor,
  getSevenDayGrowthReport,
} from "@/lib/data/seven-day-growth-report";

const PUBLIC_MODELS = [
  "prayer",
  "saint",
  "marianApparition",
  "parish",
  "devotion",
  "spiritualLifeGuide",
  "liturgyEntry",
] as const;

type FnMock = ReturnType<typeof vi.fn>;

// ContentValidationEvidence is deliberately absent from the shared
// Prisma mock (see tests/content-factory/validation-evidence-summary).
// The seven-day report reads it, so install a fresh CRUD surface per
// test and keep a typed handle to it.
let evidence: { findMany: FnMock; count: FnMock; groupBy: FnMock };

/** Arm every standard window scan + public model to return empty / zero. */
function armAllEmpty(): void {
  prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
  prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
  for (const model of PUBLIC_MODELS) {
    prismaMock[model].findMany.mockResolvedValue([]);
    prismaMock[model].count.mockResolvedValue(0);
  }
}

const HEALTHY = {
  sourceDocumentsFetched: 10,
  buildAttempts: 10,
  completePackagesBuilt: 9,
  buildFailures: 1,
  strictQaPasses: 8,
  persistedPackages: 8,
  publicPackages: 8,
  searchVisiblePackages: 8,
  sitemapVisiblePackages: 8,
  duplicatePackages: 0,
  validationEvidenceFailures: 0,
};

beforeEach(() => {
  resetPrismaMock();
  evidence = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
  };
  (prismaMock as unknown as Record<string, unknown>).contentValidationEvidence = evidence;
});

describe("computeProductionGrowthScore", () => {
  it("scores a healthy pipeline 100 with no penalties", () => {
    const { score, penalties } = computeProductionGrowthScore(HEALTHY);
    expect(score).toBe(100);
    expect(penalties).toEqual([]);
  });

  it("scores a dead pipeline 0 (no fetch, no build, no QA pass)", () => {
    const { score, penalties } = computeProductionGrowthScore({
      sourceDocumentsFetched: 0,
      buildAttempts: 0,
      completePackagesBuilt: 0,
      buildFailures: 0,
      strictQaPasses: 0,
      persistedPackages: 0,
      publicPackages: 0,
      searchVisiblePackages: 0,
      sitemapVisiblePackages: 0,
      duplicatePackages: 0,
      validationEvidenceFailures: 0,
    });
    expect(score).toBe(0);
    expect(penalties.map((p) => p.id).sort()).toEqual([
      "no_build_attempts",
      "no_fetches",
      "no_qa_passes",
    ]);
  });

  it("penalises QA passes with no persistence", () => {
    const { score, penalties } = computeProductionGrowthScore({
      ...HEALTHY,
      strictQaPasses: 5,
      persistedPackages: 0,
      publicPackages: 0,
      searchVisiblePackages: 0,
      sitemapVisiblePackages: 0,
    });
    expect(penalties.map((p) => p.id)).toEqual(["qa_without_persistence"]);
    expect(score).toBe(65);
  });

  it("penalises persistence with no public display", () => {
    const { penalties } = computeProductionGrowthScore({
      ...HEALTHY,
      publicPackages: 0,
      searchVisiblePackages: 0,
      sitemapVisiblePackages: 0,
    });
    expect(penalties.map((p) => p.id)).toEqual(["persistence_without_public"]);
  });

  it("penalises public display with no search or sitemap visibility", () => {
    const { penalties } = computeProductionGrowthScore({
      ...HEALTHY,
      searchVisiblePackages: 0,
      sitemapVisiblePackages: 0,
    });
    expect(penalties.map((p) => p.id).sort()).toEqual([
      "public_without_search",
      "public_without_sitemap",
    ]);
  });

  it("penalises duplicate saturation, validation evidence failures and builder failures", () => {
    const duplicate = computeProductionGrowthScore({
      ...HEALTHY,
      completePackagesBuilt: 2,
      duplicatePackages: 10,
    });
    expect(duplicate.penalties.map((p) => p.id)).toContain("duplicate_saturation");

    const evidenceFail = computeProductionGrowthScore({
      ...HEALTHY,
      validationEvidenceFailures: 8,
    });
    expect(evidenceFail.penalties.map((p) => p.id)).toContain("validation_evidence_failures");

    const builder = computeProductionGrowthScore({
      ...HEALTHY,
      completePackagesBuilt: 3,
      buildFailures: 12,
    });
    expect(builder.penalties.map((p) => p.id)).toContain("builder_failures");
  });

  it("never returns a score outside 0–100", () => {
    const worst = computeProductionGrowthScore({
      sourceDocumentsFetched: 0,
      buildAttempts: 0,
      completePackagesBuilt: 0,
      buildFailures: 0,
      strictQaPasses: 0,
      persistedPackages: 0,
      publicPackages: 0,
      searchVisiblePackages: 0,
      sitemapVisiblePackages: 0,
      duplicatePackages: 99,
      validationEvidenceFailures: 99,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

describe("dailyGrowthTargetFor", () => {
  it("resolves a configured per-content-type target", () => {
    expect(dailyGrowthTargetFor("Prayer")).toBeGreaterThan(0);
    expect(dailyGrowthTargetFor("Saint")).toBeGreaterThan(0);
  });

  it("returns 0 for an unknown content type", () => {
    expect(dailyGrowthTargetFor("NotAType" as never)).toBe(0);
  });
});

describe("getSevenDayGrowthReport", () => {
  it("returns one row per content type with the four daily charts", async () => {
    armAllEmpty();
    const report = await getSevenDayGrowthReport();

    expect(report.rows.length).toBe(12);
    expect(report.windowDays).toBe(7);
    expect(report.dayLabels.length).toBe(7);
    expect(Object.keys(report.charts).sort()).toEqual([
      "dailyBuilderSuccessRateByBuilder",
      "dailyPublicGrowthByType",
      "dailyQaPassRateByType",
      "dailySourceSuccessRateBySource",
    ]);
    // Public-growth chart has a series per content type.
    expect(report.charts.dailyPublicGrowthByType.series.length).toBe(12);
  });

  it("flags a stronger 7-day warning when nothing grew all week", async () => {
    armAllEmpty();
    const report = await getSevenDayGrowthReport();

    const prayer = report.rows.find((r) => r.contentType === "Prayer");
    expect(prayer?.warning).toBe("no_growth_7d");
    expect(prayer?.metrics.publicPackages).toBe(0);
    expect(prayer?.growthScore).toBe(0);
    expect(report.warningCount).toBe(12);
  });

  it("counts real public-package growth from the public tables", async () => {
    const now = new Date();
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        contentType: "Prayer",
        sourceHost: "vatican.va",
        builderName: "prayer-builder",
        buildStatus: i < 8 ? "built_complete_package" : "build_failed_missing_required_fields",
        sourceDocumentId: `doc-${i}`,
        createdAt: now,
      })),
    );
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    evidence.findMany.mockResolvedValue([
      { contentType: "Prayer", validationDecision: "pass", packageId: "p1", candidateSlug: null },
      { contentType: "Prayer", validationDecision: "pass", packageId: "p2", candidateSlug: null },
    ]);
    for (const model of PUBLIC_MODELS) {
      prismaMock[model].findMany.mockResolvedValue([]);
      prismaMock[model].count.mockResolvedValue(0);
    }
    prismaMock.prayer.findMany.mockResolvedValue(
      Array.from({ length: 6 }, () => ({
        createdAt: now,
        publicRenderReady: true,
        isThresholdEligible: true,
        archivedAt: null,
      })),
    );
    prismaMock.prayer.count.mockResolvedValue(6);

    const report = await getSevenDayGrowthReport();
    const prayer = report.rows.find((r) => r.contentType === "Prayer");

    expect(prayer?.metrics.sourceDocumentsFetched).toBe(10);
    expect(prayer?.metrics.buildAttempts).toBe(10);
    expect(prayer?.metrics.completePackagesBuilt).toBe(8);
    expect(prayer?.metrics.crossSourceValidationPasses).toBe(2);
    expect(prayer?.metrics.persistedPackages).toBe(6);
    expect(prayer?.metrics.publicPackages).toBe(6);
    expect(prayer?.metrics.searchVisiblePackages).toBe(6);
    expect(prayer?.metrics.sitemapVisiblePackages).toBe(6);
    expect(prayer?.metrics.netPublicGrowth).toBe(6);
    expect(prayer?.warning).toBe("none");
    expect(prayer?.growthScore).toBe(100);
  });

  it("surfaces a query failure as null metrics, never a false zero", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockRejectedValue(new Error("scan boom"));
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    for (const model of PUBLIC_MODELS) {
      prismaMock[model].findMany.mockResolvedValue([]);
      prismaMock[model].count.mockResolvedValue(0);
    }

    const report = await getSevenDayGrowthReport();
    const prayer = report.rows.find((r) => r.contentType === "Prayer");

    expect(prayer?.metrics.buildAttempts).toBeNull();
    expect(prayer?.metrics.completePackagesBuilt).toBeNull();
    expect(prayer?.metrics.sourceDocumentsFetched).toBeNull();
    expect(prayer?.errors.buildLogs).toMatch(/scan boom/);
  });
});

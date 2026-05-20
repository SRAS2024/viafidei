/**
 * Builder quality score tests.
 *
 * Each row covers the spec-listed dimensions:
 *   - validPackageRate (built_complete_package / total)
 *   - duplicateRate
 *   - wrongContentRate
 *   - qaPassRate (from SourceQualityScore aggregate)
 *
 * The test mocks Prisma and walks the registry to make sure every
 * content type produces a row, even when there are no builds yet.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getBuilderQualityReport } from "@/lib/content-factory/builder-quality";

beforeEach(() => {
  resetPrismaMock();
});

describe("getBuilderQualityReport()", () => {
  it("produces a row for every registered builder", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 0, qaFailCount: 0 },
    });
    const report = await getBuilderQualityReport();
    const contentTypes = new Set(report.rows.map((r) => r.contentType));
    expect(contentTypes.has("Prayer")).toBe(true);
    expect(contentTypes.has("Saint")).toBe(true);
    expect(contentTypes.has("Novena")).toBe(true);
    expect(contentTypes.has("Sacrament")).toBe(true);
    expect(contentTypes.has("History")).toBe(true);
    expect(contentTypes.has("Parish")).toBe(true);
    expect(contentTypes.has("Devotion")).toBe(true);
    expect(contentTypes.has("Consecration")).toBe(true);
    expect(contentTypes.has("MarianApparition")).toBe(true);
    expect(contentTypes.has("Liturgy")).toBe(true);
  });

  it("computes validPackageRate / duplicateRate / wrongContentRate from group-by output", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockImplementation(async (args: unknown) => {
      const a = args as { where: { contentType: string } };
      if (a.where.contentType === "Prayer") {
        return [
          { buildStatus: "built_complete_package", _count: { _all: 8 } },
          { buildStatus: "duplicate", _count: { _all: 1 } },
          { buildStatus: "wrong_content", _count: { _all: 1 } },
        ];
      }
      return [];
    });
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 7, qaFailCount: 3 },
    });
    const report = await getBuilderQualityReport();
    const prayer = report.rows.find((r) => r.contentType === "Prayer");
    expect(prayer).toBeDefined();
    expect(prayer?.totalBuilds).toBe(10);
    expect(prayer?.buildSuccessCount).toBe(8);
    expect(prayer?.validPackageRate).toBe(0.8);
    expect(prayer?.duplicateRate).toBe(0.1);
    expect(prayer?.wrongContentRate).toBe(0.1);
    expect(prayer?.qaPassRate).toBe(0.7);
  });

  it("computes qaFailRate, top missing fields and top rejected hosts", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([
      { buildStatus: "built_complete_package", _count: { _all: 5 } },
      { buildStatus: "build_failed_missing_required_fields", _count: { _all: 5 } },
    ]);
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 6, qaFailCount: 4 },
    });
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      { missingFieldsJson: ["feastDay", "biography"] },
      { missingFieldsJson: ["feastDay"] },
    ]);
    prismaMock.rejectedContentLog.groupBy.mockResolvedValue([
      { sourceHost: "bad.example", _count: { _all: 7 } },
      { sourceHost: "ok.example", _count: { _all: 2 } },
    ]);
    for (const model of [
      "prayer",
      "saint",
      "marianApparition",
      "parish",
      "devotion",
      "spiritualLifeGuide",
      "liturgyEntry",
    ] as const) {
      prismaMock[model].count.mockResolvedValue(0);
    }

    const report = await getBuilderQualityReport();
    const prayer = report.rows.find((r) => r.contentType === "Prayer")!;
    expect(prayer.qaPassRate).toBe(0.6);
    expect(prayer.qaFailRate).toBeCloseTo(0.4);
    expect(prayer.topMissingFields[0]).toEqual({ field: "feastDay", count: 2 });
    expect(prayer.topRejectedHosts[0]).toEqual({ host: "bad.example", count: 7 });
  });

  it("is resilient to a Prisma error on a single builder row", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockRejectedValue(new Error("DB transient"));
    prismaMock.sourceQualityScore.aggregate.mockResolvedValue({
      _sum: { qaPassCount: 0, qaFailCount: 0 },
    });
    const report = await getBuilderQualityReport();
    // No rows but the call did not throw.
    expect(Array.isArray(report.rows)).toBe(true);
  });
});

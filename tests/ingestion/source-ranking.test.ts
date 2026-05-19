/**
 * Source ranking tests (spec §4).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { buildSourceRankingReport } from "@/lib/ingestion/sources/source-ranking";

beforeEach(() => {
  resetPrismaMock();
});

describe("buildSourceRankingReport()", () => {
  it("returns an empty report when no scores exist", async () => {
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const report = await buildSourceRankingReport();
    expect(report.rows).toHaveLength(0);
  });

  it("ranks a strong source above a weak source", async () => {
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([
      {
        sourceId: "good",
        contentType: "Prayer",
        buildSuccessCount: 100,
        buildFailureCount: 5,
        qaPassCount: 90,
        qaFailCount: 5,
        wrongContentCount: 0,
        duplicateCount: 0,
        deletedCount: 0,
        validPackageRate: 0.95,
      },
      {
        sourceId: "bad",
        contentType: "Prayer",
        buildSuccessCount: 5,
        buildFailureCount: 50,
        qaPassCount: 1,
        qaFailCount: 30,
        wrongContentCount: 20,
        duplicateCount: 5,
        deletedCount: 0,
        validPackageRate: 0.1,
      },
    ]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "good",
        host: "vatican.va",
        role: "primary_content_source",
        pausedAt: null,
        discoveryMethod: "sitemap",
        isActive: true,
      },
      {
        id: "bad",
        host: "junk.example",
        role: "discovery_only_source",
        pausedAt: null,
        discoveryMethod: "sitemap",
        isActive: true,
      },
    ]);
    const report = await buildSourceRankingReport({ contentType: "Prayer" });
    expect(report.rows[0].sourceId).toBe("good");
    expect(report.rows[0].rank).toBe(1);
    expect(report.rows[1].sourceId).toBe("bad");
    expect(report.rows[1].rank).toBe(2);
    expect(report.rows[0].score).toBeGreaterThan(report.rows[1].score);
  });

  it("zeros the score for paused / rejected / not_configured sources", async () => {
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([
      {
        sourceId: "paused",
        contentType: "Prayer",
        buildSuccessCount: 100,
        buildFailureCount: 0,
        qaPassCount: 100,
        qaFailCount: 0,
        wrongContentCount: 0,
        duplicateCount: 0,
        deletedCount: 0,
        validPackageRate: 1.0,
      },
    ]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "paused",
        host: "x.example",
        role: "primary_content_source",
        pausedAt: new Date(),
        discoveryMethod: "sitemap",
        isActive: true,
      },
    ]);
    const report = await buildSourceRankingReport();
    expect(report.rows[0].score).toBe(0);
    expect(report.rows[0].factors).toContain("paused (DEMOTED)");
  });

  it("surfaces wrong-content and duplicate percentages in the factors list", async () => {
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([
      {
        sourceId: "mid",
        contentType: "Prayer",
        buildSuccessCount: 30,
        buildFailureCount: 70,
        qaPassCount: 20,
        qaFailCount: 50,
        wrongContentCount: 30,
        duplicateCount: 10,
        deletedCount: 0,
        validPackageRate: 0.3,
      },
    ]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "mid",
        host: "mid.example",
        role: "validation_source",
        pausedAt: null,
        discoveryMethod: "rss",
        isActive: true,
      },
    ]);
    const report = await buildSourceRankingReport();
    expect(report.rows[0].factors.some((f) => /wrong-content/.test(f))).toBe(true);
    expect(report.rows[0].factors.some((f) => /duplicate/.test(f))).toBe(true);
  });
});

/**
 * Builder weakness diagnostic — proves the helper:
 *
 *   1. Groups build failures by (contentType, missingField).
 *   2. Returns one entry per pattern that exceeds the repetition
 *      threshold, with a content-type-specific advice message
 *      (NovenaBuilder day parser, SaintBuilder patronage, etc.).
 *   3. Skips one-off failures.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  getBuilderWeaknessReport,
  getBuilderWeaknessBreakdowns,
  getBuildLogDetail,
} from "@/lib/diagnostics/builder-weakness";

beforeEach(() => {
  resetPrismaMock();
});

describe("getBuilderWeaknessReport", () => {
  it("flags repeated Novena day-parsing failures with the day-parser-weakness message", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({
        contentType: "Novena",
        builderName: "NovenaBuilder",
        sourceUrl: `https://example.com/novena-${i}`,
        missingFieldsJson: ["day7"] as never,
      })),
    );

    const report = await getBuilderWeaknessReport();

    expect(report).toHaveLength(1);
    expect(report[0].contentType).toBe("Novena");
    expect(report[0].missingField).toBe("day7");
    expect(report[0].message).toMatch(/day parser/i);
    expect(report[0].failureCount).toBe(4);
  });

  it("flags repeated Saint patronage failures with the enrichment/source-selection message", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        contentType: "Saint",
        builderName: "SaintBuilder",
        sourceUrl: `https://example.com/saint-${i}`,
        missingFieldsJson: ["patronage"] as never,
      })),
    );

    const report = await getBuilderWeaknessReport();

    expect(report).toHaveLength(1);
    expect(report[0].message).toMatch(/enrichment|source selection/i);
  });

  it("ignores one-off failures below the repetition threshold", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      {
        contentType: "Prayer",
        builderName: "PrayerBuilder",
        sourceUrl: "https://example.com/p",
        missingFieldsJson: ["prayerText"] as never,
      },
    ]);

    const report = await getBuilderWeaknessReport({ minRepetition: 3 });

    expect(report).toHaveLength(0);
  });
});

describe("getBuilderWeaknessBreakdowns", () => {
  it("groups failures by missing field, source host, content type, builder version and source role", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({
        contentType: "Novena",
        builderName: "NovenaBuilder",
        builderVersion: "1.0.0",
        sourceHost: "weak.example",
        sourceUrl: `https://weak.example/novena-${i}`,
        missingFieldsJson: ["day7"] as never,
      })),
    );
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      { host: "weak.example", role: "discovery_only_source" },
    ]);

    const breakdowns = await getBuilderWeaknessBreakdowns();

    expect(breakdowns.byMissingField[0]).toMatchObject({ key: "Novena:day7", failureCount: 4 });
    expect(breakdowns.bySourceHost[0]).toMatchObject({ key: "weak.example", failureCount: 4 });
    expect(breakdowns.byContentType[0]).toMatchObject({ key: "Novena", failureCount: 4 });
    expect(breakdowns.byBuilderVersion[0]).toMatchObject({
      key: "NovenaBuilder@1.0.0",
      failureCount: 4,
    });
    expect(breakdowns.bySourceRole[0]).toMatchObject({
      key: "discovery_only_source",
      failureCount: 4,
    });
  });

  it("groups package contract version failures from QA rejections", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        packageVersion: "2.0.0",
        failedContractName: "PrayerPackage",
        sourceUrl: `https://example.com/r-${i}`,
      })),
    );

    const breakdowns = await getBuilderWeaknessBreakdowns();
    expect(breakdowns.byPackageContractVersion[0]).toMatchObject({
      key: "PrayerPackage@2.0.0",
      failureCount: 3,
    });
  });
});

describe("getBuildLogDetail", () => {
  it("groups build failures by content type, source host, source URL, builder, failure reason and missing field", async () => {
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      {
        contentType: "Prayer",
        builderName: "PrayerBuilder",
        builderVersion: "1.0.0",
        sourceHost: "weak.example",
        sourceUrl: "https://weak.example/p1",
        buildStatus: "build_failed_missing_required_fields",
        failureReason: "Missing required fields: prayerText",
        missingFieldsJson: ["prayerText"] as never,
        createdAt: new Date("2026-05-20"),
      },
      {
        contentType: "Prayer",
        builderName: "PrayerBuilder",
        builderVersion: "1.0.0",
        sourceHost: "weak.example",
        sourceUrl: "https://weak.example/p2",
        buildStatus: "build_failed_missing_required_fields",
        failureReason: "Missing required fields: category",
        missingFieldsJson: ["category"] as never,
        createdAt: new Date("2026-05-21"),
      },
      {
        contentType: "Saint",
        builderName: "SaintBuilder",
        builderVersion: "1.0.0",
        sourceHost: "other.example",
        sourceUrl: "https://other.example/s1",
        buildStatus: "wrong_content",
        failureReason: "Page title is a livestream / event / bulletin / news page, not Saint content",
        missingFieldsJson: [] as never,
        createdAt: new Date("2026-05-22"),
      },
    ]);

    const detail = await getBuildLogDetail();

    expect(detail.totalFailures).toBe(3);
    expect(detail.byContentType).toContainEqual(
      expect.objectContaining({ key: "Prayer", failureCount: 2 }),
    );
    expect(detail.bySourceHost).toContainEqual(
      expect.objectContaining({ key: "weak.example", failureCount: 2 }),
    );
    expect(detail.bySourceUrl.map((g) => g.key)).toContain("https://weak.example/p1");
    expect(detail.byBuilder).toContainEqual(
      expect.objectContaining({ key: "PrayerBuilder@1.0.0", failureCount: 2 }),
    );
    // The two "Missing required fields: …" reasons collapse to one
    // grouped failure-reason class.
    expect(detail.byFailureReason).toContainEqual(
      expect.objectContaining({ key: "Missing required fields", failureCount: 2 }),
    );
    expect(detail.byMissingField.map((g) => g.key)).toContain("Prayer:prayerText");
    expect(detail.rows).toHaveLength(3);
  });
});

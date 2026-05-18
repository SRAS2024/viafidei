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

import { getBuilderWeaknessReport } from "@/lib/diagnostics/builder-weakness";

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

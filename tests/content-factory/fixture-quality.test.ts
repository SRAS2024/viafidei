/**
 * Fixture quality diagnostics.
 *
 * Proves:
 *   1. One quality row per fixture content type.
 *   2. No false positives — an invalid fixture must never build a
 *      complete package (the suite still discriminates).
 *   3. Every content type carries valid, invalid and messy fixtures.
 *   4. Each row reports builder name + version and fixture counts.
 */

import { describe, expect, it } from "vitest";
import { getFixtureQualityReport } from "@/lib/content-factory/fixture-quality";

describe("getFixtureQualityReport", () => {
  it("returns one row per fixture content type", () => {
    const report = getFixtureQualityReport();
    expect(report.rows.length).toBeGreaterThanOrEqual(11);
  });

  it("has no false positives — invalid fixtures never build a complete package", () => {
    const report = getFixtureQualityReport();
    const offenders = report.rows.filter((r) => r.falsePositiveCount > 0);
    expect(offenders.map((r) => `${r.contentType}:${r.falsePositiveCount}`)).toEqual([]);
  });

  it("every content type has valid, invalid and messy fixture coverage", () => {
    const report = getFixtureQualityReport();
    for (const row of report.rows) {
      expect(row.missingCoverageAreas, `${row.contentType} missing coverage`).toEqual([]);
      expect(row.validCount).toBeGreaterThanOrEqual(5);
      expect(row.invalidCount).toBeGreaterThanOrEqual(5);
      expect(row.messyCount).toBeGreaterThanOrEqual(5);
    }
  });

  it("reports builder identity and counts per row", () => {
    const report = getFixtureQualityReport();
    const prayer = report.rows.find((r) => r.contentType === "Prayer");
    expect(prayer?.builderName).toBeTruthy();
    expect(prayer?.builderVersion).toBeTruthy();
    expect(prayer?.fixtureCount).toBe(
      (prayer?.validCount ?? 0) + (prayer?.invalidCount ?? 0) + (prayer?.messyCount ?? 0),
    );
  });
});

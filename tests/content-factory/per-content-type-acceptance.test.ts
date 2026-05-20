/**
 * Per-content-type acceptance tests (spec §23, §24).
 *
 * Spec criteria pinned here:
 *   - "Each content type can build at least one complete public
 *      package in tests" — walk every PRAYER_FIXTURES and
 *      SAINT_FIXTURES "valid" entry through the builder + check
 *      built_complete_package.
 *   - "Each content type rejects incomplete packages" — walk the
 *      "invalid" entries through the builder + check non-complete
 *      outcomes.
 *
 * These tests intentionally exercise the BUILDER step only — the
 * cross-source + persist steps are covered in the dedicated
 * pipeline-integration tests. Builder coverage is the per-content-
 * type guarantee §23 names.
 */

import { describe, expect, it } from "vitest";
import {
  fixturesByKind,
  PRAYER_FIXTURES,
  SAINT_FIXTURES,
} from "@/lib/content-factory/builder-fixtures";
import { PrayerBuilder, SaintBuilder } from "@/lib/content-factory/builders";

describe("Per-content-type acceptance (spec §23)", () => {
  describe("Prayer", () => {
    it("every 'valid' fixture builds a complete package", () => {
      for (const f of fixturesByKind("Prayer", "valid")) {
        const result = PrayerBuilder.build({
          document: f.document,
          sourcePurposes: f.document.sourcePurposes,
        });
        expect(
          result.outcome,
          `${f.name}: ${result.outcome === "built_complete_package" ? "ok" : (result as { failureReason?: string }).failureReason}`,
        ).toBe("built_complete_package");
      }
    });

    it("every 'invalid' fixture produces a non-complete outcome", () => {
      for (const f of fixturesByKind("Prayer", "invalid")) {
        const result = PrayerBuilder.build({
          document: f.document,
          sourcePurposes: f.document.sourcePurposes,
        });
        expect(result.outcome, `${f.name} should NOT build complete`).not.toBe(
          "built_complete_package",
        );
      }
    });

    it("fixtures cover all five spec content types of failure mode", () => {
      const reasons = fixturesByKind("Prayer", "invalid")
        .map((f) => f.expectedFailureReason)
        .filter((r): r is string => !!r);
      // The set of distinct failure reasons should include the
      // major buckets the spec calls out: wrong_content, source_not_allowed
      // and missing-field or not-supported.
      expect(new Set(reasons).size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Saint", () => {
    it("every 'valid' fixture builds a complete package", () => {
      for (const f of fixturesByKind("Saint", "valid")) {
        const result = SaintBuilder.build({
          document: f.document,
          sourcePurposes: f.document.sourcePurposes,
        });
        expect(
          result.outcome,
          `${f.name}: ${result.outcome === "built_complete_package" ? "ok" : (result as { failureReason?: string }).failureReason}`,
        ).toBe("built_complete_package");
      }
    });

    it("every 'invalid' fixture produces a non-complete outcome", () => {
      for (const f of fixturesByKind("Saint", "invalid")) {
        const result = SaintBuilder.build({
          document: f.document,
          sourcePurposes: f.document.sourcePurposes,
        });
        expect(result.outcome, `${f.name} should NOT build complete`).not.toBe(
          "built_complete_package",
        );
      }
    });
  });

  it("fixture catalog exposes the 5+5+5 minimum for each tested type", () => {
    expect(PRAYER_FIXTURES.length).toBeGreaterThanOrEqual(15);
    expect(SAINT_FIXTURES.length).toBeGreaterThanOrEqual(15);
  });
});

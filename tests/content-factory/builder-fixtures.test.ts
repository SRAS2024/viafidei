/**
 * Builder fixture coverage tests (spec §5).
 *
 * Pins:
 *   - every content type with fixtures has at least 5 valid, 5
 *     invalid, and 5 messy entries
 *   - every fixture has a stable name + content type + document
 *   - invalid fixtures carry an expectedFailureReason hint so the
 *     builder weakness panel can group failures
 */

import { describe, expect, it } from "vitest";
import {
  ALL_BUILDER_FIXTURES,
  fixturesByKind,
  fixturesForContentType,
  PRAYER_FIXTURES,
  SAINT_FIXTURES,
  DEVOTION_FIXTURES,
  SACRAMENT_FIXTURES,
  NOVENA_FIXTURES,
  MARIAN_APPARITION_FIXTURES,
  HISTORY_FIXTURES,
  PARISH_FIXTURES,
  ROSARY_FIXTURES,
  CONSECRATION_FIXTURES,
  LITURGY_FIXTURES,
} from "@/lib/content-factory/builder-fixtures";

const COVERED_CONTENT_TYPES = [
  "Prayer",
  "Saint",
  "Devotion",
  "Sacrament",
  "Novena",
  "MarianApparition",
  "History",
  "Parish",
  "Rosary",
  "Consecration",
  "Liturgy",
] as const;

describe("Builder fixture catalog (spec §5)", () => {
  for (const ct of COVERED_CONTENT_TYPES) {
    it(`${ct} fixtures meet the 5+5+5 minimum`, () => {
      expect(fixturesByKind(ct, "valid").length).toBeGreaterThanOrEqual(5);
      expect(fixturesByKind(ct, "invalid").length).toBeGreaterThanOrEqual(5);
      expect(fixturesByKind(ct, "messy").length).toBeGreaterThanOrEqual(5);
    });
  }

  it("every fixture carries a stable name + content type + document", () => {
    for (const f of [
      ...PRAYER_FIXTURES,
      ...SAINT_FIXTURES,
      ...DEVOTION_FIXTURES,
      ...SACRAMENT_FIXTURES,
      ...NOVENA_FIXTURES,
      ...MARIAN_APPARITION_FIXTURES,
      ...HISTORY_FIXTURES,
      ...PARISH_FIXTURES,
      ...ROSARY_FIXTURES,
      ...CONSECRATION_FIXTURES,
      ...LITURGY_FIXTURES,
    ]) {
      expect(f.name).toMatch(/^[a-z0-9-]+$/);
      expect(f.contentType).toBeDefined();
      expect(f.document.sourceUrl).toMatch(/^https?:\/\//);
      expect(f.document.sourceHost).toBeTruthy();
    }
  });

  it("every invalid fixture carries an expectedFailureReason", () => {
    for (const ct of COVERED_CONTENT_TYPES) {
      for (const f of fixturesByKind(ct, "invalid")) {
        expect(
          f.expectedFailureReason,
          `${ct}/${f.name} missing expectedFailureReason`,
        ).toBeTruthy();
      }
    }
  });

  it("fixturesForContentType returns the same set as fixturesByKind union", () => {
    for (const ct of COVERED_CONTENT_TYPES) {
      const all = fixturesForContentType(ct);
      const union = [
        ...fixturesByKind(ct, "valid"),
        ...fixturesByKind(ct, "invalid"),
        ...fixturesByKind(ct, "messy"),
      ];
      expect(all.length).toBe(union.length);
    }
  });

  it("ALL_BUILDER_FIXTURES exposes every covered content type", () => {
    const keys = Object.keys(ALL_BUILDER_FIXTURES);
    for (const ct of COVERED_CONTENT_TYPES) {
      expect(keys).toContain(ct);
    }
  });
});

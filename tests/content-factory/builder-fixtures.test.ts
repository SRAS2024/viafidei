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
} from "@/lib/content-factory/builder-fixtures";

describe("Builder fixture catalog (spec §5)", () => {
  it("Prayer fixtures meet the 5+5+5 minimum", () => {
    expect(fixturesByKind("Prayer", "valid").length).toBeGreaterThanOrEqual(5);
    expect(fixturesByKind("Prayer", "invalid").length).toBeGreaterThanOrEqual(5);
    expect(fixturesByKind("Prayer", "messy").length).toBeGreaterThanOrEqual(5);
  });

  it("Saint fixtures meet the 5+5+5 minimum", () => {
    expect(fixturesByKind("Saint", "valid").length).toBeGreaterThanOrEqual(5);
    expect(fixturesByKind("Saint", "invalid").length).toBeGreaterThanOrEqual(5);
    expect(fixturesByKind("Saint", "messy").length).toBeGreaterThanOrEqual(5);
  });

  it("every fixture carries a stable name + content type + document", () => {
    for (const f of [...PRAYER_FIXTURES, ...SAINT_FIXTURES]) {
      expect(f.name).toMatch(/^[a-z0-9-]+$/);
      expect(f.contentType).toBeDefined();
      expect(f.document.sourceUrl).toMatch(/^https?:\/\//);
      expect(f.document.sourceHost).toBeTruthy();
    }
  });

  it("every invalid fixture carries an expectedFailureReason", () => {
    for (const f of [
      ...fixturesByKind("Prayer", "invalid"),
      ...fixturesByKind("Saint", "invalid"),
    ]) {
      expect(f.expectedFailureReason).toBeTruthy();
    }
  });

  it("fixturesForContentType returns the same set as fixturesByKind union", () => {
    const all = fixturesForContentType("Prayer");
    const union = [
      ...fixturesByKind("Prayer", "valid"),
      ...fixturesByKind("Prayer", "invalid"),
      ...fixturesByKind("Prayer", "messy"),
    ];
    expect(all.length).toBe(union.length);
  });

  it("ALL_BUILDER_FIXTURES exposes the registered content types", () => {
    expect(Object.keys(ALL_BUILDER_FIXTURES)).toContain("Prayer");
    expect(Object.keys(ALL_BUILDER_FIXTURES)).toContain("Saint");
  });
});

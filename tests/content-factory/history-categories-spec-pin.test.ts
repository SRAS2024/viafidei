/**
 * Spec-pin test for the 12 History categories.
 *
 * The spec enumerates exactly the 12 History categories the
 * content-factory recognises. Adding or removing one is a contract
 * change and must accompany a spec update.
 *
 * The exported HISTORY_TYPES tuple is the source of truth; this test
 * asserts:
 *   * The tuple contains exactly 12 entries.
 *   * Every spec-required label is present.
 *   * normalizeHistoryType resolves each spec label back to itself.
 *   * Common aliases ("encyclical", "council", "schism", …) resolve
 *     to the matching canonical label.
 */

import { describe, expect, it } from "vitest";
import { HISTORY_TYPES, normalizeHistoryType } from "@/lib/content-factory/normalize";

const SPEC_HISTORY_CATEGORIES = [
  "Councils",
  "Major Church events",
  "Encyclicals",
  "Papal consecrations",
  "Schisms",
  "Religious order foundings",
  "Catechisms",
  "Code of Canon Law",
  "Major papal acts",
  "Major doctrinal definitions",
  "Major ecumenical events",
  "Major liturgical reforms",
] as const;

describe("HISTORY_TYPES tuple matches the spec", () => {
  it("contains exactly 12 categories", () => {
    expect(HISTORY_TYPES).toHaveLength(12);
  });

  it("contains every spec-required label", () => {
    for (const label of SPEC_HISTORY_CATEGORIES) {
      expect(HISTORY_TYPES as readonly string[]).toContain(label);
    }
  });

  it("contains no extra labels beyond the spec set", () => {
    for (const label of HISTORY_TYPES as readonly string[]) {
      expect(SPEC_HISTORY_CATEGORIES as readonly string[]).toContain(label);
    }
  });
});

describe("normalizeHistoryType resolves every spec label back to itself", () => {
  for (const label of SPEC_HISTORY_CATEGORIES) {
    it(`round-trips ${label}`, () => {
      expect(normalizeHistoryType(label)).toBe(label);
    });
  }
});

describe("normalizeHistoryType resolves common aliases to canonical labels", () => {
  const ALIASES: Array<[string, string]> = [
    ["encyclical", "Encyclicals"],
    ["ENCYCLICAL", "Encyclicals"],
    ["council", "Councils"],
    ["Vatican II Council", "Councils"],
    ["schism", "Schisms"],
    ["Code of Canon Law 1983", "Code of Canon Law"],
    ["the catechism of the catholic church", "Catechisms"],
    ["Religious Order founding", "Religious order foundings"],
    ["papal bull", "Major papal acts"],
    ["doctrinal definition", "Major doctrinal definitions"],
    ["ecumenical dialogue", "Major ecumenical events"],
    ["liturgical reform", "Major liturgical reforms"],
  ];
  for (const [input, expected] of ALIASES) {
    it(`"${input}" → ${expected}`, () => {
      expect(normalizeHistoryType(input)).toBe(expected);
    });
  }
});

describe("normalizeHistoryType rejects unrelated input", () => {
  it("returns null for an unrelated string", () => {
    expect(normalizeHistoryType("not-a-history-type")).toBeNull();
  });

  it("returns null for null / empty input", () => {
    expect(normalizeHistoryType(null)).toBeNull();
    expect(normalizeHistoryType("")).toBeNull();
    expect(normalizeHistoryType(undefined)).toBeNull();
  });
});

/**
 * Tests for slug canonicalization and name normalization.
 */

import { describe, it, expect } from "vitest";

import { canonicalizeSlug, normalizeForComparison, suggestSlug } from "@/lib/checklist/slugs";

describe("canonicalizeSlug", () => {
  it("lowercases and dash-separates", () => {
    expect(canonicalizeSlug("Our Father")).toBe("our-father");
  });
  it("strips diacritics", () => {
    expect(canonicalizeSlug("Saint Therese")).toBe("saint-therese");
    expect(canonicalizeSlug("Padre Pío")).toBe("padre-pio");
  });
  it("strips apostrophes", () => {
    expect(canonicalizeSlug("Lord's Prayer")).toBe("lords-prayer");
  });
  it("collapses repeated dashes", () => {
    expect(canonicalizeSlug("a -- b")).toBe("a-b");
  });
  it("trims leading and trailing dashes", () => {
    expect(canonicalizeSlug("---hello---")).toBe("hello");
  });
});

describe("normalizeForComparison", () => {
  it("strips the 'Saint' prefix for matching", () => {
    expect(normalizeForComparison("Saint Joseph")).toBe(normalizeForComparison("St. Joseph"));
  });
  it("ignores case and punctuation", () => {
    expect(normalizeForComparison("Our Father")).toBe(normalizeForComparison("our father"));
    expect(normalizeForComparison("Our Father")).toBe(normalizeForComparison("Our, Father."));
  });
});

describe("suggestSlug", () => {
  it("matches canonicalizeSlug", () => {
    expect(suggestSlug("Our Father")).toBe("our-father");
  });
});

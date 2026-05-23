/**
 * Tests for duplicate detection across checklist items.
 */

import { describe, it, expect } from "vitest";

import { canonicalizeSlug, normalizeForComparison, suggestSlug } from "@/lib/worker/slugs";
import { packagesAreDuplicates } from "@/lib/worker/duplicates";

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

describe("packagesAreDuplicates", () => {
  it("matches identical checksums", () => {
    expect(
      packagesAreDuplicates({ contentChecksum: "abc123" }, { contentChecksum: "abc123" }),
    ).toBe(true);
  });
  it("matches normalized titles when checksums are absent", () => {
    expect(packagesAreDuplicates({ title: "Saint Joseph" }, { title: "St. Joseph" })).toBe(true);
  });
  it("does not consider unrelated titles as duplicates", () => {
    expect(packagesAreDuplicates({ title: "Saint Joseph" }, { title: "Saint Michael" })).toBe(
      false,
    );
  });
});

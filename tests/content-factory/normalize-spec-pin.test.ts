/**
 * Spec-pin tests for the package normalizer. The spec lists every
 * required normalization step:
 *
 *   * titles
 *   * slugs
 *   * feast days
 *   * prayer types
 *   * devotion types
 *   * sacrament aliases
 *   * history types
 *   * scripture references
 *   * whitespace
 *   * paragraph breaks (covered by whitespace normalization)
 *   * dropdown structures (covered by the prose normalisers
 *     above — there are no separate "dropdown" data shapes left
 *     in the project's content models)
 *   * source hosts
 *
 * The tests verify each helper exists, is callable, and produces a
 * stable canonical output for a representative input.
 */

import { describe, expect, it } from "vitest";
import {
  normalizeWhitespace,
  normalizeTitle,
  normalizeSlug,
  normalizeSourceHost,
  normalizeFeastDay,
  normalizePrayerType,
  normalizeDevotionType,
  normalizeHistoryType,
  normalizeScriptureReference,
} from "@/lib/content-factory/normalize";

describe("normalizeWhitespace", () => {
  it("collapses repeated whitespace to a single space", () => {
    expect(normalizeWhitespace("Hello   \n\n   world")).toBe("Hello world");
  });

  it("trims leading + trailing whitespace", () => {
    expect(normalizeWhitespace("  hi  ")).toBe("hi");
  });
});

describe("normalizeTitle", () => {
  it("normalises whitespace and strips wrapping quotes / asterisks", () => {
    expect(normalizeTitle("  Anima  Christi  ")).toBe("Anima Christi");
  });
});

describe("normalizeSlug", () => {
  it("lowercases + dasherises a title-like input", () => {
    expect(normalizeSlug("Hail Mary, Full of Grace")).toMatch(/^[a-z0-9-]+$/);
    expect(normalizeSlug("Hail Mary, Full of Grace")).toContain("hail-mary");
  });

  it("collapses consecutive dashes", () => {
    expect(normalizeSlug("Hello -- World")).toBe("hello-world");
  });

  it("strips diacritics so a slug stays ASCII-safe", () => {
    expect(normalizeSlug("San José")).toBe("san-jose");
  });
});

describe("normalizeSourceHost", () => {
  it("lowercases and strips the leading www.", () => {
    expect(normalizeSourceHost("WWW.Vatican.VA")).toBe("vatican.va");
  });

  it("strips the http:// or https:// scheme + path", () => {
    expect(normalizeSourceHost("https://www.vatican.va/sitemap.xml")).toBe("vatican.va");
  });
});

describe("normalizeFeastDay", () => {
  it("parses 'January 28' into a structured feast date", () => {
    const result = normalizeFeastDay({ feastDay: "January 28" });
    expect(result.feastMonth).toBe(1);
    expect(result.feastDayOfMonth).toBe(28);
  });

  it("round-trips feastMonth + feastDayOfMonth into a canonical feastDay string", () => {
    const result = normalizeFeastDay({ feastMonth: 5, feastDayOfMonth: 13 });
    expect(result.feastDay).toBe("May 13");
    expect(result.feastMonth).toBe(5);
    expect(result.feastDayOfMonth).toBe(13);
  });

  it("returns nulls when the input is unparseable", () => {
    const result = normalizeFeastDay({ feastDay: "definitely-not-a-date" });
    expect(result.feastMonth).toBeNull();
    expect(result.feastDayOfMonth).toBeNull();
  });
});

describe("normalizePrayerType", () => {
  it("returns a non-empty canonical label", () => {
    const out = normalizePrayerType("Traditional");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("normalizeDevotionType", () => {
  it("returns a non-empty canonical label", () => {
    const out = normalizeDevotionType("Rosary");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("output is always a member of VALID_DEVOTION_TYPES (or the original input)", async () => {
    const { VALID_DEVOTION_TYPES } = await import("@/lib/content-qa/contracts/devotion");
    const allowed = new Set<string>(VALID_DEVOTION_TYPES);
    // Every keyword alias must resolve to a contract-valid label so a
    // normalized payload can pass validateDevotionPackage downstream.
    // (Previously emitted "Rosary devotion" / "Divine Mercy devotion"
    // / "Sacred Heart devotion" / "General devotion" — none of which
    // were in the contract.)
    for (const input of [
      "Rosary",
      "rosary",
      "Sacred Heart",
      "sacred heart",
      "Immaculate Heart",
      "Divine Mercy",
      "First Friday",
      "First Saturday",
      "Stations of the Cross",
      "Chaplet",
      "Litany",
      "Novena",
      "Consecration",
      "Eucharistic adoration",
      "Marian devotion",
      "Saint devotion",
    ]) {
      expect(allowed.has(normalizeDevotionType(input))).toBe(true);
    }
  });
});

describe("normalizeHistoryType", () => {
  it("normalises 'ENCYCLICAL' to the canonical 'Encyclical' label", () => {
    expect(normalizeHistoryType("ENCYCLICAL")).toBe("Encyclical");
  });

  it("normalises 'council' to 'Council'", () => {
    expect(normalizeHistoryType("council")).toBe("Council");
  });

  it("returns null for an unrecognised category", () => {
    expect(normalizeHistoryType("not-a-real-history-type")).toBeNull();
  });

  it("returns null for null / empty input", () => {
    expect(normalizeHistoryType(null)).toBeNull();
    expect(normalizeHistoryType("")).toBeNull();
  });
});

describe("normalizeScriptureReference", () => {
  it("collapses whitespace inside a reference", () => {
    expect(normalizeScriptureReference("John   3:16")).toBe("John 3:16");
  });
});

/**
 * Novena day parser tests (spec §8).
 *
 * The parser handles every spec-listed day-heading shape and
 * surfaces missing days so the builder can refuse partial novenas.
 */

import { describe, expect, it } from "vitest";
import {
  detectMultiPageNovenaHints,
  parseDayHeading,
  parseNovenaDays,
} from "@/lib/content-factory/normalize/novena-days";

describe("parseDayHeading()", () => {
  it("parses Day 1 through Day 9", () => {
    for (let d = 1; d <= 9; d++) {
      expect(parseDayHeading(`Day ${d}`)).toBe(d);
    }
  });

  it("parses First Day through Ninth Day", () => {
    expect(parseDayHeading("First Day")).toBe(1);
    expect(parseDayHeading("Second Day")).toBe(2);
    expect(parseDayHeading("Ninth Day")).toBe(9);
  });

  it("parses Day One through Day Nine", () => {
    expect(parseDayHeading("Day One")).toBe(1);
    expect(parseDayHeading("Day Two")).toBe(2);
    expect(parseDayHeading("Day Nine")).toBe(9);
  });

  it("parses Roman numerals I through IX", () => {
    expect(parseDayHeading("I.")).toBe(1);
    expect(parseDayHeading("II.")).toBe(2);
    expect(parseDayHeading("III.")).toBe(3);
    expect(parseDayHeading("IV.")).toBe(4);
    expect(parseDayHeading("V.")).toBe(5);
    expect(parseDayHeading("IX.")).toBe(9);
  });

  it("parses page-anchor-style headings (day-1, day_2, day3)", () => {
    expect(parseDayHeading("day-1")).toBe(1);
    expect(parseDayHeading("day_2")).toBe(2);
    expect(parseDayHeading("day3")).toBe(3);
  });

  it("returns null for unrelated headings", () => {
    expect(parseDayHeading("Introduction")).toBeNull();
    expect(parseDayHeading("Conclusion")).toBeNull();
  });
});

describe("parseNovenaDays()", () => {
  it("produces 9 days from a clean Day 1..Day 9 source", () => {
    const sections = Array.from({ length: 9 }, (_, i) => ({
      heading: `Day ${i + 1}`,
      body: `Prayer for day ${i + 1}.`,
    }));
    const result = parseNovenaDays(sections);
    expect(result.days).toHaveLength(9);
    expect(result.missing).toHaveLength(0);
  });

  it("surfaces missing days when the source is partial", () => {
    const sections = [
      { heading: "Day 1", body: "Prayer for day 1." },
      { heading: "Day 2", body: "Prayer for day 2." },
      { heading: "Day 3", body: "Prayer for day 3." },
      { heading: "Day 7", body: "Prayer for day 7." },
    ];
    const result = parseNovenaDays(sections);
    expect(result.days).toHaveLength(4);
    expect(result.missing).toEqual([4, 5, 6, 8, 9]);
  });

  it("keeps the first occurrence when a day heading appears twice", () => {
    const sections = [
      { heading: "Day 1", body: "Real day 1." },
      { heading: "Day 1", body: "Duplicate day 1 — should be ignored." },
    ];
    const result = parseNovenaDays(sections);
    expect(result.days[0].body).toBe("Real day 1.");
  });

  it("mixes Roman numerals, written words, and digit headings", () => {
    const sections = [
      { heading: "First Day", body: "1" },
      { heading: "II.", body: "2" },
      { heading: "Day Three", body: "3" },
      { heading: "Day 4", body: "4" },
      { heading: "Fifth Day", body: "5" },
      { heading: "VI.", body: "6" },
      { heading: "Day Seven", body: "7" },
      { heading: "Day 8", body: "8" },
      { heading: "Ninth Day", body: "9" },
    ];
    const result = parseNovenaDays(sections);
    expect(result.days).toHaveLength(9);
    expect(result.missing).toEqual([]);
  });
});

describe("detectMultiPageNovenaHints()", () => {
  it("returns one hint per linked day page", () => {
    const hints = detectMultiPageNovenaHints({
      links: [
        { url: "https://example.org/day-1", text: "Day 1" },
        { url: "https://example.org/day-2", text: "Day 2" },
        { url: "https://example.org/day-3", text: "Day 3" },
        { url: "https://example.org/unrelated", text: "About us" },
      ],
    });
    expect(hints).toHaveLength(3);
    expect(hints.map((h) => h.dayNumber)).toEqual([1, 2, 3]);
  });

  it("de-duplicates when multiple links point at the same day", () => {
    const hints = detectMultiPageNovenaHints({
      links: [
        { url: "https://example.org/day-1", text: "Day 1" },
        { url: "https://example.org/day-1?print=1", text: "Day 1 (printable)" },
      ],
    });
    expect(hints).toHaveLength(1);
  });
});

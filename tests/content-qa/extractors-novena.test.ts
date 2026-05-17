/**
 * Novena extractor unit tests. Section 8 of the strict QA spec
 * requires a complete Novena extractor that pulls name / background /
 * purpose / duration / Day 1..9 + per-day sections.
 */

import { describe, expect, it } from "vitest";
import { extractNovena } from "@/lib/content-qa/extractors/novena";

describe("extractNovena — happy path", () => {
  it("extracts all nine days from a well-formed novena", () => {
    const body = [
      "This Divine Mercy Novena was given by Jesus to St. Faustina.",
      "Pray it daily for the intention of mercy for the world.",
      "",
      ...Array.from({ length: 9 }, (_, i) => {
        const n = i + 1;
        return [
          `Day ${n}`,
          `The Sufferings of Day ${n}`,
          `Intention: Today we pray for souls suffering in day ${n}.`,
          `Reading: John 3:${16 + n}`,
          `Prayer: Lord Jesus, on this day ${n}, I bring you these souls. Amen.`,
        ].join("\n");
      }),
    ].join("\n\n");

    const result = extractNovena({
      title: "Divine Mercy Novena",
      body,
      sourceUrl: "https://www.thedivinemercy.org/novena",
    });

    expect(result.complete).toBe(true);
    expect(result.payload.novenaName).toBe("Divine Mercy Novena");
    expect(result.payload.background).toMatch(/Divine Mercy/);
    expect(result.payload.purpose).toMatch(/intention\s+of\s+mercy/i);
    expect(result.payload.durationDays).toBe(9);
    expect(result.payload.days).toHaveLength(9);
    expect(result.missingDays).toEqual([]);
    for (let n = 1; n <= 9; n += 1) {
      const day = result.payload.days![n - 1];
      expect(day.dayNumber).toBe(n);
      expect(day.dayPrayer).toBeTruthy();
      expect(day.intention).toBeTruthy();
      expect(day.scriptureReading).toMatch(/john\s*3:/i);
    }
  });

  it("populates provenance for every extracted field", () => {
    const result = extractNovena({
      title: "Saint Joseph Novena",
      body: "A traditional novena to Saint Joseph for the intention of fathers.\n\nDay 1\nJoseph the Father\nPrayer: O Saint Joseph, intercede. Amen.",
      sourceUrl: "https://www.example.com/joseph",
    });
    expect(result.provenance.novenaName).toBeDefined();
    expect(result.provenance.background).toBeDefined();
    expect(result.provenance.sourceUrl).toBe("input");
  });
});

describe("extractNovena — partial / incomplete sources", () => {
  it("marks the result as incomplete when days are missing", () => {
    const body = [
      "Background paragraph here.",
      "Day 1",
      "Prayer: Day 1 prayer.",
      "Day 3",
      "Prayer: Day 3 prayer.",
    ].join("\n\n");
    const result = extractNovena({ title: "Partial Novena", body });
    expect(result.complete).toBe(false);
    expect(result.missingDays).toContain(2);
  });

  it("counts only the highest day-number it saw as the expected duration", () => {
    const body = [
      "Test novena.",
      "Day 1\nPrayer: P1.",
      "Day 2\nPrayer: P2.",
      "Day 3\nPrayer: P3.",
    ].join("\n\n");
    const result = extractNovena({ title: "Three-day Novena", body });
    expect(result.payload.durationDays).toBe(3);
    expect(result.payload.days).toHaveLength(3);
    expect(result.complete).toBe(true);
  });

  it("returns an empty days array when no Day headers are present", () => {
    const result = extractNovena({
      title: "Not a novena",
      body: "This is just a paragraph with no day structure.",
    });
    expect(result.complete).toBe(false);
    expect(result.payload.days).toEqual([]);
    // Default expected duration is 9 when no headers; missingDays = 1..9
    expect(result.missingDays).toHaveLength(9);
  });
});

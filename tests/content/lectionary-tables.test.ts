/**
 * Invariants of the committed lectionary tables
 * (src/lib/content-shared/lectionary/tables/*.json, built by
 * scripts/lectionary/build-tables.ts).
 *
 * The tables are generated data, so the tests here are the contract the build
 * has to keep: every citation parses, every key the calendar engine can emit
 * resolves to a formulary with readings, and identical (key, cycle) pairs map to
 * identical Lectionary numbers — the cross-year consistency rule that catches a
 * source slip or a calendar misplacement.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseCitation } from "@/lib/content-shared/bible/citation";
import { resolveLiturgicalDay } from "@/lib/content-shared/liturgical-calendar";
import {
  LECTIONARY_ATTRIBUTION,
  keyMapEntry,
  lectionaryEntry,
  lectionaryKeys,
  lectionaryNumbers,
  lectionaryTableStats,
  lookupLectionary,
  sanctoralEntriesForDate,
  sectionsForCycles,
  compareLectionaryNumbers,
  READING_ORDER,
  type LectionaryEntry,
} from "@/lib/content-shared/lectionary/index";
import { checkCoverage } from "../../scripts/lectionary/check-coverage";

const TABLE_DIR = path.join(process.cwd(), "src/lib/content-shared/lectionary/tables");

function readTable(file: string): string {
  return readFileSync(path.join(TABLE_DIR, file), "utf8");
}

const entries: LectionaryEntry[] = lectionaryNumbers().map((n) => {
  const entry = lectionaryEntry(n);
  if (!entry) throw new Error(`missing entry ${n}`);
  return entry;
});

describe("lectionary tables", () => {
  it("holds the whole Lectionary for Mass", () => {
    const stats = lectionaryTableStats();
    expect(stats.numbers).toBeGreaterThan(700);
    expect(stats.keys).toBeGreaterThan(400);
    expect(stats.byKind.sunday).toBeGreaterThan(150);
    expect(stats.byKind.weekday).toBeGreaterThan(300);
    expect(stats.byKind.sanctoral).toBeGreaterThan(150);
  });

  it("carries citations and labels only — never Scripture text", () => {
    for (const entry of entries) {
      for (const section of entry.sections) {
        // A citation is short and has no prose: books are capitalised, and the
        // only lower-case words a citation may contain are "cf.", "or" and "and".
        expect(section.citation.length, `#${entry.number} ${section.citation}`).toBeLessThan(120);
        expect(section.citation, `#${entry.number}`).toMatch(/\d/);
        expect(section.citation, `#${entry.number}`).not.toMatch(/\b[a-z]{4,}\b/);
      }
    }
  });

  it("every citation parses with the citation parser", () => {
    const unparsed: string[] = [];
    for (const entry of entries) {
      for (const section of entry.sections) {
        if (!parseCitation(section.citation)) unparsed.push(`#${entry.number} ${section.citation}`);
      }
    }
    expect(unparsed).toEqual([]);
  });

  it("keeps sections in proclamation order and one per kind per cycle", () => {
    for (const entry of entries) {
      const seen = new Set<string>();
      let rank = -1;
      for (const section of entry.sections) {
        const id = `${section.kind}|${section.cycle ?? ""}`;
        expect(seen.has(id), `#${entry.number} duplicate ${id}`).toBe(false);
        seen.add(id);
        const next = READING_ORDER.indexOf(section.kind);
        expect(next, `#${entry.number} out of order`).toBeGreaterThanOrEqual(rank);
        rank = next;
      }
    }
  });
});

describe("key map", () => {
  it("maps every key to formularies that exist in the table", () => {
    for (const key of lectionaryKeys()) {
      for (const cycle of [undefined, "A", "B", "C"] as const) {
        const row = keyMapEntry(key, cycle);
        expect(row, key).not.toBeNull();
        expect(row?.masses.length, key).toBeGreaterThan(0);
        for (const mass of row?.masses ?? []) {
          expect(lectionaryEntry(mass.number), `${key} → #${mass.number}`).not.toBeNull();
        }
      }
    }
  });

  it("gives identical (key, cycle) pairs identical numbers", () => {
    const map = JSON.parse(readTable("key-map.json")) as Record<
      string,
      Array<{ cycle: string | null; masses: Array<{ number: string; variant: string | null }> }>
    >;
    for (const [key, rows] of Object.entries(map)) {
      const cycles = rows.map((row) => row.cycle);
      // Either one row for every year, or one row per Sunday cycle — never both,
      // and never the same cycle twice, so a (key, cycle) lookup is single-valued.
      expect(new Set(cycles).size, key).toBe(cycles.length);
      if (cycles.length > 1) expect(cycles, key).not.toContain(null);
      for (const row of rows) {
        const ids = row.masses.map((m) => `${m.number}|${m.variant ?? ""}`);
        expect(new Set(ids).size, key).toBe(ids.length);
        // The principal Mass is first: no later entry may be the plain formulary.
        expect(
          row.masses.slice(1).every((m) => m.variant !== null),
          key,
        ).toBe(true);
      }
    }
  });

  it("resolves the Mass formularies of Christmas in the Lectionary's own order", () => {
    const day = lookupLectionary("nativity");
    expect(day?.number).toBe("16");
    expect(day?.variant).toBe("day");
    expect(day?.masses.map((m) => m.variant)).toEqual(["day", "dawn", "night", "vigil"]);
    expect(lookupLectionary("nativity", { variant: "vigil" })?.number).toBe("13");
    expect(lookupLectionary("nativity", { variant: "no-such-mass" })).toBeNull();
  });

  it("keeps the Year A scrutiny readings as an alternative, not the principal Mass", () => {
    expect(lookupLectionary("lent-3-sunday", { sundayCycle: "A" })?.number).toBe("28");
    expect(lookupLectionary("lent-3-sunday", { sundayCycle: "B" })?.number).toBe("29");
    expect(lookupLectionary("lent-3-sunday", { sundayCycle: "C" })?.number).toBe("30");
    expect(lookupLectionary("lent-3-sunday", { sundayCycle: "C", variant: "year-a" })?.number).toBe(
      "28",
    );
  });

  it("returns null for a key it does not know, rather than guessing", () => {
    expect(lookupLectionary("not-a-liturgical-day")).toBeNull();
  });
});

describe("cycle resolution", () => {
  it("prefers a cycle-specific section over the shared one", () => {
    const week1Monday = lectionaryEntry("305");
    expect(week1Monday).not.toBeNull();
    const yearI = sectionsForCycles(week1Monday as LectionaryEntry, { weekdayCycle: "I" });
    const yearII = sectionsForCycles(week1Monday as LectionaryEntry, { weekdayCycle: "II" });
    expect(yearI.find((s) => s.kind === "FIRST_READING")?.citation).toBe("Heb 1:1-6");
    expect(yearII.find((s) => s.kind === "FIRST_READING")?.citation).toBe("1 Sm 1:1-8");
    // The Gospel of an Ordinary-Time weekday is the same in both years.
    expect(yearI.find((s) => s.kind === "GOSPEL")?.citation).toBe(
      yearII.find((s) => s.kind === "GOSPEL")?.citation,
    );
  });

  it("resolves a real day end to end", () => {
    // Easter Sunday 2026 (Year A) — Lectionary 42.
    const day = resolveLiturgicalDay(new Date("2026-04-05T00:00:00Z"), { calendar: "roman-us" });
    const lookup = lookupLectionary(day.lectionaryKey, {
      sundayCycle: day.sundayCycle,
      weekdayCycle: day.weekdayCycle,
    });
    expect(lookup?.number).toBe("42");
    expect(lookup?.sections.map((s) => s.kind)).toEqual([
      "FIRST_READING",
      "PSALM",
      "SECOND_READING",
      "ACCLAMATION",
      "GOSPEL",
    ]);
    expect(lookup?.sections[0].citation).toBe("Acts 10:34a, 37-43");
  });

  it("indexes the Proper of Saints by its calendar date", () => {
    expect(sanctoralEntriesForDate(12, 26).map((e) => e.number)).toContain("696");
    expect(sanctoralEntriesForDate(2, 30)).toEqual([]);
  });
});

describe("coverage", () => {
  it("resolves every (key, cycle) the engine can emit for 2020-2100", () => {
    const result = checkCoverage(2020, 2100);
    expect(result.combinations).toBeGreaterThan(2000);
    expect(result.missingCombinations).toEqual([]);
    expect(result.missingKeys).toEqual([]);
    // Every day must have a first reading, a psalm and a Gospel.
    expect(result.withoutGospel).toEqual([]);
    expect(result.sectionCounts.FIRST_READING).toBe(result.combinations);
    expect(result.sectionCounts.PSALM).toBe(result.combinations);
    expect(result.sectionCounts.GOSPEL).toBe(result.combinations);
    // The Alleluia of a handful of formularies has no biblical reference at all
    // (Christmas Day, several Advent weekdays); the rest must have one.
    expect(result.sectionCounts.ACCLAMATION / result.combinations).toBeGreaterThan(0.85);
  });
});

describe("determinism", () => {
  it("writes every table with sorted keys and a trailing newline", () => {
    for (const file of [
      "by-number.json",
      "key-map.json",
      "sundays.json",
      "weekdays.json",
      "sanctoral.json",
    ]) {
      const text = readTable(file);
      expect(text.endsWith("\n"), file).toBe(true);
      // Read the keys out of the TEXT: JSON.parse would reorder them, because a
      // JS object lists its integer-like keys first ("510" before "510/1").
      const keys = [...text.matchAll(/^ {2}"((?:[^"\\]|\\.)*)":/gm)].map((m) => m[1]);
      expect(keys.length, file).toBeGreaterThan(100);
      const sorted =
        file === "by-number.json" ? [...keys].sort(compareLectionaryNumbers) : [...keys].sort();
      expect(keys, file).toEqual(sorted);
    }
  });

  it("credits both sources the tables are built from", () => {
    expect(LECTIONARY_ATTRIBUTION.map((a) => a.source)).toEqual(["usccb", "catholic-resources"]);
    expect(LECTIONARY_ATTRIBUTION[1].note).toContain("Rev. Felix Just, S.J.");
  });
});

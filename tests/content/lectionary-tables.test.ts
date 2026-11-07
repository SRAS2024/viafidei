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
import { temporalLectionaryNumbers } from "../../scripts/lectionary/calendar-check-lib";
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
      // Named sections are a sequence of their own (the Easter Vigil's nine readings).
      if (entry.sections.some((s) => s.label)) continue;
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

describe("formularies that do not fit one reading per kind", () => {
  const vigilOf = (sundayCycle: "A" | "B" | "C") =>
    lookupLectionary("easter-vigil", { sundayCycle })?.sections ?? [];

  it("gives the Easter Vigil seven readings, the Epistle, their psalms and the year's Gospel", () => {
    const sections = vigilOf("B");
    expect(sections.filter((s) => s.kind !== "PSALM").map((s) => s.label ?? s.kind)).toEqual([
      "First Reading",
      "Second Reading",
      "Third Reading",
      "Fourth Reading",
      "Fifth Reading",
      "Sixth Reading",
      "Seventh Reading",
      "Epistle",
      "GOSPEL",
    ]);
    expect(sections.filter((s) => s.kind === "PSALM")).toHaveLength(8);
    // In the order it is proclaimed, with a psalm after each reading.
    expect(sections.map((s) => s.kind).slice(0, 4)).toEqual([
      "FIRST_READING",
      "PSALM",
      "SECOND_READING",
      "PSALM",
    ]);
    expect(sections.at(-1)?.citation).toBe("Mk 16:1-7");
    expect(vigilOf("A").at(-1)?.citation).toBe("Mt 28:1-10");
    expect(vigilOf("C").at(-1)?.citation).toBe("Lk 24:1-12");
  });

  it("splits Palm Sunday's Procession from its Mass", () => {
    const mass = lookupLectionary("palm-sunday", { sundayCycle: "A" });
    expect(mass?.number).toBe("38");
    expect(mass?.sections.find((s) => s.kind === "GOSPEL")?.citation).toBe(
      "Mt 26:14—27:66 or Mt 27:11-54",
    );
    const procession = lookupLectionary("palm-sunday", { sundayCycle: "A", variant: "procession" });
    expect(procession?.number).toBe("37");
    expect(procession?.sections.map((s) => [s.kind, s.citation])).toEqual([
      ["GOSPEL", "Mt 21:1-11"],
    ]);
  });

  it("offers Pentecost's Vigil and Extended Vigil in every year", () => {
    for (const sundayCycle of ["A", "B", "C"] as const) {
      expect(lookupLectionary("pentecost", { sundayCycle })?.masses.map((m) => m.variant)).toEqual([
        "day",
        "vigil",
        "extended-vigil",
      ]);
    }
    const extended = lookupLectionary("pentecost", { variant: "extended-vigil" });
    expect(extended?.sections.filter((s) => s.kind === "PSALM")).toHaveLength(4);
    expect(extended?.sections.at(-1)?.citation).toBe("Jn 7:37-39");
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

  it("files every Proper-of-Time weekday under the number its week and day give it", () => {
    // The numbers of the Proper of Time are arithmetic, so a slip in a dated source
    // cannot quietly send a weekday to the wrong day's readings.
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2040, 11, 31);
    const wrong: string[] = [];
    for (let t = start; t <= end; t += 86_400_000) {
      const day = resolveLiturgicalDay(new Date(t), { calendar: "roman-us" });
      const expected = temporalLectionaryNumbers(day.temporalKey, day.sundayCycle);
      if (expected.length === 0 || day.lectionaryKey !== day.temporalKey) continue;
      if (
        !/^(ordinary|advent|lent|easter)-\d+-(mon|tues|wednes|thurs|fri|satur)day$/.test(
          day.temporalKey,
        )
      ) {
        continue;
      }
      const number = keyMapEntry(day.temporalKey, day.sundayCycle)?.masses[0].number;
      if (!expected.includes(Number(number)))
        wrong.push(`${day.date} ${day.temporalKey} → #${number}`);
    }
    expect(wrong).toEqual([]);
  });

  it("gives every Ordinary-Time weekday a psalm for each year, and they differ", () => {
    let differing = 0;
    for (const n of lectionaryNumbers()) {
      const number = Number.parseInt(n, 10);
      if (number < 305 || number > 508 || String(number) !== n) continue;
      const entry = lectionaryEntry(n) as LectionaryEntry;
      const psalm = (weekdayCycle: "I" | "II") =>
        sectionsForCycles(entry, { weekdayCycle }).find((s) => s.kind === "PSALM")?.citation;
      expect(psalm("I"), `#${n} Year I`).toBeTruthy();
      expect(psalm("II"), `#${n} Year II`).toBeTruthy();
      if (psalm("I") !== psalm("II")) differing += 1;
    }
    // A handful share a psalm; if most did, the two years have collapsed into one.
    expect(differing).toBeGreaterThan(180);
  });

  it("keeps a weekday on its own readings whatever the Sunday cycle", () => {
    // 2029-05-10 is a Year A Thursday of the 6th week of Easter: #294, not the
    // Ascension that the USCCB page also lists for the Thursday provinces.
    expect(lookupLectionary("easter-6-thursday", { sundayCycle: "A" })?.number).toBe("294");
    // A Year A slip in the dated source once filed this Tuesday under Monday's #317.
    expect(lookupLectionary("ordinary-4-tuesday", { sundayCycle: "A" })?.number).toBe("324");
    expect(lookupLectionary("our-lady-of-guadalupe", { sundayCycle: "C" })?.number).toBe("690A");
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

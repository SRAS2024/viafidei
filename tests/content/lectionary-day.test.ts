/**
 * Golden-set verification of the precise Proper-of-Time resolver
 * (`resolveLiturgicalDay`) for the General Roman Calendar.
 *
 * Every assertion is an EXTERNALLY verifiable fact, not a value read back from
 * the implementation:
 *   - moveable feasts are pure Easter arithmetic (Ascension = Easter + 39,
 *     Pentecost = Easter + 49, Trinity = +56, Corpus Christi = +60 (Thu),
 *     Sacred Heart = +68 (Fri));
 *   - the fixed anchors (Advent begins, Nativity, Epiphany, Baptism) are
 *     published calendar dates.
 * This is the precision proof: the engine must reproduce the real calendar, so
 * a verified lectionary table can be keyed on `lectionaryKey` with confidence.
 */

import { describe, expect, it } from "vitest";

import { resolveLiturgicalDay } from "@/lib/content-shared/liturgical-calendar";

const at = (iso: string) => resolveLiturgicalDay(new Date(`${iso}T00:00:00Z`));
const key = (iso: string) => at(iso).lectionaryKey;

describe("resolveLiturgicalDay — Proper of Time (General Roman Calendar)", () => {
  it("Easter-anchored solemnities (2025, Easter Sunday = 20 Apr)", () => {
    expect(key("2025-04-13")).toBe("palm-sunday"); // Easter − 7
    expect(key("2025-04-14")).toBe("holy-week-monday");
    expect(key("2025-04-16")).toBe("holy-week-wednesday");
    expect(key("2025-04-17")).toBe("holy-thursday");
    expect(key("2025-04-18")).toBe("good-friday");
    expect(key("2025-04-19")).toBe("easter-vigil");
    expect(key("2025-04-20")).toBe("easter-sunday");
    expect(key("2025-04-22")).toBe("easter-octave-tuesday");
    expect(key("2025-04-27")).toBe("easter-2-sunday"); // Divine Mercy
    expect(key("2025-05-29")).toBe("ascension"); // Easter + 39 (Thu)
    expect(key("2025-06-08")).toBe("pentecost"); // Easter + 49
    expect(key("2025-06-15")).toBe("trinity-sunday"); // Easter + 56
    expect(key("2025-06-19")).toBe("corpus-christi"); // Easter + 60 (Thu)
    expect(key("2025-06-27")).toBe("sacred-heart"); // Easter + 68 (Fri)
  });

  it("Lent 2025 (Ash Wednesday = 5 Mar, 1st Sunday = 9 Mar)", () => {
    expect(key("2025-03-05")).toBe("ash-wednesday");
    expect(key("2025-03-06")).toBe("lent-after-ashes-thursday");
    expect(key("2025-03-09")).toBe("lent-1-sunday");
    expect(key("2025-03-14")).toBe("lent-1-friday");
    expect(key("2025-04-06")).toBe("lent-5-sunday"); // Easter − 14
  });

  it("matches the published moveable feasts for 2026 (Easter = 5 Apr)", () => {
    expect(key("2026-02-18")).toBe("ash-wednesday"); // Easter − 46
    expect(key("2026-04-05")).toBe("easter-sunday");
    expect(key("2026-05-14")).toBe("ascension"); // Easter + 39
    expect(key("2026-05-24")).toBe("pentecost"); // Easter + 49
  });

  it("Advent and Christ the King (the 34th and last Sunday of Ordinary Time)", () => {
    // Advent 2024 begins 1 Dec; Christ the King is the Sunday before = 24 Nov.
    expect(key("2024-11-24")).toBe("christ-the-king");
    expect(at("2024-11-24").rank).toBe("SOLEMNITY");
    expect(at("2024-11-24").weekOfSeason).toBe(34);
    expect(key("2024-12-01")).toBe("advent-1-sunday");
    expect(key("2024-12-22")).toBe("advent-4-sunday");
    // Advent 2025 begins 30 Nov; Christ the King = 23 Nov.
    expect(key("2025-11-23")).toBe("christ-the-king");
    expect(key("2025-11-30")).toBe("advent-1-sunday");
    expect(key("2025-12-17")).toBe("advent-weekday-1217"); // O Antiphons, keyed by date
  });

  it("applies the sanctoral overlay for principal fixed-date solemnities", () => {
    expect(key("2025-08-15")).toBe("assumption"); // Friday, Ordinary Time
    expect(key("2025-11-01")).toBe("all-saints"); // Saturday
    expect(key("2025-12-08")).toBe("immaculate-conception"); // Monday of Advent
    expect(at("2025-08-15").rank).toBe("SOLEMNITY");
    expect(at("2025-08-15").color).toBe("White");
    // Precedence: 8 Dec 2024 is the 2nd Sunday of Advent, which outranks the
    // Immaculate Conception (it transfers), so the temporal Sunday wins.
    expect(key("2024-12-08")).toBe("advent-2-sunday");
  });

  it("Christmas season (keyed by date) + its solemnities and feasts", () => {
    expect(key("2024-12-25")).toBe("nativity");
    expect(key("2024-12-29")).toBe("holy-family"); // first Sunday after Christmas 2024
    expect(key("2025-01-01")).toBe("mary-mother-of-god");
    expect(key("2025-01-06")).toBe("epiphany");
    expect(key("2025-01-12")).toBe("baptism-of-the-lord"); // Sunday after Epiphany
  });

  it("Ordinary Time numbering — forward from the Baptism of the Lord", () => {
    // Baptism 2025 = 12 Jan, so the next Sunday is the 2nd Sunday in OT.
    expect(key("2025-01-19")).toBe("ordinary-2-sunday");
    expect(key("2025-01-21")).toBe("ordinary-2-tuesday");
    expect(at("2025-01-19").weekOfSeason).toBe(2);
  });

  it("carries the correct lectionary cycle letters", () => {
    // The liturgical year that began in Advent 2024 is Year C, weekdays Year I.
    const sun = at("2025-01-19");
    expect(sun.sundayCycle).toBe("C");
    expect(sun.weekdayCycle).toBe("I");
    expect(sun.isSunday).toBe(true);
    // The following liturgical year (Advent 2025–) is Year A, weekdays Year II.
    expect(at("2025-11-30").sundayCycle).toBe("A");
    expect(at("2025-11-30").weekdayCycle).toBe("II");
  });
});

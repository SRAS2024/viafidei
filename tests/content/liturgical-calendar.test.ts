import { describe, expect, it } from "vitest";

import {
  easterSunday,
  isJubileeYear,
  liturgicalColor,
  liturgicalDay,
  liturgicalSeasonFor,
  sundayCycle,
  usccbReadingsUrl,
  weekdayCycle,
} from "@/lib/content-shared/liturgical-calendar";

const day = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

describe("easterSunday (Computus)", () => {
  it("matches known Gregorian Easter dates", () => {
    expect(easterSunday(2000)).toEqual({ month: 4, day: 23 });
    expect(easterSunday(2023)).toEqual({ month: 4, day: 9 });
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
  });
});

describe("liturgicalSeasonFor (2026, Easter = April 5)", () => {
  const cases: Array<[string, string]> = [
    ["2026-01-01", "christmas"],
    ["2026-01-11", "christmas"], // Baptism of the Lord closes Christmas
    ["2026-01-12", "ordinary"],
    ["2026-02-17", "ordinary"],
    ["2026-02-18", "lent"], // Ash Wednesday
    ["2026-04-02", "triduum"], // Holy Thursday
    ["2026-04-03", "triduum"], // Good Friday
    ["2026-04-05", "easter"], // Easter Sunday
    ["2026-05-24", "easter"], // Pentecost
    ["2026-05-25", "ordinary"],
    ["2026-07-01", "ordinary"],
    ["2026-11-28", "ordinary"],
    ["2026-11-29", "advent"], // First Sunday of Advent
    ["2026-12-25", "christmas"],
  ];
  it.each(cases)("%s → %s", (date, season) => {
    expect(liturgicalSeasonFor(day(date))).toBe(season);
  });
});

describe("liturgicalColor", () => {
  it("uses the season colour, with Good Friday red", () => {
    expect(liturgicalColor(day("2026-07-01"))).toBe("Green"); // Ordinary
    expect(liturgicalColor(day("2026-02-18"))).toBe("Violet"); // Lent
    expect(liturgicalColor(day("2026-04-05"))).toBe("White"); // Easter
    expect(liturgicalColor(day("2026-04-02"))).toBe("White"); // Holy Thursday
    expect(liturgicalColor(day("2026-04-03"))).toBe("Red"); // Good Friday
  });
});

describe("lectionary cycles", () => {
  it("gives the Sunday cycle, flipping at the First Sunday of Advent", () => {
    expect(sundayCycle(day("2025-03-01"))).toBe("C"); // liturgical year began Advent 2024
    expect(sundayCycle(day("2026-07-01"))).toBe("A"); // began Advent 2025
    expect(sundayCycle(day("2026-11-29"))).toBe("B"); // began Advent 2026
  });

  it("gives the weekday cycle (I odd / II even liturgical years)", () => {
    expect(weekdayCycle(day("2025-03-01"))).toBe("I"); // liturgical year 2025
    expect(weekdayCycle(day("2026-07-01"))).toBe("II"); // liturgical year 2026
    expect(weekdayCycle(day("2026-11-29"))).toBe("I"); // liturgical year 2027
  });
});

describe("isJubileeYear", () => {
  it("marks ordinary jubilees every 25 years", () => {
    expect(isJubileeYear(2000)).toBe(true);
    expect(isJubileeYear(2025)).toBe(true);
    expect(isJubileeYear(2050)).toBe(true);
    expect(isJubileeYear(2026)).toBe(false);
    expect(isJubileeYear(2024)).toBe(false);
  });
});

describe("usccbReadingsUrl", () => {
  it("builds the MMDDYY USCCB daily-readings URL", () => {
    expect(usccbReadingsUrl(day("2026-07-01"))).toBe(
      "https://bible.usccb.org/bible/readings/070126.cfm",
    );
    expect(usccbReadingsUrl(day("2026-12-25"))).toBe(
      "https://bible.usccb.org/bible/readings/122526.cfm",
    );
  });
});

describe("liturgicalDay", () => {
  it("bundles the full description and is timezone-safe", () => {
    expect(liturgicalDay(day("2025-04-20"))).toEqual({
      date: "2025-04-20",
      season: "easter",
      seasonLabel: "Easter",
      color: "White",
      sundayCycle: "C",
      weekdayCycle: "I",
      isJubileeYear: true,
    });
  });

  it("normalises away the time of day", () => {
    expect(liturgicalDay(new Date("2026-07-01T23:30:00Z")).date).toBe("2026-07-01");
  });
});

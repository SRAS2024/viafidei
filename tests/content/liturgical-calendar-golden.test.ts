/**
 * Golden-set verification of the liturgical-calendar engine — the fixes for
 * audit findings CAL-1…CAL-7 — against EXTERNALLY verifiable facts:
 *   - the General Roman Calendar (Universal Norms on the Liturgical Year and
 *     the Calendar) and the calendar of the Dioceses of the United States
 *     (USCCB annual liturgical calendars);
 *   - an exhaustive agreement check, for every date 2023-01-01 … 2027-10-31,
 *     against the celebration titles and Lectionary numbers of the USCCB daily
 *     readings pages (tests/content/fixtures/usccb-daily-readings-titles-2023-2027.json,
 *     derived from the westhong/catholic-daily-readings dataset, MIT).
 */

import { describe, expect, it } from "vitest";

import {
  resolveLiturgicalDay,
  sanctoralEntries,
  SANCTORAL,
  type LiturgicalCalendarOptions,
} from "@/lib/content-shared/liturgical-calendar";

import {
  expectedLectionaryNumbers,
  judge,
  type SourceDay,
} from "../../scripts/lectionary/calendar-check-lib";
import fixture from "./fixtures/usccb-daily-readings-titles-2023-2027.json";

const GENERAL: LiturgicalCalendarOptions = { calendar: "roman-general" };
const US: LiturgicalCalendarOptions = { calendar: "roman-us" };

const at = (iso: string, opts: LiturgicalCalendarOptions = US) =>
  resolveLiturgicalDay(new Date(`${iso}T00:00:00Z`), opts);
const key = (iso: string, opts: LiturgicalCalendarOptions = US) => at(iso, opts).lectionaryKey;

describe("CAL-1 — the Baptism of the Lord and the start of Ordinary Time", () => {
  it("general calendar: the Sunday after 6 January, even when 6 January is a Sunday", () => {
    expect(key("2019-01-06", GENERAL)).toBe("epiphany");
    expect(key("2019-01-13", GENERAL)).toBe("baptism-of-the-lord");
    expect(key("2030-01-13", GENERAL)).toBe("baptism-of-the-lord");
    expect(key("2019-01-20", GENERAL)).toBe("ordinary-2-sunday");
    expect(key("2019-01-14", GENERAL)).toBe("ordinary-1-monday");
    // Never a "0th" week.
    expect(key("2019-01-08", GENERAL)).toBe("after-epiphany-tuesday");
  });

  it("US: Epiphany on the Sunday 2–8 Jan; Baptism on Monday when Epiphany is 7/8 Jan", () => {
    expect(key("2024-01-07")).toBe("epiphany");
    expect(key("2024-01-08")).toBe("baptism-of-the-lord");
    expect(key("2024-01-09")).toBe("ordinary-1-tuesday");
    expect(key("2024-01-14")).toBe("ordinary-2-sunday");
    expect(key("2023-01-08")).toBe("epiphany");
    expect(key("2023-01-09")).toBe("baptism-of-the-lord");
    expect(key("2023-01-10")).toBe("ordinary-1-tuesday");
    // Epiphany 4 Jan 2026 → Baptism the following Sunday.
    expect(key("2026-01-04")).toBe("epiphany");
    expect(key("2026-01-11")).toBe("baptism-of-the-lord");
    expect(key("2026-01-12")).toBe("ordinary-1-monday");
    expect(key("2027-01-03")).toBe("epiphany");
    expect(key("2027-01-10")).toBe("baptism-of-the-lord");
  });
});

describe("CAL-2 / CAL-3 — Christmas-season keys", () => {
  it("weekdays after Epiphany are keyed by weekday name", () => {
    expect(key("2026-01-08")).toBe("after-epiphany-thursday");
    expect(key("2027-01-08")).toBe("after-epiphany-friday");
    expect(key("2028-01-08")).toBe("after-epiphany-saturday");
    expect(key("2026-01-08", GENERAL)).toBe("after-epiphany-thursday");
  });

  it("weekdays before Epiphany and in the octave are keyed by date", () => {
    expect(key("2025-12-29")).toBe("christmas-1229");
    expect(key("2025-12-31")).toBe("christmas-1231");
    expect(key("2026-01-03")).toBe("christmas-0103");
    expect(key("2023-01-07")).toBe("christmas-0107"); // the day before a US Epiphany on 8 Jan
    expect(key("2024-01-06")).toBe("christmas-0106"); // 6 Jan is a weekday in the US
    expect(key("2024-01-06", GENERAL)).toBe("epiphany");
  });

  it("a Sunday 2–5 Jan is the 2nd Sunday after the Nativity (general) / Epiphany (US)", () => {
    expect(key("2022-01-02", GENERAL)).toBe("christmas-2-sunday");
    expect(at("2022-01-02", GENERAL).rank).toBe("SUNDAY");
    expect(key("2022-01-02")).toBe("epiphany");
    expect(key("2033-01-02", GENERAL)).toBe("christmas-2-sunday");
    // The weekday key is never reused for that Sunday.
    expect(key("2023-01-02")).toBe("christmas-0102");
  });
});

describe("CAL-7 — US variant of the Easter-anchored solemnities", () => {
  it.each([
    ["2025", "2025-05-29", "2025-06-01", "2025-06-19", "2025-06-22"],
    ["2026", "2026-05-14", "2026-05-17", "2026-06-04", "2026-06-07"],
    ["2027", "2027-05-06", "2027-05-09", "2027-05-27", "2027-05-30"],
  ])(
    "%s: Ascension and Corpus Christi on Sunday (US) vs Thursday (general)",
    (_y, ascThu, ascSun, ccThu, ccSun) => {
      expect(key(ascThu, GENERAL)).toBe("ascension");
      expect(key(ascSun, GENERAL)).toBe("easter-7-sunday");
      expect(key(ccThu, GENERAL)).toBe("corpus-christi");
      expect(key(ccSun, GENERAL)).toMatch(/^ordinary-\d+-sunday$/);

      expect(key(ascSun)).toBe("ascension");
      expect(key(ascThu)).toMatch(/^(easter-6-thursday|st-matthias)$/);
      expect(key(ccSun)).toBe("corpus-christi");
      expect(key(ccThu)).toMatch(/^ordinary-\d+-thursday$/);
    },
  );

  it("keeps the Ascension on Thursday for the provinces that do", () => {
    const thu = { calendar: "roman-us", ascensionOnThursday: true } as const;
    expect(key("2026-05-14", thu)).toBe("ascension");
    expect(key("2026-05-17", thu)).toBe("easter-7-sunday");
    expect(at("2026-05-14", thu).isHolyDayOfObligation).toBe(true);
    expect(at("2026-05-17").isHolyDayOfObligation).toBe(false);
  });

  it("US proper feasts and memorials", () => {
    expect(key("2025-12-12")).toBe("our-lady-of-guadalupe");
    expect(at("2025-12-12").rank).toBe("FEAST");
    expect(key("2025-12-12", GENERAL)).toBe("advent-2-friday");
    expect(key("2027-12-12")).toBe("advent-3-sunday"); // omitted on an Advent Sunday
    expect(at("2026-01-05").celebration).toBe("Saint John Neumann, Bishop");
    expect(key("2026-01-05")).toBe("after-epiphany-monday"); // ferial readings
    expect(at("2026-01-22").celebration).toMatch(/Unborn Children/);
    expect(at("2023-01-23").celebration).toMatch(/Unborn Children/); // 22 Jan 2023 is a Sunday
    // Independence Day / Thanksgiving carry optional Masses only: ferial.
    expect(key("2026-07-04")).toBe("ordinary-13-saturday");
    expect(at("2026-07-04").rank).toBe("WEEKDAY");
    expect(key("2026-11-26")).toBe("ordinary-34-thursday");
  });
});

describe("CAL-4 / CAL-5 — the sanctoral table and the Table of Liturgical Days", () => {
  it("solemnities and feasts of the Lord outrank Ordinary-Time Sundays", () => {
    expect(key("2025-11-02")).toBe("all-souls");
    expect(at("2025-11-02").rank).toBe("COMMEMORATION");
    expect(key("2025-11-09")).toBe("lateran-basilica");
    expect(key("2025-06-29")).toBe("sts-peter-and-paul");
    expect(at("2025-06-29").color).toBe("Red");
    expect(key("2025-02-02")).toBe("presentation");
    expect(key("2023-08-06")).toBe("transfiguration");
    expect(key("2025-09-14")).toBe("exaltation-of-the-cross");
    // Other feasts lose to Sundays and are omitted that year.
    expect(key("2025-11-30")).toBe("advent-1-sunday"); // St Andrew
    expect(key("2023-05-14")).toBe("easter-6-sunday"); // St Matthias
    expect(key("2026-05-31")).toBe("trinity-sunday"); // the Visitation
  });

  it("feasts beat Lent weekdays; memorials lose to Lent, 17–24 Dec and the octave", () => {
    expect(key("2027-02-22")).toBe("chair-of-st-peter"); // Monday of the 2nd week of Lent
    expect(key("2023-02-22")).toBe("ash-wednesday"); // Chair of Peter omitted
    expect(at("2025-03-07").rank).toBe("WEEKDAY"); // Perpetua & Felicity in Lent
    expect(at("2025-12-13").rank).toBe("MEMORIAL"); // St Lucy, Advent before the 17th
    expect(key("2025-12-13")).toBe("advent-2-saturday");
    expect(at("2028-12-14").celebration).toMatch(/John of the Cross/);
    expect(at("2025-04-29").celebration).toMatch(/Catherine of Siena/); // Easter weekday
    expect(at("2024-04-02").rank).toBe("SOLEMNITY"); // Easter octave beats everything
    expect(key("2024-04-02")).toBe("easter-octave-tuesday");
  });

  it("Dec 26–28 are feasts; the Holy Family Sunday wins over them", () => {
    expect(key("2025-12-26")).toBe("st-stephen");
    expect(at("2025-12-26").color).toBe("Red");
    expect(at("2025-12-26").temporalKey).toBe("christmas-1226");
    expect(key("2025-12-27")).toBe("st-john-apostle");
    expect(key("2026-12-28")).toBe("holy-innocents");
    expect(key("2021-12-26")).toBe("holy-family"); // Christmas on Saturday
    expect(key("2022-12-30")).toBe("holy-family"); // Christmas on Sunday → Friday 30 Dec
    expect(key("2025-12-28")).toBe("holy-family");
  });

  it("memorials: celebration and colour change, readings stay ferial unless proper", () => {
    const agnes = at("2025-01-21");
    expect(agnes.rank).toBe("MEMORIAL");
    expect(agnes.celebration).toBe("Saint Agnes, Virgin and Martyr");
    expect(agnes.color).toBe("Red");
    expect(agnes.lectionaryKey).toBe("ordinary-2-tuesday");
    expect(agnes.temporalKey).toBe("ordinary-2-tuesday");
    expect(agnes.sanctoral?.readings).toBe("ferial");

    const timothy = at("2026-01-26");
    expect(timothy.lectionaryKey).toBe("sts-timothy-and-titus");
    expect(timothy.temporalKey).toBe("ordinary-3-monday");
    expect(timothy.sanctoral?.readings).toBe("proper");

    const martha = at("2025-07-29");
    expect(martha.lectionaryKey).toBe("sts-martha-mary-and-lazarus");
    expect(martha.sanctoral?.readings).toBe("proper-gospel");
    expect(at("2025-09-15").lectionaryKey).toBe("our-lady-of-sorrows");
    expect(at("2025-10-02").lectionaryKey).toBe("guardian-angels");
  });

  it("moveable memorials: Mother of the Church (Monday after Pentecost), Immaculate Heart", () => {
    expect(key("2026-05-25")).toBe("mary-mother-of-the-church");
    expect(key("2028-06-05")).toBe("mary-mother-of-the-church"); // prevails over St Boniface
    expect(key("2023-06-17")).toBe("immaculate-heart");
    // Colliding with another obligatory memorial, both become optional → weekday.
    expect(at("2026-06-13").rank).toBe("WEEKDAY");
    expect(at("2027-06-05").rank).toBe("WEEKDAY");
    expect(key("2025-06-28")).toBe("ordinary-12-saturday"); // vs St Irenaeus
    // Colliding with a solemnity it is simply omitted.
    expect(key("2028-06-24")).toBe("nativity-of-john-the-baptist");
  });

  it("the table covers the General Roman Calendar and the US proper", () => {
    const general = sanctoralEntries("roman-general");
    const us = sanctoralEntries("roman-us");
    const count = (entries: readonly { rank: string; ofTheLord?: boolean }[], rank: string) =>
      entries.filter((e) => e.rank === rank).length;
    // 7 solemnities + All Souls + 4 feasts of the Lord + 20 feasts + 67 obligatory memorials.
    expect(count(general, "SOLEMNITY")).toBe(7);
    expect(count(general, "COMMEMORATION")).toBe(1);
    expect(count(general, "FEAST")).toBe(24);
    expect(count(general, "MEMORIAL")).toBe(67);
    expect(general.length).toBe(99);
    // US proper: Our Lady of Guadalupe (feast) + 6 obligatory memorials; the
    // Day of Prayer for the Unborn is placed by its Sunday rule, not by date.
    expect(us.length).toBe(general.length + 7);
    expect(
      SANCTORAL.filter((e) => e.rank === "SOLEMNITY")
        .map((e) => e.key)
        .sort(),
    ).toEqual([
      "all-saints",
      "annunciation",
      "assumption",
      "immaculate-conception",
      "nativity-of-john-the-baptist",
      "st-joseph",
      "sts-peter-and-paul",
    ]);
    expect(SANCTORAL.filter((e) => e.rank === "FEAST" && e.ofTheLord).length).toBe(4);
    expect(SANCTORAL.filter((e) => e.rank === "FEAST" && !e.ofTheLord).length).toBe(21);
    const keys = SANCTORAL.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("CAL-6 — transfers", () => {
  it("Immaculate Conception on an Advent Sunday → Monday 9 December", () => {
    expect(key("2024-12-08")).toBe("advent-2-sunday");
    expect(key("2024-12-09")).toBe("immaculate-conception");
    expect(at("2024-12-09").isHolyDayOfObligation).toBe(true);
    expect(key("2030-12-09")).toBe("immaculate-conception");
    expect(key("2024-12-09", GENERAL)).toBe("immaculate-conception");
  });

  it("Annunciation in Holy Week / the Easter octave → Monday after the 2nd Sunday of Easter", () => {
    expect(key("2024-03-25")).toBe("holy-week-monday");
    expect(key("2024-04-08")).toBe("annunciation");
    expect(key("2027-03-25")).toBe("holy-thursday"); // Easter 2027 = 28 March
    expect(key("2027-04-05")).toBe("annunciation");
    expect(key("2018-04-09", GENERAL)).toBe("annunciation"); // 25 Mar 2018 was Palm Sunday
    // On a Lent Sunday → the Monday.
    expect(key("2012-03-25")).toBe("lent-5-sunday");
    expect(key("2012-03-26")).toBe("annunciation");
  });

  it("St Joseph on a Lent Sunday → Monday; in Holy Week → the Saturday before Palm Sunday", () => {
    expect(key("2028-03-19")).toBe("lent-3-sunday");
    expect(key("2028-03-20")).toBe("st-joseph");
    expect(key("2023-03-19")).toBe("lent-4-sunday");
    expect(key("2023-03-20")).toBe("st-joseph");
    expect(key("2008-03-19", GENERAL)).toBe("holy-week-wednesday");
    expect(key("2008-03-15", GENERAL)).toBe("st-joseph");
  });

  it("Nativity of John the Baptist coinciding with the Sacred Heart → 23 June", () => {
    expect(key("2022-06-24")).toBe("sacred-heart");
    expect(key("2022-06-23")).toBe("nativity-of-john-the-baptist");
    expect(key("2022-06-24", GENERAL)).toBe("sacred-heart");
    expect(key("2022-06-23", GENERAL)).toBe("nativity-of-john-the-baptist");
  });

  it("holy days of obligation follow the US abrogation rule", () => {
    expect(at("2028-01-01").isHolyDayOfObligation).toBe(false); // Saturday
    expect(at("2027-11-01").isHolyDayOfObligation).toBe(false); // Monday
    expect(at("2026-08-15").isHolyDayOfObligation).toBe(false); // Saturday
    expect(at("2025-08-15").isHolyDayOfObligation).toBe(true); // Friday
    expect(at("2026-12-25").isHolyDayOfObligation).toBe(true);
    expect(at("2026-12-08").isHolyDayOfObligation).toBe(true);
    expect(at("2025-06-29").isHolyDayOfObligation).toBe(false); // a Sunday
    expect(at("2026-06-29", GENERAL).isHolyDayOfObligation).toBe(true);
    expect(at("2026-01-06", GENERAL).isHolyDayOfObligation).toBe(true);
  });
});

describe("every date 2020–2050 resolves in both calendars", () => {
  it("emits a well-formed key, celebration, week and cycles for every day", () => {
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2050, 11, 31);
    const keyShape = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const opts of [US, GENERAL]) {
      for (let t = start; t <= end; t += 86_400_000) {
        const d = resolveLiturgicalDay(new Date(t), opts);
        expect(d.lectionaryKey).toMatch(keyShape);
        expect(d.temporalKey).toMatch(keyShape);
        expect(d.celebration.length).toBeGreaterThan(3);
        expect(d.temporalKey).not.toMatch(/-0-/);
        expect(d.weekOfSeason).toBeGreaterThanOrEqual(0);
        expect(d.weekOfSeason).toBeLessThanOrEqual(34);
        if (d.sanctoral && d.sanctoral.readings === "ferial") {
          expect(d.lectionaryKey).toBe(d.temporalKey);
        }
        if (!d.sanctoral) expect(d.lectionaryKey).toBe(d.temporalKey);
        if (d.isSunday) expect(d.rank).not.toBe("MEMORIAL");
      }
    }
  });

  it("the Christmas season never produces an 'ordinary-0' week in either calendar", () => {
    for (let y = 2000; y <= 2100; y++) {
      for (const opts of [US, GENERAL]) {
        for (let day = 1; day <= 20; day++) {
          const k = key(`${y}-01-${String(day).padStart(2, "0")}`, opts);
          expect(k).not.toMatch(/^ordinary-0-/);
        }
      }
    }
  });
});

describe("exhaustive agreement with the USCCB daily-readings titles, 2023-01-01 … 2027-10-31", () => {
  /**
   * Dates where the DATASET is wrong (checked against the USCCB calendar text
   * or the readings the row itself carries); listed explicitly so a change in
   * either the engine or the fixture is visible.
   */
  const KNOWN_DATASET_ERRORS: Record<string, string> = {
    "2023-01-31":
      "empty scrape (no title, no readings) carrying Lectionary 317; 31 Jan 2023 is Tuesday of the 4th week (324, St John Bosco)",
    "2026-08-09":
      "row shows Lectionary 113 but carries the Year A readings of the 19th Sunday (115), which the USCCB 2026 calendar also lists",
  };

  it("agrees on every date except the documented dataset errors", () => {
    const entries = Object.entries(fixture as Record<string, SourceDay>);
    expect(entries.length).toBeGreaterThan(1700);
    const hard: string[] = [];
    const soft: string[] = [];
    let titleMatches = 0;
    let numberOnly = 0;
    let numberAgree = 0;
    let withNumbers = 0;
    for (const [date, src] of entries) {
      const day = at(date);
      const v = judge(day, src);
      if (v.kind === "title") titleMatches++;
      else if (v.kind === "number") numberOnly++;
      else if (v.kind === "soft") soft.push(`${date}: ${v.reason}`);
      else hard.push(`${date}: ${v.reason}`);
      if (src.numbers.length > 0) {
        withNumbers++;
        const expectedNumbers = new Set(expectedLectionaryNumbers(day));
        if (src.numbers.some((n) => expectedNumbers.has(n))) numberAgree++;
      }
    }
    expect(soft).toEqual([]);
    expect(hard.map((h) => h.slice(0, 10)).sort()).toEqual(
      Object.keys(KNOWN_DATASET_ERRORS).sort(),
    );
    expect(titleMatches).toBeGreaterThan(1550);
    expect(numberOnly).toBeGreaterThan(100);
    // The Lectionary-number model is an independent check of the engine.
    expect(numberAgree / withNumbers).toBeGreaterThan(0.99);
  });
});

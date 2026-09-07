/**
 * Liturgical calendar engine (spec — "Liturgical Calendar: seasons, readings
 * cycle, Jubilee years").
 *
 * Pure, deterministic computation of the liturgical day for any civil date:
 * season, colour, lectionary cycles, the date of Easter (Computus), the exact
 * Proper-of-Time celebration, the Proper-of-Saints overlay (solemnities,
 * feasts, obligatory memorials) with the precedence and transfer rules of the
 * Universal Norms on the Liturgical Year and the Calendar (UNLY, Table of
 * Liturgical Days), and the national variant used by the site's readings
 * source (the Dioceses of the United States).
 *
 * Everything works on the date's civil year/month/day in UTC so it is
 * timezone-safe: the caller supplies the visitor's local calendar date and
 * gets the same answer regardless of where the server runs. This module is
 * the SINGLE SOURCE OF TRUTH for the calendar: the Python brain reads a JSON
 * export of it (scripts/lectionary/export-golden.ts) and the Admin Worker's
 * seasonal scorer imports from here.
 *
 * The daily Mass readings themselves live in the lectionary table, keyed on
 * `lectionaryKey` (+ `sundayCycle` / `weekdayCycle`).
 */
export type LiturgicalSeason = "advent" | "christmas" | "ordinary" | "lent" | "triduum" | "easter";

/**
 * Which calendar to compute.
 *  - "roman-general": the General Roman Calendar (Epiphany 6 Jan, Ascension
 *    and Corpus Christi on Thursday, Baptism on the Sunday after 6 Jan).
 *  - "roman-us": the calendar of the Dioceses of the United States (Epiphany
 *    on the Sunday 2–8 Jan, Ascension on the 7th Sunday of Easter except in
 *    the provinces that keep Thursday, Corpus Christi on the Sunday after
 *    Trinity, the Baptism on Monday when Epiphany is 7/8 Jan, the US proper
 *    feasts/memorials, and the US holy-day-of-obligation rules).
 */
export type LiturgicalCalendarId = "roman-general" | "roman-us";

export interface LiturgicalCalendarOptions {
  /** Defaults to "roman-us": the site's readings source (USCCB) follows it. */
  calendar?: LiturgicalCalendarId;
  /**
   * "roman-us" only: keep the Ascension on Thursday (the ecclesiastical
   * provinces of Boston, Hartford, New York, Newark, Omaha and Philadelphia).
   */
  ascensionOnThursday?: boolean;
}

/** Default calendar for the whole site (the readings source is the USCCB). */
export const DEFAULT_LITURGICAL_CALENDAR: LiturgicalCalendarId = "roman-us";

export interface LiturgicalDay {
  /** Normalised ISO date (YYYY-MM-DD). */
  date: string;
  season: LiturgicalSeason;
  seasonLabel: string;
  /** Colour of the day's celebration (e.g. Red on a martyr's feast). */
  color: string;
  sundayCycle: "A" | "B" | "C";
  weekdayCycle: "I" | "II";
  isJubileeYear: boolean;
}

const SEASON_LABELS: Record<LiturgicalSeason, string> = {
  advent: "Advent",
  christmas: "Christmas",
  ordinary: "Ordinary Time",
  lent: "Lent",
  triduum: "Sacred Triduum",
  easter: "Easter",
};

function utc(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day));
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86_400_000);
}

/** Strips any time-of-day, keeping the UTC calendar date. */
function startOfUtcDay(date: Date): Date {
  return utc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function iso(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mmdd(date: Date): string {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Sunday on or before a date. */
function sundayOnOrBefore(date: Date): Date {
  return addDays(date, -date.getUTCDay());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Date of Easter Sunday for a Gregorian year (Meeus/Jones/Butcher Computus).
 * Returns the 1-based month (3 = March, 4 = April) and day.
 */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function easterDate(year: number): Date {
  const { month, day } = easterSunday(year);
  return utc(year, month, day);
}

/** First Sunday of Advent: the last Sunday on or before December 24, minus three weeks. */
function firstSundayOfAdvent(year: number): Date {
  const dec24 = utc(year, 12, 24);
  const fourthSunday = addDays(dec24, -dec24.getUTCDay());
  return addDays(fourthSunday, -21);
}

/** The civil year in which the current liturgical year's Advent began. */
function adventStartYear(date: Date): number {
  const y = date.getUTCFullYear();
  return date.getTime() >= firstSundayOfAdvent(y).getTime() ? y : y - 1;
}

/** Epiphany: 6 January (general) or the Sunday between 2 and 8 January (US). */
function epiphanyDate(year: number, calendar: LiturgicalCalendarId): Date {
  if (calendar === "roman-general") return utc(year, 1, 6);
  const jan2 = utc(year, 1, 2);
  return addDays(jan2, (7 - jan2.getUTCDay()) % 7);
}

/**
 * The Baptism of the Lord, closing the Christmas season.
 *  - General calendar: the Sunday after 6 January (UNLY 38) — 13 January when
 *    6 January is itself a Sunday.
 *  - US: the Sunday after Epiphany, or the Monday after Epiphany when Epiphany
 *    falls on 7 or 8 January (Ordinary Time then begins on the Tuesday).
 */
function baptismDate(year: number, calendar: LiturgicalCalendarId): Date {
  const epiphany = epiphanyDate(year, calendar);
  if (calendar === "roman-general") {
    const dow = epiphany.getUTCDay();
    return addDays(epiphany, dow === 0 ? 7 : 7 - dow);
  }
  return epiphany.getUTCDate() >= 7 ? addDays(epiphany, 1) : addDays(epiphany, 7);
}

/** Holy Family: the Sunday in the Christmas octave, or Dec 30 if Christmas is a Sunday. */
function holyFamilyDate(year: number): Date {
  const christmas = utc(year, 12, 25);
  if (christmas.getUTCDay() === 0) return utc(year, 12, 30);
  return addDays(christmas, 7 - christmas.getUTCDay());
}

/** Sunday lectionary cycle (A/B/C) for the liturgical year containing the date. */
export function sundayCycle(input: Date): "A" | "B" | "C" {
  const r = ((adventStartYear(startOfUtcDay(input)) % 3) + 3) % 3;
  return r === 0 ? "A" : r === 1 ? "B" : "C";
}

/** Weekday lectionary cycle: Year I in odd liturgical years, Year II in even. */
export function weekdayCycle(input: Date): "I" | "II" {
  const liturgicalYearNumber = adventStartYear(startOfUtcDay(input)) + 1;
  return liturgicalYearNumber % 2 === 1 ? "I" : "II";
}

/** Ordinary jubilees fall every 25 years (… 2000, 2025, 2050 …). */
export function isJubileeYear(year: number): boolean {
  return year % 25 === 0;
}

/**
 * Link to the official daily Mass readings (USCCB) for a date. The full
 * lectionary is not reproduced here; this points at the authoritative
 * source, whose URLs are keyed by MMDDYY.
 */
export function usccbReadingsUrl(input: Date): string {
  const date = startOfUtcDay(input);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  return `https://bible.usccb.org/bible/readings/${mm}${dd}${yy}.cfm`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Year context: every Easter/Advent/Epiphany-anchored date of a civil year for
// a given calendar, plus the resolved Proper-of-Saints placements (after the
// UNLY precedence, transfer and omission rules). Memoised per (year, calendar).
// ─────────────────────────────────────────────────────────────────────────────

export type LiturgicalRank =
  | "SOLEMNITY"
  | "FEAST"
  | "MEMORIAL"
  | "COMMEMORATION"
  | "SUNDAY"
  | "WEEKDAY";

export type SanctoralRank = "SOLEMNITY" | "FEAST" | "MEMORIAL" | "COMMEMORATION";

/**
 * How a sanctoral celebration's readings relate to the weekday readings.
 *  - "proper": the Proper of Saints supplies the readings (solemnities, feasts,
 *    and the few memorials whose proper reading must be used, e.g. Timothy &
 *    Titus); look the readings up under the sanctoral `key`. Memorials marked
 *    "proper" only override the reading(s) the Lectionary assigns them; the
 *    lectionary layer fills the rest from `temporalKey`.
 *  - "proper-gospel": only the Gospel is proper (Martha, Passion of John the
 *    Baptist, Our Lady of Sorrows, Guardian Angels, Immaculate Heart); the
 *    first reading and psalm are the weekday's (`temporalKey`).
 *  - "ferial": the weekday readings are used (`lectionaryKey === temporalKey`);
 *    the memorial only changes the celebration heading and colour.
 */
export type SanctoralReadings = "proper" | "proper-gospel" | "ferial";

export interface SanctoralEntry {
  month: number;
  day: number;
  key: string;
  celebration: string;
  rank: SanctoralRank;
  color: string;
  readings: SanctoralReadings;
  /** Feast of the Lord (UNLY Table rank 5): outranks Sundays of Christmas/OT. */
  ofTheLord?: boolean;
  /** Present only in the given calendars (absent = General Roman Calendar). */
  calendars?: readonly LiturgicalCalendarId[];
  /** A national (proper) celebration: Table rank 8 (feast) / 11 (memorial). */
  proper?: boolean;
}

export interface SanctoralOverlay {
  key: string;
  celebration: string;
  rank: SanctoralRank;
  color: string;
  readings: SanctoralReadings;
}

export interface LiturgicalDayDetail extends LiturgicalDay {
  calendar: LiturgicalCalendarId;
  /** 0 = Sunday … 6 = Saturday (UTC). */
  dayOfWeek: number;
  isSunday: boolean;
  /** Week number within the season — Advent 1–4, Lent 1–5, Easter 1–7, and
   *  Ordinary Time 1–34 (also for Trinity, Corpus Christi and the Sacred
   *  Heart, which sit inside an OT week). 0 when the day is a stand-alone
   *  celebration (e.g. the Triduum) or the Christmas season, which the
   *  lectionary keys by date. */
  weekOfSeason: number;
  /** Rank of the celebration actually observed that day. */
  rank: LiturgicalRank;
  /** Human label of the celebration observed, e.g. "Saint Agnes, Virgin and
   *  Martyr", "Tuesday of the 23rd Week in Ordinary Time". */
  celebration: string;
  /** The key the day's readings are looked up by: the sanctoral key when the
   *  Proper of Saints supplies (some of) the readings, otherwise the
   *  Proper-of-Time key. Sunday/solemnity readings also vary by `sundayCycle`;
   *  Ordinary-Time weekday first readings vary by `weekdayCycle`. */
  lectionaryKey: string;
  /** The underlying Proper-of-Time key, even when a feast overrides the day
   *  (a memorial with a proper Gospel still takes its first reading here). */
  temporalKey: string;
  /** Label of the underlying Proper-of-Time day. */
  temporalCelebration: string;
  /** The sanctoral celebration observed today, if any. */
  sanctoral?: SanctoralOverlay;
  /** A weekday holy day of obligation (Sundays are always days of obligation
   *  and are not flagged). US: Jan 1 / Aug 15 / Nov 1 lose the obligation when
   *  they fall on a Saturday or Monday; the Ascension only when kept on
   *  Thursday. General calendar: the ten days of canon 1246 §1. */
  isHolyDayOfObligation: boolean;
}

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const OCTAVE_DAY_LABELS = ["Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"] as const;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * Precedence classes of the UNLY Table of Liturgical Days (lower wins).
 *   1  Paschal Triduum
 *   2  Nativity, Epiphany, Ascension, Pentecost; Sundays of Advent, Lent and
 *      Easter; Ash Wednesday; Holy Week Monday–Wednesday; the Easter octave
 *   3  Solemnities of the General Calendar; All Souls
 *   5  Feasts of the Lord in the General Calendar
 *   6  Sundays of Christmas and Ordinary Time
 *   7  Feasts of the BVM and the Saints in the General Calendar
 *   8  Proper (national) feasts
 *   9  Advent weekdays 17–24 Dec; days of the Christmas octave; Lent weekdays
 *  10  Obligatory memorials of the General Calendar
 *  11  Proper (national) obligatory memorials
 *  13  Weekdays of Advent to 16 Dec, of Christmas from 2 Jan, of Easter after
 *      the octave, and of Ordinary Time
 */
type Precedence = 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 13;

interface Temporal {
  key: string;
  celebration: string;
  rank: LiturgicalRank;
  color: string;
  weekOfSeason: number;
  precedence: Precedence;
}

interface YearContext {
  year: number;
  calendar: LiturgicalCalendarId;
  easter: Date;
  ashWednesday: Date;
  pentecost: Date;
  /** First Sunday of Advent that falls in this civil year. */
  advent1: Date;
  /** First Sunday of Advent of the previous civil year (opens this year's January). */
  prevAdvent1: Date;
  christKing: Date;
  epiphany: Date;
  baptism: Date;
  /** Sunday that opens the 1st week of Ordinary Time (the Baptism, or the US Epiphany Sunday). */
  otAnchor: Date;
  holyFamily: Date;
  ascension: Date;
  corpusChristi: Date;
  sacredHeart: Date;
  /** ISO date → sanctoral celebration observed that day (after transfers). */
  sanctoral: Map<string, SanctoralEntry>;
}

const CONTEXT_MEMO = new Map<string, YearContext>();

function yearContext(year: number, opts: Required<LiturgicalCalendarOptions>): YearContext {
  const memoKey = `${year}|${opts.calendar}|${opts.ascensionOnThursday ? 1 : 0}`;
  const hit = CONTEXT_MEMO.get(memoKey);
  if (hit) return hit;

  const { calendar } = opts;
  const easter = easterDate(year);
  const advent1 = firstSundayOfAdvent(year);
  const baptism = baptismDate(year, calendar);
  const sundayAscension = calendar === "roman-us" && !opts.ascensionOnThursday;
  const ctx: YearContext = {
    year,
    calendar,
    easter,
    ashWednesday: addDays(easter, -46),
    pentecost: addDays(easter, 49),
    advent1,
    prevAdvent1: firstSundayOfAdvent(year - 1),
    christKing: addDays(advent1, -7),
    epiphany: epiphanyDate(year, calendar),
    baptism,
    otAnchor: sundayOnOrBefore(baptism),
    holyFamily: holyFamilyDate(year),
    ascension: addDays(easter, sundayAscension ? 42 : 39),
    corpusChristi: addDays(easter, calendar === "roman-us" ? 63 : 60),
    sacredHeart: addDays(easter, 68),
    sanctoral: new Map(),
  };
  placeSanctoral(ctx);

  if (CONTEXT_MEMO.size > 600) CONTEXT_MEMO.clear();
  CONTEXT_MEMO.set(memoKey, ctx);
  return ctx;
}

function seasonOf(date: Date, ctx: YearContext): LiturgicalSeason {
  const t = date.getTime();
  const year = ctx.year;
  if (t >= utc(year, 1, 1).getTime() && t <= ctx.baptism.getTime()) return "christmas";
  const holyThu = addDays(ctx.easter, -3).getTime();
  if (t >= ctx.ashWednesday.getTime() && t < holyThu) return "lent";
  if (t >= holyThu && t < ctx.easter.getTime()) return "triduum";
  if (t >= ctx.easter.getTime() && t <= ctx.pentecost.getTime()) return "easter";
  if (t >= ctx.advent1.getTime() && t <= utc(year, 12, 24).getTime()) return "advent";
  if (t >= utc(year, 12, 25).getTime()) return "christmas";
  return "ordinary";
}

/**
 * Ordinary Time week number (1–34). The first stretch counts forward from the
 * week of the Baptism of the Lord; the resumption after Pentecost counts back
 * from Christ the King (the 34th Sunday) — the standard method that absorbs
 * Easter's variable date.
 */
function ordinaryTimeWeek(date: Date, ctx: YearContext): number {
  if (date.getTime() < ctx.ashWednesday.getTime()) {
    return Math.floor(dayDiff(sundayOnOrBefore(date), ctx.otAnchor) / 7) + 1;
  }
  const weeksBack = Math.floor(dayDiff(ctx.christKing, sundayOnOrBefore(date)) / 7);
  return 34 - weeksBack;
}

/** Week number within Advent / Lent / Easter (1-based). */
function seasonWeek(date: Date, seasonStartSunday: Date): number {
  return Math.floor(dayDiff(sundayOnOrBefore(date), seasonStartSunday) / 7) + 1;
}

function temporal(
  key: string,
  celebration: string,
  rank: LiturgicalRank,
  color: string,
  precedence: Precedence,
  weekOfSeason = 0,
): Temporal {
  return { key, celebration, rank, color, weekOfSeason, precedence };
}

/**
 * The exact Proper-of-Time celebration for a date: Easter-anchored days, the
 * season Sundays and weekdays, and the Christmas-season days keyed by date.
 */
function temporalCelebration(date: Date, ctx: YearContext): Temporal {
  const dow = date.getUTCDay();
  const dowName = WEEKDAY_NAMES[dow];
  const dowLabel = WEEKDAY_LABELS[dow];
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const fromEaster = dayDiff(date, ctx.easter);

  // ── Holy Week, the Paschal Triduum, the Easter octave, Easter-anchored days ─
  if (fromEaster === -7) {
    return temporal("palm-sunday", "Palm Sunday of the Passion of the Lord", "SUNDAY", "Red", 2);
  }
  if (fromEaster >= -6 && fromEaster <= -4) {
    return temporal(`holy-week-${dowName}`, `${dowLabel} of Holy Week`, "WEEKDAY", "Violet", 2);
  }
  if (fromEaster === -3) return temporal("holy-thursday", "Holy Thursday", "SOLEMNITY", "White", 1);
  if (fromEaster === -2) return temporal("good-friday", "Good Friday", "SOLEMNITY", "Red", 1);
  if (fromEaster === -1) {
    return temporal("easter-vigil", "Holy Saturday (Easter Vigil)", "SOLEMNITY", "White", 1);
  }
  if (fromEaster === 0) return temporal("easter-sunday", "Easter Sunday", "SOLEMNITY", "White", 1);
  if (fromEaster >= 1 && fromEaster <= 6) {
    return temporal(
      `easter-octave-${dowName}`,
      `${dowLabel} within the Octave of Easter`,
      "SOLEMNITY",
      "White",
      2,
    );
  }
  if (sameDay(date, ctx.ascension)) {
    return temporal("ascension", "The Ascension of the Lord", "SOLEMNITY", "White", 2);
  }
  if (fromEaster === 49) return temporal("pentecost", "Pentecost Sunday", "SOLEMNITY", "Red", 2);
  if (fromEaster === 56) {
    return temporal(
      "trinity-sunday",
      "The Most Holy Trinity",
      "SOLEMNITY",
      "White",
      3,
      ordinaryTimeWeek(date, ctx),
    );
  }
  if (sameDay(date, ctx.corpusChristi)) {
    return temporal(
      "corpus-christi",
      "The Most Holy Body and Blood of Christ",
      "SOLEMNITY",
      "White",
      3,
      ordinaryTimeWeek(date, ctx),
    );
  }
  if (fromEaster === 68) {
    return temporal(
      "sacred-heart",
      "The Most Sacred Heart of Jesus",
      "SOLEMNITY",
      "White",
      3,
      ordinaryTimeWeek(date, ctx),
    );
  }

  // ── Christ the King: the last Sunday before Advent (34th Sunday of OT) ──────
  if (sameDay(date, ctx.christKing)) {
    return temporal(
      "christ-the-king",
      "Our Lord Jesus Christ, King of the Universe",
      "SOLEMNITY",
      "White",
      3,
      34,
    );
  }

  const season = seasonOf(date, ctx);

  // ── Advent ─────────────────────────────────────────────────────────────────
  if (season === "advent") {
    const w = seasonWeek(date, ctx.advent1);
    if (dow === 0) {
      return temporal(
        `advent-${w}-sunday`,
        `${ordinal(w)} Sunday of Advent`,
        "SUNDAY",
        "Violet",
        2,
        w,
      );
    }
    if (month === 12 && day >= 17) {
      // Late-Advent weekdays (17–24 Dec) are keyed by date (the O Antiphons).
      return temporal(
        `advent-${mmdd(date)}`,
        `${dowLabel} of the ${ordinal(w)} Week of Advent`,
        "WEEKDAY",
        "Violet",
        9,
        w,
      );
    }
    return temporal(
      `advent-${w}-${dowName}`,
      `${dowLabel} of the ${ordinal(w)} Week of Advent`,
      "WEEKDAY",
      "Violet",
      13,
      w,
    );
  }

  // ── Christmas season (keyed by date; the Lord's days resolved by date) ─────
  if (season === "christmas") {
    if (month === 12 && day === 25) {
      return temporal("nativity", "The Nativity of the Lord", "SOLEMNITY", "White", 2);
    }
    if (month === 1 && day === 1) {
      return temporal(
        "mary-mother-of-god",
        "Mary, the Holy Mother of God",
        "SOLEMNITY",
        "White",
        3,
      );
    }
    if (sameDay(date, ctx.epiphany)) {
      return temporal("epiphany", "The Epiphany of the Lord", "SOLEMNITY", "White", 2);
    }
    if (sameDay(date, ctx.baptism)) {
      return temporal("baptism-of-the-lord", "The Baptism of the Lord", "FEAST", "White", 5);
    }
    if (sameDay(date, ctx.holyFamily)) {
      return temporal(
        "holy-family",
        "The Holy Family of Jesus, Mary and Joseph",
        "FEAST",
        "White",
        5,
      );
    }
    if (dow === 0) {
      // A Sunday between 2 and 5 January (general calendar; in the US that
      // Sunday is the Epiphany, resolved above).
      return temporal(
        "christmas-2-sunday",
        "Second Sunday after the Nativity",
        "SUNDAY",
        "White",
        6,
      );
    }
    if (month === 12) {
      return temporal(
        `christmas-${mmdd(date)}`,
        `${OCTAVE_DAY_LABELS[day - 26]} Day within the Octave of the Nativity of the Lord`,
        "WEEKDAY",
        "White",
        9,
      );
    }
    if (date.getTime() > ctx.epiphany.getTime()) {
      return temporal(
        `after-epiphany-${dowName}`,
        `${dowLabel} after Epiphany`,
        "WEEKDAY",
        "White",
        13,
      );
    }
    return temporal(
      `christmas-${mmdd(date)}`,
      `Christmas Weekday (January ${day})`,
      "WEEKDAY",
      "White",
      13,
    );
  }

  // ── Lent ─────────────────────────────────────────────────────────────────
  if (season === "lent") {
    if (sameDay(date, ctx.ashWednesday)) {
      return temporal("ash-wednesday", "Ash Wednesday", "WEEKDAY", "Violet", 2);
    }
    if (date.getTime() < addDays(ctx.ashWednesday, 4).getTime()) {
      return temporal(
        `after-ashes-${dowName}`,
        `${dowLabel} after Ash Wednesday`,
        "WEEKDAY",
        "Violet",
        9,
      );
    }
    const w = seasonWeek(date, addDays(ctx.easter, -42));
    if (dow === 0) {
      return temporal(`lent-${w}-sunday`, `${ordinal(w)} Sunday of Lent`, "SUNDAY", "Violet", 2, w);
    }
    return temporal(
      `lent-${w}-${dowName}`,
      `${dowLabel} of the ${ordinal(w)} Week of Lent`,
      "WEEKDAY",
      "Violet",
      9,
      w,
    );
  }

  // ── Easter (octave handled above; weeks 2–7 here) ──────────────────────────
  if (season === "easter") {
    const w = seasonWeek(date, ctx.easter);
    if (dow === 0) {
      const label =
        w === 2 ? "2nd Sunday of Easter (Divine Mercy)" : `${ordinal(w)} Sunday of Easter`;
      return temporal(`easter-${w}-sunday`, label, "SUNDAY", "White", 2, w);
    }
    return temporal(
      `easter-${w}-${dowName}`,
      `${dowLabel} of the ${ordinal(w)} Week of Easter`,
      "WEEKDAY",
      "White",
      13,
      w,
    );
  }

  // ── Ordinary Time ──────────────────────────────────────────────────────────
  const w = ordinaryTimeWeek(date, ctx);
  if (dow === 0) {
    return temporal(
      `ordinary-${w}-sunday`,
      `${ordinal(w)} Sunday in Ordinary Time`,
      "SUNDAY",
      "Green",
      6,
      w,
    );
  }
  return temporal(
    `ordinary-${w}-${dowName}`,
    `${dowLabel} of the ${ordinal(w)} Week in Ordinary Time`,
    "WEEKDAY",
    "Green",
    13,
    w,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Proper of Saints (General Roman Calendar + the Proper Calendar for the
// Dioceses of the United States). Solemnities, feasts and every OBLIGATORY
// memorial; optional memorials are not modelled (the day resolves to the
// weekday, as the USCCB readings pages do). Data, not code: month/day, key,
// Missal title, rank, colour, readings mode.
// ─────────────────────────────────────────────────────────────────────────────

const US: readonly LiturgicalCalendarId[] = ["roman-us"];

function sol(month: number, day: number, key: string, celebration: string, color = "White") {
  return { month, day, key, celebration, rank: "SOLEMNITY", color, readings: "proper" } as const;
}
function feastOfTheLord(
  month: number,
  day: number,
  key: string,
  celebration: string,
  color: string,
) {
  return {
    month,
    day,
    key,
    celebration,
    rank: "FEAST",
    color,
    readings: "proper",
    ofTheLord: true,
  } as const;
}
function feast(month: number, day: number, key: string, celebration: string, color: string) {
  return { month, day, key, celebration, rank: "FEAST", color, readings: "proper" } as const;
}
function mem(
  month: number,
  day: number,
  key: string,
  celebration: string,
  color: string,
  readings: SanctoralReadings = "ferial",
) {
  return { month, day, key, celebration, rank: "MEMORIAL", color, readings } as const;
}
function usMem(month: number, day: number, key: string, celebration: string, color: string) {
  return { ...mem(month, day, key, celebration, color), calendars: US, proper: true } as const;
}

/** The fixed-date sanctoral table (moveable memorials are placed in `placeSanctoral`). */
export const SANCTORAL: readonly SanctoralEntry[] = [
  // ── January ──
  mem(
    1,
    2,
    "sts-basil-and-gregory",
    "Saints Basil the Great and Gregory Nazianzen, Bishops and Doctors of the Church",
    "White",
  ),
  usMem(1, 4, "st-elizabeth-ann-seton", "Saint Elizabeth Ann Seton, Religious", "White"),
  usMem(1, 5, "st-john-neumann", "Saint John Neumann, Bishop", "White"),
  mem(1, 17, "st-anthony-abbot", "Saint Anthony, Abbot", "White"),
  mem(1, 21, "st-agnes", "Saint Agnes, Virgin and Martyr", "Red"),
  mem(
    1,
    24,
    "st-francis-de-sales",
    "Saint Francis de Sales, Bishop and Doctor of the Church",
    "White",
  ),
  feast(1, 25, "conversion-of-st-paul", "The Conversion of Saint Paul the Apostle", "White"),
  mem(1, 26, "sts-timothy-and-titus", "Saints Timothy and Titus, Bishops", "White", "proper"),
  mem(1, 28, "st-thomas-aquinas", "Saint Thomas Aquinas, Priest and Doctor of the Church", "White"),
  mem(1, 31, "st-john-bosco", "Saint John Bosco, Priest", "White"),
  // ── February ──
  feastOfTheLord(2, 2, "presentation", "The Presentation of the Lord", "White"),
  mem(2, 5, "st-agatha", "Saint Agatha, Virgin and Martyr", "Red"),
  mem(2, 6, "st-paul-miki-and-companions", "Saint Paul Miki and Companions, Martyrs", "Red"),
  mem(2, 10, "st-scholastica", "Saint Scholastica, Virgin", "White"),
  mem(2, 14, "sts-cyril-and-methodius", "Saints Cyril, Monk, and Methodius, Bishop", "White"),
  feast(2, 22, "chair-of-st-peter", "The Chair of Saint Peter the Apostle", "White"),
  mem(2, 23, "st-polycarp", "Saint Polycarp, Bishop and Martyr", "Red"),
  // ── March ──
  mem(3, 7, "sts-perpetua-and-felicity", "Saints Perpetua and Felicity, Martyrs", "Red"),
  sol(3, 19, "st-joseph", "Saint Joseph, Spouse of the Blessed Virgin Mary"),
  sol(3, 25, "annunciation", "The Annunciation of the Lord"),
  // ── April ──
  mem(4, 7, "st-john-baptist-de-la-salle", "Saint John Baptist de la Salle, Priest", "White"),
  mem(4, 11, "st-stanislaus", "Saint Stanislaus, Bishop and Martyr", "Red"),
  feast(4, 25, "st-mark", "Saint Mark, Evangelist", "Red"),
  mem(
    4,
    29,
    "st-catherine-of-siena",
    "Saint Catherine of Siena, Virgin and Doctor of the Church",
    "White",
  ),
  // ── May ──
  mem(5, 2, "st-athanasius", "Saint Athanasius, Bishop and Doctor of the Church", "White"),
  feast(5, 3, "sts-philip-and-james", "Saints Philip and James, Apostles", "Red"),
  feast(5, 14, "st-matthias", "Saint Matthias, Apostle", "Red"),
  mem(5, 26, "st-philip-neri", "Saint Philip Neri, Priest", "White"),
  feast(5, 31, "visitation", "The Visitation of the Blessed Virgin Mary", "White"),
  // ── June ──
  mem(6, 1, "st-justin", "Saint Justin, Martyr", "Red"),
  mem(
    6,
    3,
    "st-charles-lwanga-and-companions",
    "Saint Charles Lwanga and Companions, Martyrs",
    "Red",
  ),
  mem(6, 5, "st-boniface", "Saint Boniface, Bishop and Martyr", "Red"),
  mem(6, 11, "st-barnabas", "Saint Barnabas, Apostle", "Red", "proper"),
  mem(
    6,
    13,
    "st-anthony-of-padua",
    "Saint Anthony of Padua, Priest and Doctor of the Church",
    "White",
  ),
  mem(6, 21, "st-aloysius-gonzaga", "Saint Aloysius Gonzaga, Religious", "White"),
  sol(6, 24, "nativity-of-john-the-baptist", "The Nativity of Saint John the Baptist"),
  mem(6, 28, "st-irenaeus", "Saint Irenaeus, Bishop and Martyr", "Red"),
  sol(6, 29, "sts-peter-and-paul", "Saints Peter and Paul, Apostles", "Red"),
  // ── July ──
  feast(7, 3, "st-thomas-apostle", "Saint Thomas, Apostle", "Red"),
  mem(7, 11, "st-benedict", "Saint Benedict, Abbot", "White"),
  usMem(7, 14, "st-kateri-tekakwitha", "Saint Kateri Tekakwitha, Virgin", "White"),
  mem(7, 15, "st-bonaventure", "Saint Bonaventure, Bishop and Doctor of the Church", "White"),
  feast(7, 22, "st-mary-magdalene", "Saint Mary Magdalene", "White"),
  feast(7, 25, "st-james", "Saint James, Apostle", "Red"),
  mem(
    7,
    26,
    "sts-joachim-and-anne",
    "Saints Joachim and Anne, Parents of the Blessed Virgin Mary",
    "White",
  ),
  mem(
    7,
    29,
    "sts-martha-mary-and-lazarus",
    "Saints Martha, Mary and Lazarus",
    "White",
    "proper-gospel",
  ),
  mem(7, 31, "st-ignatius-of-loyola", "Saint Ignatius of Loyola, Priest", "White"),
  // ── August ──
  mem(
    8,
    1,
    "st-alphonsus-liguori",
    "Saint Alphonsus Liguori, Bishop and Doctor of the Church",
    "White",
  ),
  mem(8, 4, "st-john-vianney", "Saint John Vianney, Priest", "White"),
  feastOfTheLord(8, 6, "transfiguration", "The Transfiguration of the Lord", "White"),
  mem(8, 8, "st-dominic", "Saint Dominic, Priest", "White"),
  feast(8, 10, "st-lawrence", "Saint Lawrence, Deacon and Martyr", "Red"),
  mem(8, 11, "st-clare", "Saint Clare, Virgin", "White"),
  mem(8, 14, "st-maximilian-kolbe", "Saint Maximilian Kolbe, Priest and Martyr", "Red"),
  sol(8, 15, "assumption", "The Assumption of the Blessed Virgin Mary"),
  mem(8, 20, "st-bernard", "Saint Bernard, Abbot and Doctor of the Church", "White"),
  mem(8, 21, "st-pius-x", "Saint Pius X, Pope", "White"),
  mem(8, 22, "queenship-of-mary", "The Queenship of the Blessed Virgin Mary", "White"),
  feast(8, 24, "st-bartholomew", "Saint Bartholomew, Apostle", "Red"),
  mem(8, 27, "st-monica", "Saint Monica", "White"),
  mem(8, 28, "st-augustine", "Saint Augustine, Bishop and Doctor of the Church", "White"),
  mem(
    8,
    29,
    "passion-of-john-the-baptist",
    "The Passion of Saint John the Baptist",
    "Red",
    "proper-gospel",
  ),
  // ── September ──
  mem(
    9,
    3,
    "st-gregory-the-great",
    "Saint Gregory the Great, Pope and Doctor of the Church",
    "White",
  ),
  feast(9, 8, "nativity-of-mary", "The Nativity of the Blessed Virgin Mary", "White"),
  usMem(9, 9, "st-peter-claver", "Saint Peter Claver, Priest", "White"),
  mem(
    9,
    13,
    "st-john-chrysostom",
    "Saint John Chrysostom, Bishop and Doctor of the Church",
    "White",
  ),
  feastOfTheLord(9, 14, "exaltation-of-the-cross", "The Exaltation of the Holy Cross", "Red"),
  mem(9, 15, "our-lady-of-sorrows", "Our Lady of Sorrows", "White", "proper-gospel"),
  mem(
    9,
    16,
    "sts-cornelius-and-cyprian",
    "Saints Cornelius, Pope, and Cyprian, Bishop, Martyrs",
    "Red",
  ),
  mem(
    9,
    20,
    "sts-andrew-kim-and-companions",
    "Saints Andrew Kim Tae-gŏn, Priest, and Paul Chŏng Ha-sang, and Companions, Martyrs",
    "Red",
  ),
  feast(9, 21, "st-matthew", "Saint Matthew, Apostle and Evangelist", "Red"),
  mem(9, 23, "st-pius-of-pietrelcina", "Saint Pius of Pietrelcina, Priest", "White"),
  mem(9, 27, "st-vincent-de-paul", "Saint Vincent de Paul, Priest", "White"),
  feast(9, 29, "archangels", "Saints Michael, Gabriel and Raphael, Archangels", "White"),
  mem(9, 30, "st-jerome", "Saint Jerome, Priest and Doctor of the Church", "White"),
  // ── October ──
  mem(
    10,
    1,
    "st-therese-of-the-child-jesus",
    "Saint Thérèse of the Child Jesus, Virgin and Doctor of the Church",
    "White",
  ),
  mem(10, 2, "guardian-angels", "The Holy Guardian Angels", "White", "proper-gospel"),
  mem(10, 4, "st-francis-of-assisi", "Saint Francis of Assisi", "White"),
  mem(10, 7, "our-lady-of-the-rosary", "Our Lady of the Rosary", "White"),
  mem(
    10,
    15,
    "st-teresa-of-jesus",
    "Saint Teresa of Jesus, Virgin and Doctor of the Church",
    "White",
  ),
  mem(10, 17, "st-ignatius-of-antioch", "Saint Ignatius of Antioch, Bishop and Martyr", "Red"),
  feast(10, 18, "st-luke", "Saint Luke, Evangelist", "Red"),
  usMem(
    10,
    19,
    "sts-john-de-brebeuf-isaac-jogues-and-companions",
    "Saints John de Brébeuf and Isaac Jogues, Priests, and Companions, Martyrs",
    "Red",
  ),
  feast(10, 28, "sts-simon-and-jude", "Saints Simon and Jude, Apostles", "Red"),
  // ── November ──
  sol(11, 1, "all-saints", "All Saints"),
  {
    month: 11,
    day: 2,
    key: "all-souls",
    celebration: "The Commemoration of All the Faithful Departed (All Souls' Day)",
    rank: "COMMEMORATION",
    color: "Violet",
    readings: "proper",
  },
  mem(11, 4, "st-charles-borromeo", "Saint Charles Borromeo, Bishop", "White"),
  feastOfTheLord(11, 9, "lateran-basilica", "The Dedication of the Lateran Basilica", "White"),
  mem(11, 10, "st-leo-the-great", "Saint Leo the Great, Pope and Doctor of the Church", "White"),
  mem(11, 11, "st-martin-of-tours", "Saint Martin of Tours, Bishop", "White"),
  mem(11, 12, "st-josaphat", "Saint Josaphat, Bishop and Martyr", "Red"),
  usMem(11, 13, "st-frances-xavier-cabrini", "Saint Frances Xavier Cabrini, Virgin", "White"),
  mem(11, 17, "st-elizabeth-of-hungary", "Saint Elizabeth of Hungary, Religious", "White"),
  mem(11, 21, "presentation-of-mary", "The Presentation of the Blessed Virgin Mary", "White"),
  mem(11, 22, "st-cecilia", "Saint Cecilia, Virgin and Martyr", "Red"),
  mem(
    11,
    24,
    "st-andrew-dung-lac-and-companions",
    "Saint Andrew Dũng-Lạc, Priest, and Companions, Martyrs",
    "Red",
  ),
  feast(11, 30, "st-andrew", "Saint Andrew, Apostle", "Red"),
  // ── December ──
  mem(12, 3, "st-francis-xavier", "Saint Francis Xavier, Priest", "White"),
  mem(12, 7, "st-ambrose", "Saint Ambrose, Bishop and Doctor of the Church", "White"),
  sol(12, 8, "immaculate-conception", "The Immaculate Conception of the Blessed Virgin Mary"),
  {
    month: 12,
    day: 12,
    key: "our-lady-of-guadalupe",
    celebration: "Our Lady of Guadalupe",
    rank: "FEAST",
    color: "White",
    readings: "proper",
    calendars: US,
    proper: true,
  },
  mem(12, 13, "st-lucy", "Saint Lucy, Virgin and Martyr", "Red"),
  mem(
    12,
    14,
    "st-john-of-the-cross",
    "Saint John of the Cross, Priest and Doctor of the Church",
    "White",
  ),
  feast(12, 26, "st-stephen", "Saint Stephen, the First Martyr", "Red"),
  feast(12, 27, "st-john-apostle", "Saint John, Apostle and Evangelist", "White"),
  feast(12, 28, "holy-innocents", "The Holy Innocents, Martyrs", "Red"),
];

/** Moveable memorials, placed relative to Easter / a Sunday rule. */
const IMMACULATE_HEART: SanctoralEntry = {
  month: 0,
  day: 0,
  key: "immaculate-heart",
  celebration: "The Immaculate Heart of the Blessed Virgin Mary",
  rank: "MEMORIAL",
  color: "White",
  readings: "proper-gospel",
};
const MARY_MOTHER_OF_THE_CHURCH: SanctoralEntry = {
  month: 0,
  day: 0,
  key: "mary-mother-of-the-church",
  celebration: "The Blessed Virgin Mary, Mother of the Church",
  rank: "MEMORIAL",
  color: "White",
  readings: "proper",
};
const US_DAY_OF_PRAYER: SanctoralEntry = {
  month: 1,
  day: 22,
  key: "day-of-prayer-for-the-unborn",
  celebration: "Day of Prayer for the Legal Protection of Unborn Children",
  rank: "MEMORIAL",
  color: "Violet",
  readings: "ferial",
  calendars: US,
  proper: true,
};

/** The sanctoral entries that belong to a calendar (fixed dates only). */
export function sanctoralEntries(
  calendar: LiturgicalCalendarId = DEFAULT_LITURGICAL_CALENDAR,
): readonly SanctoralEntry[] {
  return SANCTORAL.filter((e) => !e.calendars || e.calendars.includes(calendar));
}

function sanctoralPrecedence(e: SanctoralEntry): Precedence {
  switch (e.rank) {
    case "SOLEMNITY":
    case "COMMEMORATION":
      return 3;
    case "FEAST":
      return e.ofTheLord ? 5 : e.proper ? 8 : 7;
    case "MEMORIAL":
      return e.proper ? 11 : 10;
  }
}

/** First day after `from` on which a transferred solemnity may be celebrated. */
function nextFreeDay(from: Date, ctx: YearContext): Date {
  let d = addDays(from, 1);
  for (let guard = 0; guard < 60; guard++) {
    const t = temporalCelebration(d, ctx);
    const occupant = ctx.sanctoral.get(iso(d));
    if (t.precedence > 3 && !(occupant && sanctoralPrecedence(occupant) <= 3)) return d;
    d = addDays(d, 1);
  }
  return d;
}

/**
 * Where an impeded solemnity goes (UNLY 60 + the standing rulings):
 *  - St Joseph in Holy Week → the Saturday before Palm Sunday;
 *  - the Nativity of John the Baptist coinciding with the Sacred Heart → 23 June
 *    (CDW, 2022);
 *  - otherwise the closest following day not impeded: the Immaculate
 *    Conception on an Advent Sunday → 9 Dec; the Annunciation on a Lent Sunday
 *    → Monday, in Holy Week or the Easter octave → the Monday after the 2nd
 *    Sunday of Easter; St Joseph on a Lent Sunday → 20 March.
 */
function transferTarget(entry: SanctoralEntry, from: Date, ctx: YearContext): Date {
  const fromEaster = dayDiff(from, ctx.easter);
  if (entry.key === "st-joseph" && fromEaster >= -7 && fromEaster <= -1) {
    return addDays(ctx.easter, -8);
  }
  if (entry.key === "nativity-of-john-the-baptist" && sameDay(from, ctx.sacredHeart)) {
    return addDays(from, -1);
  }
  return nextFreeDay(from, ctx);
}

function placeOne(entry: SanctoralEntry, date: Date, ctx: YearContext): void {
  const t = temporalCelebration(date, ctx);
  const cls = sanctoralPrecedence(entry);
  const key = iso(date);
  const occupant = ctx.sanctoral.get(key);

  if (cls < t.precedence) {
    if (!occupant) {
      ctx.sanctoral.set(key, entry);
      return;
    }
    const occupantCls = sanctoralPrecedence(occupant);
    if (cls < occupantCls) {
      ctx.sanctoral.set(key, entry);
      return;
    }
    if (cls === occupantCls && entry.rank === "MEMORIAL" && occupant.rank === "MEMORIAL") {
      // Two obligatory memorials on one day. The Immaculate Heart and the other
      // memorial both become optional (CDW notification of 8 Dec 1998), so the
      // day is the weekday; Mary, Mother of the Church prevails over the
      // memorial it meets (Monday after Pentecost).
      if (entry.key === IMMACULATE_HEART.key || occupant.key === IMMACULATE_HEART.key) {
        ctx.sanctoral.delete(key);
      } else if (entry.key === MARY_MOTHER_OF_THE_CHURCH.key) {
        ctx.sanctoral.set(key, entry);
      }
    }
    return;
  }

  // Impeded. Solemnities transfer; everything else is omitted this year.
  if (entry.rank === "SOLEMNITY") {
    const target = transferTarget(entry, date, ctx);
    ctx.sanctoral.set(iso(target), entry);
  }
}

/** Resolve every sanctoral placement of a civil year into `ctx.sanctoral`. */
function placeSanctoral(ctx: YearContext): void {
  const entries = sanctoralEntries(ctx.calendar);
  // Higher ranks first so lower ones see the occupant.
  const ordered = [...entries].sort((a, b) => sanctoralPrecedence(a) - sanctoralPrecedence(b));
  for (const e of ordered) placeOne(e, utc(ctx.year, e.month, e.day), ctx);

  placeOne(MARY_MOTHER_OF_THE_CHURCH, addDays(ctx.pentecost, 1), ctx);
  placeOne(IMMACULATE_HEART, addDays(ctx.sacredHeart, 1), ctx);

  if (ctx.calendar === "roman-us") {
    // 22 January, or 23 January when the 22nd is a Sunday.
    const jan22 = utc(ctx.year, 1, 22);
    placeOne(US_DAY_OF_PRAYER, jan22.getUTCDay() === 0 ? addDays(jan22, 1) : jan22, ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Holy days of obligation
// ─────────────────────────────────────────────────────────────────────────────

const GENERAL_HOLY_DAYS = new Set([
  "mary-mother-of-god",
  "epiphany",
  "st-joseph",
  "ascension",
  "corpus-christi",
  "sts-peter-and-paul",
  "assumption",
  "all-saints",
  "immaculate-conception",
  "nativity",
]);

/** US holy days whose obligation is abrogated when they fall on a Saturday or Monday. */
const US_ABROGABLE_HOLY_DAYS = new Set(["mary-mother-of-god", "assumption", "all-saints"]);
const US_FIXED_HOLY_DAYS = new Set(["immaculate-conception", "nativity", "ascension"]);

function holyDayOfObligation(date: Date, key: string, calendar: LiturgicalCalendarId): boolean {
  const dow = date.getUTCDay();
  if (dow === 0) return false;
  if (calendar === "roman-general") return GENERAL_HOLY_DAYS.has(key);
  if (US_FIXED_HOLY_DAYS.has(key)) return true;
  if (US_ABROGABLE_HOLY_DAYS.has(key)) return dow !== 6 && dow !== 1;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public resolvers
// ─────────────────────────────────────────────────────────────────────────────

function normaliseOptions(opts?: LiturgicalCalendarOptions): Required<LiturgicalCalendarOptions> {
  return {
    calendar: opts?.calendar ?? DEFAULT_LITURGICAL_CALENDAR,
    ascensionOnThursday: opts?.ascensionOnThursday ?? false,
  };
}

export function liturgicalSeasonFor(
  input: Date,
  opts?: LiturgicalCalendarOptions,
): LiturgicalSeason {
  const date = startOfUtcDay(input);
  return seasonOf(date, yearContext(date.getUTCFullYear(), normaliseOptions(opts)));
}

/** Liturgical colour of the day's celebration (Good Friday and martyrs red, etc.). */
export function liturgicalColor(input: Date, opts?: LiturgicalCalendarOptions): string {
  return resolveLiturgicalDay(input, opts).color;
}

/** Bundles the full liturgical description of a civil date. */
export function liturgicalDay(input: Date, opts?: LiturgicalCalendarOptions): LiturgicalDay {
  const date = startOfUtcDay(input);
  const season = liturgicalSeasonFor(date, opts);
  return {
    date: iso(date),
    season,
    seasonLabel: SEASON_LABELS[season],
    color: liturgicalColor(date, opts),
    sundayCycle: sundayCycle(date),
    weekdayCycle: weekdayCycle(date),
    isJubileeYear: isJubileeYear(date.getUTCFullYear()),
  };
}

/**
 * The precise liturgical day for a civil date — the stable key a verified
 * lectionary table maps to Scripture citations — with the Proper of Saints
 * applied under the UNLY precedence and transfer rules.
 */
export function resolveLiturgicalDay(
  input: Date,
  opts?: LiturgicalCalendarOptions,
): LiturgicalDayDetail {
  const options = normaliseOptions(opts);
  const date = startOfUtcDay(input);
  const ctx = yearContext(date.getUTCFullYear(), options);
  const t = temporalCelebration(date, ctx);
  const season = seasonOf(date, ctx);
  const dow = date.getUTCDay();
  const s = ctx.sanctoral.get(iso(date));

  const base = {
    date: iso(date),
    season,
    seasonLabel: SEASON_LABELS[season],
    sundayCycle: sundayCycle(date),
    weekdayCycle: weekdayCycle(date),
    isJubileeYear: isJubileeYear(date.getUTCFullYear()),
    calendar: options.calendar,
    dayOfWeek: dow,
    isSunday: dow === 0,
    weekOfSeason: t.weekOfSeason,
    temporalKey: t.key,
    temporalCelebration: t.celebration,
  };

  if (s) {
    const lectionaryKey = s.readings === "ferial" ? t.key : s.key;
    return {
      ...base,
      color: s.color,
      rank: s.rank,
      celebration: s.celebration,
      lectionaryKey,
      sanctoral: {
        key: s.key,
        celebration: s.celebration,
        rank: s.rank,
        color: s.color,
        readings: s.readings,
      },
      isHolyDayOfObligation: holyDayOfObligation(date, s.key, options.calendar),
    };
  }

  return {
    ...base,
    color: t.color,
    rank: t.rank,
    celebration: t.celebration,
    lectionaryKey: t.key,
    isHolyDayOfObligation: holyDayOfObligation(date, t.key, options.calendar),
  };
}

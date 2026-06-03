/**
 * Liturgical calendar core (spec — "Liturgical Calendar: seasons, readings
 * cycle, Jubilee years").
 *
 * Pure, deterministic computation of the liturgical season, colour, and
 * lectionary cycle for any civil date, plus the date of Easter (Computus).
 * Everything works on the date's civil year/month/day in UTC so it is
 * timezone-safe: the caller supplies the visitor's local calendar date and
 * gets the same answer regardless of where the server runs. The daily Mass
 * readings themselves are not reproduced here (the full lectionary is out of
 * scope); callers link to the official daily readings instead.
 */
export type LiturgicalSeason = "advent" | "christmas" | "ordinary" | "lent" | "triduum" | "easter";

export interface LiturgicalDay {
  /** Normalised ISO date (YYYY-MM-DD). */
  date: string;
  season: LiturgicalSeason;
  seasonLabel: string;
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

const SEASON_COLORS: Record<LiturgicalSeason, string> = {
  advent: "Violet",
  christmas: "White",
  ordinary: "Green",
  lent: "Violet",
  triduum: "White",
  easter: "White",
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

/** First Sunday of Advent: the last Sunday on or before December 24. */
function firstSundayOfAdvent(year: number): Date {
  const dec24 = utc(year, 12, 24);
  const fourthSunday = addDays(dec24, -dec24.getUTCDay());
  return addDays(fourthSunday, -21);
}

/** Baptism of the Lord: the first Sunday after Epiphany (Jan 6), closing Christmas. */
function baptismOfTheLord(year: number): Date {
  const jan6 = utc(year, 1, 6);
  const dow = jan6.getUTCDay();
  // If Epiphany falls on a Sunday, the Baptism is the following Monday.
  return dow === 0 ? utc(year, 1, 7) : addDays(jan6, 7 - dow);
}

/** The civil year in which the current liturgical year's Advent began. */
function adventStartYear(date: Date): number {
  const y = date.getUTCFullYear();
  return date.getTime() >= firstSundayOfAdvent(y).getTime() ? y : y - 1;
}

export function liturgicalSeasonFor(input: Date): LiturgicalSeason {
  const date = startOfUtcDay(input);
  const t = date.getTime();
  const year = date.getUTCFullYear();

  const easter = easterDate(year);
  const ashWed = addDays(easter, -46).getTime();
  const holyThu = addDays(easter, -3).getTime();
  const holySat = addDays(easter, -1).getTime();
  const pentecost = addDays(easter, 49).getTime();

  const advent1 = firstSundayOfAdvent(year).getTime();
  const dec24 = utc(year, 12, 24).getTime();
  const dec25 = utc(year, 12, 25).getTime();
  const dec31 = utc(year, 12, 31).getTime();
  const jan1 = utc(year, 1, 1).getTime();
  const baptism = baptismOfTheLord(year).getTime();

  if (t >= jan1 && t <= baptism) return "christmas";
  if (t >= ashWed && t < holyThu) return "lent";
  if (t >= holyThu && t <= holySat) return "triduum";
  if (t >= easter.getTime() && t <= pentecost) return "easter";
  if (t >= advent1 && t <= dec24) return "advent";
  if (t >= dec25 && t <= dec31) return "christmas";
  return "ordinary";
}

/** Liturgical colour for a date (Good Friday is red within the Triduum). */
export function liturgicalColor(input: Date): string {
  const date = startOfUtcDay(input);
  const season = liturgicalSeasonFor(date);
  if (season === "triduum") {
    const goodFriday = addDays(easterDate(date.getUTCFullYear()), -2).getTime();
    return date.getTime() === goodFriday ? "Red" : "White";
  }
  return SEASON_COLORS[season];
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

/** Bundles the full liturgical description of a civil date. */
export function liturgicalDay(input: Date): LiturgicalDay {
  const date = startOfUtcDay(input);
  const season = liturgicalSeasonFor(date);
  return {
    date: iso(date),
    season,
    seasonLabel: SEASON_LABELS[season],
    color: liturgicalColor(date),
    sundayCycle: sundayCycle(date),
    weekdayCycle: weekdayCycle(date),
    isJubileeYear: isJubileeYear(date.getUTCFullYear()),
  };
}

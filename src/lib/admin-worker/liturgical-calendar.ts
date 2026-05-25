/**
 * Liturgical calendar engine. Computes the current liturgical season
 * and a small "seasonal relevance" score the homepage scorer uses.
 *
 * Deterministic, no external dependencies. The algorithm:
 *   - Easter via the Gregorian Meeus algorithm
 *   - Ash Wednesday = Easter − 46 days
 *   - Lent = Ash Wednesday → Holy Saturday
 *   - Easter Season = Easter → Pentecost (49 days)
 *   - Advent = 4th Sunday before Christmas → Christmas Eve
 *   - Christmas Season = Christmas → Baptism of the Lord
 *     (approximated as Christmas + 14 days)
 *   - Ordinary Time otherwise
 */

export type LiturgicalSeason =
  | "ADVENT"
  | "CHRISTMAS"
  | "LENT"
  | "TRIDUUM"
  | "EASTER"
  | "ORDINARY_TIME";

/** Gregorian Easter date (Meeus / Jones / Butcher algorithm). */
export function gregorianEaster(year: number): Date {
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
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function between(d: Date, start: Date, end: Date): boolean {
  const t = startOfDay(d).getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}

/**
 * First Sunday of Advent for the supplied liturgical year. Computed as
 * the Sunday nearest to St. Andrew (Nov 30) — Catholic convention.
 */
function firstSundayOfAdvent(year: number): Date {
  const standard = new Date(Date.UTC(year, 10, 30)); // Nov 30
  const dow = standard.getUTCDay(); // 0 = Sunday
  // Sunday on or before Nov 30 closer than Sunday after.
  const offsetBefore = dow;
  const offsetAfter = (7 - dow) % 7;
  return offsetBefore <= offsetAfter
    ? addDays(standard, -offsetBefore)
    : addDays(standard, offsetAfter);
}

export interface LiturgicalContext {
  season: LiturgicalSeason;
  /** Whether today is a Sunday. */
  isSunday: boolean;
  /** Whether today is Christmas day. */
  isChristmas: boolean;
  /** Whether today is Easter Sunday. */
  isEaster: boolean;
  /** Whether today is the Annunciation (March 25). */
  isAnnunciation: boolean;
  /** Whether today is the Immaculate Conception (December 8). */
  isImmaculateConception: boolean;
  /** Whether today is the Assumption (August 15). */
  isAssumption: boolean;
  /** Whether today falls in a Marian month (May / October). */
  inMarianMonth: boolean;
  /** Date used for the computation (start-of-day UTC). */
  date: Date;
}

export function computeLiturgicalContext(date = new Date()): LiturgicalContext {
  const day = startOfDay(date);
  const year = day.getUTCFullYear();
  const easter = gregorianEaster(year);
  const ashWednesday = addDays(easter, -46);
  const holySaturday = addDays(easter, -1);
  const triduumStart = addDays(easter, -3); // Holy Thursday
  const pentecost = addDays(easter, 49);
  // Christmas season spans late December → ~Jan 8 of the next year.
  // We handle both directions so a day in early January of `year`
  // sees the previous year's Christmas season, and a day in late
  // December sees the current year's.
  const christmasThisYear = new Date(Date.UTC(year, 11, 25));
  const lastDayOfYear = new Date(Date.UTC(year, 11, 31));
  const christmasPrevYear = new Date(Date.UTC(year - 1, 11, 25));
  const baptismOfTheLordThisYear = addDays(christmasPrevYear, 14); // ≈ Jan 8 of `year`
  const advent = firstSundayOfAdvent(year);
  const adventEnd = new Date(Date.UTC(year, 11, 24));

  let season: LiturgicalSeason = "ORDINARY_TIME";
  // Easter Sunday wins over Triduum so it can be classified as EASTER.
  if (between(day, easter, pentecost)) season = "EASTER";
  else if (between(day, triduumStart, holySaturday)) season = "TRIDUUM";
  else if (between(day, ashWednesday, holySaturday)) season = "LENT";
  else if (between(day, christmasThisYear, lastDayOfYear)) season = "CHRISTMAS";
  else if (between(day, new Date(Date.UTC(year, 0, 1)), baptismOfTheLordThisYear))
    season = "CHRISTMAS";
  else if (between(day, advent, adventEnd)) season = "ADVENT";

  return {
    season,
    isSunday: day.getUTCDay() === 0,
    isChristmas: day.getTime() === christmasThisYear.getTime(),
    isEaster: day.getTime() === easter.getTime(),
    isAnnunciation: day.getUTCMonth() === 2 && day.getUTCDate() === 25,
    isImmaculateConception: day.getUTCMonth() === 11 && day.getUTCDate() === 8,
    isAssumption: day.getUTCMonth() === 7 && day.getUTCDate() === 15,
    inMarianMonth: day.getUTCMonth() === 4 || day.getUTCMonth() === 9, // May / October
    date: day,
  };
}

/**
 * Seasonal-relevance score for homepage scoring. High during the
 * major liturgical seasons + Marian months, lower in deep Ordinary
 * Time. Always in [0, 1].
 */
export function seasonalRelevance(date = new Date()): number {
  const ctx = computeLiturgicalContext(date);
  if (ctx.isEaster || ctx.isChristmas) return 1;
  if (ctx.season === "TRIDUUM") return 1;
  if (ctx.season === "ADVENT" || ctx.season === "CHRISTMAS" || ctx.season === "EASTER") return 0.95;
  if (ctx.season === "LENT") return 0.9;
  if (ctx.inMarianMonth) return 0.85;
  if (ctx.isAnnunciation || ctx.isImmaculateConception || ctx.isAssumption) return 0.95;
  if (ctx.isSunday) return 0.75;
  return 0.65;
}

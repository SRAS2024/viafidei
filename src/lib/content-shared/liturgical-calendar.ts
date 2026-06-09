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

// ─────────────────────────────────────────────────────────────────────────────
// Precise day identity (Proper of Time) for lectionary keying.
//
// The season/cycle above is not enough to look up the exact Mass readings: the
// Lectionary is keyed on the *specific* liturgical day — "2nd Sunday of Advent
// (C)", "Tuesday of the 23rd Week in Ordinary Time (I)", "The Ascension of the
// Lord". This section computes that identity deterministically for the GENERAL
// ROMAN CALENDAR (the universal calendar — no national transfers), which is the
// stable key a verified lectionary table maps to citations. The Proper of
// Saints (fixed-date sanctoral) is layered on separately.
// ─────────────────────────────────────────────────────────────────────────────

export type LiturgicalRank = "SOLEMNITY" | "FEAST" | "SUNDAY" | "WEEKDAY";

export interface LiturgicalDayDetail extends LiturgicalDay {
  /** 0 = Sunday … 6 = Saturday (UTC). */
  dayOfWeek: number;
  isSunday: boolean;
  /** Week number within the season — Advent 1–4, Lent 1–5, Easter 1–7, and
   *  Ordinary Time 1–34. 0 when the day is a stand-alone celebration (e.g. the
   *  Triduum) or the Christmas season, which the lectionary keys by date. */
  weekOfSeason: number;
  rank: LiturgicalRank;
  /** Human label, e.g. "Tuesday of the 23rd Week in Ordinary Time". */
  celebration: string;
  /** Stable Proper-of-Time key the lectionary table is indexed on, e.g.
   *  "advent-2-sunday", "ordinary-23-tuesday", "ascension", "christ-the-king",
   *  "christmas-weekday-1227". Sunday/solemnity readings also vary by
   *  `sundayCycle`; Ordinary-Time weekday first readings vary by `weekdayCycle`. */
  lectionaryKey: string;
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

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Sunday on or before a date. */
function sundayOnOrBefore(date: Date): Date {
  return addDays(date, -date.getUTCDay());
}

/**
 * Ordinary Time week number (1–34) for a date known to be in Ordinary Time.
 * First stretch (after the Baptism of the Lord) counts forward; the resumption
 * after Pentecost counts backward from Christ the King = the 34th Sunday, the
 * Sunday before Advent — the standard method that absorbs Easter's variable
 * date.
 */
function ordinaryTimeWeek(date: Date): number {
  const adventY = adventStartYear(date);
  const baptism = baptismOfTheLord(adventY + 1);
  const ashWed = addDays(easterDate(adventY + 1), -46);

  if (date.getTime() < ashWed.getTime()) {
    // First stretch: the weekdays after the Baptism Sunday are the 1st week;
    // the next Sunday is the 2nd Sunday in Ordinary Time.
    return Math.floor(dayDiff(sundayOnOrBefore(date), baptism) / 7) + 1;
  }
  // Resumption: count back from Christ the King (Sunday before next Advent).
  const christKing = addDays(firstSundayOfAdvent(adventY + 1), -7);
  const weeksBack = Math.floor(dayDiff(christKing, sundayOnOrBefore(date)) / 7);
  return 34 - weeksBack;
}

/** Week number within Advent / Lent / Easter (1-based). */
function seasonWeek(date: Date, seasonStartSunday: Date): number {
  return Math.floor(dayDiff(sundayOnOrBefore(date), seasonStartSunday) / 7) + 1;
}

interface TemporalCelebration {
  rank: LiturgicalRank;
  celebration: string;
  lectionaryKey: string;
  weekOfSeason: number;
}

/**
 * The exact Proper-of-Time celebration for a date. Easter-anchored moveable
 * solemnities and the season Sundays/weekdays resolve here; the result is the
 * lectionary key (plus the cycle letters from `liturgicalDay`).
 */
function temporalCelebration(date: Date): TemporalCelebration {
  const year = date.getUTCFullYear();
  const dow = date.getUTCDay();
  const dowName = WEEKDAY_NAMES[dow];
  const dowLabel = WEEKDAY_LABELS[dow];
  const adventY = adventStartYear(date);

  // Easter-anchored fixed points for this liturgical year.
  const easter = easterDate(adventY + 1);
  const fromEaster = dayDiff(date, easter);
  const SOL = "SOLEMNITY" as const;

  // ── Holy Week + Paschal Triduum + Easter octave + Easter-anchored days ─────
  if (fromEaster === -7)
    return single("SUNDAY", "Palm Sunday of the Passion of the Lord", "palm-sunday");
  if (fromEaster === -6) return single("WEEKDAY", "Monday of Holy Week", "holy-week-monday");
  if (fromEaster === -5) return single("WEEKDAY", "Tuesday of Holy Week", "holy-week-tuesday");
  if (fromEaster === -4) return single("WEEKDAY", "Wednesday of Holy Week", "holy-week-wednesday");
  if (fromEaster === -3) return single(SOL, "Holy Thursday", "holy-thursday");
  if (fromEaster === -2) return single(SOL, "Good Friday", "good-friday");
  if (fromEaster === -1) return single(SOL, "Holy Saturday (Easter Vigil)", "easter-vigil");
  if (fromEaster === 0) return single(SOL, "Easter Sunday", "easter-sunday");
  if (fromEaster >= 1 && fromEaster <= 6) {
    return single(SOL, `${dowLabel} within the Octave of Easter`, `easter-octave-${dowName}`);
  }
  if (fromEaster === 39) return single(SOL, "The Ascension of the Lord", "ascension");
  if (fromEaster === 49) return single(SOL, "Pentecost Sunday", "pentecost");
  if (fromEaster === 56) return single(SOL, "The Most Holy Trinity", "trinity-sunday");
  if (fromEaster === 60)
    return single(SOL, "The Most Holy Body and Blood of Christ", "corpus-christi");
  if (fromEaster === 68) return single(SOL, "The Most Sacred Heart of Jesus", "sacred-heart");

  const season = liturgicalSeasonFor(date);

  // ── Christ the King: the last Sunday before Advent (34th Sunday of OT) ──────
  const christKing = addDays(firstSundayOfAdvent(adventY + 1), -7);
  if (date.getTime() === christKing.getTime()) {
    return {
      rank: SOL,
      celebration: "Our Lord Jesus Christ, King of the Universe",
      lectionaryKey: "christ-the-king",
      weekOfSeason: 34,
    };
  }

  // ── Advent ─────────────────────────────────────────────────────────────────
  if (season === "advent") {
    // Dec 17–24 are "late Advent" weekdays keyed by date (the O Antiphons).
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (month === 12 && day >= 17 && day <= 24 && dow !== 0) {
      const md = `${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
      return {
        rank: "WEEKDAY",
        celebration: `${dowLabel}, ${ordinal(day)} December (Advent)`,
        lectionaryKey: `advent-weekday-${md}`,
        weekOfSeason: 0,
      };
    }
    const w = seasonWeek(date, firstSundayOfAdvent(adventY));
    return weekday(
      dow,
      w,
      "advent",
      `${ordinal(w)} Sunday of Advent`,
      `${ordinal(w)} Week of Advent`,
    );
  }

  // ── Christmas season (keyed by date; major feasts resolved by date) ────────
  if (season === "christmas") {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (month === 12 && day === 25) return single(SOL, "The Nativity of the Lord", "nativity");
    if (month === 1 && day === 1)
      return single(SOL, "Mary, the Holy Mother of God", "mary-mother-of-god");
    if (month === 1 && day === 6) return single(SOL, "The Epiphany of the Lord", "epiphany");
    if (date.getTime() === baptismOfTheLord(year).getTime()) {
      return single("FEAST", "The Baptism of the Lord", "baptism-of-the-lord");
    }
    // Holy Family: the Sunday in the Christmas octave (Dec 26–31), or Dec 30
    // when Christmas is a Sunday. Only ever falls in December.
    if (month === 12 && date.getTime() === holyFamilySunday(year).getTime()) {
      return single("FEAST", "The Holy Family of Jesus, Mary and Joseph", "holy-family");
    }
    const md = `${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
    const label = dow === 0 ? "Sunday after the Nativity" : `${dowLabel} of the Christmas season`;
    return {
      rank: dow === 0 ? "SUNDAY" : "WEEKDAY",
      celebration: label,
      lectionaryKey: `christmas-weekday-${md}`,
      weekOfSeason: 0,
    };
  }

  // ── Lent ─────────────────────────────────────────────────────────────────
  if (season === "lent") {
    const ashWed = addDays(easter, -46);
    if (date.getTime() === ashWed.getTime())
      return single("WEEKDAY", "Ash Wednesday", "ash-wednesday");
    if (date.getTime() > ashWed.getTime() && date.getTime() < addDays(ashWed, 4).getTime()) {
      // Thu/Fri/Sat after Ash Wednesday (before the 1st Sunday of Lent).
      return {
        rank: "WEEKDAY",
        celebration: `${dowLabel} after Ash Wednesday`,
        lectionaryKey: `lent-after-ashes-${dowName}`,
        weekOfSeason: 0,
      };
    }
    const firstSundayLent = addDays(easter, -42);
    const w = seasonWeek(date, firstSundayLent);
    return weekday(dow, w, "lent", `${ordinal(w)} Sunday of Lent`, `${ordinal(w)} Week of Lent`);
  }

  // ── Easter (octave handled above; weeks 2–7 here) ──────────────────────────
  if (season === "easter") {
    const w = seasonWeek(date, easter);
    if (dow === 0 && w === 2)
      return single("SUNDAY", "2nd Sunday of Easter (Divine Mercy)", "easter-2-sunday");
    return weekday(
      dow,
      w,
      "easter",
      `${ordinal(w)} Sunday of Easter`,
      `${ordinal(w)} Week of Easter`,
    );
  }

  // ── Ordinary Time ──────────────────────────────────────────────────────────
  const w = ordinaryTimeWeek(date);
  if (dow === 0) {
    return {
      rank: "SUNDAY",
      celebration: `${ordinal(w)} Sunday in Ordinary Time`,
      lectionaryKey: `ordinary-${w}-sunday`,
      weekOfSeason: w,
    };
  }
  return {
    rank: "WEEKDAY",
    celebration: `${dowLabel} of the ${ordinal(w)} Week in Ordinary Time`,
    lectionaryKey: `ordinary-${w}-${dowName}`,
    weekOfSeason: w,
  };

  // ── local helpers ──────────────────────────────────────────────────────────
  function single(rank: LiturgicalRank, celebration: string, key: string): TemporalCelebration {
    return { rank, celebration, lectionaryKey: key, weekOfSeason: 0 };
  }
  function weekday(
    dowNum: number,
    week: number,
    seasonKey: string,
    sundayLabel: string,
    weekLabel: string,
  ): TemporalCelebration {
    if (dowNum === 0) {
      return {
        rank: "SUNDAY",
        celebration: sundayLabel,
        lectionaryKey: `${seasonKey}-${week}-sunday`,
        weekOfSeason: week,
      };
    }
    return {
      rank: "WEEKDAY",
      celebration: `${WEEKDAY_LABELS[dowNum]} of the ${weekLabel}`,
      lectionaryKey: `${seasonKey}-${week}-${WEEKDAY_NAMES[dowNum]}`,
      weekOfSeason: week,
    };
  }
}

/** Holy Family: the Sunday in the Christmas octave, or Dec 30 if Christmas is a Sunday. */
function holyFamilySunday(year: number): Date {
  const christmas = utc(year, 12, 25);
  if (christmas.getUTCDay() === 0) return utc(year, 12, 30);
  // First Sunday after Christmas (within Dec 26–31).
  return addDays(christmas, 7 - christmas.getUTCDay());
}

interface SanctoralFeast {
  month: number;
  day: number;
  key: string;
  celebration: string;
  color: string;
}

/**
 * Principal fixed-date solemnities of the Proper of Saints. These outrank an
 * Ordinary-Time Sunday, so they override the temporal day — except where a
 * higher-ranking Advent/Lent/Easter Sunday would win (the feast then transfers,
 * which we conservatively decline to override rather than show wrong readings).
 */
const SANCTORAL: readonly SanctoralFeast[] = [
  {
    month: 8,
    day: 15,
    key: "assumption",
    celebration: "The Assumption of the Blessed Virgin Mary",
    color: "White",
  },
  { month: 11, day: 1, key: "all-saints", celebration: "All Saints", color: "White" },
  {
    month: 12,
    day: 8,
    key: "immaculate-conception",
    celebration: "The Immaculate Conception of the Blessed Virgin Mary",
    color: "White",
  },
];

function sanctoralOverride(date: Date): SanctoralFeast | null {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const feast = SANCTORAL.find((f) => f.month === month && f.day === day);
  if (!feast) return null;
  // Privileged Advent/Lent/Easter Sundays outrank these solemnities (the feast
  // transfers); don't override them. Aug 15 / Nov 1 are always in Ordinary
  // Time, where the solemnity wins even on a Sunday.
  const season = liturgicalSeasonFor(date);
  const privileged = season === "advent" || season === "lent" || season === "easter";
  if (privileged && date.getUTCDay() === 0) return null;
  return feast;
}

/**
 * The precise liturgical day for a civil date — the stable key a verified
 * lectionary table maps to Scripture citations. General Roman Calendar, with a
 * Proper-of-Saints overlay for the principal fixed-date solemnities.
 */
export function resolveLiturgicalDay(input: Date): LiturgicalDayDetail {
  const date = startOfUtcDay(input);
  const base = liturgicalDay(date);

  const sanctoral = sanctoralOverride(date);
  if (sanctoral) {
    return {
      ...base,
      color: sanctoral.color,
      dayOfWeek: date.getUTCDay(),
      isSunday: date.getUTCDay() === 0,
      weekOfSeason: 0,
      rank: "SOLEMNITY",
      celebration: sanctoral.celebration,
      lectionaryKey: sanctoral.key,
    };
  }

  const t = temporalCelebration(date);
  return {
    ...base,
    dayOfWeek: date.getUTCDay(),
    isSunday: date.getUTCDay() === 0,
    weekOfSeason: t.weekOfSeason,
    rank: t.rank,
    celebration: t.celebration,
    lectionaryKey: t.lectionaryKey,
  };
}

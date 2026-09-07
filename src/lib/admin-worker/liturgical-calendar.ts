/**
 * Liturgical calendar context for the Admin Worker's homepage scorer: the
 * current season plus a small "seasonal relevance" score.
 *
 * Thin adapter over the shared engine (src/lib/content-shared/
 * liturgical-calendar.ts) — Easter, Advent and the season boundaries are
 * computed there, once, for the whole platform; this module only maps the
 * shared season names onto the worker's upper-case vocabulary and derives
 * the scoring flags. Deterministic, no external dependencies.
 */

import {
  easterSunday,
  liturgicalSeasonFor,
  type LiturgicalSeason as SharedSeason,
} from "@/lib/content-shared/liturgical-calendar";

export type LiturgicalSeason =
  | "ADVENT"
  | "CHRISTMAS"
  | "LENT"
  | "TRIDUUM"
  | "EASTER"
  | "ORDINARY_TIME";

const SEASON_MAP: Record<SharedSeason, LiturgicalSeason> = {
  advent: "ADVENT",
  christmas: "CHRISTMAS",
  lent: "LENT",
  triduum: "TRIDUUM",
  easter: "EASTER",
  ordinary: "ORDINARY_TIME",
};

/** Gregorian Easter date (Meeus / Jones / Butcher algorithm) at UTC midnight. */
export function gregorianEaster(year: number): Date {
  const { month, day } = easterSunday(year);
  return new Date(Date.UTC(year, month - 1, day));
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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
  const easter = gregorianEaster(day.getUTCFullYear());
  return {
    season: SEASON_MAP[liturgicalSeasonFor(day)],
    isSunday: day.getUTCDay() === 0,
    isChristmas: day.getUTCMonth() === 11 && day.getUTCDate() === 25,
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

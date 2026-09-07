/**
 * Liturgical calendar context for the Admin Worker's homepage scorer: the
 * current season plus a small "seasonal relevance" score.
 *
 * Thin adapter over the shared engine (src/lib/content-shared/
 * liturgical-calendar.ts): the celebration observed on a date, its season and
 * Easter itself are all computed THERE, once, for the whole platform. This
 * module only maps the shared season names onto the worker's upper-case
 * vocabulary and turns the resolved day into scoring flags — it must never
 * re-derive a date the engine already knows. Deterministic, no external
 * dependencies.
 */

import {
  easterSunday,
  resolveLiturgicalDay,
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
  // Ask the SHARED engine which celebration the day actually is, rather than
  // testing month/day here. A second implementation of "is today Christmas?"
  // is a second thing to keep right (and the old one was blind to transfers —
  // the Annunciation moves out of Holy Week, the Assumption can be transferred).
  const resolved = resolveLiturgicalDay(day);
  const keys = new Set([resolved.lectionaryKey, resolved.temporalKey, resolved.sanctoral?.key]);
  const observes = (key: string): boolean => keys.has(key);
  return {
    season: SEASON_MAP[resolved.season],
    isSunday: resolved.isSunday,
    isChristmas: observes("nativity"),
    isEaster: observes("easter-sunday"),
    isAnnunciation: observes("annunciation"),
    isImmaculateConception: observes("immaculate-conception"),
    isAssumption: observes("assumption"),
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

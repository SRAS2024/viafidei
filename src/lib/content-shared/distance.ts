/**
 * How far away a parish is, in the visitor's own words and units.
 *
 * Three rules live here rather than inside the locator component, because all
 * of them are easy to get subtly wrong in a component and all of them have to
 * hold under test:
 *
 *  1. UNITS FOLLOW THE READER — never the coordinate, never the IP address.
 *     Every site language except English reads metric, wherever the visitor
 *     happens to be standing: a Portuguese page says kilometres even on a
 *     phone in Denver. English reads miles only where English readers do, the
 *     United States (with Liberia and Myanmar, CLDR's other US-system
 *     territories); British, Irish, Canadian, Australian and Indian English
 *     read metric. WHICH English comes from the browser's own language list
 *     (en-GB vs en-US). Deriving it from the coordinate would switch a
 *     traveller's units mid-trip, which people find disorienting.
 *  2. PRECISION SHRINKS WITH DISTANCE. Short distances go to the nearest
 *     hundred feet or hundred metres ("800 ft", "300 m"); from a thousand of
 *     those the larger unit takes over with one decimal ("1.3 mi", "2.4 km");
 *     from ten, whole numbers ("14 km"). A parish across the street reads
 *     "100 m", never "0 m", and a non-finite distance renders nothing at all.
 *  3. THE WORDS ARE THE SITE'S LANGUAGE. The number, its separators and the
 *     unit abbreviation come from Intl in the reader's regional variant of the
 *     site language ("2,4 km" in Portuguese, "2.4公里" in Chinese); the phrase
 *     around them ("{distance} away") comes from the UI dictionary.
 */

import { normalizeLocale, type Locale } from "@/lib/i18n/locales";

import { haversineMiles } from "./geo";

export type MeasurementSystem = "imperial" | "metric";

/**
 * Regions whose readers measure road distance in miles: CLDR's US-system
 * territories. The UK is deliberately absent. Its road signs still say miles,
 * but the owner asked for British English to read metric like every other
 * English outside these three.
 */
const IMPERIAL_REGIONS: ReadonlySet<string> = new Set(["US", "LR", "MM"]);

/**
 * English with no region anywhere in the browser's list is American English
 * by CLDR's likely subtags (en -> en-Latn-US), so it keeps the miles that the
 * search radius and the near API already speak.
 */
const ENGLISH_DEFAULT_REGION = "US";

/**
 * Site languages whose own tag Intl cannot format with. Latin has no CLDR
 * number data, so `Intl.NumberFormat("la")` silently borrows the runtime's
 * default locale and the same page would read "2.4 km" on one machine and
 * "2,4 km" on another. It takes the Holy See's conventions instead, which is
 * also where CLDR's likely subtags place Latin (la -> la-Latn-VA).
 */
const FORMAT_LOCALE_OVERRIDES: Partial<Record<Locale, string>> = { la: "it-VA" };

/** The measurement system a region reads, by its CLDR region code. */
export function measurementSystemForRegion(region: string): MeasurementSystem {
  return IMPERIAL_REGIONS.has(region.toUpperCase()) ? "imperial" : "metric";
}

/**
 * The browser's language list in preference order: `navigator.languages`, or
 * the lone `navigator.language` on an engine that only has that. Pass the
 * navigator explicitly so this stays a pure function (and a server render,
 * where there is no navigator, is a normal call that returns nothing).
 */
export function navigatorLocales(
  nav?: { languages?: unknown; language?: unknown } | null,
): string[] {
  if (!nav) return [];
  const list =
    Array.isArray(nav.languages) && nav.languages.length > 0 ? nav.languages : [nav.language];
  return list.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "");
}

/** Parsed tags in preference order; a malformed one ("en_US", "x") is skipped. */
function parseTags(locales: unknown): Intl.Locale[] {
  const list = typeof locales === "string" ? [locales] : Array.isArray(locales) ? locales : [];
  const tags: Intl.Locale[] = [];
  for (const raw of list) {
    if (typeof raw !== "string" || raw.trim() === "") continue;
    try {
      tags.push(new Intl.Locale(raw.trim()));
    } catch {
      // Intl.Locale throws on a malformed tag rather than resolving it.
    }
  }
  return tags;
}

/**
 * Where the reader's conventions come from. The first tag that names a region
 * outright wins: "en-GB", but equally "fr-CA" or "es-US" ahead of a bare "en",
 * because it is the most specific thing the browser says about its reader.
 * Failing that, the region the first language implies (en -> US, de -> DE).
 */
function readerRegion(tags: readonly Intl.Locale[]): string | null {
  for (const tag of tags) if (tag.region) return tag.region;
  for (const tag of tags) {
    try {
      const region = tag.maximize().region;
      if (region) return region;
    } catch {
      // Keep looking.
    }
  }
  return null;
}

/**
 * The tag Intl formats with: the reader's own regional variant of the site
 * language when the browser lists one ("en-GB" on an English page, "pt-PT" on
 * a Portuguese one), so separators and abbreviations read the way the reader
 * expects; otherwise the site language itself.
 */
function formattingLocale(site: Locale, tags: readonly Intl.Locale[]): string {
  const override = FORMAT_LOCALE_OVERRIDES[site];
  if (override) return override;
  // Canonical form, so the site's "tl" matches a browser's "fil-PH". An engine
  // without Intl.Locale (Safari before 14) parsed no tags, so nothing matches.
  let language: string;
  try {
    language = new Intl.Locale(site).language;
  } catch {
    return site;
  }
  for (const tag of tags) if (tag.language === language) return tag.baseName;
  return site;
}

/** Everything needed to state a distance: units, and the locale to word it in. */
export type DistanceDisplay = {
  /** The BCP-47 tag Intl formats with: "en-GB", "pt", "zh-TW", "it-VA". */
  locale: string;
  system: MeasurementSystem;
};

/**
 * Units and formatting locale for one visitor, from the site language (the
 * `vf_locale` cookie, else Accept-Language) and the browser's language list.
 * Anything that is not a supported site language reads as English.
 */
export function resolveDistanceDisplay(
  siteLocale: unknown,
  deviceLocales: unknown,
): DistanceDisplay {
  const site = normalizeLocale(typeof siteLocale === "string" ? siteLocale : null);
  const tags = parseTags(deviceLocales);
  const system =
    site === "en"
      ? measurementSystemForRegion(readerRegion(tags) ?? ENGLISH_DEFAULT_REGION)
      : "metric";
  return { locale: formattingLocale(site, tags), system };
}

/** Intl's unit identifiers, so a measurement can be formatted as-is. */
export type DistanceUnit = "foot" | "mile" | "meter" | "kilometer";

/** A distance rounded the way it will be read. */
export type MeasuredDistance = {
  value: number;
  unit: DistanceUnit;
  /** 1 for "2.4 km" and "1.3 mi"; 0 for "300 m", "800 ft" and "14 km". */
  fractionDigits: 0 | 1;
};

const FEET_PER_MILE = 5280;
const METRES_PER_MILE = 1609.344;
const KM_PER_MILE = 1.609344;

const SCALES: Record<
  MeasurementSystem,
  { small: DistanceUnit; smallPerMile: number; large: DistanceUnit; largePerMile: number }
> = {
  imperial: { small: "foot", smallPerMile: FEET_PER_MILE, large: "mile", largePerMile: 1 },
  metric: {
    small: "meter",
    smallPerMile: METRES_PER_MILE,
    large: "kilometer",
    largePerMile: KM_PER_MILE,
  },
};

/** Short distances are stated to the nearest hundred feet or hundred metres… */
const SHORT_STEP = 100;
/** …until that would read a thousand: 1,000 ft is 0.2 mi and 1,000 m is 1 km. */
const SHORT_LIMIT = 1000;
/** One decimal below ten of the larger unit ("2.4 km"), whole numbers from ten. */
const WHOLE_FROM = 10;

/**
 * Round a distance for display, or null for one that cannot be stated
 * honestly (NaN, Infinity, a missing coordinate upstream). A negative input is
 * clamped rather than rendered: distance has no sign, and a floating-point
 * -0.0000001 from a coordinate diff must not print a minus.
 */
export function measureDistance(
  miles: unknown,
  system: MeasurementSystem,
): MeasuredDistance | null {
  if (typeof miles !== "number" || !Number.isFinite(miles)) return null;
  const safe = Math.max(0, miles);
  const { small, smallPerMile, large, largePerMile } = SCALES[system];

  const hundreds = Math.round((safe * smallPerMile) / SHORT_STEP) * SHORT_STEP;
  if (hundreds < SHORT_LIMIT) {
    // Standing at the door still reads as a distance: the smallest step, never 0.
    return { value: Math.max(SHORT_STEP, hundreds), unit: small, fractionDigits: 0 };
  }
  const inLarge = safe * largePerMile;
  const tenths = Math.round(inLarge * 10) / 10;
  if (tenths < WHOLE_FROM) return { value: tenths, unit: large, fractionDigits: 1 };
  return { value: Math.round(inLarge), unit: large, fractionDigits: 0 };
}

/** What follows the number on an engine without Intl unit formatting. */
const UNIT_SYMBOLS: Record<DistanceUnit, string> = {
  foot: "ft",
  mile: "mi",
  meter: "m",
  kilometer: "km",
};

/**
 * A distance in the reader's notation, without the surrounding phrase:
 * "800 ft", "1.3 mi", "300 m", "2,4 km", "2.4公里". Null when there is no
 * distance to state.
 */
export function formatDistance(miles: unknown, display: DistanceDisplay): string | null {
  const measured = measureDistance(miles, display.system);
  if (!measured) return null;
  try {
    return new Intl.NumberFormat(display.locale, {
      style: "unit",
      unit: measured.unit,
      unitDisplay: "short",
      minimumFractionDigits: measured.fractionDigits,
      maximumFractionDigits: measured.fractionDigits,
    }).format(measured.value);
  } catch {
    // Unit formatting arrived in Safari 14.1; an older engine still gets a figure.
    return `${measured.value.toFixed(measured.fractionDigits)} ${UNIT_SYMBOLS[measured.unit]}`;
  }
}

/**
 * The English phrase, and the fallback for a template that has lost its
 * placeholder (a raw dictionary key, say) so the distance is never dropped.
 */
export const DISTANCE_AWAY_FALLBACK = "{distance} away";

/**
 * The line shown under a parish name, from the dictionary's
 * `parishes.distanceAway` template: "2.4 km away", "A 2,4 km de distância",
 * "距您2.4公里". Null when there is no distance to state.
 */
export function formatDistanceAway(
  miles: unknown,
  display: DistanceDisplay,
  template?: string | null,
): string | null {
  const distance = formatDistance(miles, display);
  if (distance === null) return null;
  const phrase =
    typeof template === "string" && template.includes("{distance}")
      ? template
      : DISTANCE_AWAY_FALLBACK;
  // A replacer function, so nothing in the formatted text is read as a `$` pattern.
  return phrase.replace("{distance}", () => distance);
}

function counted(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

/**
 * A SEARCH RADIUS in words for the locator's English explanation: "50 miles",
 * "80 kilometres". Deliberately not `formatDistance`: a radius is a round
 * number we chose, so "50.0 miles" would read like a measurement of something
 * rather than the size of the search.
 */
export function formatRadius(miles: unknown, system: MeasurementSystem): string | null {
  if (typeof miles !== "number" || !Number.isFinite(miles)) return null;
  const safe = Math.max(0, miles);
  return system === "imperial"
    ? counted(Math.round(safe), "mile", "miles")
    : counted(Math.round(safe * KM_PER_MILE), "kilometre", "kilometres");
}

export type Coordinate = { latitude: number; longitude: number };

/**
 * Great-circle miles from the visitor to a parish, or null when either point
 * has no usable coordinate. The API also returns a SQL distance for ordering;
 * this recomputes the number actually shown from the visitor's own fix, so the
 * label cannot drift from the coordinate the device just handed us.
 */
export function parishDistanceMiles(from: Coordinate, to: Partial<Coordinate>): number | null {
  const { latitude, longitude } = to;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!Number.isFinite(from.latitude) || !Number.isFinite(from.longitude)) return null;
  return haversineMiles(from.latitude, from.longitude, latitude, longitude);
}

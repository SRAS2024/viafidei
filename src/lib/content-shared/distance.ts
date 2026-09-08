/**
 * How far away a parish is, in words.
 *
 * Two rules live here rather than inside the locator component because both
 * have to work server-side and under test, and both are easy to get subtly
 * wrong in a component:
 *
 *  1. UNITS COME FROM THE DEVICE, NOT FROM THE COORDINATE. A US-configured
 *     phone in Rome still reads miles; a German phone in Denver still reads
 *     kilometres. Deriving the unit from where the visitor is standing would
 *     silently switch a traveller's units mid-trip, which is exactly the
 *     behaviour people find disorienting.
 *  2. THE THRESHOLDS. A parish across the street must not read "0.0 miles
 *     away", and a negative or non-finite distance must not render at all.
 */

import { haversineMiles } from "./geo";

export type MeasurementSystem = "imperial" | "metric";

/**
 * Regions whose everyday distances are miles. The US, Liberia and Myanmar are
 * imperial outright; the UK is metric by law but every road sign, car and
 * person still says miles, which is the only unit this feature reports.
 */
const IMPERIAL_REGIONS: ReadonlySet<string> = new Set(["US", "LR", "MM", "GB"]);

/**
 * When the runtime reports no usable locale at all we keep the unit the rest
 * of this feature already speaks: the API, the stored distances and the
 * widening ladder are all in miles, so converting on a "no idea" signal would
 * be a guess dressed up as a measurement.
 */
const FALLBACK_SYSTEM: MeasurementSystem = "imperial";

/**
 * `Intl.Locale.prototype.measurementSystem` is still a proposal — Node 22 and
 * several shipping browsers leave it undefined — so it is read when present
 * and the region allow-list answers otherwise.
 */
function declaredSystem(locale: Intl.Locale): MeasurementSystem | null {
  const declared = (locale as { measurementSystem?: unknown }).measurementSystem;
  if (declared === "metric") return "metric";
  // The proposal's imperial values are "us" and "uk".
  if (declared === "us" || declared === "uk") return "imperial";
  return null;
}

/**
 * The measurement system a single BCP-47 tag implies, or null when the tag is
 * unusable or names a region nobody has an opinion about.
 */
export function measurementSystemForLocale(locale: unknown): MeasurementSystem | null {
  if (typeof locale !== "string" || locale.trim() === "") return null;
  let parsed: Intl.Locale;
  try {
    parsed = new Intl.Locale(locale.trim());
  } catch {
    // A malformed tag ("x", "", "en_US") throws rather than resolving.
    return null;
  }
  const declared = declaredSystem(parsed);
  if (declared) return declared;
  // A bare language ("en", "de") carries no region; likely-subtags resolution
  // supplies the one the tag implies (en -> US, de -> DE), which is what a
  // browser means when it sends "en".
  let region = parsed.region ?? null;
  if (!region) {
    try {
      region = parsed.maximize().region ?? null;
    } catch {
      region = null;
    }
  }
  if (!region) return null;
  return IMPERIAL_REGIONS.has(region.toUpperCase()) ? "imperial" : "metric";
}

/** The first tag in preference order that resolves; the fallback otherwise. */
export function measurementSystemForLocales(locales: unknown): MeasurementSystem {
  const list = typeof locales === "string" ? [locales] : Array.isArray(locales) ? locales : [];
  for (const tag of list) {
    const system = measurementSystemForLocale(tag);
    if (system) return system;
  }
  return FALLBACK_SYSTEM;
}

/**
 * The device's measurement system, read from the navigator's language
 * preferences. Pass the navigator explicitly so this stays a pure function
 * (and so a server render, where there is no navigator, is a normal call).
 */
export function deviceMeasurementSystem(
  nav?: { languages?: unknown; language?: unknown } | null,
): MeasurementSystem {
  if (!nav) return FALLBACK_SYSTEM;
  const languages = Array.isArray(nav.languages) ? nav.languages : null;
  if (languages && languages.length > 0) return measurementSystemForLocales(languages);
  return measurementSystemForLocales(nav.language);
}

const FEET_PER_MILE = 5280;
const METRES_PER_MILE = 1609.344;
const KM_PER_MILE = 1.609344;
/** Below a tenth of a mile, "0.1 miles" is less useful than whole feet. */
const MILES_BELOW_WHICH_FEET = 0.1;
/**
 * Below a kilometre, whole metres. The metric switch sits higher than the
 * imperial one on purpose: "0.2 kilometres away" is a worse thing to read than
 * "150 metres away" for a parish you can see from where you are standing, and
 * a kilometre is where mapping apps change unit too.
 */
const METRES_BELOW_WHICH_METRES = 1000;
/** At three digits a tenth of a mile is noise, and reads like a machine. */
const WHOLE_NUMBERS_AT = 100;

function decimalOrWhole(value: number): string {
  return value >= WHOLE_NUMBERS_AT ? Math.round(value).toLocaleString("en-US") : value.toFixed(1);
}

function counted(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

/**
 * A distance in words, without the trailing "away" — "150 feet", "3.2 miles",
 * "150 metres", "12.4 kilometres". Returns null for a distance that cannot be
 * shown honestly (NaN, Infinity, a missing coordinate upstream).
 *
 * A negative input is clamped rather than rendered: distance has no sign, and
 * a floating-point -0.0000001 from a coordinate diff must not print a minus.
 */
export function formatDistance(miles: unknown, system: MeasurementSystem): string | null {
  if (typeof miles !== "number" || !Number.isFinite(miles)) return null;
  const safe = Math.max(0, miles);

  if (system === "imperial") {
    if (safe < MILES_BELOW_WHICH_FEET) {
      // Standing on the doorstep still reads as a distance, never "0 feet".
      return counted(Math.max(1, Math.round(safe * FEET_PER_MILE)), "foot", "feet");
    }
    return `${decimalOrWhole(safe)} miles`;
  }

  const metres = safe * METRES_PER_MILE;
  if (metres < METRES_BELOW_WHICH_METRES) {
    return counted(Math.max(1, Math.round(metres)), "metre", "metres");
  }
  return `${decimalOrWhole(safe * KM_PER_MILE)} kilometres`;
}

/**
 * A SEARCH RADIUS in words — "50 miles", "80 kilometres". Deliberately not
 * `formatDistance`: a radius is a round number we chose, so "50.0 miles" reads
 * like a measurement of something rather than the size of the search.
 */
export function formatRadius(miles: unknown, system: MeasurementSystem): string | null {
  if (typeof miles !== "number" || !Number.isFinite(miles)) return null;
  const safe = Math.max(0, miles);
  return system === "imperial"
    ? counted(Math.round(safe), "mile", "miles")
    : counted(Math.round(safe * KM_PER_MILE), "kilometre", "kilometres");
}

/** The line shown under a parish name: "0.1 miles away", "150 feet away". */
export function formatDistanceAway(miles: unknown, system: MeasurementSystem): string | null {
  const distance = formatDistance(miles, system);
  return distance === null ? null : `${distance} away`;
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

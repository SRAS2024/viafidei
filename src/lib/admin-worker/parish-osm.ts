/**
 * Keyless OpenStreetMap (Overpass API) parish discovery — the tile sweep.
 *
 * Google Maps parish discovery (parish-discovery-runner.ts) needs a
 * `GOOGLE_PLACES_API_KEY`. This is the keyless, free, public-data path: a
 * persistent sweep of ~1° tiles over the Catholic world (parish-osm-tiles.ts)
 * asks Overpass (parish-osm-overpass.ts, one polite query at a time under a
 * daily budget) for churches tagged `amenity=place_of_worship` +
 * `religion=christian` + `denomination=roman_catholic|catholic`, and publishes
 * the named ones deterministically on that tag through the strict parish
 * schema + the real publish orchestrator.
 *
 * What this lane does NOT do: fetch parish websites. That is the separate,
 * bounded `runParishWebsiteVerification` lane (parish-website-verification.ts),
 * which checks communion with Rome against each site over time and
 * unpublishes (with a review row) anything that proves NOT to be in
 * communion. Splitting the two is what lets discovery publish hundreds per
 * run within its watchdog instead of stalling on 10-second site fetches.
 *
 * Nothing is invented: a candidate needs its OSM name plus EITHER a locality
 * tag OR coordinates. Wayside shrines, crosses, grottoes and numbered Stations
 * of the Cross are not parishes and are never candidates. Before a tile's new
 * candidates are deduped they are looked up by OSM id on Nominatim in batches
 * of 50 (nominatim-lookup.ts), which fills a blank street, postcode, locality
 * and state — and replaces a TILE-fallback country, never an `addr:country`
 * tag. When that lookup is unavailable (budget, cooldown) the parish publishes
 * as before and the address-research lane completes it later; a missing city
 * may still come from `is_in` or one bounded reverse lookup. Dedup runs
 * cheapest-first — sourceRef, the shared address rule (same key AND within
 * 250 m, plus the same name for a street without a house number;
 * parish-address.ts), same-name-within-200 m, then slug (a collision
 * gets a stable suffix, never a silent skip) — and a re-swept parish enriches
 * its own row in place. Every run is bounded (publish cap checked BEFORE any
 * per-candidate work, a wall-clock deadline under the lane watchdog) and
 * resumable (per-tile progress is persisted).
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import { isDoctrinallySensitive } from "./content-type-profiles";
import { applyProtectedContentUpdate } from "./content-protection";
import { runPublishOrchestrator } from "./publish-orchestrator";
import {
  designationFor,
  fileReview,
  slugify,
  type ParishDesignation,
} from "./parish-discovery-runner";
import { findDuplicateParish, normalizedParishName, parishAddressKey } from "./parish-address";
import { composeStreetLine, countryNameFor, normalizePostalCode } from "./parish-address-format";
import {
  addressPrecisionOf,
  nextAddressResearchMeta,
  type AddressPrecision,
  type AddressResearchMeta,
} from "./parish-address-status";
import {
  lookupOsmPlaces,
  nominatimAddressParts,
  NOMINATIM_MAX_IDS_PER_REQUEST,
  type NominatimPlace,
} from "./nominatim-lookup";
import type { PlaceParish } from "./parish-places";
import { writeAdminWorkerLog } from "./logs";
import {
  claimDueTiles,
  clearTileActive,
  emptyResweepMs,
  enqueueTiles,
  markTileActive,
  osmTileProgress,
  resweepMs,
  splitTile,
  writeTileState,
  type OsmTile,
  type OsmTileState,
} from "./parish-osm-tiles";
import {
  buildTileQuery,
  overpassBudgetRemaining,
  runOverpassQuery,
  type OverpassElement,
} from "./parish-osm-overpass";
import {
  reverseLookupCapPerRun,
  reverseLookupCity,
  type ReverseLookupBudget,
} from "./parish-geocode";

/** Positive integer from an env var, or the fallback. */
function osmEnvInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Lane cadence. Politeness toward Overpass is enforced by the persisted
// daily query budget + request spacing (parish-osm-overpass.ts), so the run
// throttle can be short: 3 min by default, env-tunable
// (`ADMIN_WORKER_OSM_THROTTLE_MS`).
const THROTTLE_MS = osmEnvInt("ADMIN_WORKER_OSM_THROTTLE_MS", 3 * 60 * 1000);
// Max elements per tile query. A tile that returns exactly this many is
// DENSE and gets quartered, so no element is ever silently truncated.
const OUT_CAP = osmEnvInt("ADMIN_WORKER_OSM_OUT_CAP", 500);
// Wall-clock budget per run — comfortably under the lane's 8-minute watchdog
// so a run always persists its own progress instead of being killed mid-tile.
const RUN_BUDGET_MS = osmEnvInt("ADMIN_WORKER_OSM_RUN_BUDGET_MS", 6 * 60 * 1000);
// A candidate that fails the publish gate is remembered for this long so the
// sweep does not retry it (and its DB lookups) on every visit to its tile.
const SKIP_DAYS = osmEnvInt("ADMIN_WORKER_OSM_SKIP_DAYS", 7);
const DAY_MS = 24 * 60 * 60 * 1000;
/** Consecutive runs that may die inside one tile without progress before it is parked. */
const MAX_NO_PROGRESS_ATTEMPTS = 3;
const THROTTLE_KEY = "osm-parish-lastrun";
const SKIP_PREFIX = "osm-skip:";
/** Same-name proximity window (~200 m) for the geo dedup. */
const NEARBY_DEG = 0.002;

/** Keyless + on by default; disabled in skip-network and via opt-out env. */
export function osmParishDiscoveryEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_OSM_PARISHES ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

// ── Acceptance: map an OSM element to a candidate, inventing nothing ────────

/**
 * Latin and Eastern Catholic churches in full communion with Rome, by the OSM
 * `denomination` values mappers actually use, with the adjective a summary
 * gives each. Every other value (old_catholic, polish_catholic,
 * catholic_apostolic, liberal_catholic, catholic_sspx, buildings shared with a
 * Protestant or Orthodox body, ...) is a different body.
 */
export const COMMUNION_DENOMINATIONS: Readonly<Record<string, string>> = {
  catholic: "Catholic",
  roman_catholic: "Roman Catholic",
  latin_catholic: "Catholic",
  "roman_catholic;catholic": "Catholic",
  "catholic;roman_catholic": "Catholic",
  "roman_catholic;greek_catholic": "Catholic",
  "greek_catholic;roman_catholic": "Catholic",
  ukrainian_greek_catholic: "Ukrainian Greek Catholic",
  ukrainian_catholic: "Ukrainian Greek Catholic",
  greek_catholic: "Greek Catholic",
  maronite: "Maronite Catholic",
  "syro-malabar_catholic": "Syro-Malabar Catholic",
  "syro-malankara_catholic": "Syro-Malankara Catholic",
  malankara_catholic: "Syro-Malankara Catholic",
  syriac_catholic: "Syriac Catholic",
  armenian_catholic: "Armenian Catholic",
  chaldean_catholic: "Chaldean Catholic",
  byzantine_catholic: "Byzantine Catholic",
  ruthenian_catholic: "Ruthenian Greek Catholic",
  slovak_greek_catholic: "Slovak Greek Catholic",
  hungarian_greek_catholic: "Hungarian Greek Catholic",
  romanian_greek_catholic: "Romanian Greek Catholic",
  romanian_catholic: "Catholic",
  melkite_greek_catholic: "Melkite Greek Catholic",
  melkite: "Melkite Greek Catholic",
  coptic_catholic: "Coptic Catholic",
  ethiopian_catholic: "Ethiopian Catholic",
  eritrean_catholic: "Eritrean Catholic",
};

export function isCommunionDenomination(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMMUNION_DENOMINATIONS, value);
}

const LOCALITY_TAGS = [
  "addr:city",
  "addr:town",
  "addr:place",
  "addr:suburb",
  "addr:village",
  "addr:hamlet",
  "is_in:city",
  "is_in:town",
  "is_in:village",
] as const;

/** Locality from the element's own tags (never derived from a county/state). */
export function localityFromTags(tags: Record<string, string>): string {
  for (const key of LOCALITY_TAGS) {
    const v = (tags[key] ?? "").trim();
    if (v) return v;
  }
  // `is_in` is "City, Region, Country": only a multi-part value names a city.
  const isIn = (tags.is_in ?? "").split(/[,;]/).map((s) => s.trim());
  if (isIn.length >= 2 && isIn[0]) return isIn[0];
  return "";
}

// Moved to the shared address modules; re-exported for existing callers.
export { countryNameFor, normalizedParishName };

// ── Not a parish: wayside shrines, crosses and Stations of the Cross ────────

/** Typed reason a mapped place of worship is not a parish. */
export type ParishExclusionReason =
  | "wayside-shrine"
  | "wayside-chapel"
  | "wayside-cross"
  | "lourdes-grotto"
  | "cross"
  | "stations-of-the-cross"
  | "funerary-chapel"
  | "private"
  | "generic-name";

export interface ParishExclusion {
  reason: ParishExclusionReason;
  /** The tag or name that decided it, for the audit trail. */
  evidence: string;
}

const EXCLUDED_PLACE_OF_WORSHIP = new Map<string, ParishExclusionReason>([
  ["wayside_shrine", "wayside-shrine"],
  ["wayside_chapel", "wayside-chapel"],
  ["cross", "cross"],
  ["lourdes_grotto", "lourdes-grotto"],
]);
const EXCLUDED_HISTORIC = new Map<string, ParishExclusionReason>([
  ["wayside_shrine", "wayside-shrine"],
  ["wayside_cross", "wayside-cross"],
]);
/**
 * Whole names that are unambiguously one numbered Station of the Cross:
 * "Kreuzwegstation V", "2e Statie" … "14e Statie", "Statie I" … "Statie XIV",
 * "Die dritte Schmerz Mariens". Name patterns are otherwise unreliable ("Grote
 * of Sint-Laurenskerk" is a large church), so the tags decide everything else.
 */
const STATIONS_OF_THE_CROSS_RE: readonly RegExp[] = [
  /^kreuzwegstation\s+([ivxlc]+|\d+)$/i,
  /^\d+(e|de|ste)?\s+statie$/i,
  /^statie\s+([ivxlc]+|\d+)$/i,
  /^((der|die)\s+)?(erste|zweite|dritte|vierte|f(ü|ue)nfte|sechste|sieb(en)?te|\d+\.)\s+schmerz(en)?\s+mariens$/i,
];

/** A cemetery or funeral chapel, a wayside marker, or a small shrine by name. */
const FUNERARY_OR_WAYSIDE_NAME_RE =
  /(friedhofs?kapelle|aussegnungshalle|leichenhalle|trauerhalle|kaplica cmentarna|cemetery chapel|chapel of rest|chapelle fun[ée]raire|mortuary|kapliczka|bildstock|wegkreuz|flurkreuz|feldkreuz|hofkreuz|marterl)/i;

/**
 * Whole names that only describe a kind of chapel or church ("Kaplica domowa" -
 * house chapel, "Kapelle", "Chapelle", "Church"): they name no place a reader
 * can identify, so such a record is left out rather than published bare.
 */
const GENERIC_PLACE_NAMES = new Set([
  "chapel",
  "kapelle",
  "chapelle",
  "capilla",
  "cappella",
  "kaplica",
  "kapel",
  "capela",
  "kaple",
  "kapela",
  "kaplnka",
  "church",
  "kirche",
  "eglise",
  "église",
  "iglesia",
  "chiesa",
  "kosciol",
  "kościół",
  "igreja",
  "kerk",
  "oratorio",
  "oratory",
  "oratoire",
  "pfarrkirche",
  "parish church",
  "catholic church",
  "roman catholic church",
  "chiesa parrocchiale",
  "parroquia",
  "paroisse",
  "parafia",
  "kaplica domowa",
  "kaplica szpitalna",
  "kaplica dojazdowa",
  "kaplica cmentarna",
  "kaplica zakonna",
  "kaplica publiczna",
  "kaplica prywatna",
  "kaplica filialna",
  "hauskapelle",
  "krankenhauskapelle",
  "schulkapelle",
  "klosterkapelle",
  "chapelle de l'hôpital",
  "chapelle de l'hopital",
  "chapelle privée",
  "hospital chapel",
  "house chapel",
  "private chapel",
  "convent chapel",
  "capilla del hospital",
  "cappella dell'ospedale",
  "cappella privata",
]);

/**
 * Why a Catholic place of worship is NOT a parish, from its OSM tags
 * (`place_of_worship`, `historic`, `man_made`) or a strict Stations-of-the-
 * Cross name — or null. Used for new candidates (Overpass tags) and for
 * already-published rows (Nominatim extratags) alike.
 */
export function parishExclusionFor(
  name: string,
  tags: Record<string, string> = {},
): ParishExclusion | null {
  const tag = (k: string) => (tags[k] ?? "").trim().toLowerCase();
  const pow = EXCLUDED_PLACE_OF_WORSHIP.get(tag("place_of_worship"));
  if (pow) return { reason: pow, evidence: `place_of_worship=${tag("place_of_worship")}` };
  const historic = EXCLUDED_HISTORIC.get(tag("historic"));
  if (historic) return { reason: historic, evidence: `historic=${tag("historic")}` };
  if (tag("man_made") === "cross") return { reason: "cross", evidence: "man_made=cross" };
  // A private chapel (a house, convent or institution's own) is not open to the faithful.
  if (tag("access") === "private" || tag("access") === "no")
    return { reason: "private", evidence: `access=${tag("access")}` };
  const trimmed = name.trim();
  if (STATIONS_OF_THE_CROSS_RE.some((re) => re.test(trimmed)))
    return { reason: "stations-of-the-cross", evidence: `name "${trimmed}"` };
  if (FUNERARY_OR_WAYSIDE_NAME_RE.test(trimmed))
    return { reason: "funerary-chapel", evidence: `name "${trimmed}"` };
  if (GENERIC_PLACE_NAMES.has(trimmed.toLowerCase()))
    return { reason: "generic-name", evidence: `name "${trimmed}"` };
  return null;
}

/** How long discovery stays away from a row kept down as not a parish. */
export const EXCLUDED_SKIP_MS = 365 * DAY_MS;

// ── The published summary sentence ──────────────────────────────────────────

const DESIGNATION_WORD: Record<ParishDesignation, string> = {
  parish: "parish",
  chapel: "chapel",
  shrine: "shrine",
  cathedral: "cathedral",
  "major-basilica": "major basilica",
  "minor-basilica": "minor basilica",
  oratory: "oratory",
};

/** The one factual sentence an OSM parish is published with. */
export function osmParishSummary(input: {
  name: string;
  designation: ParishDesignation;
  denomination?: string;
  city?: string;
  country?: string;
}): string {
  const body =
    (input.denomination && COMMUNION_DENOMINATIONS[input.denomination]) ||
    (input.denomination === "roman_catholic" ? "Roman Catholic" : "Catholic");
  const where = [input.city, input.country]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const kind = DESIGNATION_WORD[input.designation] ?? "parish";
  return `${input.name} is a ${body} ${kind}${where ? ` in ${where}` : ""}, listed in OpenStreetMap as a Catholic place of worship.`;
}

/** Both machine forms: the current sentence and the original one, which ended
 * with `(denomination "…")`. */
const MACHINE_SUMMARY_RE =
  /^(.+) is a (Roman Catholic|Catholic) (parish|chapel|shrine|cathedral|major basilica|minor basilica)(?: in (.+?))?, listed in OpenStreetMap as a Catholic place of worship(?: \(denomination "(?:roman_catholic|catholic)"\))?\.$/;

/**
 * When `summary` is still the machine-written sentence for `title` (so it may
 * be regenerated as its facts change), its denomination; null for anything a
 * person wrote or edited.
 */
export function machineParishSummary(
  summary: unknown,
  title: string,
): { denomination: "roman_catholic" | "catholic" } | null {
  if (typeof summary !== "string") return null;
  const m = MACHINE_SUMMARY_RE.exec(summary.trim());
  if (!m || m[1] !== title.trim()) return null;
  return { denomination: m[2] === "Roman Catholic" ? "roman_catholic" : "catholic" };
}

export interface OsmCandidate extends PlaceParish {
  /** The OSM denomination value that admitted it (`roman_catholic` | `catholic`). */
  denomination: string;
  osmType: string;
  osmId: number;
  /** Slug base derived from the English name when the local one is non-Latin. */
  slugBase: string;
  /** The `name:en` tag, for the slug when the name itself has no Latin word. */
  englishName?: string;
  /** From OSM tags (`building`, `place_of_worship`, `church:type`, …) and the name. */
  designation: ParishDesignation;
  /**
   * Where `countryCode` came from: the element's `addr:country` tag, the
   * tile's fallback, or a Nominatim answer. Only a tile fallback may be
   * replaced — a tag is the mapper's own statement.
   */
  countrySource?: "tag" | "tile" | "nominatim";
  /**
   * The element's own street, house number and postcode tags, as mapped. The
   * street line's order and the postcode's format depend on the country, so
   * both are derived again when a lookup replaces a tile-fallback country.
   * `street` is empty when the line is `addr:full`, which is kept as written.
   */
  addressTags?: { street: string; houseNumber: string; postcode: string };
  /** Set when a Nominatim lookup answered for this candidate at discovery; the
   * row then publishes with its research state (`_meta.addressResearch`). */
  addressLookup?: {
    /** False when Nominatim answered without this object. */
    returned: boolean;
    /** True when the answer filled or corrected at least one field. */
    used: boolean;
    precision: AddressPrecision;
    at: number;
  };
}

/**
 * A website tag as a usable https URL: a scheme-less value ("stmarys.org")
 * gets https:// when it then parses as a URL with a real host; anything else
 * (free text, credentials, another scheme) is dropped.
 */
function websiteFromTag(raw: string): string | undefined {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return undefined;
  const url = /^https?:\/\//i.test(value)
    ? value
    : /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
      ? ""
      : `https://${value}`;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || !parsed.hostname.includes(".")) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

/**
 * The slug base for a church: its name — or `name:en` when the name is in a
 * script slugify cannot spell — with the locality. "" when neither name has a
 * Latin word: a locality alone ("new-york") names no church, and every
 * non-Latin church in a city would compete for it.
 */
function parishSlugBase(name: string, englishName: string | undefined, locality: string): string {
  const named = [name, englishName ?? ""].find((n) => slugify(n) !== "");
  return named ? slugify(`${named} ${locality}`) : "";
}

/**
 * Map one Overpass element to a parish candidate, or null when it is not an
 * explicitly Catholic, named church that can be located (a locality tag OR
 * coordinates), or is not a parish at all (`parishExclusionFor`). `fallback`
 * supplies the tile's country when the element has no `addr:country`.
 * Exported for testing.
 */
export function osmElementToParish(
  el: OverpassElement,
  fallback: { countryCode?: string } = {},
): OsmCandidate | null {
  const tags = el.tags ?? {};
  const rawName = (tags.name ?? "").trim();
  if (!rawName) return null;
  // Display names start with a capital ("chiesa parrocchiale X" -> "Chiesa parrocchiale X").
  const name = rawName.charAt(0).toLocaleUpperCase() + rawName.slice(1);
  const denomination = (tags.denomination ?? "").trim().toLowerCase();
  if (!isCommunionDenomination(denomination)) return null;
  const religion = (tags.religion ?? "").trim().toLowerCase();
  if (religion && religion !== "christian") return null;
  // A ruin or a closed church is not a parish anyone can attend.
  if (tags.ruins === "yes" || tags.disused === "yes" || tags.abandoned === "yes") return null;
  if (tags["disused:amenity"] || tags["abandoned:amenity"]) return null;
  // Nor is a wayside shrine, a cross, a grotto or a Station of the Cross.
  if (parishExclusionFor(name, tags)) return null;
  if (!el.type || el.id == null) return null;

  const lat = typeof el.lat === "number" ? el.lat : el.center?.lat;
  const lon = typeof el.lon === "number" ? el.lon : el.center?.lon;
  const hasCoords = typeof lat === "number" && typeof lon === "number";
  const city = localityFromTags(tags);
  if (!city && !hasCoords) return null;

  const rawCountry = (tags["addr:country"] ?? "").trim().toUpperCase();
  const taggedCountry = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : undefined;
  const countryCode = taggedCountry ?? fallback.countryCode;

  // The street line in the country's own order ("Hauptstraße 12", "12 Main
  // St"). A hamlet addressed by place + number ("Lhota 12") uses addr:place
  // as its street; a house number alone is no street line at all.
  const full = (tags["addr:full"] ?? "").trim();
  const houseNumber = (tags["addr:housenumber"] ?? "").trim();
  const street =
    (tags["addr:street"] ?? "").trim() || (houseNumber ? (tags["addr:place"] ?? "").trim() : "");
  const address = full || composeStreetLine(street, houseNumber, countryCode);

  const website = websiteFromTag(tags.website || tags["contact:website"] || "");
  const phone = (tags.phone || tags["contact:phone"] || "").trim() || undefined;

  const osmRef = `${el.type}/${el.id}`;
  const englishName = (tags["name:en"] ?? "").trim();

  return {
    name,
    formattedAddress: address,
    city: city || undefined,
    state: (tags["addr:state"] ?? tags["addr:province"] ?? "").trim() || undefined,
    country: countryNameFor(countryCode),
    countryCode,
    countrySource: taggedCountry ? "tag" : countryCode ? "tile" : undefined,
    postcode: normalizePostalCode(tags["addr:postcode"], countryCode),
    addressTags: {
      street: full ? "" : street,
      houseNumber,
      postcode: (tags["addr:postcode"] ?? "").trim(),
    },
    latitude: hasCoords ? lat : undefined,
    longitude: hasCoords ? lon : undefined,
    website,
    phone,
    placeId: `osm:${osmRef}`,
    types: ["place_of_worship"],
    mapsUri: `https://www.openstreetmap.org/${osmRef}`,
    denomination,
    osmType: el.type,
    osmId: el.id,
    slugBase: parishSlugBase(name, englishName, city) || `parish-${el.type}-${el.id}`,
    englishName: englishName || undefined,
    designation: designationFor(name, tags, hasCoords ? { lat: lat!, lon: lon! } : undefined),
  };
}

/**
 * Derive again what depends on the country from the element's own tags, once
 * a lookup has replaced its tile-fallback country: the street line's order (a
 * Houston church on a Mexican tile was composed "Main Street 1505") and
 * whether its postcode fits ("H2X 3J6" is no US ZIP but a Canadian code).
 */
function rederiveForCountry(candidate: OsmCandidate): void {
  const tags = candidate.addressTags;
  if (!tags) return;
  if (tags.street) {
    candidate.formattedAddress = composeStreetLine(
      tags.street,
      tags.houseNumber,
      candidate.countryCode,
    );
  }
  candidate.postcode = normalizePostalCode(tags.postcode, candidate.countryCode);
}

/**
 * Fill a NEW candidate's blanks from its Nominatim answer, before the address
 * dedup sees it: street line, locality, state, postal code — and the country
 * when the candidate's came from the tile fallback (or it had none), with the
 * tagged street line and postcode derived again for it. A value the element's
 * own tags supplied is never replaced. `place: null` means Nominatim answered
 * without this object. Exported for testing.
 */
export function applyLookupToCandidate(
  candidate: OsmCandidate,
  place: NominatimPlace | null,
  now: number,
): void {
  if (!place) {
    candidate.addressLookup = {
      returned: false,
      used: false,
      precision: addressPrecisionOf(candidate.formattedAddress),
      at: now,
    };
    return;
  }
  const parts = nominatimAddressParts(place);
  let used = false;
  // Country first: the street order and the postcode format depend on it.
  if (
    parts.countryCode &&
    parts.countryCode !== candidate.countryCode &&
    (!candidate.countryCode || candidate.countrySource === "tile")
  ) {
    candidate.countryCode = parts.countryCode;
    candidate.country = parts.country;
    candidate.countrySource = "nominatim";
    rederiveForCountry(candidate);
    used = true;
  }
  const sameCountry = !candidate.countryCode || candidate.countryCode === parts.countryCode;
  let precision = addressPrecisionOf(candidate.formattedAddress);
  if (!candidate.formattedAddress && parts.street && sameCountry) {
    candidate.formattedAddress = composeStreetLine(
      parts.street,
      parts.houseNumber,
      candidate.countryCode,
    );
    precision = parts.precision;
    used = true;
  }
  if (!candidate.city && parts.locality) {
    candidate.city = parts.locality;
    candidate.slugBase =
      parishSlugBase(candidate.name, candidate.englishName, parts.locality) || candidate.slugBase;
    used = true;
  }
  if (!candidate.state && parts.state && sameCountry) {
    candidate.state = parts.state;
    used = true;
  }
  if (!candidate.postcode && parts.postalCode && sameCountry) {
    candidate.postcode = parts.postalCode;
    used = true;
  }
  candidate.addressLookup = { returned: true, used, precision, at: now };
}

/** The research state a looked-up candidate publishes with, from its final fields. */
function candidateResearchMeta(candidate: OsmCandidate): AddressResearchMeta | null {
  const lookup = candidate.addressLookup;
  if (!lookup) return null;
  return nextAddressResearchMeta({
    previous: null,
    payload: {
      address: candidate.formattedAddress,
      city: candidate.city,
      postalCode: candidate.postcode,
      countryCode: candidate.countryCode,
    },
    returned: lookup.returned,
    precision: lookup.precision,
    sources: lookup.used ? ["osm", "nominatim"] : ["osm"],
    now: lookup.at,
  });
}

// ── Dedup helpers ───────────────────────────────────────────────────────────

type ExistingRow = {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  sourceRef: string | null;
  payload: unknown;
};

const ROW_SELECT = {
  id: true,
  slug: true,
  title: true,
  isPublished: true,
  sourceRef: true,
  payload: true,
} as const;

async function findBySourceRef(prisma: PrismaClient, ref: string): Promise<ExistingRow | null> {
  return prisma.publishedContent
    .findFirst({ where: { contentType: "PARISH" as never, sourceRef: ref }, select: ROW_SELECT })
    .catch(() => null) as Promise<ExistingRow | null>;
}

async function findBySlug(prisma: PrismaClient, slug: string): Promise<ExistingRow | null> {
  return prisma.publishedContent
    .findFirst({ where: { contentType: "PARISH" as never, slug }, select: ROW_SELECT })
    .catch(() => null) as Promise<ExistingRow | null>;
}

/** A LIVE parish with the same distinctive name within ~200 m. */
async function findNearbySameName(
  prisma: PrismaClient,
  candidate: OsmCandidate,
): Promise<ExistingRow | null> {
  if (typeof candidate.latitude !== "number" || typeof candidate.longitude !== "number")
    return null;
  const key = normalizedParishName(candidate.name);
  if (!key) return null;
  const rows = (await prisma.publishedContent
    .findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        latitude: { gte: candidate.latitude - NEARBY_DEG, lte: candidate.latitude + NEARBY_DEG },
        longitude: { gte: candidate.longitude - NEARBY_DEG, lte: candidate.longitude + NEARBY_DEG },
      },
      select: ROW_SELECT,
      take: 25,
    })
    .catch(() => [])) as ExistingRow[];
  return rows.find((r) => normalizedParishName(r.title) === key) ?? null;
}

function payloadOf(row: ExistingRow): Record<string, unknown> {
  return row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? { ...(row.payload as Record<string, unknown>) }
    : {};
}

/** True when the row was unpublished as a duplicate of a parish that is still live. */
async function dedupKeeperIsLive(prisma: PrismaClient, row: ExistingRow): Promise<boolean> {
  const meta = payloadOf(row)._meta;
  const dedup =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).dedup
      : null;
  const keeperId =
    dedup && typeof dedup === "object" ? (dedup as { keeperId?: unknown }).keeperId : null;
  if (typeof keeperId !== "string" || !keeperId) return false;
  const keeper = await prisma.publishedContent
    .findFirst({
      where: { id: keeperId, contentType: "PARISH" as never, isPublished: true },
      select: { id: true },
    })
    .catch(() => null);
  return Boolean(keeper);
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/**
 * Enrich an existing row from a re-swept OSM element: fill ONLY empty fields
 * (phone, website, coordinates, city, address, postal code, country,
 * sourceRef, addressKey) through the protection gate. Never overwrites;
 * returns true when applied.
 */
async function enrichExistingRow(
  prisma: PrismaClient,
  row: ExistingRow,
  candidate: OsmCandidate,
  passId?: string,
): Promise<boolean> {
  const current = payloadOf(row);
  const proposed = { ...current };
  const fill = (key: string, value: unknown) => {
    if (isBlank(current[key]) && !isBlank(value)) proposed[key] = value;
  };
  fill("phone", candidate.phone);
  fill("website", candidate.website);
  fill("latitude", candidate.latitude);
  fill("longitude", candidate.longitude);
  fill("city", candidate.city);
  fill("address", candidate.formattedAddress);
  fill("state", candidate.state);
  fill("postalCode", candidate.postcode);
  fill("country", candidate.country);
  fill("countryCode", candidate.countryCode);
  fill("sourceRef", candidate.placeId);
  const key = parishAddressKey({
    address: (proposed.address as string | undefined) ?? candidate.formattedAddress,
    city: (proposed.city as string | undefined) ?? candidate.city,
    state: (proposed.state as string | undefined) ?? candidate.state,
    postalCode: (proposed.postalCode as string | undefined) ?? candidate.postcode,
  });
  fill("addressKey", key);
  if (Object.keys(proposed).length === Object.keys(current).length) return false;
  if (!validatePayload("PARISH", proposed).ok) return false;
  const res = await applyProtectedContentUpdate(prisma, {
    contentId: row.id,
    proposedPayload: proposed,
    reason: "osm-resweep",
    qualityScore: 0.88,
    evidenceCount: 1,
    passId,
  }).catch(() => null);
  return Boolean(res?.applied);
}

// ── Skip memory (gate failures are not retried every sweep) ─────────────────
//
// Keyed by slug (what the website-verification lane knows) AND by sourceRef
// (`osm:node/123`, stable across slug suffixes and reverse-lookup cities) so a
// remembered candidate is recognised BEFORE any reverse lookup is spent on it.

async function readSkip(prisma: PrismaClient, key: string): Promise<boolean> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SKIP_PREFIX + key } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const until = (row?.memoryValue as { retryAfter?: number } | null)?.retryAfter;
  return typeof until === "number" && until > Date.now();
}

/**
 * Remember that `key` (a slug or a sourceRef) failed the gate: discovery will
 * not retry it until `retryAfterMs` has elapsed. Also used by the website
 * verification lane (one year for a parish proved not in communion).
 */
export async function writeOsmSkip(
  prisma: PrismaClient,
  key: string,
  reason: string,
  retryAfterMs: number = SKIP_DAYS * DAY_MS,
): Promise<void> {
  const value = { retryAfter: Date.now() + retryAfterMs, reason: reason.slice(0, 240) };
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SKIP_PREFIX + key } },
      update: { memoryValue: value, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: SKIP_PREFIX + key,
        memoryValue: value,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

// ── Publishing ──────────────────────────────────────────────────────────────

/** Publish one OSM parish through the real gate (OSM-accurate citations + summary). */
async function publishOsmParish(
  prisma: PrismaClient,
  candidate: OsmCandidate,
  slug: string,
): Promise<{ kind: string; reason: string }> {
  const city = candidate.city ?? "";
  const citations = [candidate.mapsUri, candidate.website].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  if (citations.length === 0) return { kind: "blocked", reason: "no citation" };
  const designation = candidate.designation;

  const payload: Record<string, unknown> = {
    slug,
    title: candidate.name,
    designation,
    // The summary states exactly what the source says and nothing more.
    summary: osmParishSummary({
      name: candidate.name,
      designation,
      denomination: candidate.denomination,
      city,
      country: candidate.country,
    }),
    citations,
    sourceRef: candidate.placeId,
  };
  if (candidate.formattedAddress) payload.address = candidate.formattedAddress;
  if (city) payload.city = city;
  if (candidate.postcode) payload.postalCode = candidate.postcode;
  const addressKey = parishAddressKey({
    address: candidate.formattedAddress,
    city,
    state: candidate.state,
    postalCode: candidate.postcode,
  });
  if (addressKey) payload.addressKey = addressKey;
  if (candidate.state) payload.state = candidate.state;
  if (candidate.country) payload.country = candidate.country;
  if (candidate.countryCode) payload.countryCode = candidate.countryCode;
  if (candidate.website) payload.website = candidate.website;
  if (candidate.phone) payload.phone = candidate.phone;
  if (typeof candidate.latitude === "number") payload.latitude = candidate.latitude;
  if (typeof candidate.longitude === "number") payload.longitude = candidate.longitude;
  // Researched at discovery: the research lane picks the row up again only
  // once it is due, instead of spending a second lookup on it straight away.
  const addressResearch = candidateResearchMeta(candidate);
  if (addressResearch) payload._meta = { addressResearch };

  const valid = validatePayload("PARISH", payload);
  if (!valid.ok) return { kind: "blocked", reason: `schema: ${valid.errors.join("; ")}` };

  const item = await prisma.checklistItem
    .findFirst({
      where: { contentType: "PARISH" as never, canonicalSlug: slug },
      select: { id: true },
    })
    .catch(() => null);
  const checklistItem =
    item ??
    (await prisma.checklistItem
      .create({
        data: {
          contentType: "PARISH" as never,
          canonicalName: candidate.name,
          canonicalSlug: slug,
          approvalStatus: "APPROVED_FOR_BUILD",
        },
        select: { id: true },
      })
      .catch(() => null));
  if (!checklistItem) return { kind: "blocked", reason: "checklist item unavailable" };

  const result = await runPublishOrchestrator(prisma, {
    contentType: "PARISH",
    contentId: checklistItem.id,
    title: candidate.name,
    slug,
    payload: payload as never,
    authorityLevel: "COMMUNITY",
    finalScore: 0.88,
    qaPassed: true,
    hasSourceEvidence: true,
    isDoctrinallySensitive: isDoctrinallySensitive("PARISH"),
    confidence: 0.8,
    // Deterministic, tag-derived data: the brain's live-fetch screens add
    // nothing here (and would cost a brain call per parish at 250/run); the
    // per-publish side effects are batched once per run below.
    skipBrainScreens: true,
    skipPostPublishSideEffects: true,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: [],
      evidence: [],
      hasConflict: false,
      summary: `Discovered via OpenStreetMap (denomination ${candidate.denomination}); website communion check pending in the verification lane.`,
    },
  }).catch(() => null);
  if (!result) return { kind: "error", reason: "orchestrator threw" };
  return { kind: result.kind, reason: result.reason };
}

export type CandidateOutcome =
  | "published"
  | "updated"
  | "duplicate"
  | "skipped"
  | "failed"
  | "review";

interface RunContext {
  brainActive: boolean;
  passId?: string;
  reverse: ReverseLookupBudget;
  /**
   * Nominatim answers prefetched for the current chunk's new candidates:
   * sourceRef → place, or null when Nominatim answered without the object.
   * A ref that is absent was not looked up (budget, cooldown, known row).
   */
  lookups?: Map<string, NominatimPlace | null>;
}

/**
 * Stable, source-derived slugs for a collision, in the order they are tried:
 * the postcode, the OSM id's last four digits, then the whole typed OSM id.
 * The postcode alone is not unique — the lookup gives most candidates one,
 * and barangay chapels or frazioni repeat a dedication within one locality
 * and postcode — so the last option is the one only this element can hold.
 */
function collisionSlugs(candidate: OsmCandidate): string[] {
  const withSuffix = (suffix: string) =>
    `${candidate.slugBase.slice(0, Math.min(74, 79 - suffix.length))}-${suffix}`;
  const id = String(candidate.osmId);
  const options = [
    candidate.postcode ? slugify(candidate.postcode) : "",
    id.slice(-4),
    `${candidate.osmType.charAt(0)}${id}`,
  ].filter(Boolean);
  return [...new Set(options.map(withSuffix))];
}

/**
 * Run one candidate through dedup and (when new) the publish gate. Order is
 * cheapest-first and every branch is an indexed lookup.
 */
export async function processOsmCandidate(
  prisma: PrismaClient,
  candidate: OsmCandidate,
  ctx: RunContext,
): Promise<CandidateOutcome> {
  // 1. Same OSM element already in the catalog → enrich in place (re-sweep).
  const bySource = await findBySourceRef(prisma, candidate.placeId);
  if (bySource?.isPublished) {
    return (await enrichExistingRow(prisma, bySource, candidate, ctx.passId))
      ? "updated"
      : "duplicate";
  }
  // Its own row was unpublished as a duplicate (`_meta.dedup`) of a parish
  // that is still live: stay down. The candidate's fresh tags may lack the
  // street the research lane filled in, so the address check below could miss
  // it and the sweep would republish what the maintenance just took down.
  if (bySource && (await dedupKeeperIsLive(prisma, bySource))) return "duplicate";

  // A new candidate's Nominatim answer (prefetched per chunk) fills its blanks
  // first, so the address dedup below sees the street and postcode.
  const lookedUp = ctx.lookups?.has(candidate.placeId) === true;
  if (lookedUp) {
    applyLookupToCandidate(candidate, ctx.lookups?.get(candidate.placeId) ?? null, Date.now());
  }

  // 2. Same street address AND within 250 m (or the same name when either has
  //    no coordinates) → same place under another name or source. A shared
  //    key alone — two street-less churches in one city — is not enough, and
  //    a street without a house number (two churches on one Kirchplatz) also
  //    needs the same name.
  const addressKey = parishAddressKey({
    address: candidate.formattedAddress,
    city: candidate.city,
    state: candidate.state,
    postalCode: candidate.postcode,
  });
  const byAddress = await findDuplicateParish(prisma, {
    addressKey,
    address: candidate.formattedAddress,
    countryCode: candidate.countryCode,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    name: candidate.name,
  });
  if (byAddress) {
    const row = await findBySlug(prisma, byAddress.slug);
    if (row?.isPublished && !row.sourceRef)
      await enrichExistingRow(prisma, row, candidate, ctx.passId);
    return "duplicate";
  }

  // 3. Same distinctive name within ~200 m (Maps vs OSM, addr:full vs street).
  const nearby = await findNearbySameName(prisma, candidate);
  if (nearby) {
    if (!nearby.sourceRef) await enrichExistingRow(prisma, nearby, candidate, ctx.passId);
    return "duplicate";
  }

  // A remembered gate failure is skipped here, BEFORE the reverse lookup, so
  // a rejected candidate never spends Nominatim budget on every re-sweep.
  if (await readSkip(prisma, candidate.placeId)) return "skipped";

  // City fallback for coordinate-only candidates: one bounded reverse lookup
  // (address.city|town|village|municipality only). Runs AFTER the dedup so a
  // known parish never spends a lookup, and only when the id lookup did not
  // already answer for this very object.
  if (
    !candidate.city &&
    candidate.addressLookup?.returned !== true &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
  ) {
    const r = await reverseLookupCity(prisma, candidate.latitude, candidate.longitude, ctx.reverse);
    if (r.city) {
      candidate.city = r.city;
      candidate.slugBase =
        parishSlugBase(candidate.name, candidate.englishName, r.city) || candidate.slugBase;
    }
    // Nominatim's country is where the point lies: it replaces a tile
    // fallback (which can be a neighbouring country's) but never a tag.
    if (
      r.countryCode &&
      r.countryCode !== candidate.countryCode &&
      (!candidate.countryCode || candidate.countrySource === "tile")
    ) {
      candidate.countryCode = r.countryCode;
      candidate.country = countryNameFor(r.countryCode);
      candidate.countrySource = "nominatim";
      rederiveForCountry(candidate);
    }
  }

  // 4. Slug. Its own row may exist unpublished (a rollback): republish it under
  //    its slug — the orchestrator's update branch flips it live again. Else a
  //    live collision with a DIFFERENT parish gets the first free stable
  //    suffix instead of a silent skip, while an unpublished row with no other
  //    source is reused.
  let slug = candidate.slugBase;
  if (bySource && !bySource.isPublished) {
    slug = bySource.slug;
  } else {
    const taken = (row: ExistingRow | null) =>
      Boolean(row && (row.isPublished || (row.sourceRef && row.sourceRef !== candidate.placeId)));
    if (taken(await findBySlug(prisma, slug))) {
      let free: string | null = null;
      for (const option of collisionSlugs(candidate)) {
        if (!taken(await findBySlug(prisma, option))) {
          free = option;
          break;
        }
      }
      // Even the whole OSM id is held by another source: nothing stable is left.
      if (!free) return "duplicate";
      slug = free;
    }
  }
  if (await readSkip(prisma, slug)) return "skipped";
  if (!ctx.brainActive) return "review";

  const res = await publishOsmParish(prisma, candidate, slug);
  if (res.kind === "published") return "published";
  if (res.kind === "duplicate") return "duplicate";
  await writeOsmSkip(prisma, slug, `${res.kind}: ${res.reason}`);
  await writeOsmSkip(prisma, candidate.placeId, `${res.kind}: ${res.reason}`);
  if (
    await fileReview(
      prisma,
      candidate,
      slug,
      {
        status: "in-communion",
        confidence: 0.8,
        signals: {
          positive: [`OpenStreetMap denomination=${candidate.denomination}`],
          negative: [],
          review: [],
        },
        reason: res.reason,
      },
      "Confirm and publish parish (OpenStreetMap; publish gate did not pass)",
    )
  ) {
    return "review";
  }
  return "failed";
}

// ── The run ─────────────────────────────────────────────────────────────────

export interface OsmParishResult {
  enabled: boolean;
  queriesRun: number;
  tilesSwept: number;
  candidates: number;
  published: number;
  updated: number;
  duplicates: number;
  skipped: number;
  routedToReview: number;
  rejected: number;
  /** Nominatim lookup requests spent on new candidates' addresses. */
  addressLookups: number;
  budgetExhausted: boolean;
  detail: string;
}

/** Self-throttle so the loop can call this every pass without hammering Overpass. */
async function throttleOk(prisma: PrismaClient): Promise<boolean> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < THROTTLE_MS) return false;
  await stampThrottle(prisma);
  return true;
}

async function stampThrottle(prisma: PrismaClient): Promise<void> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

function elementRef(el: OverpassElement): string {
  return `${el.type ?? "?"}/${el.id ?? "?"}`;
}

type SweepContext = RunContext & {
  maxPublish: number;
  deadline: number;
  /** Set once a lookup was refused or failed: the rest of the run asks no more. */
  lookupsStopped: boolean;
};

/** sourceRefs with an active skip memory (a remembered gate failure). */
async function activeSkipRefs(prisma: PrismaClient, refs: string[]): Promise<Set<string>> {
  try {
    const rows = await prisma.adminWorkerMemory.findMany({
      where: { memoryType: "GENERIC", memoryKey: { in: refs.map((r) => SKIP_PREFIX + r) } },
      select: { memoryKey: true, memoryValue: true },
    });
    const now = Date.now();
    return new Set(
      rows
        .filter((r) => {
          const until = (r.memoryValue as { retryAfter?: number } | null)?.retryAfter;
          return typeof until === "number" && until > now;
        })
        .map((r) => r.memoryKey.slice(SKIP_PREFIX.length)),
    );
  } catch {
    // Unknown: spend no lookup budget on candidates that may be remembered.
    return new Set(refs);
  }
}

/**
 * Look up the NEW candidates among the next chunk of elements on Nominatim, in
 * one request (≤ 50 ids), before any of them is processed. A row already
 * published is skipped (the research lane keeps those up to date), as is a
 * candidate with an active skip memory. Fail-open: whatever goes unanswered is
 * not looked up — it publishes as before and the research lane completes it.
 */
async function prefetchAddressLookups(
  prisma: PrismaClient,
  elements: OverpassElement[],
  tile: OsmTile,
  base: OsmParishResult,
  ctx: SweepContext,
): Promise<Map<string, NominatimPlace | null>> {
  const out = new Map<string, NominatimPlace | null>();
  if (ctx.lookupsStopped) return out;
  const refs = elements
    .map((el) => osmElementToParish(el, { countryCode: tile.countryCode }))
    .filter((c): c is OsmCandidate => c !== null)
    .map((c) => c.placeId);
  if (refs.length === 0) return out;
  const known = (await prisma.publishedContent
    .findMany({
      where: { contentType: "PARISH" as never, isPublished: true, sourceRef: { in: refs } },
      select: { sourceRef: true },
    })
    .catch(() => null)) as Array<{ sourceRef: string | null }> | null;
  if (!known) return out;
  const skip = await activeSkipRefs(prisma, refs);
  for (const row of known) if (row.sourceRef) skip.add(row.sourceRef);
  const fresh = refs.filter((r) => !skip.has(r));
  if (fresh.length === 0) return out;
  const res = await lookupOsmPlaces(prisma, fresh, { maxRequests: 1 });
  base.addressLookups += res.requests;
  // Budget spent, a cooldown, or a failed request: stop asking for this run.
  if (res.stopReason && res.stopReason !== "request-cap") ctx.lookupsStopped = true;
  for (const [ref, place] of res.places) out.set(ref, place);
  for (const ref of res.notReturned) out.set(ref, null);
  return out;
}

/**
 * Sweep one tile: query it, split it when dense, and run its elements through
 * `processOsmCandidate` until the publish cap or the deadline. Progress is
 * persisted on the tile so a stopped run resumes where it left off.
 */
async function sweepTile(
  prisma: PrismaClient,
  tile: OsmTile,
  initialState: OsmTileState,
  base: OsmParishResult,
  ctx: SweepContext,
): Promise<"done" | "stopped" | "failed" | "budget"> {
  let state = initialState;
  const now = Date.now();
  // Claim the tile durably BEFORE the (up to 90 s) query: a run killed by the
  // watchdog or a crash then resumes it first next time instead of losing it
  // until the next lap. A tile that keeps killing runs without ever making
  // progress (`resumeAfter` still null) is parked FAILED with a backoff so
  // one pathological tile cannot wedge the sweep.
  // (`failures` is shared with the Overpass-failure backoff below and is
  // only reset by a completed sweep, so a mirror that keeps failing on this
  // tile still backs off exponentially across claims.)
  const diedWithoutProgress = state.status === "IN_PROGRESS" && state.resumeAfter == null;
  const failures = diedWithoutProgress ? state.failures + 1 : state.failures;
  if (diedWithoutProgress && failures > MAX_NO_PROGRESS_ATTEMPTS) {
    await writeTileState(prisma, tile, {
      ...state,
      status: "FAILED",
      failures,
      lastError: "run died repeatedly before making progress",
      nextDueAt: now + Math.min(6 * 60 * 60 * 1000 * 2 ** (failures - 1), 7 * DAY_MS),
    });
    await clearTileActive(prisma, tile.id);
    return "failed";
  }
  state = { ...state, status: "IN_PROGRESS", failures };
  await writeTileState(prisma, tile, state);
  await markTileActive(prisma, tile.id);

  const res = await runOverpassQuery(prisma, buildTileQuery(tile.bbox, OUT_CAP));
  base.queriesRun += res.attempts;
  if (!res.ok) {
    if (res.budgetExhausted) {
      // Nothing was attempted: the tile stays claimed (IN_PROGRESS + active)
      // and is the first thing tomorrow's run picks up.
      base.budgetExhausted = true;
      return "budget";
    }
    const failures = state.failures + 1;
    await writeTileState(prisma, tile, {
      ...state,
      status: "FAILED",
      failures,
      lastError: res.error,
      nextDueAt: now + Math.min(6 * 60 * 60 * 1000 * 2 ** (failures - 1), 7 * DAY_MS),
    });
    await clearTileActive(prisma, tile.id);
    return "failed";
  }

  const elements = res.elements;
  const children = elements.length >= OUT_CAP ? splitTile(tile) : [];
  if (children.length > 0) {
    // Dense: the cap truncated this tile. Queue the quarters (they re-fetch
    // everything here without a cap) — but still use the elements we already
    // have, since dedup makes the overlap free.
    await enqueueTiles(prisma, children);
  }

  let resumeAfter = state.resumeAfter;
  let lastProcessed: string | null = null;
  let prefetchedThrough = -1;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    const ref = elementRef(el);
    if (resumeAfter) {
      if (ref === resumeAfter) resumeAfter = null;
      continue;
    }
    // Bound the run BEFORE any per-candidate work.
    if (base.published >= ctx.maxPublish || Date.now() > ctx.deadline) {
      await writeTileState(prisma, tile, {
        ...state,
        status: "IN_PROGRESS",
        elementCount: elements.length,
        resumeAfter: lastProcessed,
        lastError: null,
      });
      // The next run picks this tile up first, ahead of the cursor/queue.
      await markTileActive(prisma, tile.id);
      return "stopped";
    }
    // One Nominatim request covers the next 50 elements' new candidates.
    if (i > prefetchedThrough) {
      prefetchedThrough = i + NOMINATIM_MAX_IDS_PER_REQUEST - 1;
      ctx.lookups = await prefetchAddressLookups(
        prisma,
        elements.slice(i, prefetchedThrough + 1),
        tile,
        base,
        ctx,
      );
    }
    const candidate = osmElementToParish(el, { countryCode: tile.countryCode });
    lastProcessed = ref;
    if (!candidate) continue;
    base.candidates += 1;
    state.accepted += 1;
    const outcome = await processOsmCandidate(prisma, candidate, ctx).catch(
      (): CandidateOutcome => "failed",
    );
    if (outcome === "published") {
      base.published += 1;
      state.published += 1;
    } else if (outcome === "updated") base.updated += 1;
    else if (outcome === "duplicate") base.duplicates += 1;
    else if (outcome === "skipped") base.skipped += 1;
    else if (outcome === "review") base.routedToReview += 1;
    else base.rejected += 1;
  }

  await writeTileState(prisma, tile, {
    ...state,
    status: children.length > 0 ? "DENSE_SPLIT" : "SWEPT",
    elementCount: elements.length,
    resumeAfter: null,
    lastSweptAt: now,
    nextDueAt: now + (elements.length === 0 ? emptyResweepMs() : resweepMs()),
    failures: 0,
    lastError: null,
  });
  await clearTileActive(prisma, tile.id);
  return "done";
}

/**
 * Run one OSM parish-discovery pass: claim the next due tile(s), sweep them,
 * publish what is new (cap ~250/run), enrich what is known. Self-throttled,
 * budgeted, bounded, resumable, and fail-open.
 */
export async function runOsmParishDiscovery(
  prisma: PrismaClient,
  opts: {
    brainActive: boolean;
    /** Tiles queried per run (default 1; env `ADMIN_WORKER_OSM_MAX_QUERIES`). */
    maxQueries?: number;
    /** New parishes published per run (default 250; env `ADMIN_WORKER_OSM_MAX_PUBLISH`). */
    maxPublishPerPass?: number;
    force?: boolean;
    passId?: string;
  },
): Promise<OsmParishResult> {
  const base: OsmParishResult = {
    enabled: osmParishDiscoveryEnabled(),
    queriesRun: 0,
    tilesSwept: 0,
    candidates: 0,
    published: 0,
    updated: 0,
    duplicates: 0,
    skipped: 0,
    routedToReview: 0,
    rejected: 0,
    addressLookups: 0,
    budgetExhausted: false,
    detail: "",
  };
  if (!base.enabled) {
    base.detail = "OSM parish discovery disabled (skip-network or opt-out).";
    return base;
  }
  // Sprint scheduler: grow parishes in bounded sprints, then stand down for a
  // (short) cooldown during which the worker grows the OTHER content types.
  // `force` bypasses it for manual/proof runs.
  if (!opts.force) {
    const { evaluateParishSprint } = await import("./parish-sprint");
    const sprint = await evaluateParishSprint(prisma);
    if (!sprint.active) {
      base.detail = sprint.reason;
      return base;
    }
  }
  if (!opts.force && !(await throttleOk(prisma))) {
    base.detail = "throttled (Overpass fair-use)";
    return base;
  }
  const remaining = await overpassBudgetRemaining(prisma);
  if (remaining <= 0) {
    base.budgetExhausted = true;
    base.detail = "daily Overpass query budget spent — resuming tomorrow";
    return base;
  }

  const maxTiles = opts.maxQueries ?? osmEnvInt("ADMIN_WORKER_OSM_MAX_QUERIES", 1);
  const maxPublish = opts.maxPublishPerPass ?? osmEnvInt("ADMIN_WORKER_OSM_MAX_PUBLISH", 250);
  const ctx: SweepContext = {
    brainActive: opts.brainActive,
    passId: opts.passId,
    reverse: { remaining: reverseLookupCapPerRun() },
    maxPublish,
    deadline: Date.now() + RUN_BUDGET_MS,
    lookupsStopped: false,
  };

  const claimed = await claimDueTiles(prisma, Math.min(maxTiles, remaining));
  const swept: string[] = [];
  for (const { tile, state } of claimed.tiles) {
    if (base.published >= maxPublish || Date.now() > ctx.deadline) break;
    const outcome = await sweepTile(prisma, tile, state, base, ctx).catch(() => "failed" as const);
    base.tilesSwept += 1;
    swept.push(`${tile.id} (${tile.country}): ${outcome}`);
    if (outcome === "budget") break;
  }

  if (base.published > 0) {
    // Batched once per run (the orchestrator's per-publish side effects were
    // skipped): close the goal gap and flag search/sitemap refresh.
    const { refreshContentGoals } = await import("./content-goals");
    await refreshContentGoals(prisma).catch(() => undefined);
    const { flagSearchRefresh, flagSitemapRefresh } = await import("./repair");
    await Promise.all([
      flagSearchRefresh(prisma).catch(() => undefined),
      flagSitemapRefresh(prisma).catch(() => undefined),
    ]);
    if (!opts.force) {
      const { recordParishSprintProgress } = await import("./parish-sprint");
      await recordParishSprintProgress(prisma, base.published).catch(() => undefined);
    }
  }
  // Stamp the throttle at the END too so the next run cannot start until the
  // throttle window has elapsed after this one finished (no overlapping runs).
  if (!opts.force) await stampThrottle(prisma);

  const progress = await osmTileProgress(prisma).catch(() => null);
  base.detail =
    `${base.candidates} candidate(s) over ${base.tilesSwept} tile(s) [${swept.join("; ") || claimed.detail}]: ` +
    `published ${base.published}, updated ${base.updated}, ${base.duplicates} duplicate(s), ${base.skipped} skipped, ` +
    `${base.routedToReview} to review, ${base.rejected} rejected` +
    (progress
      ? `; sweep ${progress.cursor}/${progress.catalogue} tiles, ${progress.queued} split tile(s) queued`
      : "") +
    (base.budgetExhausted ? "; daily Overpass budget spent" : "") +
    ".";
  if (base.tilesSwept > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "osm_parish_sweep",
      message: `OSM parish sweep: ${base.detail}`,
      contentType: "PARISH",
      safeMetadata: {
        tiles: base.tilesSwept,
        queries: base.queriesRun,
        candidates: base.candidates,
        published: base.published,
        updated: base.updated,
        duplicates: base.duplicates,
        skipped: base.skipped,
        rejected: base.rejected,
        addressLookups: base.addressLookups,
      },
    }).catch(() => undefined);
  }
  return base;
}

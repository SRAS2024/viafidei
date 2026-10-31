/**
 * Parish duplicate detection by ADDRESS.
 *
 * Two parishes at the same street address are the same place, however their
 * names are spelled ("St. Mary" vs "Saint Mary Catholic Church"), so the
 * address — not the name — is the first duplicate signal. `parishAddressKey`
 * folds a street line + postal code (else locality) + state into a stable
 * fingerprint, stored on the payload (`addressKey`) and in the indexed
 * `PublishedContent.addressKey` column so the lookup is an index probe rather
 * than a JSON scan of every parish row.
 *
 * The key used to be `address + city + state` with every non-ASCII character
 * deleted. A parish with no street therefore keyed as just "rome", and every
 * later street-less church in Rome was treated as its duplicate: never
 * published at discovery, or unpublished by the address maintenance (measured
 * 2026-10-31: 127 rows keyed "rome" with 1 published, 943 parishes unpublished
 * on 2026-09-08/09 with no recorded reason). Non-Latin streets collapsed to
 * their house numbers ("22"), and "Hörsteler Straße" keyed as "horsteler stra
 * e". Now:
 *
 *   - there is no key without a street line that keeps a Latin letter after
 *     transliteration — a city, a state or a bare number never identifies a
 *     place on its own;
 *   - Latin letters NFKD cannot decompose are transliterated (ß→ss, æ→ae, …)
 *     instead of deleted, and "Straße"/"Str." fold to one token;
 *   - a key match alone is never a duplicate: `findDuplicateParish` also needs
 *     the two rows within 250 m, or (when either has no coordinates) the same
 *     distinctive name. Every path — the OSM sweep, the Maps lane, the address
 *     maintenance and the dedup restore — goes through that one rule.
 */

import type { PrismaClient } from "@prisma/client";

/** Long-form → canonical short token for the words that vary between sources. */
const CANONICAL_TOKEN: Record<string, string> = {
  saint: "st",
  street: "st",
  avenue: "ave",
  av: "ave",
  road: "rd",
  boulevard: "blvd",
  drive: "dr",
  lane: "ln",
  court: "ct",
  place: "pl",
  square: "sq",
  highway: "hwy",
  parkway: "pkwy",
  suite: "ste",
  apartment: "apt",
  building: "bldg",
  floor: "fl",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
  strasse: "str",
  straat: "str",
};

/** Latin letters NFKD leaves whole, spelled the way they are usually transliterated. */
const LATIN_FOLD: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  þ: "th",
  ł: "l",
  ı: "i",
};

/**
 * Fold text to lower-case ASCII Latin words: NFKD with the combining marks
 * stripped, the letters in LATIN_FOLD transliterated, and everything else —
 * punctuation and non-Latin scripts alike — turned into word breaks. A
 * Cyrillic or Greek street therefore folds to its digits only.
 */
export function foldToAsciiLatin(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ßæœøđðþłı]/g, (ch) => LATIN_FOLD[ch] ?? " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalToken(token: string): string {
  const mapped = CANONICAL_TOKEN[token];
  if (mapped) return mapped;
  // German and Dutch write the street word as a suffix ("Hauptstraße",
  // "Kerkstraat"); fold it so the abbreviated "Hauptstr." keys the same.
  const compound = /^(.+?)(strasse|straat)$/.exec(token);
  return compound ? `${compound[1]}str` : token;
}

function addressTokens(value: string | null | undefined): string[] {
  const folded = foldToAsciiLatin(value);
  return folded ? folded.split(" ").map(canonicalToken) : [];
}

/** A postal code as one key token ("3474 MC" → "3474mc"); "" when absent. */
function postalToken(value: string | null | undefined): string {
  return foldToAsciiLatin(value).replace(/ /g, "");
}

/**
 * Normalize an address into a duplicate-detection fingerprint: the street
 * line's tokens (order-free, so "Hauptstraße 12" ≡ "12 Hauptstraße"), then the
 * postal code — or the locality when there is none — then the state.
 *
 * Returns "" unless the street line keeps at least one Latin letter: callers
 * treat an empty key as "no address dedup possible" and never block on it.
 */
export function parishAddressKey(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}): string {
  const street = addressTokens(input.address);
  if (!street.some((token) => /[a-z]/.test(token))) return "";
  const postal = postalToken(input.postalCode);
  const place = postal ? [postal] : addressTokens(input.city);
  return [...[...street].sort(), ...place, ...addressTokens(input.state)].join(" ");
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** `parishAddressKey` over a stored parish payload. */
export function parishAddressKeyForPayload(payload: Record<string, unknown>): string {
  return parishAddressKey({
    address: text(payload.address),
    city: text(payload.city),
    state: text(payload.state),
    postalCode: text(payload.postalCode),
  });
}

// ── Names ───────────────────────────────────────────────────────────────────

const NAME_STOP_WORDS = new Set([
  "st",
  "saint",
  "san",
  "santa",
  "santo",
  "sao",
  "ste",
  "sainte",
  "sankt",
  "sw",
  "church",
  "parish",
  "parroquia",
  "paroisse",
  "eglise",
  "pfarrkirche",
  "pfarrei",
  "kirche",
  "iglesia",
  "igreja",
  "chiesa",
  "parrocchia",
  "kosciol",
  "parafia",
  "catholic",
  "roman",
  "rc",
  "of",
  "the",
  "de",
  "del",
  "della",
  "di",
  "da",
  "do",
  "dos",
  "das",
  "la",
  "le",
  "les",
  "el",
  "los",
  "las",
  "and",
  "y",
  "e",
  "et",
  "und",
]);

/**
 * Fold a parish name to its distinctive words so "St. Mary Catholic Church"
 * and "Parish of Saint Mary" compare equal. Empty when nothing distinctive
 * remains (then no name-based dedup is possible).
 */
export function normalizedParishName(name: string): string {
  return foldToAsciiLatin(name)
    .split(" ")
    .filter((w) => w && !NAME_STOP_WORDS.has(w))
    .sort() // "Holy Cross Cathedral" ≡ "Cathedral of the Holy Cross"
    .join(" ");
}

// ── Distance + the shared duplicate rule ────────────────────────────────────

/** Two rows sharing an address key are the same place only this close together. */
export const DUPLICATE_RADIUS_M = 250;
const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in metres. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type ParishDuplicateRule =
  | "address-key+within-250m"
  | "address-key+same-name"
  | "same-name-within-250m";

export interface LocatedParish {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

function coordsOf(p: LocatedParish): { latitude: number; longitude: number } | null {
  return typeof p.latitude === "number" &&
    Number.isFinite(p.latitude) &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.longitude)
    ? { latitude: p.latitude, longitude: p.longitude }
    : null;
}

/**
 * Decide whether two parishes that already share an address key are the same
 * place. Pure: coordinates within DUPLICATE_RADIUS_M when both have them;
 * otherwise the same non-empty distinctive name. Null = distinct parishes.
 */
export function parishDuplicateRule(
  a: LocatedParish,
  b: LocatedParish,
): { rule: ParishDuplicateRule; distanceM: number | null } | null {
  const ca = coordsOf(a);
  const cb = coordsOf(b);
  if (ca && cb) {
    const distanceM = haversineMeters(ca, cb);
    return distanceM <= DUPLICATE_RADIUS_M
      ? { rule: "address-key+within-250m", distanceM: Math.round(distanceM) }
      : null;
  }
  const na = normalizedParishName(a.name);
  return na && na === normalizedParishName(b.name)
    ? { rule: "address-key+same-name", distanceM: null }
    : null;
}

export interface ParishDuplicateMatch {
  id: string;
  slug: string;
  title: string;
  rule: ParishDuplicateRule;
  distanceM: number | null;
}

/**
 * The published parish this one duplicates, or null. Probes the indexed
 * `addressKey` column for live rows with the same key and keeps the first
 * (lowest id) that passes `parishDuplicateRule`. `excludeId` keeps a row from
 * matching itself; `beforeId` restricts to rows published earlier (the
 * maintenance keeper rule). Fail-open: a query error is "no duplicate".
 */
export async function findDuplicateParish(
  prisma: PrismaClient,
  candidate: LocatedParish & { addressKey: string },
  opts: { excludeId?: string; beforeId?: string } = {},
): Promise<ParishDuplicateMatch | null> {
  if (!candidate.addressKey) return null;
  const idFilter: Record<string, string> = {};
  if (opts.beforeId) idFilter.lt = opts.beforeId;
  if (opts.excludeId) idFilter.not = opts.excludeId;
  const rows = (await prisma.publishedContent
    .findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        addressKey: candidate.addressKey,
        ...(Object.keys(idFilter).length > 0 ? { id: idFilter } : {}),
      },
      orderBy: { id: "asc" },
      take: 25,
      select: { id: true, slug: true, title: true, latitude: true, longitude: true },
    })
    .catch(() => [])) as Array<{
    id: string;
    slug: string;
    title: string;
    latitude: number | null;
    longitude: number | null;
  }>;
  for (const row of rows) {
    const verdict = parishDuplicateRule(candidate, { ...row, name: row.title });
    if (verdict) return { id: row.id, slug: row.slug, title: row.title, ...verdict };
  }
  return null;
}

/** Metres per degree of latitude, for the proximity bounding box. */
const METERS_PER_DEGREE_LAT = 111_320;

/**
 * A published parish with the same distinctive name within 250 m — the same
 * church mapped twice (a node and a way, or two sources), whatever their
 * addresses say. Indexed (latitude, longitude) box first, haversine second.
 */
export async function findNearbySameNameParish(
  prisma: PrismaClient,
  candidate: LocatedParish,
  opts: { excludeId?: string } = {},
): Promise<ParishDuplicateMatch | null> {
  const c = coordsOf(candidate);
  const name = normalizedParishName(candidate.name);
  if (!c || !name) return null;
  const dLat = DUPLICATE_RADIUS_M / METERS_PER_DEGREE_LAT;
  const dLon = dLat / Math.max(0.01, Math.cos((c.latitude * Math.PI) / 180));
  const rows = (await prisma.publishedContent
    .findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        latitude: { gte: c.latitude - dLat, lte: c.latitude + dLat },
        longitude: { gte: c.longitude - dLon, lte: c.longitude + dLon },
        ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      },
      orderBy: { id: "asc" },
      take: 50,
      select: { id: true, slug: true, title: true, latitude: true, longitude: true },
    })
    .catch(() => [])) as Array<{
    id: string;
    slug: string;
    title: string;
    latitude: number | null;
    longitude: number | null;
  }>;
  for (const row of rows) {
    const rc = coordsOf({ name: row.title, latitude: row.latitude, longitude: row.longitude });
    if (!rc || normalizedParishName(row.title) !== name) continue;
    const distanceM = haversineMeters(c, rc);
    if (distanceM <= DUPLICATE_RADIUS_M) {
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        rule: "same-name-within-250m",
        distanceM: Math.round(distanceM),
      };
    }
  }
  return null;
}

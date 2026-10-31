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
 *     maintenance and the dedup restore — goes through that one rule;
 *   - distance alone decides only for a key that names one building (a street
 *     line WITH a house number). A street or square without one ("Kirchplatz",
 *     "Via del Corso" — Nominatim's parent street, which had no house number in
 *     50 of 50 sampled parishes) is shared by every church on it, so a parish
 *     church and the chapel 90 m away on the same Kirchplatz also need the
 *     same distinctive name before one counts as the other's duplicate.
 */

import type { PrismaClient } from "@prisma/client";

import { streetBeforeNumber } from "./parish-address-format";

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

// ── Does the street line name one building? ─────────────────────────────────

/** A house number as one folded token: "12", "12a", "3bis". */
const HOUSE_NUMBER_RE = /^\d{1,5}(?:[a-z]|bis|ter|quater)?$/;
/** The year of a date a street is named after ("8 Mai 1945", "1 Decembrie 1918"). */
const YEAR_RE = /^(?:1[6-9]|20)\d\d$/;
/** A Spanish ordinal ("6ª Avenida" folds to "6a avenida"). */
const ORDINAL_RE = /^\d+[ao]$/;

/** Folded month names, as dates in street names spell them ("3 Maja", "28. října"). */
const MONTHS = new Set(
  [
    "january february march april may june july august september october november december",
    "enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre",
    "diciembre janeiro fevereiro marco maio junho julho setembro outubro novembro dezembro",
    "gennaio febbraio aprile maggio giugno luglio settembre ottobre dicembre janvier fevrier",
    "mars avril mai juin juillet aout decembre januar februar marz maerz juni juli oktober",
    "dezember januari februari maart mei augustus",
    "stycznia lutego marca kwietnia maja czerwca lipca sierpnia wrzesnia pazdziernika listopada",
    "grudnia ledna unora brezna dubna kvetna cervna cervence srpna zari rijna listopadu prosince",
    "januara februara aprila juna jula augusta septembra oktobra novembra decembra januarja",
    "februarja junija julija avgusta sijecnja veljace ozujka travnja svibnja lipnja srpnja",
    "kolovoza rujna studenoga prosinca ianuarie februarie martie aprilie iunie iulie",
    "septembrie octombrie noiembrie decembrie marcius aprilis majus junius julius augusztus",
    "szeptember",
  ].flatMap((group) => group.split(" ")),
);
/** "5 de Mayo", "7 de Setembro": the word between a day and its month. */
const DATE_LINKS = new Set(["de", "del", "du", "di"]);
/** "3 Sur", "5 Oriente", "100 South": a numbered street with its direction. */
const COMPASS = new Set(
  "norte sur oriente poniente este oeste north south east west nord sud est ouest".split(" "),
);
/** Road words a number follows as the road's own name ("Calle 60", "Carrera 7", "Route 66"). */
const ROAD_WORDS = new Set(
  [
    "calle carrera avenida diagonal transversal circunvalar autopista carretera camino ruta",
    "rua estrada rodovia travessa via strada statale provinciale strasse straat ulica aleja",
    "street road avenue route highway interstate nacional federal provincial estatal estadual",
    "departamental regional sector zona quadra kilometro",
  ].flatMap((group) => group.split(" ")),
);
/** Words that announce a house number ("Calle 60 No. 491", "Hauptstr. Nr. 5"). */
const HOUSE_NUMBER_MARKERS = new Set(["no", "nr", "nro", "num", "numero"]);

/** The leading number is part of the street's own name ("3 Maja", "5 de Mayo"). */
function leadingNumberNamesStreet(tokens: string[]): boolean {
  const next = tokens[1] ?? "";
  return (
    MONTHS.has(next) ||
    (DATE_LINKS.has(next) && MONTHS.has(tokens[2] ?? "")) ||
    (tokens.length === 2 && COMPASS.has(next)) ||
    (ORDINAL_RE.test(tokens[0] ?? "") && ROAD_WORDS.has(next))
  );
}

/** The trailing number is part of the street's own name ("Calle 60", "B 12"). */
function trailingNumberNamesStreet(tokens: string[]): boolean {
  const last = tokens[tokens.length - 1] ?? "";
  const prev = tokens[tokens.length - 2] ?? "";
  if (MONTHS.has(prev) && YEAR_RE.test(last)) return true;
  if (/\d/.test(prev) || HOUSE_NUMBER_MARKERS.has(prev)) return false;
  // A road word, or a short road class / abbreviation ("B 12", "SS 16",
  // "Cra 7", the "x 61" of a cross-street).
  return ROAD_WORDS.has(prev) || prev.length <= 3;
}

/**
 * Whether a street line carries a house number — i.e. names one building, not
 * a whole street or square. A house number sits at an edge of the line: first
 * in number-first countries and in every row composed before the locale order
 * existed ("12 Hauptstraße"), last in street-first countries ("Hauptstraße
 * 12"). A number that belongs to the street's own name is not one: a date
 * ("3 Maja", "5 de Mayo", "Rue du 8 Mai 1945"), a numbered street of a grid
 * city ("Calle 60", "Carrera 7", "3 Sur") or a road ("B 12", "Route 66").
 * Doubt reads as "no house number": the key then needs the name as well,
 * which can at worst leave a duplicate listed, never hide a distinct church.
 */
export function streetLineHasHouseNumber(
  address: string | null | undefined,
  countryCode?: string | null,
): boolean {
  const tokens = foldToAsciiLatin(address).split(" ").filter(Boolean);
  if (tokens.length < 2) return false;
  if (HOUSE_NUMBER_RE.test(tokens[0]!) && !leadingNumberNamesStreet(tokens)) return true;
  // A number-first country never writes the house number last.
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(cc) && !streetBeforeNumber(cc)) return false;
  return HOUSE_NUMBER_RE.test(tokens[tokens.length - 1]!) && !trailingNumberNamesStreet(tokens);
}

// ── Names ───────────────────────────────────────────────────────────────────

const NAME_STOP_WORDS = new Set([
  "st",
  "s",
  "saint",
  "san",
  "sant",
  "santa",
  "santo",
  "santi",
  "santissima",
  "santissimo",
  "ss",
  "sao",
  "ste",
  "sainte",
  "sankt",
  "sint",
  "sv",
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
  "dello",
  "delle",
  "degli",
  "dei",
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
 * and "Parish of Saint Mary" compare equal — and so do the abbreviated forms
 * one church is often mapped under twice ("S. Eligio dei Ferrari", "Chiesa di
 * Sant'Eligio dei Ferrari"). Empty when nothing distinctive remains (then no
 * name-based dedup is possible).
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
  | "street-key+same-name-within-250m"
  | "address-key+same-name"
  | "same-name-within-250m";

export interface LocatedParish {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** A parish with its address key and the street line (and country) the key came from. */
export interface KeyedParish extends LocatedParish {
  addressKey: string;
  /** Whether this line carries a house number decides how strong a key match is. */
  address: string | null | undefined;
  countryCode?: string | null;
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
 * place. Pure. When both have coordinates they must lie within
 * DUPLICATE_RADIUS_M — and, unless the shared key carries a house number
 * (`key.houseNumber`: it names one building), also share their distinctive
 * name, because a bare street or square is shared by every church on it.
 * Without coordinates on both, the same non-empty name decides. Null =
 * distinct parishes.
 */
export function parishDuplicateRule(
  a: LocatedParish,
  b: LocatedParish,
  key: { houseNumber: boolean },
): { rule: ParishDuplicateRule; distanceM: number | null } | null {
  const na = normalizedParishName(a.name);
  const sameName = na !== "" && na === normalizedParishName(b.name);
  const ca = coordsOf(a);
  const cb = coordsOf(b);
  if (ca && cb) {
    const distanceM = haversineMeters(ca, cb);
    if (distanceM > DUPLICATE_RADIUS_M) return null;
    if (key.houseNumber)
      return { rule: "address-key+within-250m", distanceM: Math.round(distanceM) };
    return sameName
      ? { rule: "street-key+same-name-within-250m", distanceM: Math.round(distanceM) }
      : null;
  }
  return sameName ? { rule: "address-key+same-name", distanceM: null } : null;
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
 * (lowest id) that passes `parishDuplicateRule` — told by the candidate's own
 * street line whether the key names one building (rows sharing a key share
 * its street words, house number included). `excludeId` keeps a row from
 * matching itself; `beforeId` restricts to rows published earlier (the
 * maintenance keeper rule). Fail-open: a query error is "no duplicate".
 */
export async function findDuplicateParish(
  prisma: PrismaClient,
  candidate: KeyedParish,
  opts: { excludeId?: string; beforeId?: string } = {},
): Promise<ParishDuplicateMatch | null> {
  if (!candidate.addressKey) return null;
  const key = { houseNumber: streetLineHasHouseNumber(candidate.address, candidate.countryCode) };
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
    const verdict = parishDuplicateRule(candidate, { ...row, name: row.title }, key);
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

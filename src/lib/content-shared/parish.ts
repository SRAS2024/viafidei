/**
 * Parish classification filters.
 *
 * Parish records carry a single `designation` (parish / chapel / shrine /
 * cathedral / major-basilica / minor-basilica). The directory groups these
 * into the classifications the user can filter by — Parish, Cathedral,
 * Basilica, Shrine, Chapel — so cathedrals, basilicas, shrines and chapels are
 * clearly distinct from ordinary parishes. A church that is also a basilica,
 * cathedral, or shrine surfaces under that classification (its specific
 * designation label is still shown on the card).
 */

export type ParishClassification = "parish" | "cathedral" | "basilica" | "shrine" | "chapel";
export type ParishFilter = ParishClassification | "all";

export const PARISH_FILTERS: ReadonlyArray<{ key: ParishFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "parish", label: "Parishes" },
  { key: "cathedral", label: "Cathedrals" },
  { key: "basilica", label: "Basilicas" },
  { key: "shrine", label: "Shrines" },
  { key: "chapel", label: "Chapels" },
];

const CLASSIFICATIONS: ReadonlySet<string> = new Set([
  "parish",
  "cathedral",
  "basilica",
  "shrine",
  "chapel",
]);

/** Group a raw designation into one of the filterable classifications. */
export function classifyParish(designation: unknown): ParishClassification {
  const d = typeof designation === "string" ? designation.toLowerCase() : "";
  if (d === "cathedral") return "cathedral";
  if (d.includes("basilica")) return "basilica";
  if (d === "shrine") return "shrine";
  // An oratory, like a chapel, is a place of worship that is not a parish church.
  if (d === "chapel" || d === "oratory") return "chapel";
  return "parish";
}

/** Resolve a `?class=` value into the active filter (defaults to "all"). */
export function resolveParishFilter(param: string | null | undefined): ParishFilter {
  return param && CLASSIFICATIONS.has(param) ? (param as ParishClassification) : "all";
}

/** Whether a record with the given designation matches the active filter. */
export function parishMatchesFilter(designation: unknown, filter: ParishFilter): boolean {
  return filter === "all" || classifyParish(designation) === filter;
}

/**
 * Parish card presentation helpers.
 *
 * These exist so the parish card is a pure RENDERING concern: reformatting the
 * card reformats all 9,731 published parishes at once, with no worker pass, no
 * database write and no republish. Nothing here reads or reshapes stored data.
 */

/** The place parts of a parish record: town, region and country. */
export type ParishPlaceParts = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  /** ISO-3166 alpha-2: decides where the postal code goes. */
  countryCode?: string | null;
};

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The street address out of a projected directory row. `ParishListItem.location`
 * is "address, city, state" already joined, but the card prints the place on
 * its own line, so the trailing place parts are stripped here instead of
 * being repeated one line apart. Returns null when nothing but the place is
 * left (the record has no postal address at all).
 */
export function parishStreetAddress(
  row: ParishPlaceParts & { location?: string | null },
): string | null {
  const parts = trimmed(row.location)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // Peel from the end: location is built address-first, so country/state/city
  // can only ever be the trailing segments.
  for (const tail of [row.country, row.state, row.city]) {
    const want = trimmed(tail).toLowerCase();
    if (want && parts.length > 0 && parts[parts.length - 1]!.toLowerCase() === want) parts.pop();
  }
  return parts.join(", ") || null;
}

/**
 * The destination handed to Maps: the whole address the card shows (street,
 * postal code, town, region, country), so "123 Main St" resolves to the right
 * "123 Main St" on earth. MapsAddressLink still prefers exact coordinates when
 * the record carries them.
 */
export function parishDirectionsAddress(parts: ParishAddressParts): string {
  return parishAddressLines(parts).join(", ");
}

/**
 * What a church is, as its card says it under the name: "Parish",
 * "Cathedral", "Shrine", "Chapel", "Oratory", and always "Minor Basilica" or
 * "Major Basilica" — the stored designations are `minor-basilica` /
 * `major-basilica`. A bare "basilica" (no record carries one today) says only
 * "Basilica" rather than guess which. A designation this list does not know
 * returns null, so a raw token never reaches the card.
 */
const DESIGNATION_LABELS: Readonly<Record<string, string>> = {
  parish: "Parish",
  cathedral: "Cathedral",
  shrine: "Shrine",
  chapel: "Chapel",
  oratory: "Oratory",
  "minor-basilica": "Minor Basilica",
  "major-basilica": "Major Basilica",
  basilica: "Basilica",
};

export function parishDesignationLabel(designation: unknown): string | null {
  const key =
    typeof designation === "string"
      ? designation
          .trim()
          .toLowerCase()
          .replace(/[\s_]+/g, "-")
      : "";
  return DESIGNATION_LABELS[key] ?? null;
}

/** Every part of a church's postal address a record may carry. */
export type ParishAddressParts = ParishPlaceParts & {
  /** The street line ("6135 South Austin Avenue"). */
  address?: string | null;
  postalCode?: string | null;
  /** ISO 3166-1 alpha-2, which decides where the postal code goes. */
  countryCode?: string | null;
};

/**
 * Countries whose addresses put the postal code after the town and region
 * ("Chicago, IL 60629", "Singapore 048616"); everywhere else it leads the town
 * ("00184 Roma").
 */
const POSTCODE_AFTER_LOCALITY: ReadonlySet<string> = new Set([
  "US",
  "CA",
  "GB",
  "IE",
  "AU",
  "NZ",
  "IN",
  "PH",
  "ZA",
  "SG",
  "BR",
]);

/** The same, for a record that names its country but carries no code. */
const COUNTRY_CODES_BY_NAME: Readonly<Record<string, string>> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  canada: "CA",
  australia: "AU",
  "new zealand": "NZ",
  "united kingdom": "GB",
  ireland: "IE",
  india: "IN",
  philippines: "PH",
  "south africa": "ZA",
  singapore: "SG",
  brazil: "BR",
  brasil: "BR",
};

const BARE_COUNTRY_CODE = /^[A-Za-z]{2}$/;

/**
 * A country line in words. Some early records stored the country as its bare
 * ISO code ("AT"), which is no use on an envelope; the name comes from the
 * platform's own region data, and anything it does not know stays as stored.
 */
function countryInWords(country: string): string {
  if (!BARE_COUNTRY_CODE.test(country)) return country;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase());
    return name && name !== "Unknown Region" ? name : country;
  } catch {
    return country;
  }
}

/**
 * A church's address as the lines of an envelope: the street, then the
 * locality (postal code, town and region, in the country's own order), then
 * the country in words. Missing parts are dropped, and a record with none of
 * them yields []. Nothing is looked up beyond the name of a bare country code:
 * only what the record stores.
 */
export function parishAddressLines(parts: ParishAddressParts): string[] {
  const street = trimmed(parts.address);
  const postal = trimmed(parts.postalCode);
  const city = trimmed(parts.city);
  const region = trimmed(parts.state);
  const country = trimmed(parts.country);
  const code =
    trimmed(parts.countryCode).toUpperCase() ||
    (BARE_COUNTRY_CODE.test(country) ? country.toUpperCase() : "") ||
    COUNTRY_CODES_BY_NAME[country.toLowerCase()] ||
    "";

  let locality: string;
  if (postal && POSTCODE_AFTER_LOCALITY.has(code)) {
    const place = [city, region].filter(Boolean).join(", ");
    locality = place ? `${place} ${postal}` : postal;
  } else {
    const town = [postal, city].filter(Boolean).join(" ");
    locality = [town, region].filter(Boolean).join(", ");
  }
  return [street, locality, countryInWords(country)].filter(Boolean);
}

/**
 * The directory's other scripts and the language each is read in, with the
 * countries where a neighbouring language writes it.
 */
const SCRIPT_LANGUAGES: ReadonlyArray<
  readonly [RegExp, string, Readonly<Record<string, string>>?]
> = [
  [/\p{Script=Hangul}/gu, "ko"],
  [/\p{Script=Greek}/gu, "el"],
  [/\p{Script=Cyrillic}/gu, "ru", { UA: "uk", BG: "bg" }],
  [/\p{Script=Arabic}/gu, "ar"],
  [/\p{Script=Hebrew}/gu, "he"],
  [/\p{Script=Thai}/gu, "th"],
  [/\p{Script=Lao}/gu, "lo"],
  [/\p{Script=Myanmar}/gu, "my"],
  [/\p{Script=Devanagari}/gu, "hi", { NP: "ne" }],
  [/\p{Script=Bengali}/gu, "bn"],
  [/\p{Script=Tamil}/gu, "ta"],
  [/\p{Script=Malayalam}/gu, "ml"],
  [/\p{Script=Georgian}/gu, "ka"],
  [/\p{Script=Armenian}/gu, "hy"],
  [/\p{Script=Ethiopic}/gu, "am"],
];
const HAN = /\p{Script=Han}/gu;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const ANY_LETTER = /\p{L}/gu;

function countOf(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * The language a church's name or a line of its address is written in, when
 * most of its letters settle it. VoiceOver reads such a line in that language's
 * voice instead of spelling Hangul or Hebrew through an English one, and the
 * browser draws Han in the country's own forms. Latin script settles nothing
 * ("Via Roma" and "Main Street" look alike), and a mixed line ("Dae Seongdang
 * (대성당)") keeps the page's language: most of it is meant to be read that way.
 */
export function parishTextLanguage(
  text: string | null | undefined,
  countryCode?: string | null,
): string | undefined {
  const value = trimmed(text);
  if (!value) return undefined;
  const letters = countOf(value, ANY_LETTER);
  const han = countOf(value, HAN);
  const kana = countOf(value, KANA);
  const code = trimmed(countryCode).toUpperCase();
  if (2 * (han + kana) > letters) {
    if (kana > 0 || code === "JP") return "ja";
    if (code === "KR") return "ko";
    return code === "TW" || code === "HK" || code === "MO" ? "zh-Hant" : "zh";
  }
  for (const [script, language, byCountry] of SCRIPT_LANGUAGES) {
    if (2 * countOf(value, script) > letters) return byCountry?.[code] ?? language;
  }
  return undefined;
}

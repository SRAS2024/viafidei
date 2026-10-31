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
  if (d === "chapel") return "chapel";
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

/**
 * A church's address as the lines of an envelope: the street, then the
 * locality (postal code, town and region, in the country's own order), then
 * the country. Missing parts are dropped, and a record with none of them
 * yields []. Nothing is reshaped or looked up — only what the record stores.
 */
export function parishAddressLines(parts: ParishAddressParts): string[] {
  const street = trimmed(parts.address);
  const postal = trimmed(parts.postalCode);
  const city = trimmed(parts.city);
  const region = trimmed(parts.state);
  const country = trimmed(parts.country);
  const code =
    trimmed(parts.countryCode).toUpperCase() || COUNTRY_CODES_BY_NAME[country.toLowerCase()] || "";

  let locality: string;
  if (postal && POSTCODE_AFTER_LOCALITY.has(code)) {
    const place = [city, region].filter(Boolean).join(", ");
    locality = place ? `${place} ${postal}` : postal;
  } else {
    const town = [postal, city].filter(Boolean).join(" ");
    locality = [town, region].filter(Boolean).join(", ");
  }
  return [street, locality, country].filter(Boolean);
}

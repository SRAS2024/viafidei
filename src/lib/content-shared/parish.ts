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

/** The parts of a parish record its place line is built from. */
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

/** Countries that write the postal code AFTER the locality ("Springfield, IL 62701"). */
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
]);

/**
 * The place line under the street: postal code, locality, state and country
 * in the country's usual order — "00153 Roma, Lazio, Italy", "Springfield,
 * Illinois 62701, United States" — with missing parts dropped.
 *
 * This is a LOCATION, not a diocese (the card used to label it "Diocese";
 * only `payload.diocese` names one). Returns null when the record has none of
 * the parts, so the caller omits the line rather than printing an empty row.
 */
export function parishPlaceLine(parts: ParishPlaceParts): string | null {
  const postal = trimmed(parts.postalCode);
  const city = trimmed(parts.city);
  const state = trimmed(parts.state);
  const country = trimmed(parts.country);
  let segments: string[];
  if (POSTCODE_AFTER_LOCALITY.has(trimmed(parts.countryCode).toUpperCase())) {
    segments = state
      ? [city, [state, postal].filter(Boolean).join(" ")]
      : [[city, postal].filter(Boolean).join(" ")];
  } else {
    segments = [[postal, city].filter(Boolean).join(" "), state];
  }
  const joined = [...segments, country].filter(Boolean).join(", ");
  return joined || null;
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
 * The destination handed to Maps: the street address plus the place parts, so
 * "123 Main St" resolves to the right "123 Main St" on earth. MapsAddressLink
 * still prefers exact coordinates when the record carries them.
 */
export function parishDirectionsAddress(
  parts: ParishPlaceParts & { address?: string | null },
): string {
  return [trimmed(parts.address), parishPlaceLine(parts) ?? ""].filter(Boolean).join(", ");
}

/**
 * A parish website as an (href, label) pair, or null when the record has no
 * usable one. Stored values are inconsistent about the scheme, so a bare
 * "stmarys.org" still becomes a working https link, and the label drops the
 * scheme and any trailing slash so the card shows a domain, not a raw URL.
 */
export function parishWebsite(value: unknown): { href: string; label: string } | null {
  const raw = trimmed(value);
  if (!raw) return null;
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const label = href.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return label ? { href, label } : null;
}

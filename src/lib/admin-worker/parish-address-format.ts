/**
 * Locale-aware postal-address formatting for the parish directory.
 *
 * Two facts about an address depend on the country and were ignored before:
 *
 *   - the ORDER of street and house number. A German church is at
 *     "Hauptstraße 12", an American one at "12 Main Street"; the street line
 *     used to be composed number-first everywhere, so half of Europe and all of
 *     Latin America read back to front.
 *   - the SHAPE of a postal code. A tag or lookup value that does not fit its
 *     country's format ("Roma", "75001;75002", a phone number) is DROPPED, never
 *     repaired, so nothing here can invent a postcode.
 *
 * Pure and deterministic; shared by the OSM sweep, the Nominatim research lane
 * and the dedup key.
 */

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function upperCode(value: unknown): string {
  const v = clean(value).toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : "";
}

/** English display name for an ISO-3166 alpha-2 code ("PL" → "Poland"). */
export function countryNameFor(code: string | undefined): string | undefined {
  if (!code || !/^[A-Z]{2}$/.test(code)) return undefined;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Countries whose addresses put the street name BEFORE the house number
 * ("Via Roma 12", "ul. Długa 5", "Calle Mayor 3"). Everywhere else — and for an
 * unknown country — the number comes first, the US / UK / French convention.
 */
const STREET_FIRST = new Set(
  [
    // Central, northern and southern Europe
    "DE AT CH LI NL BE IT SM VA ES AD PT PL CZ SK HU SI HR RS BA ME MK AL XK",
    "DK NO SE FI IS EE LV LT RO BG GR CY TR UA BY MD RU",
    // Latin America
    "AR BR CL CO MX PE VE UY PY BO EC GT HN SV NI CR PA CU DO",
    // Elsewhere
    "ID IL",
  ].flatMap((group) => group.split(" ")),
);

/** True when `countryCode` writes "<street> <number>". */
export function streetBeforeNumber(countryCode: string | null | undefined): boolean {
  return STREET_FIRST.has(upperCode(countryCode));
}

/**
 * The street line in the country's own order. A house number with no street
 * (or `addr:place`) is not a street line and yields "" — the old composition
 * stored a bare "12" as the address.
 */
export function composeStreetLine(
  street: string | null | undefined,
  houseNumber: string | null | undefined,
  countryCode: string | null | undefined,
): string {
  const s = clean(street);
  const n = clean(houseNumber);
  if (!s) return "";
  if (!n) return s;
  return streetBeforeNumber(countryCode) ? `${s} ${n}` : `${n} ${s}`;
}

/**
 * Postal-code formats (upper-cased, single-spaced) for the countries the sweep
 * covers. A country absent here falls back to a generic shape check.
 */
const POSTAL_FORMATS: Readonly<Record<string, RegExp>> = {
  US: /^\d{5}(-\d{4})?$/,
  PR: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/,
  MX: /^\d{5}$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/,
  IE: /^[A-Z]\d[\dW] ?[A-Z\d]{4}$/,
  FR: /^\d{5}$/,
  MC: /^980\d{2}$/,
  DE: /^\d{5}$/,
  IT: /^\d{5}$/,
  SM: /^4789\d$/,
  VA: /^00120$/,
  ES: /^\d{5}$/,
  AD: /^AD\d{3}$/,
  PT: /^\d{4}(-\d{3})?$/,
  NL: /^\d{4} ?[A-Z]{2}$/,
  BE: /^\d{4}$/,
  LU: /^(L-)?\d{4}$/,
  CH: /^\d{4}$/,
  LI: /^\d{4}$/,
  AT: /^\d{4}$/,
  PL: /^\d{2}-\d{3}$/,
  CZ: /^\d{3} ?\d{2}$/,
  SK: /^\d{3} ?\d{2}$/,
  HU: /^\d{4}$/,
  SI: /^(SI-)?\d{4}$/,
  HR: /^\d{5}$/,
  RS: /^\d{5}$/,
  BA: /^\d{5}$/,
  ME: /^\d{5}$/,
  MK: /^\d{4}$/,
  AL: /^\d{4}$/,
  RO: /^\d{6}$/,
  BG: /^\d{4}$/,
  GR: /^\d{3} ?\d{2}$/,
  CY: /^\d{4}$/,
  MT: /^[A-Z]{3} ?\d{2,4}$/,
  DK: /^\d{4}$/,
  NO: /^\d{4}$/,
  SE: /^\d{3} ?\d{2}$/,
  FI: /^\d{5}$/,
  IS: /^\d{3}$/,
  EE: /^\d{5}$/,
  LV: /^(LV-)?\d{4}$/,
  LT: /^(LT-)?\d{5}$/,
  UA: /^\d{5}$/,
  BY: /^\d{6}$/,
  RU: /^\d{6}$/,
  TR: /^\d{5}$/,
  BR: /^\d{5}-?\d{3}$/,
  AR: /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/,
  CL: /^\d{7}$/,
  CO: /^\d{6}$/,
  PE: /^\d{5}$/,
  EC: /^\d{6}$/,
  VE: /^\d{4}$/,
  UY: /^\d{5}$/,
  GT: /^\d{5}$/,
  CR: /^\d{5}$/,
  DO: /^\d{5}$/,
  CU: /^\d{5}$/,
  PH: /^\d{4}$/,
  IN: /^\d{3} ?\d{3}$/,
  LK: /^\d{5}$/,
  AU: /^\d{4}$/,
  NZ: /^\d{4}$/,
  ZA: /^\d{4}$/,
  SG: /^\d{6}$/,
  KR: /^\d{5}$/,
  JP: /^\d{3}-?\d{4}$/,
  CN: /^\d{6}$/,
  ID: /^\d{5}$/,
  TH: /^\d{5}$/,
  MY: /^\d{5}$/,
  NG: /^\d{6}$/,
  KE: /^\d{5}$/,
  TZ: /^\d{5}$/,
  LB: /^\d{4}( ?\d{4})?$/,
  IL: /^\d{5}(\d{2})?$/,
  JO: /^\d{5}$/,
  EG: /^\d{5}$/,
};

/** Countries with no postal-code system in everyday use: an address there is
 * complete without one, and any value offered for it is suspect. */
const NO_POSTAL_CODES = new Set(
  [
    "AE AG AO AW BF BI BJ BO BS BW BZ CD CF CG CI CK CM DJ DM ER FJ GA GD GH GM GQ",
    "GY HK JM KI KM KN LC ML MO MR MW NR NU QA RW SB SC SL SO SR ST SY TD TG TK TL",
    "TO TV UG VC VU YE ZW",
  ].flatMap((group) => group.split(" ")),
);

/** Shape check for a country with no table entry: 2–10 characters, a digit. */
const GENERIC_POSTAL = /^(?=.*\d)[A-Z0-9][A-Z0-9 -]{1,9}$/;

/** Whether an address in `countryCode` needs a postal code to be complete. */
export function countryUsesPostalCodes(countryCode: string | null | undefined): boolean {
  return !NO_POSTAL_CODES.has(upperCode(countryCode));
}

/**
 * The postal code in display form (trimmed, single-spaced, upper-case) when it
 * fits the country's format, else undefined. Never reshapes a value into a
 * different code: "00153" stays "00153", "75001;75002" is refused.
 */
export function normalizePostalCode(
  raw: string | null | undefined,
  countryCode: string | null | undefined,
): string | undefined {
  const value = clean(raw).toUpperCase();
  if (!value || value.length > 12) return undefined;
  const cc = upperCode(countryCode);
  if (cc && NO_POSTAL_CODES.has(cc)) return undefined;
  const format = cc ? POSTAL_FORMATS[cc] : undefined;
  if (format) return format.test(value) ? value : undefined;
  return GENERIC_POSTAL.test(value) ? value : undefined;
}

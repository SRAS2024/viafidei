/**
 * Parish extractor (Section 8). Produces a typed Parish package
 * payload with name, address, city, region, country, diocese, and
 * website.
 *
 * "Usable location" means at least one of (address) or (city +
 * country). A parish row with no usable location is rejected.
 */

export type ParishExtractionResult = {
  complete: boolean;
  payload: {
    parishName?: string;
    address?: string;
    city?: string;
    region?: string;
    country?: string;
    diocese?: string;
    websiteUrl?: string;
    sourceUrl?: string;
  };
  provenance: Record<string, string>;
  missingFields: string[];
};

const COUNTRY_HINTS = [
  "United States",
  "USA",
  "United Kingdom",
  "UK",
  "Canada",
  "Australia",
  "Ireland",
  "France",
  "Italy",
  "Spain",
  "Mexico",
  "Brazil",
  "Argentina",
  "Philippines",
  "India",
  "Poland",
  "Germany",
  "Portugal",
];

const COUNTRY_RE = new RegExp(`\\b(${COUNTRY_HINTS.join("|")})\\b`, "i");

// US-state-like patterns to derive `region`.
const US_STATE_RE =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

const ADDRESS_RE =
  /\b(\d{1,5}\s+[A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,5}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Place|Pl\.?|Court|Ct\.?|Highway|Hwy\.?))\b/;

const DIOCESE_RE = /\b(?:Diocese|Archdiocese)\s+of\s+([A-Z][A-Za-z\s.'-]+?)(?=[.,\n]|$)/;

const URL_RE = /\bhttps?:\/\/[^\s)]+/;

function sourceHostFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function extractParish(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
}): ParishExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];

  const parishName = args.title?.trim() || undefined;
  if (parishName) provenance.parishName = "title input";
  else missingFields.push("parishName");

  const addressMatch = args.body.match(ADDRESS_RE);
  const address = addressMatch ? addressMatch[1].trim() : undefined;
  if (address) provenance.address = "address regex";

  const countryMatch = args.body.match(COUNTRY_RE);
  let country = countryMatch ? countryMatch[1] : undefined;
  if (country === "USA") country = "United States";
  if (country === "UK") country = "United Kingdom";
  if (country) provenance.country = "country regex";

  const stateMatch = args.body.match(US_STATE_RE);
  const region = stateMatch ? stateMatch[1] : undefined;
  if (region) provenance.region = "US-state regex";

  // City heuristic: a Title Case word right before the state/country
  // mention, or in an address line. We use a simple "two-word capital
  // block" pattern.
  let city: string | undefined;
  if (stateMatch) {
    const before = args.body.slice(0, stateMatch.index);
    const cityMatch = before.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?),?\s*$/);
    city = cityMatch ? cityMatch[1].trim() : undefined;
  }
  if (city) provenance.city = "preceding capital-block";

  const dioceseMatch = args.body.match(DIOCESE_RE);
  const diocese = dioceseMatch ? `Diocese of ${dioceseMatch[1].trim()}` : undefined;
  if (diocese) provenance.diocese = "diocese regex";

  const urlMatch = args.body.match(URL_RE);
  const websiteUrl = urlMatch ? urlMatch[0] : undefined;
  if (websiteUrl) provenance.websiteUrl = "URL regex";

  // Usable-location requirement: address OR (city + country).
  const hasUsableLocation = !!address || (!!city && !!country);
  if (!hasUsableLocation) missingFields.push("location");

  return {
    complete: missingFields.length === 0,
    payload: {
      parishName,
      address,
      city,
      region,
      country,
      diocese,
      websiteUrl,
      sourceUrl: args.sourceUrl ?? sourceHostFromUrl(args.sourceUrl),
    },
    provenance,
    missingFields,
  };
}

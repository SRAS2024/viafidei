/**
 * Google Maps / Places parish discovery (spec: "allow parishes to be found in
 * Google Maps"). Gated on GOOGLE_PLACES_API_KEY — with no key configured this
 * is disabled and every call returns an empty list, so the default deployment
 * is unaffected.
 *
 * Uses the Places API (New) Text Search endpoint with a field mask, asking for
 * Catholic churches in a given locality. The raw results are only *candidates*:
 * Maps lists "Catholic" churches that are not in communion with Rome, so every
 * candidate must still pass `verifyParishCommunion` (communion-verifier.ts)
 * against its own website before it can be published.
 */

export interface PlaceParish {
  name: string;
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  placeId: string;
  types: string[];
  /** A stable Maps URL for the citation trail. */
  mapsUri?: string;
}

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.types",
  "places.addressComponents",
  "places.primaryType",
].join(",");

const TIMEOUT_MS = 12_000;

export function placesApiKey(): string | null {
  const k = (process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
  return k || null;
}

/** Is Google Maps parish discovery configured? */
export function placesEnabled(): boolean {
  return placesApiKey() != null && process.env.ADMIN_WORKER_SKIP_NETWORK !== "1";
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  websiteUri?: string;
  googleMapsUri?: string;
  types?: string[];
  primaryType?: string;
  addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
}

function componentOfType(raw: RawPlace, type: string, short = false): string | undefined {
  const c = (raw.addressComponents ?? []).find((x) => (x.types ?? []).includes(type));
  if (!c) return undefined;
  return (short ? c.shortText : c.longText) ?? c.longText ?? c.shortText ?? undefined;
}

function toParish(raw: RawPlace): PlaceParish | null {
  const name = raw.displayName?.text?.trim();
  const id = raw.id?.trim();
  if (!name || !id) return null;
  return {
    name,
    formattedAddress: raw.formattedAddress?.trim() ?? "",
    city:
      componentOfType(raw, "locality") ??
      componentOfType(raw, "postal_town") ??
      componentOfType(raw, "administrative_area_level_2"),
    state: componentOfType(raw, "administrative_area_level_1"),
    country: componentOfType(raw, "country"),
    latitude: typeof raw.location?.latitude === "number" ? raw.location.latitude : undefined,
    longitude: typeof raw.location?.longitude === "number" ? raw.location.longitude : undefined,
    website: raw.websiteUri?.trim() || undefined,
    placeId: id,
    types: raw.types ?? (raw.primaryType ? [raw.primaryType] : []),
    mapsUri: raw.googleMapsUri?.trim() || `https://www.google.com/maps/place/?q=place_id:${id}`,
  };
}

/**
 * Search Google Maps for Catholic churches matching a free-text locality query
 * (e.g. "Catholic churches in Boston, Massachusetts"). Returns [] when no API
 * key is configured or the call fails. Results are unverified candidates.
 */
export async function searchCatholicParishes(query: string): Promise<PlaceParish[]> {
  const key = placesApiKey();
  if (!key || !query.trim() || process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        // Bias toward places of worship; the communion check does the real
        // filtering, this just narrows the candidate set.
        includedType: "church",
        languageCode: "en",
        maxResultCount: 20,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: RawPlace[] };
    const out: PlaceParish[] = [];
    for (const raw of data.places ?? []) {
      const p = toParish(raw);
      if (p) out.push(p);
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

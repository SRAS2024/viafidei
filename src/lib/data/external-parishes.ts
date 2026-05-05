/**
 * Live, global parish lookups backed by OpenStreetMap.
 *
 * Why OSM:
 *   We deliberately keep our internal Parish table small and curated. To
 *   give users access to *every* Catholic church in the world (the explicit
 *   product requirement for the parish locator), we proxy queries to the
 *   OpenStreetMap Overpass API at request time. OSM has the deepest open
 *   coverage of houses of worship globally, tagged as
 *   `amenity=place_of_worship + religion=christian + denomination=catholic`.
 *
 * Boundaries:
 *   - All HTTP work happens server-side; the browser only ever talks to our
 *     own /api/parishes endpoints, so the strict CSP `connect-src 'self'`
 *     remains intact.
 *   - We mirror the data into our domain shape (NearbyParish-like) so the
 *     UI can render a uniform list of internal + external results.
 *   - OSM-sourced rows carry a slug of the form `osm-<type>-<id>` (e.g.
 *     `osm-node-1234567890`) so the existing detail route at
 *     /spiritual-guidance/[slug] can recognize them and render the
 *     external-listing layout without touching the database.
 */

import { appConfig } from "../config";
import { logger } from "../observability/logger";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
] as const;

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

const REQUEST_TIMEOUT_MS = 12_000;

export type ExternalParish = {
  id: string; // matches the slug — `osm-<type>-<id>`
  slug: string;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  latitude: number;
  longitude: number;
  source: "osm";
};

export type NearbyExternalParish = {
  parish: ExternalParish;
  distanceKm: number;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

function getUserAgent(): string {
  return appConfig.ingestion.userAgent;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build an Overpass QL query selecting Catholic churches inside a bounding
 * box around (lat, lon). Bounding box is more efficient than `around` for
 * large radii because Overpass indexes by bbox first.
 */
function buildOverpassNearbyQuery(lat: number, lon: number, radiusKm: number): string {
  const radiusM = Math.round(Math.max(0.5, Math.min(radiusKm, 250)) * 1000);
  return `
[out:json][timeout:25];
(
  node["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"](around:${radiusM},${lat},${lon});
  way["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"](around:${radiusM},${lat},${lon});
  relation["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"](around:${radiusM},${lat},${lon});
);
out tags center 200;
`.trim();
}

function buildOverpassByIdQuery(type: "node" | "way" | "relation", id: number): string {
  return `
[out:json][timeout:15];
${type}(${id});
out tags center 1;
`.trim();
}

function buildOverpassSearchQuery(name: string, country?: string | null): string {
  const safeName = name.replace(/["\\]/g, "").trim();
  if (!safeName) return "";
  const countryClause = country
    ? `(area["ISO3166-1"="${country.replace(/[^A-Za-z]/g, "").toUpperCase()}"];)->.searchArea;`
    : "";
  const areaScope = country ? "(area.searchArea)" : "";
  return `
[out:json][timeout:25];
${countryClause}
(
  node["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"]["name"~"${safeName}",i]${areaScope};
  way["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"]["name"~"${safeName}",i]${areaScope};
  relation["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"]["name"~"${safeName}",i]${areaScope};
);
out tags center 60;
`.trim();
}

async function runOverpass(query: string): Promise<OverpassResponse | null> {
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": getUserAgent(),
          accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as OverpassResponse;
      return json;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) {
    logger.warn("parish.overpass_failed", {
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
  return null;
}

/**
 * Convert an Overpass element into our normalized ExternalParish shape.
 * Returns null if the element lacks the minimum required fields (name +
 * coordinates).
 */
function toExternalParish(el: OverpassElement): ExternalParish | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  const slug = `osm-${el.type}-${el.id}`;
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  const city = tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"];
  const region = tags["addr:state"] ?? tags["addr:province"];
  const country = tags["addr:country"];
  const phone = tags.phone ?? tags["contact:phone"];
  const websiteUrl = tags.website ?? tags["contact:website"];

  return {
    id: slug,
    slug,
    name,
    address: street || null,
    city: city ?? null,
    region: region ?? null,
    country: country ?? null,
    phone: phone ?? null,
    websiteUrl: websiteUrl ? normalizeUrl(websiteUrl) : null,
    latitude: lat,
    longitude: lon,
    source: "osm",
  };
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const EARTH_KM = 6371;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const x =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_KM * c;
}

export async function findOsmParishesNear(
  lat: number,
  lon: number,
  radiusKm: number,
  take = 40,
): Promise<NearbyExternalParish[]> {
  const query = buildOverpassNearbyQuery(lat, lon, radiusKm);
  const json = await runOverpass(query);
  if (!json?.elements?.length) return [];
  const seen = new Set<string>();
  const results: NearbyExternalParish[] = [];
  for (const el of json.elements) {
    const parish = toExternalParish(el);
    if (!parish) continue;
    if (seen.has(parish.slug)) continue;
    seen.add(parish.slug);
    const distanceKm = haversineKm({ lat, lon }, { lat: parish.latitude, lon: parish.longitude });
    if (distanceKm > radiusKm) continue;
    results.push({ parish, distanceKm });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results.slice(0, take);
}

export async function searchOsmParishes(query: string, take = 40): Promise<ExternalParish[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  // Try direct name match first (works well for unique names: "Notre-Dame de Paris").
  const namedQuery = buildOverpassSearchQuery(trimmed);
  if (namedQuery) {
    const json = await runOverpass(namedQuery);
    const direct = (json?.elements ?? [])
      .map(toExternalParish)
      .filter((p): p is ExternalParish => p !== null);
    if (direct.length > 0) {
      return dedupe(direct).slice(0, take);
    }
  }

  // Fall back: geocode the query as a place name, then return the nearest
  // Catholic churches around that point.
  const geo = await geocodeWithNominatim(trimmed);
  if (!geo) return [];
  const nearby = await findOsmParishesNear(geo.lat, geo.lon, 25, take);
  return nearby.map((entry) => entry.parish);
}

function dedupe(parishes: ExternalParish[]): ExternalParish[] {
  const seen = new Set<string>();
  const out: ExternalParish[] = [];
  for (const p of parishes) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p);
  }
  return out;
}

async function geocodeWithNominatim(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  try {
    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        "user-agent": getUserAgent(),
        accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const items = (await res.json()) as NominatimResult[];
    const first = items[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch (err) {
    logger.warn("parish.nominatim_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

const SLUG_PATTERN = /^osm-(node|way|relation)-(\d+)$/;

export async function fetchOsmParishById(slug: string): Promise<ExternalParish | null> {
  const match = SLUG_PATTERN.exec(slug);
  if (!match) return null;
  const type = match[1] as "node" | "way" | "relation";
  const id = Number(match[2]);
  if (!Number.isFinite(id)) return null;
  const json = await runOverpass(buildOverpassByIdQuery(type, id));
  const el = json?.elements?.[0];
  if (!el) return null;
  return toExternalParish(el);
}

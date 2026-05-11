import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { findParishesNear, findPublishedParishes } from "@/lib/data/parishes";
import {
  findOsmParishesNear,
  geocodeWithNominatim,
  looksLikeLocationQuery,
  searchOsmParishes,
  type ExternalParish,
} from "@/lib/data/external-parishes";
import { logger } from "@/lib/observability/logger";

/**
 * Global parish search.
 *
 * The route handles two intents:
 *   1. Name searches ("St. Patrick", "Notre Dame") — runs a literal
 *      lookup against the curated catalog and Overpass.
 *   2. Location searches (ZIP, postcode, "City, ST", coordinates) — geocodes
 *      the input and returns nearby Catholic churches sorted by distance.
 *
 * Internal results always win on slug duplicates so users see the
 * admin-curated record when one exists.
 */
const NEARBY_RADIUS_KM = 30;
const MAX_TOTAL_RESULTS = 100;

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:parishes-search:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return jsonError("invalid");

  type Item = {
    id: string;
    slug: string;
    name: string;
    address?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    phone?: string | null;
    websiteUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    distanceKm?: number;
    source: "internal" | "osm";
  };

  const seenSlugs = new Set<string>();
  const items: Item[] = [];

  // Branch on intent so a "94103" or "Boston, MA" query reaches the
  // geocoder + nearby-radius path. Falling through to the literal
  // Overpass name search for those would return nothing useful.
  const treatAsLocation = looksLikeLocationQuery(q);

  if (treatAsLocation) {
    const geo = await geocodeWithNominatim(q).catch((err) => {
      logger.warn("parish.geocode_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });

    if (geo) {
      const [internalNear, externalNear] = await Promise.all([
        findParishesNear(geo.lat, geo.lon, NEARBY_RADIUS_KM, 60).catch((err) => {
          logger.warn("parish.internal_near_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        }),
        findOsmParishesNear(geo.lat, geo.lon, NEARBY_RADIUS_KM, 80).catch((err) => {
          logger.warn("parish.external_near_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        }),
      ]);

      for (const entry of internalNear) {
        if (seenSlugs.has(entry.parish.slug)) continue;
        seenSlugs.add(entry.parish.slug);
        items.push({
          id: entry.parish.id,
          slug: entry.parish.slug,
          name: entry.parish.name,
          address: entry.parish.address,
          city: entry.parish.city,
          region: entry.parish.region,
          country: entry.parish.country,
          phone: entry.parish.phone,
          websiteUrl: entry.parish.websiteUrl,
          latitude: entry.parish.latitude,
          longitude: entry.parish.longitude,
          distanceKm: entry.distanceKm,
          source: "internal",
        });
      }

      for (const entry of externalNear) {
        if (seenSlugs.has(entry.parish.slug)) continue;
        seenSlugs.add(entry.parish.slug);
        items.push({
          id: entry.parish.id,
          slug: entry.parish.slug,
          name: entry.parish.name,
          address: entry.parish.address,
          city: entry.parish.city ?? geo.city ?? null,
          region: entry.parish.region ?? geo.region ?? null,
          country: entry.parish.country ?? geo.country ?? null,
          phone: entry.parish.phone,
          websiteUrl: entry.parish.websiteUrl,
          latitude: entry.parish.latitude,
          longitude: entry.parish.longitude,
          distanceKm: entry.distanceKm,
          source: "osm",
        });
      }

      items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      return jsonOk({
        items: items.slice(0, MAX_TOTAL_RESULTS),
        intent: "location",
        center: { lat: geo.lat, lon: geo.lon },
        radiusKm: NEARBY_RADIUS_KM,
      });
    }

    // Geocoding failed — fall through to a name search so the user still
    // gets a chance at results instead of an empty page.
  }

  const [internal, external] = await Promise.all([
    findPublishedParishes({ q }, 60).catch((err) => {
      logger.warn("parish.internal_search_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }),
    searchOsmParishes(q, 80).catch((err) => {
      logger.warn("parish.external_search_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as ExternalParish[];
    }),
  ]);

  for (const p of internal) {
    if (seenSlugs.has(p.slug)) continue;
    seenSlugs.add(p.slug);
    items.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      address: p.address,
      city: p.city,
      region: p.region,
      country: p.country,
      phone: p.phone,
      websiteUrl: p.websiteUrl,
      latitude: p.latitude,
      longitude: p.longitude,
      source: "internal",
    });
  }

  for (const p of external) {
    if (seenSlugs.has(p.slug)) continue;
    seenSlugs.add(p.slug);
    items.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      address: p.address,
      city: p.city,
      region: p.region,
      country: p.country,
      phone: p.phone,
      websiteUrl: p.websiteUrl,
      latitude: p.latitude,
      longitude: p.longitude,
      source: "osm",
    });
  }

  return jsonOk({
    items: items.slice(0, MAX_TOTAL_RESULTS),
    intent: "name",
  });
}

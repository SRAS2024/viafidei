import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { findParishesNear } from "@/lib/data/parishes";
import { findOsmParishesNear } from "@/lib/data/external-parishes";
import { logger } from "@/lib/observability/logger";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:parishes-near:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const radiusKm = Math.min(Math.max(Number(url.searchParams.get("radiusKm")) || 25, 1), 250);
  const includeExternal = url.searchParams.get("external") !== "false";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return jsonError("invalid");
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return jsonError("invalid");

  // Pull curated DB rows and OSM rows in parallel. Both must be safe to fail
  // independently so a single upstream hiccup never blanks the locator.
  const [internal, external] = await Promise.all([
    findParishesNear(lat, lon, radiusKm, 40).catch((err) => {
      logger.warn("parish.internal_near_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }),
    includeExternal
      ? findOsmParishesNear(lat, lon, radiusKm, 80).catch((err) => {
          logger.warn("parish.external_near_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        })
      : Promise.resolve([]),
  ]);

  // De-duplicate: prefer curated DB rows when an OSM result lands within
  // ~150m of a known parish (likely the same building).
  const merged = mergeNearby(internal, external);
  return jsonOk({ items: merged.slice(0, 60), radiusKm });
}

type InternalEntry = Awaited<ReturnType<typeof findParishesNear>>[number];
type ExternalEntry = Awaited<ReturnType<typeof findOsmParishesNear>>[number];

type MergedEntry = {
  parish: {
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
    source: "internal" | "osm";
  };
  distanceKm: number;
};

function mergeNearby(internal: InternalEntry[], external: ExternalEntry[]): MergedEntry[] {
  const out: MergedEntry[] = [];

  for (const entry of internal) {
    out.push({
      parish: {
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
        source: "internal",
      },
      distanceKm: entry.distanceKm,
    });
  }

  for (const entry of external) {
    const tooClose = out.some((existing) => {
      if (existing.parish.latitude == null || existing.parish.longitude == null) return false;
      const d = haversineKm(
        { lat: existing.parish.latitude, lon: existing.parish.longitude },
        { lat: entry.parish.latitude, lon: entry.parish.longitude },
      );
      return d < 0.15;
    });
    if (tooClose) continue;
    out.push({
      parish: {
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
        source: "osm",
      },
      distanceKm: entry.distanceKm,
    });
  }

  return out.sort((a, b) => a.distanceKm - b.distanceKm);
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
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

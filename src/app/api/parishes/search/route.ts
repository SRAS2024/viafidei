import { type NextRequest } from "next/server";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/http";
import { findPublishedParishes } from "@/lib/data/parishes";
import { searchOsmParishes, type ExternalParish } from "@/lib/data/external-parishes";
import { logger } from "@/lib/observability/logger";

/**
 * Global parish search.
 *
 * Combines our curated catalog with a live OpenStreetMap query so the
 * locator surfaces parishes anywhere in the world without depending on
 * what's been ingested locally. The internal catalog wins on duplicates so
 * users still see the richer (admin-curated) record when one exists.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`pub:parishes-search:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return jsonError("invalid");

  const [internal, external] = await Promise.all([
    findPublishedParishes({ q }, 40).catch((err) => {
      logger.warn("parish.internal_search_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }),
    searchOsmParishes(q, 60).catch((err) => {
      logger.warn("parish.external_search_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as ExternalParish[];
    }),
  ]);

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
    source: "internal" | "osm";
  };

  const seenSlugs = new Set<string>();
  const items: Item[] = [];

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

  return jsonOk({ items: items.slice(0, 80) });
}

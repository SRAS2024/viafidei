/**
 * Keyless OpenStreetMap (Overpass API) parish discovery.
 *
 * Google Maps parish discovery (parish-discovery-runner.ts) is powerful but
 * needs a `GOOGLE_PLACES_API_KEY`. This is the keyless, free, public-data
 * alternative: it queries the OpenStreetMap Overpass API for churches tagged
 * `amenity=place_of_worship` + `religion=christian` + `denomination=roman_catholic`
 * in a locality, and feeds the candidates through the SAME accuracy gates as the
 * Maps flow — communion verification against the parish website + the strict
 * parish schema + the real publish orchestrator. More sources, more versatility,
 * no key, same accuracy bar.
 *
 * Communion handling mirrors the Maps flow: a candidate with a website is
 * verified against it (a site that reveals it is NOT in communion with Rome is
 * rejected), while a candidate with no website is trusted on the strength of the
 * explicit `roman_catholic` denomination tag (which, unlike Google's coarse
 * "Catholic", already excludes Old Catholic / sedevacantist / Orthodox). Either
 * way it still passes the schema + publish gate. Network-gated (a no-op offline)
 * and self-throttled so it respects Overpass fair-use.
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import { isDoctrinallySensitive } from "./content-type-profiles";
import { runPublishOrchestrator } from "./publish-orchestrator";
import { verifyParishCommunion, type CommunionVerdict } from "./communion-verifier";
import { designationFor, fileReview, slugify } from "./parish-discovery-runner";
import type { PlaceParish } from "./parish-places";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS = 30_000;
const THROTTLE_MS = 10 * 60 * 1000; // respect Overpass fair-use: at most ~every 10 min
const THROTTLE_KEY = "osm-parish-lastrun";

/** A few Catholic-dense localities to seed discovery on a fresh catalog. */
const DEFAULT_OSM_CITIES = ["Rome", "Boston", "Dublin", "Manila", "Kraków", "Buenos Aires"];

/** Keyless + on by default; disabled in skip-network and via opt-out env. */
export function osmParishDiscoveryEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_OSM_PARISHES ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/**
 * Map one Overpass element to a parish candidate, or null when it isn't an
 * explicitly Roman Catholic church with a usable name + street address + city.
 * Exported for testing.
 */
export function osmElementToParish(el: OverpassElement): PlaceParish | null {
  const tags = el.tags ?? {};
  const name = (tags.name ?? "").trim();
  if (!name) return null;
  // Strict: only the explicit Roman Catholic denomination tag (excludes
  // "old_catholic", the ambiguous bare "catholic", Orthodox, etc.).
  if ((tags.denomination ?? "").toLowerCase() !== "roman_catholic") return null;

  const city = (tags["addr:city"] ?? tags["addr:town"] ?? "").trim();
  if (!city) return null;
  const full = (tags["addr:full"] ?? "").trim();
  const street = (tags["addr:street"] ?? "").trim();
  const houseNumber = (tags["addr:housenumber"] ?? "").trim();
  const address = full || [houseNumber, street].filter(Boolean).join(" ").trim();
  if (!address) return null;
  if (!el.type || el.id == null) return null;

  const lat = typeof el.lat === "number" ? el.lat : el.center?.lat;
  const lon = typeof el.lon === "number" ? el.lon : el.center?.lon;

  let website = (tags.website || tags["contact:website"] || "").trim();
  if (website && !/^https?:\/\//i.test(website)) website = "";
  if (website) {
    try {
      new URL(website);
    } catch {
      website = "";
    }
  }

  const osmRef = `${el.type}/${el.id}`;
  return {
    name,
    formattedAddress: address,
    city,
    state: (tags["addr:state"] ?? "").trim() || undefined,
    country: (tags["addr:country"] ?? "").trim() || undefined,
    latitude: typeof lat === "number" ? lat : undefined,
    longitude: typeof lon === "number" ? lon : undefined,
    website: website || undefined,
    placeId: `osm:${osmRef}`,
    types: ["place_of_worship"],
    mapsUri: `https://www.openstreetmap.org/${osmRef}`,
  };
}

/**
 * Search OpenStreetMap (Overpass) for Roman Catholic churches in a locality.
 * Returns [] offline / disabled / on any failure. Candidates are unverified.
 */
export async function searchCatholicParishesOsm(locality: string): Promise<PlaceParish[]> {
  if (!osmParishDiscoveryEnabled() || !locality.trim()) return [];
  // Overpass area names match a single token best; keep letters/numbers/space.
  const safe = locality.replace(/[^\p{L}\p{N}\s.'-]/gu, "").trim();
  if (!safe) return [];
  const query = `[out:json][timeout:25];
area["name"="${safe}"]->.a;
nwr["amenity"="place_of_worship"]["religion"="christian"]["denomination"="roman_catholic"]["name"](area.a);
out center tags 60;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "User-Agent": "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; parish directory)",
      },
      body: query,
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { elements?: OverpassElement[] };
    const out: PlaceParish[] = [];
    for (const el of data.elements ?? []) {
      const p = osmElementToParish(el);
      if (p) out.push(p);
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export interface OsmParishResult {
  enabled: boolean;
  queriesRun: number;
  candidates: number;
  published: number;
  routedToReview: number;
  rejected: number;
  detail: string;
}

/** Self-throttle so the loop can call this every pass without hammering Overpass. */
async function throttleOk(prisma: PrismaClient): Promise<boolean> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < THROTTLE_MS) return false;
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
  return true;
}

/** Localities to query this pass: operator-configured, else catalog cities, else seeds. */
async function buildOsmCityQueries(prisma: PrismaClient, max: number): Promise<string[]> {
  const cities: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const city = (raw.split(",")[0] ?? "").trim();
    if (city && !seen.has(city.toLowerCase())) {
      seen.add(city.toLowerCase());
      cities.push(city);
    }
  };

  const configured = (process.env.PARISH_DISCOVERY_LOCATIONS ?? "")
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length > 0) {
    configured.forEach(push);
    return cities.slice(0, max);
  }

  const rows = await prisma.publishedContent
    .findMany({
      where: { contentType: "PARISH" as never, isPublished: true },
      select: { payload: true },
      take: 500,
    })
    .catch(() => [] as Array<{ payload: unknown }>);
  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    if (typeof p.city === "string") push(p.city);
    if (cities.length >= max) break;
  }
  if (cities.length === 0) DEFAULT_OSM_CITIES.forEach(push);
  return cities.slice(0, max);
}

/** Publish one OSM parish through the real gate (OSM-accurate citations + summary). */
async function publishOsmParish(
  prisma: PrismaClient,
  candidate: PlaceParish,
  slug: string,
  verdict: CommunionVerdict,
): Promise<boolean> {
  const city = candidate.city ?? "";
  const citations = [candidate.mapsUri, candidate.website].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  if (citations.length === 0) return false;
  const designation = designationFor(candidate.name);
  const websiteChecked = Boolean(candidate.website) && verdict.status === "in-communion";

  const payload: Record<string, unknown> = {
    slug,
    title: candidate.name,
    designation,
    address: candidate.formattedAddress,
    city,
    summary: `${candidate.name} is a Roman Catholic ${designation.replace("-", " ")} in ${city}, listed in OpenStreetMap (denomination "roman_catholic")${
      websiteChecked ? "; communion with the Holy See checked against the parish website" : ""
    }.`,
    citations,
  };
  if (candidate.state) payload.state = candidate.state;
  if (candidate.country) payload.country = candidate.country;
  if (candidate.website) payload.website = candidate.website;
  if (typeof candidate.latitude === "number") payload.latitude = candidate.latitude;
  if (typeof candidate.longitude === "number") payload.longitude = candidate.longitude;

  if (!validatePayload("PARISH", payload).ok) return false;

  const item = await prisma.checklistItem
    .findFirst({
      where: { contentType: "PARISH" as never, canonicalSlug: slug },
      select: { id: true },
    })
    .catch(() => null);
  const checklistItem =
    item ??
    (await prisma.checklistItem
      .create({
        data: {
          contentType: "PARISH" as never,
          canonicalName: candidate.name,
          canonicalSlug: slug,
          approvalStatus: "APPROVED_FOR_BUILD",
        },
        select: { id: true },
      })
      .catch(() => null));
  if (!checklistItem) return false;

  const result = await runPublishOrchestrator(prisma, {
    contentType: "PARISH",
    contentId: checklistItem.id,
    title: candidate.name,
    slug,
    payload: payload as never,
    authorityLevel: "COMMUNITY",
    finalScore: 0.88,
    qaPassed: true,
    hasSourceEvidence: citations.length > 0,
    isDoctrinallySensitive: isDoctrinallySensitive("PARISH"),
    confidence: verdict.confidence || 0.8,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: [],
      evidence: [],
      hasConflict: false,
      summary: `Discovered via OpenStreetMap (denomination roman_catholic)${
        candidate.website ? `; ${verdict.reason}` : ""
      }.`,
    },
  }).catch(() => null);

  return result?.kind === "published";
}

/**
 * Run one keyless OSM parish-discovery pass: query a couple of localities,
 * communion-check candidates, and publish the in-communion ones (routing the
 * rest to review). Self-throttled and bounded.
 */
export async function runOsmParishDiscovery(
  prisma: PrismaClient,
  opts: {
    brainActive: boolean;
    maxQueries?: number;
    maxPublishPerPass?: number;
    force?: boolean;
  },
): Promise<OsmParishResult> {
  const base: OsmParishResult = {
    enabled: osmParishDiscoveryEnabled(),
    queriesRun: 0,
    candidates: 0,
    published: 0,
    routedToReview: 0,
    rejected: 0,
    detail: "",
  };
  if (!base.enabled) {
    base.detail = "OSM parish discovery disabled (skip-network or opt-out).";
    return base;
  }
  if (!opts.force && !(await throttleOk(prisma))) {
    base.detail = "throttled (Overpass fair-use)";
    return base;
  }

  const maxQueries = opts.maxQueries ?? 2;
  const maxPublish = opts.maxPublishPerPass ?? 8;
  const cities = await buildOsmCityQueries(prisma, maxQueries);

  for (const city of cities) {
    const candidates = await searchCatholicParishesOsm(city);
    base.queriesRun += 1;
    for (const candidate of candidates) {
      base.candidates += 1;
      const slug = slugify(`${candidate.name} ${candidate.city ?? ""}`);
      if (!slug) continue;

      const exists = await prisma.publishedContent
        .findFirst({ where: { contentType: "PARISH" as never, slug }, select: { id: true } })
        .catch(() => null);
      if (exists) continue;

      // Communion: verify the website when present; otherwise trust the explicit
      // roman_catholic denomination tag.
      let verdict: CommunionVerdict;
      if (candidate.website) {
        verdict = await verifyParishCommunion(candidate.website);
        if (verdict.status === "not-in-communion") {
          base.rejected += 1;
          continue;
        }
      } else {
        verdict = {
          status: "in-communion",
          confidence: 0.8,
          signals: {
            positive: ["OpenStreetMap denomination=roman_catholic"],
            negative: [],
            review: [],
          },
          reason: "OpenStreetMap denomination=roman_catholic.",
        };
      }

      if (verdict.status === "in-communion" && opts.brainActive && base.published < maxPublish) {
        if (await publishOsmParish(prisma, candidate, slug, verdict)) {
          base.published += 1;
          continue;
        }
      }

      if (
        await fileReview(
          prisma,
          candidate,
          slug,
          verdict,
          verdict.status === "in-communion"
            ? "Confirm and publish parish (OpenStreetMap, in communion with Rome)"
            : "Verify parish communion with Rome before publishing",
        )
      ) {
        base.routedToReview += 1;
      }
    }
  }

  base.detail = `${base.candidates} candidate(s) over ${base.queriesRun} locality query(ies): published ${base.published}, ${base.routedToReview} to review, ${base.rejected} rejected.`;
  return base;
}

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
import { inspectParishWebsite, type CommunionVerdict } from "./communion-verifier";
import { designationFor, fileReview, slugify } from "./parish-discovery-runner";
import { parishAddressKey, findPublishedParishByAddressKey } from "./parish-address";
import type { PlaceParish } from "./parish-places";

/**
 * Overpass endpoints to try, in order. The primary public instance
 * (overpass-api.de) is frequently overloaded — it returns 504s and, even when
 * it answers 200, an area query can take 30s+ or (with a lagging area index)
 * come back EMPTY for a locality that plainly has Catholic parishes. Rotating
 * through the well-known mirrors turns a single flaky host into a reliable
 * pool: the first endpoint that returns a non-empty result wins. Operators can
 * prepend their own via OVERPASS_ENDPOINTS (comma-separated).
 */
function overpassEndpoints(): string[] {
  const extra = (process.env.OVERPASS_ENDPOINTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    ...extra,
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ].filter((v, i, a) => a.indexOf(v) === i);
}
// Overpass area queries legitimately take 20-40s; the old 30s client timeout
// aborted a slow-but-successful query and read it as "0 parishes". Give it a
// 55s budget (server-side [timeout:50] below leaves margin) — still under the
// 120s per-lane watchdog.
const TIMEOUT_MS = 55_000;
/** Positive integer from an env var, or the fallback. */
function osmEnvInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
// Overpass fair-use throttle. Default ~10 min between runs; env-tunable
// (`ADMIN_WORKER_OSM_THROTTLE_MS`) so an operator with a self-hosted/paid
// Overpass (see OVERPASS_ENDPOINTS) can grow the 200k-parish directory faster.
const THROTTLE_MS = osmEnvInt("ADMIN_WORKER_OSM_THROTTLE_MS", 10 * 60 * 1000);
// Max parish elements returned per bbox query. Env-tunable
// (`ADMIN_WORKER_OSM_OUT_CAP`) — a dense metro/region has hundreds of parishes,
// so a higher cap drains each locality in fewer sweeps.
const OUT_CAP = osmEnvInt("ADMIN_WORKER_OSM_OUT_CAP", 500);
const THROTTLE_KEY = "osm-parish-lastrun";
const LOCALITY_CURSOR_KEY = "osm-parish-locality-cursor";

/** A locality to sweep: a display name plus an optional bounding box. */
interface OsmLocality {
  name: string;
  /** [south, west, north, east] — when set, a fast spatial-index query is used. */
  bbox?: [number, number, number, number];
}

/**
 * Catholic-dense metro areas to sweep, each as a BOUNDING BOX. A bbox query hits
 * Overpass's spatial index directly and returns in ~3s with dozens of parishes,
 * where the old `area["name"=…]` lookup took 30-55s, was rate-limited, and often
 * returned 0 (a lagging/ambiguous area index). The worker rotates through this
 * list across passes (a saved cursor), so the directory grows worldwide instead
 * of re-querying the same two cities. This is a seed set — the catalog's own
 * published parishes expand coverage further via nearby-tile queries.
 */
const SEED_LOCALITIES: OsmLocality[] = [
  { name: "Rome", bbox: [41.79, 12.34, 42.0, 12.65] },
  { name: "Boston", bbox: [42.2, -71.2, 42.45, -70.95] },
  { name: "New York", bbox: [40.5, -74.05, 40.92, -73.7] },
  { name: "Chicago", bbox: [41.64, -87.94, 42.02, -87.52] },
  { name: "Philadelphia", bbox: [39.87, -75.28, 40.14, -74.96] },
  { name: "Los Angeles", bbox: [33.7, -118.5, 34.34, -118.15] },
  { name: "Dublin", bbox: [53.28, -6.4, 53.41, -6.1] },
  { name: "Manila", bbox: [14.5, 120.94, 14.68, 121.05] },
  { name: "Kraków", bbox: [49.98, 19.79, 50.12, 20.09] },
  { name: "Warsaw", bbox: [52.13, 20.85, 52.37, 21.27] },
  { name: "Madrid", bbox: [40.31, -3.83, 40.56, -3.55] },
  { name: "Paris", bbox: [48.8, 2.22, 48.91, 2.47] },
  { name: "Milan", bbox: [45.4, 9.07, 45.54, 9.28] },
  { name: "Naples", bbox: [40.8, 14.14, 40.92, 14.34] },
  { name: "Lisbon", bbox: [38.69, -9.23, 38.8, -9.09] },
  { name: "Vienna", bbox: [48.12, 16.24, 48.32, 16.51] },
  { name: "Munich", bbox: [48.06, 11.36, 48.25, 11.72] },
  { name: "Buenos Aires", bbox: [-34.71, -58.53, -34.53, -58.33] },
  { name: "Mexico City", bbox: [19.24, -99.28, 19.59, -98.94] },
  { name: "São Paulo", bbox: [-23.75, -46.83, -23.43, -46.36] },
  { name: "Montreal", bbox: [45.4, -73.77, 45.7, -73.47] },
  { name: "Toronto", bbox: [43.58, -79.64, 43.85, -79.12] },
  { name: "Sydney", bbox: [-33.95, 151.1, -33.78, 151.3] },
  { name: "Malta", bbox: [35.79, 14.18, 36.08, 14.58] },
  // Region-level sweeps over Catholic-dense areas with strong OpenStreetMap
  // address coverage. A region bbox returns far more parishes per query than a
  // single metro (Ireland alone ~190 with full addresses), so these give the
  // directory real headroom toward the 200k target without hand-listing every
  // city. Kept to moderate-size areas so the query stays within the request
  // timeout; a slow/empty one simply falls through the mirror race.
  { name: "Ireland", bbox: [51.4, -10.6, 55.4, -5.4] },
  { name: "Belgium", bbox: [49.5, 2.5, 51.5, 6.4] },
  { name: "Netherlands", bbox: [50.75, 3.35, 53.5, 7.2] },
  { name: "Austria", bbox: [46.4, 9.5, 49.0, 17.2] },
  { name: "Switzerland", bbox: [45.8, 5.95, 47.8, 10.5] },
  { name: "Portugal", bbox: [37.0, -9.5, 42.15, -6.2] },
  { name: "Catalonia", bbox: [40.5, 0.15, 42.9, 3.35] },
  { name: "Slovenia", bbox: [45.42, 13.38, 46.88, 16.6] },
  { name: "Croatia", bbox: [42.4, 13.5, 46.55, 19.45] },
  { name: "Slovakia", bbox: [47.7, 16.8, 49.6, 22.6] },
];

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

  // Phone is often right there in the OSM tags — take it as a best-effort start
  // (the website scrape may still refine it). Never required.
  const phone = (tags.phone || tags["contact:phone"] || "").trim() || undefined;

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
    phone,
    placeId: `osm:${osmRef}`,
    types: ["place_of_worship"],
    mapsUri: `https://www.openstreetmap.org/${osmRef}`,
  };
}

/**
 * Search OpenStreetMap (Overpass) for Roman Catholic churches in a locality.
 * Returns [] offline / disabled / on any failure. Candidates are unverified.
 */
export async function searchCatholicParishesOsm(
  locality: string,
  bbox?: [number, number, number, number],
): Promise<PlaceParish[]> {
  if (!osmParishDiscoveryEnabled()) return [];
  let query: string;
  if (bbox) {
    // Fast path: bounding-box query straight against Overpass's spatial index —
    // ~3s and dozens of parishes, no area lookup. The OUT_CAP result limit lets
    // a dense metro yield plenty of candidates per pass.
    const [s, w, n, e] = bbox;
    query = `[out:json][timeout:50];
nwr["amenity"="place_of_worship"]["religion"="christian"]["denomination"="roman_catholic"]["name"](${s},${w},${n},${e});
out center tags ${OUT_CAP};`;
  } else {
    if (!locality.trim()) return [];
    // Fallback: area-name lookup (slower, less reliable) for catalog-derived
    // localities that have no bbox. Overpass area names match a single token
    // best; keep letters/numbers/space.
    const safe = locality.replace(/[^\p{L}\p{N}\s.'-]/gu, "").trim();
    if (!safe) return [];
    query = `[out:json][timeout:50];
area["name"="${safe}"]->.a;
nwr["amenity"="place_of_worship"]["religion"="christian"]["denomination"="roman_catholic"]["name"](area.a);
out center tags ${OUT_CAP};`;
  }

  // Race every mirror in PARALLEL and take the first NON-EMPTY result. The
  // public Overpass instances are individually unreliable — one is overloaded
  // (504), another is slow (30s+), a third has a lagging area index and returns
  // 0 rows — but at any moment at least one usually answers quickly with data.
  // Querying them sequentially with a per-endpoint timeout could take
  // endpoints×timeout (well over the 120s lane watchdog); racing them means the
  // fastest healthy mirror wins in ~20s. One request per mirror per 10-min
  // throttle window respects each host's fair-use policy.
  const attempt = (endpoint: string): Promise<PlaceParish[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "User-Agent": "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; parish directory)",
      },
      body: query,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return [] as PlaceParish[];
        // Skip only when the server explicitly declares a non-JSON body (an HTML
        // error/rate-limit page). A missing/empty content-type falls through to
        // the parse, where a non-JSON body rejects and is caught below.
        const contentType = res.headers?.get?.("content-type") ?? "";
        if (contentType && !/json/i.test(contentType)) return [] as PlaceParish[];
        const data = (await res.json()) as { elements?: OverpassElement[] };
        const out: PlaceParish[] = [];
        for (const el of data.elements ?? []) {
          const p = osmElementToParish(el);
          if (p) out.push(p);
        }
        return out;
      })
      .catch(() => [] as PlaceParish[])
      .finally(() => clearTimeout(timer));
  };

  const pending = overpassEndpoints().map((ep) => attempt(ep));
  // Resolve as soon as any mirror returns a non-empty result; otherwise wait for
  // all and return [] (nothing reachable / no data for this locality this pass).
  return await new Promise<PlaceParish[]>((resolve) => {
    let settled = 0;
    let resolved = false;
    for (const p of pending) {
      p.then((rows) => {
        settled += 1;
        if (!resolved && rows.length > 0) {
          resolved = true;
          resolve(rows);
        } else if (settled === pending.length && !resolved) {
          resolve([]);
        }
      });
    }
  });
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

/** Read the rotating locality-sweep cursor (0 when unset). */
async function readLocalityCursor(prisma: PrismaClient): Promise<number> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: LOCALITY_CURSOR_KEY },
      },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = (row?.memoryValue as { index?: number } | null)?.index;
  return typeof v === "number" && v >= 0 ? v : 0;
}

/** Persist the next locality-sweep cursor so each pass covers new metros. */
async function writeLocalityCursor(prisma: PrismaClient, index: number): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: {
        memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: LOCALITY_CURSOR_KEY },
      },
      update: { memoryValue: { index }, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: LOCALITY_CURSOR_KEY,
        memoryValue: { index },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/**
 * Localities to query this pass. Operator-configured names win (area lookup);
 * otherwise the worker rotates through the bbox-backed SEED_LOCALITIES via a
 * saved cursor so it sweeps a new set of metros every pass and covers the world
 * over time instead of re-querying the same city forever.
 */
async function buildOsmCityQueries(prisma: PrismaClient, max: number): Promise<OsmLocality[]> {
  const configured = (process.env.PARISH_DISCOVERY_LOCATIONS ?? "")
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length > 0) {
    const seen = new Set<string>();
    const out: OsmLocality[] = [];
    for (const raw of configured) {
      const city = (raw.split(",")[0] ?? "").trim();
      if (city && !seen.has(city.toLowerCase())) {
        seen.add(city.toLowerCase());
        out.push({ name: city });
      }
    }
    return out.slice(0, max);
  }

  // Rotate through the seed metros: start at the saved cursor, wrap around.
  const start = (await readLocalityCursor(prisma)) % SEED_LOCALITIES.length;
  const out: OsmLocality[] = [];
  for (let i = 0; i < Math.min(max, SEED_LOCALITIES.length); i++) {
    out.push(SEED_LOCALITIES[(start + i) % SEED_LOCALITIES.length]);
  }
  await writeLocalityCursor(prisma, (start + out.length) % SEED_LOCALITIES.length);
  return out;
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
    addressKey: parishAddressKey({
      address: candidate.formattedAddress,
      city,
      state: candidate.state,
    }),
  };
  if (candidate.state) payload.state = candidate.state;
  if (candidate.country) payload.country = candidate.country;
  if (candidate.website) payload.website = candidate.website;
  // Best-effort contact / schedule details (never required to publish).
  if (candidate.phone) payload.phone = candidate.phone;
  if (candidate.massTimes) payload.massTimes = candidate.massTimes;
  if (candidate.confessionTimes) payload.confessionTimes = candidate.confessionTimes;
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
/** In-communion verdict backed by OSM's curated `denomination=roman_catholic`
 * tag — used both for parishes with no website and for those whose website
 * can't be read (an unreadable site is no evidence against communion). */
function osmDenominationVerdict(reason: string): CommunionVerdict {
  return {
    status: "in-communion",
    confidence: 0.8,
    signals: { positive: ["OpenStreetMap denomination=roman_catholic"], negative: [], review: [] },
    reason,
  };
}

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
  // Sprint scheduler: grow parishes in bounded sprints, then stand down for a
  // cooldown window during which the worker grows the OTHER content types
  // (unless every other goal is already met, in which case parishes run
  // continuously). `force` bypasses the cooldown for manual/proof runs.
  if (!opts.force) {
    const { evaluateParishSprint } = await import("./parish-sprint");
    const sprint = await evaluateParishSprint(prisma);
    if (!sprint.active) {
      base.detail = sprint.reason;
      return base;
    }
  }
  if (!opts.force && !(await throttleOk(prisma))) {
    base.detail = "throttled (Overpass fair-use)";
    return base;
  }

  // Localities queried per run and NEW parishes published per run — env-tunable
  // (`ADMIN_WORKER_OSM_MAX_QUERIES` / `ADMIN_WORKER_OSM_MAX_PUBLISH`) so parish
  // growth toward the 200k target can be dialled up where Overpass fair-use
  // allows (the mirror race spreads the load). Conservative defaults.
  const maxQueries = opts.maxQueries ?? osmEnvInt("ADMIN_WORKER_OSM_MAX_QUERIES", 2);
  const maxPublish = opts.maxPublishPerPass ?? osmEnvInt("ADMIN_WORKER_OSM_MAX_PUBLISH", 8);
  const localities = await buildOsmCityQueries(prisma, maxQueries);

  for (const locality of localities) {
    const candidates = await searchCatholicParishesOsm(locality.name, locality.bbox);
    base.queriesRun += 1;
    for (const candidate of candidates) {
      base.candidates += 1;
      const slug = slugify(`${candidate.name} ${candidate.city ?? ""}`);
      if (!slug) continue;

      const exists = await prisma.publishedContent
        .findFirst({ where: { contentType: "PARISH" as never, slug }, select: { id: true } })
        .catch(() => null);
      if (exists) continue;

      // Duplicate by ADDRESS: if an already-published parish sits at this exact
      // address, it is the same place under a different name — skip it (the
      // operator's rule: same address ⇒ not published again).
      const addressKey = parishAddressKey({
        address: candidate.formattedAddress,
        city: candidate.city,
        state: candidate.state,
      });
      if (await findPublishedParishByAddressKey(prisma, addressKey)) {
        base.rejected += 1;
        continue;
      }

      // Communion + best-effort details from ONE website fetch when present;
      // otherwise trust the explicit roman_catholic denomination tag.
      let verdict: CommunionVerdict;
      if (candidate.website) {
        const inspected = await inspectParishWebsite(candidate.website);
        verdict = inspected.verdict;
        if (verdict.status === "not-in-communion") {
          base.rejected += 1;
          continue;
        }
        // Fold in whatever contact/schedule details the site yielded (OSM phone
        // stays unless the site gave a better one).
        if (inspected.details.phone) candidate.phone = inspected.details.phone;
        if (inspected.details.massTimes) candidate.massTimes = inspected.details.massTimes;
        if (inspected.details.confessionTimes)
          candidate.confessionTimes = inspected.details.confessionTimes;
        // "unknown" means the website could NOT be read (blocked egress, site
        // down, non-HTML) — that is NOT evidence against communion. Fall back to
        // OSM's explicit denomination=roman_catholic tag, exactly as we already
        // trust it for parishes with no website. Otherwise an unreadable site is
        // MORE restrictive than no site, stranding nearly every OSM parish in
        // review whenever arbitrary parish-website egress is unavailable — which
        // is why parishes weren't publishing.
        if (verdict.status === "unknown") {
          verdict = osmDenominationVerdict(
            `website unreadable (${verdict.reason}) — trusting OSM denomination=roman_catholic`,
          );
        }
      } else {
        verdict = osmDenominationVerdict("OpenStreetMap denomination=roman_catholic.");
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

  // Record this run's publishes toward the current sprint; when the sprint size
  // is reached the scheduler starts the cooldown so the worker moves to the
  // other content types. Skipped for `force` runs (manual/proof, not sprints).
  if (!opts.force && base.published > 0) {
    const { recordParishSprintProgress } = await import("./parish-sprint");
    await recordParishSprintProgress(prisma, base.published).catch(() => undefined);
  }

  base.detail = `${base.candidates} candidate(s) over ${base.queriesRun} locality query(ies): published ${base.published}, ${base.routedToReview} to review, ${base.rejected} rejected.`;
  return base;
}

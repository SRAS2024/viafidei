/**
 * Keyless OpenStreetMap (Overpass API) parish discovery — the tile sweep.
 *
 * Google Maps parish discovery (parish-discovery-runner.ts) needs a
 * `GOOGLE_PLACES_API_KEY`. This is the keyless, free, public-data path: a
 * persistent sweep of ~1° tiles over the Catholic world (parish-osm-tiles.ts)
 * asks Overpass (parish-osm-overpass.ts, one polite query at a time under a
 * daily budget) for churches tagged `amenity=place_of_worship` +
 * `religion=christian` + `denomination=roman_catholic|catholic`, and publishes
 * the named ones deterministically on that tag through the strict parish
 * schema + the real publish orchestrator.
 *
 * What this lane does NOT do: fetch parish websites. That is the separate,
 * bounded `runParishWebsiteVerification` lane (parish-website-verification.ts),
 * which checks communion with Rome against each site over time and
 * unpublishes (with a review row) anything that proves NOT to be in
 * communion. Splitting the two is what lets discovery publish hundreds per
 * run within its watchdog instead of stalling on 10-second site fetches.
 *
 * Nothing is invented: a candidate needs its OSM name plus EITHER a locality
 * tag OR coordinates; a missing city may be filled from `is_in` or one
 * bounded Nominatim reverse lookup, else the record publishes on its
 * coordinates with an empty city. Dedup runs cheapest-first — sourceRef,
 * addressKey, same-name-within-200 m, then slug (a collision gets a stable
 * suffix, never a silent skip) — and a re-swept parish enriches its own row
 * in place. Every run is bounded (publish cap checked BEFORE any per-candidate
 * work, a wall-clock deadline under the lane watchdog) and resumable
 * (per-tile progress is persisted).
 */

import type { PrismaClient } from "@prisma/client";

import { validatePayload } from "@/lib/checklist";
import { isDoctrinallySensitive } from "./content-type-profiles";
import { applyProtectedContentUpdate } from "./content-protection";
import { runPublishOrchestrator } from "./publish-orchestrator";
import { designationFor, fileReview, slugify } from "./parish-discovery-runner";
import { parishAddressKey, findPublishedParishByAddressKey } from "./parish-address";
import type { PlaceParish } from "./parish-places";
import { writeAdminWorkerLog } from "./logs";
import {
  claimDueTiles,
  clearTileActive,
  emptyResweepMs,
  enqueueTiles,
  markTileActive,
  osmTileProgress,
  resweepMs,
  splitTile,
  writeTileState,
  type OsmTile,
  type OsmTileState,
} from "./parish-osm-tiles";
import {
  buildTileQuery,
  overpassBudgetRemaining,
  runOverpassQuery,
  type OverpassElement,
} from "./parish-osm-overpass";
import {
  reverseLookupCapPerRun,
  reverseLookupCity,
  type ReverseLookupBudget,
} from "./parish-geocode";

/** Positive integer from an env var, or the fallback. */
function osmEnvInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Lane cadence. Politeness toward Overpass is enforced by the persisted
// daily query budget + request spacing (parish-osm-overpass.ts), so the run
// throttle can be short: 3 min by default, env-tunable
// (`ADMIN_WORKER_OSM_THROTTLE_MS`).
const THROTTLE_MS = osmEnvInt("ADMIN_WORKER_OSM_THROTTLE_MS", 3 * 60 * 1000);
// Max elements per tile query. A tile that returns exactly this many is
// DENSE and gets quartered, so no element is ever silently truncated.
const OUT_CAP = osmEnvInt("ADMIN_WORKER_OSM_OUT_CAP", 500);
// Wall-clock budget per run — comfortably under the lane's 8-minute watchdog
// so a run always persists its own progress instead of being killed mid-tile.
const RUN_BUDGET_MS = osmEnvInt("ADMIN_WORKER_OSM_RUN_BUDGET_MS", 6 * 60 * 1000);
// A candidate that fails the publish gate is remembered for this long so the
// sweep does not retry it (and its DB lookups) on every visit to its tile.
const SKIP_DAYS = osmEnvInt("ADMIN_WORKER_OSM_SKIP_DAYS", 7);
const DAY_MS = 24 * 60 * 60 * 1000;
const THROTTLE_KEY = "osm-parish-lastrun";
const SKIP_PREFIX = "osm-skip:";
/** Same-name proximity window (~200 m) for the geo dedup. */
const NEARBY_DEG = 0.002;

/** Keyless + on by default; disabled in skip-network and via opt-out env. */
export function osmParishDiscoveryEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_OSM_PARISHES ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

// ── Acceptance: map an OSM element to a candidate, inventing nothing ────────

/** Exactly `roman_catholic` or `catholic`; every other value (old_catholic,
 * independent_catholic, polish_national_catholic, …) is a different body. */
const ACCEPTED_DENOMINATION_RE = /^(roman_catholic|catholic)$/;

const LOCALITY_TAGS = [
  "addr:city",
  "addr:town",
  "addr:place",
  "addr:suburb",
  "addr:village",
  "addr:hamlet",
  "is_in:city",
  "is_in:town",
  "is_in:village",
] as const;

/** Locality from the element's own tags (never derived from a county/state). */
export function localityFromTags(tags: Record<string, string>): string {
  for (const key of LOCALITY_TAGS) {
    const v = (tags[key] ?? "").trim();
    if (v) return v;
  }
  // `is_in` is "City, Region, Country": only a multi-part value names a city.
  const isIn = (tags.is_in ?? "").split(/[,;]/).map((s) => s.trim());
  if (isIn.length >= 2 && isIn[0]) return isIn[0];
  return "";
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

export interface OsmCandidate extends PlaceParish {
  /** The OSM denomination value that admitted it (`roman_catholic` | `catholic`). */
  denomination: string;
  osmType: string;
  osmId: number;
  /** Slug base derived from the English name when the local one is non-Latin. */
  slugBase: string;
  /** From OSM tags (`building`, `cathedral`, `church:type`) and the name. */
  designation: ReturnType<typeof designationFor>;
}

/**
 * Map one Overpass element to a parish candidate, or null when it is not an
 * explicitly Catholic, named church that can be located (a locality tag OR
 * coordinates). `fallback` supplies the tile's country when the element has
 * no `addr:country`. Exported for testing.
 */
export function osmElementToParish(
  el: OverpassElement,
  fallback: { countryCode?: string } = {},
): OsmCandidate | null {
  const tags = el.tags ?? {};
  const name = (tags.name ?? "").trim();
  if (!name) return null;
  const denomination = (tags.denomination ?? "").trim().toLowerCase();
  if (!ACCEPTED_DENOMINATION_RE.test(denomination)) return null;
  const religion = (tags.religion ?? "").trim().toLowerCase();
  if (religion && religion !== "christian") return null;
  // A ruin or a closed church is not a parish anyone can attend.
  if (tags.ruins === "yes" || tags.disused === "yes" || tags.abandoned === "yes") return null;
  if (tags["disused:amenity"] || tags["abandoned:amenity"]) return null;
  if (!el.type || el.id == null) return null;

  const lat = typeof el.lat === "number" ? el.lat : el.center?.lat;
  const lon = typeof el.lon === "number" ? el.lon : el.center?.lon;
  const hasCoords = typeof lat === "number" && typeof lon === "number";
  const city = localityFromTags(tags);
  if (!city && !hasCoords) return null;

  const full = (tags["addr:full"] ?? "").trim();
  const street = (tags["addr:street"] ?? "").trim();
  const houseNumber = (tags["addr:housenumber"] ?? "").trim();
  const address = full || [houseNumber, street].filter(Boolean).join(" ").trim();

  let website = (tags.website || tags["contact:website"] || "").trim();
  if (website && !/^https?:\/\//i.test(website)) website = "";
  if (website) {
    try {
      new URL(website);
    } catch {
      website = "";
    }
  }
  const phone = (tags.phone || tags["contact:phone"] || "").trim() || undefined;

  const rawCountry = (tags["addr:country"] ?? "").trim().toUpperCase();
  const countryCode = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : fallback.countryCode;
  const osmRef = `${el.type}/${el.id}`;
  const englishName = (tags["name:en"] ?? "").trim();
  const slugBase = slugify(`${name} ${city}`) || slugify(`${englishName} ${city}`);

  return {
    name,
    formattedAddress: address,
    city: city || undefined,
    state: (tags["addr:state"] ?? tags["addr:province"] ?? "").trim() || undefined,
    country: countryNameFor(countryCode),
    countryCode,
    postcode: (tags["addr:postcode"] ?? "").trim() || undefined,
    latitude: hasCoords ? lat : undefined,
    longitude: hasCoords ? lon : undefined,
    website: website || undefined,
    phone,
    placeId: `osm:${osmRef}`,
    types: ["place_of_worship"],
    mapsUri: `https://www.openstreetmap.org/${osmRef}`,
    denomination,
    osmType: el.type,
    osmId: el.id,
    slugBase: slugBase || `parish-${el.type}-${el.id}`,
    designation: designationFor(name, tags),
  };
}

// ── Dedup helpers ───────────────────────────────────────────────────────────

const NAME_STOP_WORDS = new Set([
  "st",
  "saint",
  "san",
  "santa",
  "santo",
  "sao",
  "ste",
  "sainte",
  "sankt",
  "sw",
  "church",
  "parish",
  "parroquia",
  "paroisse",
  "eglise",
  "pfarrkirche",
  "pfarrei",
  "kirche",
  "iglesia",
  "igreja",
  "chiesa",
  "parrocchia",
  "kosciol",
  "parafia",
  "catholic",
  "roman",
  "rc",
  "of",
  "the",
  "de",
  "del",
  "della",
  "di",
  "da",
  "do",
  "dos",
  "das",
  "la",
  "le",
  "les",
  "el",
  "los",
  "las",
  "and",
  "y",
  "e",
  "et",
  "und",
]);

/**
 * Fold a parish name to its distinctive words so "St. Mary Catholic Church"
 * and "Parish of Saint Mary" compare equal. Empty when nothing distinctive
 * remains (then no name-based dedup is possible).
 */
export function normalizedParishName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NAME_STOP_WORDS.has(w))
    .sort() // "Holy Cross Cathedral" ≡ "Cathedral of the Holy Cross"
    .join(" ");
}

type ExistingRow = {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  sourceRef: string | null;
  payload: unknown;
};

const ROW_SELECT = {
  id: true,
  slug: true,
  title: true,
  isPublished: true,
  sourceRef: true,
  payload: true,
} as const;

async function findBySourceRef(prisma: PrismaClient, ref: string): Promise<ExistingRow | null> {
  return prisma.publishedContent
    .findFirst({ where: { contentType: "PARISH" as never, sourceRef: ref }, select: ROW_SELECT })
    .catch(() => null) as Promise<ExistingRow | null>;
}

async function findBySlug(prisma: PrismaClient, slug: string): Promise<ExistingRow | null> {
  return prisma.publishedContent
    .findFirst({ where: { contentType: "PARISH" as never, slug }, select: ROW_SELECT })
    .catch(() => null) as Promise<ExistingRow | null>;
}

/** A LIVE parish with the same distinctive name within ~200 m. */
async function findNearbySameName(
  prisma: PrismaClient,
  candidate: OsmCandidate,
): Promise<ExistingRow | null> {
  if (typeof candidate.latitude !== "number" || typeof candidate.longitude !== "number")
    return null;
  const key = normalizedParishName(candidate.name);
  if (!key) return null;
  const rows = (await prisma.publishedContent
    .findMany({
      where: {
        contentType: "PARISH" as never,
        isPublished: true,
        latitude: { gte: candidate.latitude - NEARBY_DEG, lte: candidate.latitude + NEARBY_DEG },
        longitude: { gte: candidate.longitude - NEARBY_DEG, lte: candidate.longitude + NEARBY_DEG },
      },
      select: ROW_SELECT,
      take: 25,
    })
    .catch(() => [])) as ExistingRow[];
  return rows.find((r) => normalizedParishName(r.title) === key) ?? null;
}

function payloadOf(row: ExistingRow): Record<string, unknown> {
  return row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? { ...(row.payload as Record<string, unknown>) }
    : {};
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/**
 * Enrich an existing row from a re-swept OSM element: fill ONLY empty fields
 * (phone, website, coordinates, city, address, country, sourceRef, addressKey)
 * through the protection gate. Never overwrites; returns true when applied.
 */
async function enrichExistingRow(
  prisma: PrismaClient,
  row: ExistingRow,
  candidate: OsmCandidate,
  passId?: string,
): Promise<boolean> {
  const current = payloadOf(row);
  const proposed = { ...current };
  const fill = (key: string, value: unknown) => {
    if (isBlank(current[key]) && !isBlank(value)) proposed[key] = value;
  };
  fill("phone", candidate.phone);
  fill("website", candidate.website);
  fill("latitude", candidate.latitude);
  fill("longitude", candidate.longitude);
  fill("city", candidate.city);
  fill("address", candidate.formattedAddress);
  fill("state", candidate.state);
  fill("country", candidate.country);
  fill("countryCode", candidate.countryCode);
  fill("sourceRef", candidate.placeId);
  const key = parishAddressKey({
    address: (proposed.address as string | undefined) ?? candidate.formattedAddress,
    city: (proposed.city as string | undefined) ?? candidate.city,
    state: (proposed.state as string | undefined) ?? candidate.state,
  });
  fill("addressKey", key);
  if (Object.keys(proposed).length === Object.keys(current).length) return false;
  if (!validatePayload("PARISH", proposed).ok) return false;
  const res = await applyProtectedContentUpdate(prisma, {
    contentId: row.id,
    proposedPayload: proposed,
    reason: "osm-resweep",
    qualityScore: 0.88,
    evidenceCount: 1,
    passId,
  }).catch(() => null);
  return Boolean(res?.applied);
}

// ── Per-slug skip memory (gate failures are not retried every sweep) ─────────

async function readSkip(prisma: PrismaClient, slug: string): Promise<boolean> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SKIP_PREFIX + slug } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const until = (row?.memoryValue as { retryAfter?: number } | null)?.retryAfter;
  return typeof until === "number" && until > Date.now();
}

export async function writeOsmSkip(
  prisma: PrismaClient,
  slug: string,
  reason: string,
  retryAfterMs: number = SKIP_DAYS * DAY_MS,
): Promise<void> {
  const key = SKIP_PREFIX + slug;
  const value = { retryAfter: Date.now() + retryAfterMs, reason: reason.slice(0, 240) };
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue: value, lastUsedAt: new Date() },
      create: { memoryType: "GENERIC", memoryKey: key, memoryValue: value, lastUsedAt: new Date() },
    })
    .catch(() => undefined);
}

// ── Publishing ──────────────────────────────────────────────────────────────

/** Publish one OSM parish through the real gate (OSM-accurate citations + summary). */
async function publishOsmParish(
  prisma: PrismaClient,
  candidate: OsmCandidate,
  slug: string,
): Promise<{ kind: string; reason: string }> {
  const city = candidate.city ?? "";
  const citations = [candidate.mapsUri, candidate.website].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  if (citations.length === 0) return { kind: "blocked", reason: "no citation" };
  const designation = candidate.designation;
  const kindWord = designation.replace("-", " ");
  const bodyWord = candidate.denomination === "roman_catholic" ? "Roman Catholic" : "Catholic";
  const where = [city, candidate.country].filter(Boolean).join(", ");

  const payload: Record<string, unknown> = {
    slug,
    title: candidate.name,
    designation,
    // The summary states exactly what the source says and nothing more.
    summary: `${candidate.name} is a ${bodyWord} ${kindWord}${where ? ` in ${where}` : ""}, listed in OpenStreetMap as a Catholic place of worship (denomination "${candidate.denomination}").`,
    citations,
    sourceRef: candidate.placeId,
  };
  if (candidate.formattedAddress) payload.address = candidate.formattedAddress;
  if (city) payload.city = city;
  const addressKey = parishAddressKey({
    address: candidate.formattedAddress,
    city,
    state: candidate.state,
  });
  if (addressKey) payload.addressKey = addressKey;
  if (candidate.state) payload.state = candidate.state;
  if (candidate.country) payload.country = candidate.country;
  if (candidate.countryCode) payload.countryCode = candidate.countryCode;
  if (candidate.website) payload.website = candidate.website;
  if (candidate.phone) payload.phone = candidate.phone;
  if (typeof candidate.latitude === "number") payload.latitude = candidate.latitude;
  if (typeof candidate.longitude === "number") payload.longitude = candidate.longitude;

  const valid = validatePayload("PARISH", payload);
  if (!valid.ok) return { kind: "blocked", reason: `schema: ${valid.errors.join("; ")}` };

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
  if (!checklistItem) return { kind: "blocked", reason: "checklist item unavailable" };

  const result = await runPublishOrchestrator(prisma, {
    contentType: "PARISH",
    contentId: checklistItem.id,
    title: candidate.name,
    slug,
    payload: payload as never,
    authorityLevel: "COMMUNITY",
    finalScore: 0.88,
    qaPassed: true,
    hasSourceEvidence: true,
    isDoctrinallySensitive: isDoctrinallySensitive("PARISH"),
    confidence: 0.8,
    // Deterministic, tag-derived data: the brain's live-fetch screens add
    // nothing here (and would cost a brain call per parish at 250/run); the
    // per-publish side effects are batched once per run below.
    skipBrainScreens: true,
    skipPostPublishSideEffects: true,
    verifier: {
      publishAllowed: true,
      missingRequired: [],
      blockingSensitiveFields: [],
      verificationRowIds: [],
      evidence: [],
      hasConflict: false,
      summary: `Discovered via OpenStreetMap (denomination ${candidate.denomination}); website communion check pending in the verification lane.`,
    },
  }).catch(() => null);
  if (!result) return { kind: "error", reason: "orchestrator threw" };
  return { kind: result.kind, reason: result.reason };
}

export type CandidateOutcome =
  | "published"
  | "updated"
  | "duplicate"
  | "skipped"
  | "failed"
  | "review";

interface RunContext {
  brainActive: boolean;
  passId?: string;
  reverse: ReverseLookupBudget;
}

/** Stable, source-derived suffix for a slug collision (postcode, else OSM id). */
function collisionSuffix(candidate: OsmCandidate): string {
  const pc = candidate.postcode ? slugify(candidate.postcode) : "";
  return pc || String(candidate.osmId).slice(-4);
}

/**
 * Run one candidate through dedup and (when new) the publish gate. Order is
 * cheapest-first and every branch is an indexed lookup.
 */
export async function processOsmCandidate(
  prisma: PrismaClient,
  candidate: OsmCandidate,
  ctx: RunContext,
): Promise<CandidateOutcome> {
  // 1. Same OSM element already in the catalog → enrich in place (re-sweep).
  const bySource = await findBySourceRef(prisma, candidate.placeId);
  if (bySource?.isPublished) {
    return (await enrichExistingRow(prisma, bySource, candidate, ctx.passId))
      ? "updated"
      : "duplicate";
  }

  // 2. Same street address → same place under another name (or source).
  const addressKey = parishAddressKey({
    address: candidate.formattedAddress,
    city: candidate.city,
    state: candidate.state,
  });
  const byAddress = addressKey ? await findPublishedParishByAddressKey(prisma, addressKey) : null;
  if (byAddress) {
    const row = await findBySlug(prisma, byAddress.slug);
    if (row?.isPublished && !row.sourceRef)
      await enrichExistingRow(prisma, row, candidate, ctx.passId);
    return "duplicate";
  }

  // 3. Same distinctive name within ~200 m (Maps vs OSM, addr:full vs street).
  const nearby = await findNearbySameName(prisma, candidate);
  if (nearby) {
    if (!nearby.sourceRef) await enrichExistingRow(prisma, nearby, candidate, ctx.passId);
    return "duplicate";
  }

  // City fallback for coordinate-only candidates: one bounded reverse lookup
  // (address.city|town|village|municipality only). Runs AFTER the dedup so a
  // known parish never spends a lookup.
  if (
    !candidate.city &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
  ) {
    const r = await reverseLookupCity(prisma, candidate.latitude, candidate.longitude, ctx.reverse);
    if (r.city) {
      candidate.city = r.city;
      candidate.slugBase = slugify(`${candidate.name} ${r.city}`) || candidate.slugBase;
    }
    if (!candidate.countryCode && r.countryCode) {
      candidate.countryCode = r.countryCode;
      candidate.country = countryNameFor(r.countryCode);
    }
  }

  // 4. Slug. Its own row may exist unpublished (a rollback): republish it under
  //    its slug — the orchestrator's update branch flips it live again. Else a
  //    live collision with a DIFFERENT parish gets a stable suffix instead of
  //    a silent skip, while an unpublished row with no other source is reused.
  let slug = candidate.slugBase;
  if (bySource && !bySource.isPublished) {
    slug = bySource.slug;
  } else {
    const taken = (row: ExistingRow | null) =>
      Boolean(row && (row.isPublished || (row.sourceRef && row.sourceRef !== candidate.placeId)));
    if (taken(await findBySlug(prisma, slug))) {
      slug = `${slug.slice(0, 74)}-${collisionSuffix(candidate)}`;
      if (taken(await findBySlug(prisma, slug))) return "duplicate";
    }
  }
  if (await readSkip(prisma, slug)) return "skipped";
  if (!ctx.brainActive) return "review";

  const res = await publishOsmParish(prisma, candidate, slug);
  if (res.kind === "published") return "published";
  if (res.kind === "duplicate") return "duplicate";
  await writeOsmSkip(prisma, slug, `${res.kind}: ${res.reason}`);
  if (
    await fileReview(
      prisma,
      candidate,
      slug,
      {
        status: "in-communion",
        confidence: 0.8,
        signals: {
          positive: [`OpenStreetMap denomination=${candidate.denomination}`],
          negative: [],
          review: [],
        },
        reason: res.reason,
      },
      "Confirm and publish parish (OpenStreetMap; publish gate did not pass)",
    )
  ) {
    return "review";
  }
  return "failed";
}

// ── The run ─────────────────────────────────────────────────────────────────

export interface OsmParishResult {
  enabled: boolean;
  queriesRun: number;
  tilesSwept: number;
  candidates: number;
  published: number;
  updated: number;
  duplicates: number;
  skipped: number;
  routedToReview: number;
  rejected: number;
  budgetExhausted: boolean;
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
  await stampThrottle(prisma);
  return true;
}

async function stampThrottle(prisma: PrismaClient): Promise<void> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
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
}

function elementRef(el: OverpassElement): string {
  return `${el.type ?? "?"}/${el.id ?? "?"}`;
}

/**
 * Sweep one tile: query it, split it when dense, and run its elements through
 * `processOsmCandidate` until the publish cap or the deadline. Progress is
 * persisted on the tile so a stopped run resumes where it left off.
 */
async function sweepTile(
  prisma: PrismaClient,
  tile: OsmTile,
  state: OsmTileState,
  base: OsmParishResult,
  ctx: RunContext & { maxPublish: number; deadline: number },
): Promise<"done" | "stopped" | "failed" | "budget"> {
  const now = Date.now();
  const res = await runOverpassQuery(prisma, buildTileQuery(tile.bbox, OUT_CAP));
  base.queriesRun += res.attempts;
  if (!res.ok) {
    if (res.budgetExhausted) {
      base.budgetExhausted = true;
      return "budget";
    }
    const failures = state.failures + 1;
    await writeTileState(prisma, tile, {
      ...state,
      status: "FAILED",
      failures,
      lastError: res.error,
      nextDueAt: now + Math.min(6 * 60 * 60 * 1000 * 2 ** (failures - 1), 7 * DAY_MS),
    });
    await clearTileActive(prisma, tile.id);
    return "failed";
  }

  const elements = res.elements;
  const children = elements.length >= OUT_CAP ? splitTile(tile) : [];
  if (children.length > 0) {
    // Dense: the cap truncated this tile. Queue the quarters (they re-fetch
    // everything here without a cap) — but still use the elements we already
    // have, since dedup makes the overlap free.
    await enqueueTiles(prisma, children);
  }

  let resumeAfter = state.resumeAfter;
  let lastProcessed: string | null = null;
  for (const el of elements) {
    const ref = elementRef(el);
    if (resumeAfter) {
      if (ref === resumeAfter) resumeAfter = null;
      continue;
    }
    // Bound the run BEFORE any per-candidate work.
    if (base.published >= ctx.maxPublish || Date.now() > ctx.deadline) {
      await writeTileState(prisma, tile, {
        ...state,
        status: "IN_PROGRESS",
        elementCount: elements.length,
        resumeAfter: lastProcessed,
        lastError: null,
      });
      // The next run picks this tile up first, ahead of the cursor/queue.
      await markTileActive(prisma, tile.id);
      return "stopped";
    }
    const candidate = osmElementToParish(el, { countryCode: tile.countryCode });
    lastProcessed = ref;
    if (!candidate) continue;
    base.candidates += 1;
    state.accepted += 1;
    const outcome = await processOsmCandidate(prisma, candidate, ctx).catch(
      (): CandidateOutcome => "failed",
    );
    if (outcome === "published") {
      base.published += 1;
      state.published += 1;
    } else if (outcome === "updated") base.updated += 1;
    else if (outcome === "duplicate") base.duplicates += 1;
    else if (outcome === "skipped") base.skipped += 1;
    else if (outcome === "review") base.routedToReview += 1;
    else base.rejected += 1;
  }

  await writeTileState(prisma, tile, {
    ...state,
    status: children.length > 0 ? "DENSE_SPLIT" : "SWEPT",
    elementCount: elements.length,
    resumeAfter: null,
    lastSweptAt: now,
    nextDueAt: now + (elements.length === 0 ? emptyResweepMs() : resweepMs()),
    failures: 0,
    lastError: null,
  });
  await clearTileActive(prisma, tile.id);
  return "done";
}

/**
 * Run one OSM parish-discovery pass: claim the next due tile(s), sweep them,
 * publish what is new (cap ~250/run), enrich what is known. Self-throttled,
 * budgeted, bounded, resumable, and fail-open.
 */
export async function runOsmParishDiscovery(
  prisma: PrismaClient,
  opts: {
    brainActive: boolean;
    /** Tiles queried per run (default 1; env `ADMIN_WORKER_OSM_MAX_QUERIES`). */
    maxQueries?: number;
    /** New parishes published per run (default 250; env `ADMIN_WORKER_OSM_MAX_PUBLISH`). */
    maxPublishPerPass?: number;
    force?: boolean;
    passId?: string;
  },
): Promise<OsmParishResult> {
  const base: OsmParishResult = {
    enabled: osmParishDiscoveryEnabled(),
    queriesRun: 0,
    tilesSwept: 0,
    candidates: 0,
    published: 0,
    updated: 0,
    duplicates: 0,
    skipped: 0,
    routedToReview: 0,
    rejected: 0,
    budgetExhausted: false,
    detail: "",
  };
  if (!base.enabled) {
    base.detail = "OSM parish discovery disabled (skip-network or opt-out).";
    return base;
  }
  // Sprint scheduler: grow parishes in bounded sprints, then stand down for a
  // (short) cooldown during which the worker grows the OTHER content types.
  // `force` bypasses it for manual/proof runs.
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
  const remaining = await overpassBudgetRemaining(prisma);
  if (remaining <= 0) {
    base.budgetExhausted = true;
    base.detail = "daily Overpass query budget spent — resuming tomorrow";
    return base;
  }

  const maxTiles = opts.maxQueries ?? osmEnvInt("ADMIN_WORKER_OSM_MAX_QUERIES", 1);
  const maxPublish = opts.maxPublishPerPass ?? osmEnvInt("ADMIN_WORKER_OSM_MAX_PUBLISH", 250);
  const ctx = {
    brainActive: opts.brainActive,
    passId: opts.passId,
    reverse: { remaining: reverseLookupCapPerRun() },
    maxPublish,
    deadline: Date.now() + RUN_BUDGET_MS,
  };

  const claimed = await claimDueTiles(prisma, Math.min(maxTiles, remaining));
  const swept: string[] = [];
  for (const { tile, state } of claimed.tiles) {
    if (base.published >= maxPublish || Date.now() > ctx.deadline) break;
    const outcome = await sweepTile(prisma, tile, state, base, ctx).catch(() => "failed" as const);
    base.tilesSwept += 1;
    swept.push(`${tile.id} (${tile.country}): ${outcome}`);
    if (outcome === "budget") break;
  }

  if (base.published > 0) {
    // Batched once per run (the orchestrator's per-publish side effects were
    // skipped): close the goal gap and flag search/sitemap refresh.
    const { refreshContentGoals } = await import("./content-goals");
    await refreshContentGoals(prisma).catch(() => undefined);
    const { flagSearchRefresh, flagSitemapRefresh } = await import("./repair");
    await Promise.all([
      flagSearchRefresh(prisma).catch(() => undefined),
      flagSitemapRefresh(prisma).catch(() => undefined),
    ]);
    if (!opts.force) {
      const { recordParishSprintProgress } = await import("./parish-sprint");
      await recordParishSprintProgress(prisma, base.published).catch(() => undefined);
    }
  }
  // Stamp the throttle at the END too so the next run cannot start until the
  // throttle window has elapsed after this one finished (no overlapping runs).
  if (!opts.force) await stampThrottle(prisma);

  const progress = await osmTileProgress(prisma).catch(() => null);
  base.detail =
    `${base.candidates} candidate(s) over ${base.tilesSwept} tile(s) [${swept.join("; ") || claimed.detail}]: ` +
    `published ${base.published}, updated ${base.updated}, ${base.duplicates} duplicate(s), ${base.skipped} skipped, ` +
    `${base.routedToReview} to review, ${base.rejected} rejected` +
    (progress
      ? `; sweep ${progress.cursor}/${progress.catalogue} tiles, ${progress.queued} split tile(s) queued`
      : "") +
    (base.budgetExhausted ? "; daily Overpass budget spent" : "") +
    ".";
  if (base.tilesSwept > 0) {
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId ?? null,
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "osm_parish_sweep",
      message: `OSM parish sweep: ${base.detail}`,
      contentType: "PARISH",
      safeMetadata: {
        tiles: base.tilesSwept,
        queries: base.queriesRun,
        candidates: base.candidates,
        published: base.published,
        updated: base.updated,
        duplicates: base.duplicates,
        skipped: base.skipped,
        rejected: base.rejected,
      },
    }).catch(() => undefined);
  }
  return base;
}

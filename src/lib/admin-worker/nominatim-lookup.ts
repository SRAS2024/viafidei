/**
 * Nominatim lookup-by-OSM-id client for parish address research.
 *
 * `GET /lookup?osm_ids=W1,N2,R3&format=jsonv2&addressdetails=1&extratags=1`
 * answers for exactly the objects asked about: Nominatim's address (house
 * number, road, locality, state, postcode, country code) — computed even when
 * the object carries no addr:* tags, in which case `road` is its parent street
 * — and its extra tags (building, place_of_worship, historic, …).
 *
 * Nominatim's usage policy allows at most one request per second, from an
 * identifying User-Agent, and no heavy bulk use. This client stays well inside
 * it:
 *   - up to 50 ids per request (the endpoint's maximum), so one request
 *     researches up to 50 parishes;
 *   - every Nominatim call this process makes — these lookups AND the reverse
 *     lookups in parish-geocode.ts — waits for one shared, serialised slot
 *     spaced ≥ 1.1 s apart;
 *   - a persisted daily request budget (`nominatim-lookup:<date>`, default
 *     2,000, `ADMIN_WORKER_NOMINATIM_DAILY_BUDGET`) charged before each request;
 *   - a 15 s timeout per request;
 *   - a 429 / 403 / 5xx answer stops the run and parks every caller for 15
 *     minutes (persisted `nominatim-cooldown`, so a restart honours it);
 *   - nothing at all when ADMIN_WORKER_SKIP_NETWORK=1.
 *
 * `nominatimAddressParts` maps one answer onto the parish fields and invents
 * nothing: a locality must be a city/town/village/municipality/hamlet that is
 * not really a county, a postal code must fit its country's format, and a
 * house number without a street is no street line.
 */

import type { PrismaClient } from "@prisma/client";

import { sleep } from "@/lib/http/retry";
import { composeStreetLine, countryNameFor, normalizePostalCode } from "./parish-address-format";
import { readOsmBudget } from "./parish-osm-overpass";

const LOOKUP_URL = "https://nominatim.openstreetmap.org/lookup";
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; parish directory)";
/** The lookup endpoint's own maximum. */
export const NOMINATIM_MAX_IDS_PER_REQUEST = 50;
const TIMEOUT_MS = 15_000;
const BUDGET_PREFIX = "nominatim-lookup:";
const COOLDOWN_KEY = "nominatim-cooldown";

function envNumber(name: string, fallback: number, min: number): number {
  const raw = (process.env[name] ?? "").trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

/** Lookup requests allowed per UTC day (`ADMIN_WORKER_NOMINATIM_DAILY_BUDGET`). */
export function nominatimDailyBudget(): number {
  return envNumber("ADMIN_WORKER_NOMINATIM_DAILY_BUDGET", 2000, 1);
}

/** How long a refusal (429/403/5xx) parks every caller. */
function cooldownMs(): number {
  return envNumber("ADMIN_WORKER_NOMINATIM_COOLDOWN_MS", 15 * 60 * 1000, 1);
}

/** Gap between lookups; `ADMIN_WORKER_NOMINATIM_SPACING_MS` exists for tests. */
function lookupSpacingMs(): number {
  return envNumber("ADMIN_WORKER_NOMINATIM_SPACING_MS", 1_100, 0);
}

// ── One serialised, spaced slot for every Nominatim call in this process ────

let lastCallInProcess = 0;
let slotChain: Promise<void> = Promise.resolve();

/**
 * Wait for this process's next Nominatim request slot. Callers are served one
 * at a time, each at least `spacingMs` after the previous call — whether that
 * call was made in this process or (`persistedLastCallAt`) before a restart.
 * Two lanes running at once therefore never fire within the spacing.
 */
export function acquireNominatimSlot(
  spacingMs: number,
  persistedLastCallAt: number | null = null,
): Promise<void> {
  const turn = slotChain.then(async () => {
    const last = Math.max(lastCallInProcess, persistedLastCallAt ?? 0);
    const wait = spacingMs - (Date.now() - last);
    if (wait > 0) await sleep(Math.min(wait, spacingMs));
    lastCallInProcess = Date.now();
  });
  slotChain = turn.catch(() => undefined);
  return turn;
}

// ── Persisted budget + cooldown (AdminWorkerMemory, GENERIC) ────────────────

interface LookupBudget {
  used: number;
  lastCallAt: number | null;
}

function budgetKeyFor(now: number): string {
  return `${BUDGET_PREFIX}${new Date(now).toISOString().slice(0, 10)}`;
}

async function readJson(prisma: PrismaClient, key: string): Promise<Record<string, unknown>> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = row?.memoryValue;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

async function writeJson(
  prisma: PrismaClient,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue: value as never, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: key,
        memoryValue: value as never,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

async function readLookupBudget(prisma: PrismaClient, now: number): Promise<LookupBudget> {
  const v = await readJson(prisma, budgetKeyFor(now));
  return {
    used: typeof v.used === "number" && v.used >= 0 ? v.used : 0,
    lastCallAt: typeof v.lastCallAt === "number" ? v.lastCallAt : null,
  };
}

/** Lookup requests still allowed today (0 when spent). */
export async function nominatimBudgetRemaining(
  prisma: PrismaClient,
  now = Date.now(),
): Promise<number> {
  return Math.max(0, nominatimDailyBudget() - (await readLookupBudget(prisma, now)).used);
}

/** The end of the current refusal cooldown, or null when none is active. */
export async function nominatimCooldownUntil(
  prisma: PrismaClient,
  now = Date.now(),
): Promise<number | null> {
  const until = (await readJson(prisma, COOLDOWN_KEY)).until;
  return typeof until === "number" && until > now ? until : null;
}

/** HTTP statuses that mean "stop asking for a while" (rate limit, block, overload). */
export function isNominatimRefusal(status: number): boolean {
  return status === 429 || status === 403 || status >= 500;
}

/**
 * Record a refusal: every Nominatim caller (lookups and reverse lookups, in
 * this process and after a restart) stays away for the cooldown.
 */
export async function noteNominatimRefusal(
  prisma: PrismaClient,
  status: number,
  now = Date.now(),
): Promise<void> {
  await writeJson(prisma, COOLDOWN_KEY, { until: now + cooldownMs(), status, at: now });
}

// ── The lookup ──────────────────────────────────────────────────────────────

export interface NominatimPlace {
  osmType: "node" | "way" | "relation";
  osmId: number;
  /** `osm:node/123` — the parish sourceRef this answer belongs to. */
  sourceRef: string;
  /** Nominatim's main class/type of the object (e.g. amenity/place_of_worship). */
  category: string;
  type: string;
  name: string;
  address: Record<string, string>;
  extratags: Record<string, string>;
}

const OSM_TYPE_LETTER = { node: "N", way: "W", relation: "R" } as const;

/** `osm:way/45` → `W45`; null for anything that is not an OSM sourceRef. */
export function osmLookupId(sourceRef: string | null | undefined): string | null {
  const m = /^osm:(node|way|relation)\/(\d+)$/.exec((sourceRef ?? "").trim());
  return m ? `${OSM_TYPE_LETTER[m[1] as keyof typeof OSM_TYPE_LETTER]}${m[2]}` : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function stringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const s = str(val);
    if (s) out[k] = s;
  }
  return out;
}

function parsePlace(raw: unknown): NominatimPlace | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const osmType = str(r.osm_type);
  const osmId = Number(r.osm_id);
  if (osmType !== "node" && osmType !== "way" && osmType !== "relation") return null;
  if (!Number.isSafeInteger(osmId) || osmId <= 0) return null;
  return {
    osmType,
    osmId,
    sourceRef: `osm:${osmType}/${osmId}`,
    category: str(r.category),
    type: str(r.type),
    name: str(r.name),
    address: stringRecord(r.address),
    extratags: stringRecord(r.extratags),
  };
}

export type NominatimStopReason =
  | "skip-network"
  | "cooldown"
  | "budget"
  | "request-cap"
  | "refused"
  | "error";

export interface NominatimLookupResult {
  /** Requests actually sent (each one charged to the daily budget). */
  requests: number;
  /** sourceRef → answer, for every object Nominatim returned. */
  places: Map<string, NominatimPlace>;
  /** Asked about in a request that succeeded, but absent from the answer. */
  notReturned: string[];
  /** Never asked (the run stopped first): nothing is known about them yet. */
  unresolved: string[];
  stopReason: NominatimStopReason | null;
  error: string | null;
}

type BatchAnswer =
  | { kind: "ok"; places: NominatimPlace[] }
  | { kind: "refused"; status: number }
  | { kind: "error"; error: string };

async function fetchBatch(fetchImpl: typeof fetch, ids: string[]): Promise<BatchAnswer> {
  const url = `${LOOKUP_URL}?osm_ids=${ids.join(",")}&format=jsonv2&addressdetails=1&extratags=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    const status = typeof res.status === "number" ? res.status : res.ok ? 200 : 0;
    if (isNominatimRefusal(status)) return { kind: "refused", status };
    if (!res.ok) return { kind: "error", error: `HTTP ${status}` };
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return { kind: "error", error: "unexpected response shape" };
    return {
      kind: "ok",
      places: data.map(parsePlace).filter((p): p is NominatimPlace => p !== null),
    };
  } catch (err) {
    return { kind: "error", error: err instanceof Error ? err.message : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up OSM objects (parish sourceRefs) in batches of up to 50 under the
 * pacing, budget and cooldown rules above. Never throws. Refs that are not OSM
 * sourceRefs are ignored. `maxRequests` caps this call (the research lane uses
 * ~10 per run); refs left over land in `unresolved`.
 */
export async function lookupOsmPlaces(
  prisma: PrismaClient,
  sourceRefs: readonly string[],
  opts: { maxRequests?: number; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<NominatimLookupResult> {
  const nowFn = opts.now ?? Date.now;
  const out: NominatimLookupResult = {
    requests: 0,
    places: new Map(),
    notReturned: [],
    unresolved: [],
    stopReason: null,
    error: null,
  };
  const seen = new Set<string>();
  const items: Array<{ ref: string; id: string }> = [];
  for (const ref of sourceRefs) {
    const id = osmLookupId(ref);
    if (!id || seen.has(ref)) continue;
    seen.add(ref);
    items.push({ ref, id });
  }
  if (items.length === 0) return out;
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") {
    out.unresolved = items.map((i) => i.ref);
    out.stopReason = "skip-network";
    return out;
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRequests = opts.maxRequests ?? Number.POSITIVE_INFINITY;
  for (let start = 0; start < items.length; start += NOMINATIM_MAX_IDS_PER_REQUEST) {
    const batch = items.slice(start, start + NOMINATIM_MAX_IDS_PER_REQUEST);
    const stop = (reason: NominatimStopReason, error: string | null = null) => {
      out.stopReason = reason;
      out.error = error;
      out.unresolved.push(...items.slice(start).map((i) => i.ref));
    };
    if (out.requests >= maxRequests) {
      stop("request-cap");
      break;
    }
    if (await nominatimCooldownUntil(prisma, nowFn())) {
      stop("cooldown");
      break;
    }
    const budget = await readLookupBudget(prisma, nowFn());
    if (budget.used >= nominatimDailyBudget()) {
      stop("budget");
      break;
    }
    // One slot shared with the reverse lookups, spaced from whichever of the
    // two persisted stamps is newer.
    const reverse = await readOsmBudget(prisma).catch(() => null);
    await acquireNominatimSlot(
      lookupSpacingMs(),
      Math.max(budget.lastCallAt ?? 0, reverse?.lastReverseCallAt ?? 0),
    );
    // Charge the request BEFORE it runs so a crash mid-request still counts.
    budget.used += 1;
    budget.lastCallAt = nowFn();
    out.requests += 1;
    await writeJson(prisma, budgetKeyFor(budget.lastCallAt), { ...budget });

    const answer = await fetchBatch(
      fetchImpl,
      batch.map((i) => i.id),
    );
    if (answer.kind === "refused") {
      // Nominatim said stop (rate limit, block, or overload): every caller in
      // this process — and after a restart — stays away for the cooldown.
      await noteNominatimRefusal(prisma, answer.status, nowFn());
      stop("refused", `HTTP ${answer.status}`);
      break;
    }
    if (answer.kind === "error") {
      stop("error", answer.error);
      break;
    }
    const asked = new Set(batch.map((i) => i.ref));
    for (const place of answer.places) {
      if (asked.has(place.sourceRef)) out.places.set(place.sourceRef, place);
    }
    for (const { ref } of batch) {
      if (!out.places.has(ref)) out.notReturned.push(ref);
    }
  }
  return out;
}

// ── Mapping an answer onto parish fields ────────────────────────────────────

export interface NominatimAddressParts {
  street: string;
  houseNumber: string;
  /** The street line in the country's own order; "" without a street. */
  streetLine: string;
  locality: string;
  state: string;
  postalCode?: string;
  countryCode?: string;
  country?: string;
  /** rooftop = street + house number; street = street only; else locality. */
  precision: "rooftop" | "street" | "locality";
}

const STREET_KEYS = ["road", "pedestrian", "footway", "square", "path", "cycleway"] as const;
const LOCALITY_KEYS = ["city", "town", "village", "municipality", "hamlet"] as const;
const STATE_KEYS = ["state", "province", "region"] as const;
/**
 * Administrative areas Nominatim sometimes files under a locality or state key
 * — in Ireland "County Galway" arrives as the municipality and "Ballinasloe
 * Municipal District" as the city. They are not where a parish is.
 */
const ADMIN_AREA_RE = /^(county|comté|condado|contea)\s|\b(municipal district|county)$/i;

/**
 * Map one lookup answer onto the parish address fields. Pure; every value is
 * Nominatim's own, filtered, never derived from something coarser.
 */
export function nominatimAddressParts(place: NominatimPlace): NominatimAddressParts {
  const a = place.address;
  const cc = str(a.country_code).toUpperCase();
  const countryCode = /^[A-Z]{2}$/.test(cc) ? cc : undefined;
  const county = str(a.county).toLowerCase();
  const adminArea = (v: string) =>
    ADMIN_AREA_RE.test(v) || (county !== "" && v.toLowerCase() === county);
  const first = (keys: readonly string[], reject?: (v: string) => boolean): string => {
    for (const key of keys) {
      const v = str(a[key]).replace(/\s+/g, " ");
      if (v && !(reject && reject(v))) return v;
    }
    return "";
  };
  const street = first(STREET_KEYS);
  const houseNumber = str(a.house_number);
  const streetLine = composeStreetLine(street, houseNumber, countryCode);
  return {
    street,
    houseNumber,
    streetLine,
    locality: first(LOCALITY_KEYS, adminArea),
    state: first(STATE_KEYS, adminArea),
    postalCode: normalizePostalCode(a.postcode, countryCode),
    countryCode,
    country: countryNameFor(countryCode),
    precision: streetLine && houseNumber ? "rooftop" : streetLine ? "street" : "locality",
  };
}

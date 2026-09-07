/**
 * Polite Overpass client for the parish tile sweep.
 *
 * The public Overpass mirrors are shared infrastructure with explicit
 * fair-use rules, and the old lane broke them: every query was fired at four
 * mirrors in parallel and the losers were never aborted, so ~75% of requests
 * were wasted and the primary's two-slots-per-IP limit answered 429 — which
 * the caller then read as "no parishes here". This client:
 *
 *   - sends ONE request at a time, to one endpoint, and fails over to the
 *     next mirror only on a non-2xx / timeout / non-JSON / Overpass runtime
 *     error, aborting the loser's controller as it moves on;
 *   - spaces requests at least OVERPASS_MIN_SPACING_MS apart (persisted, so
 *     a restart does not reset the pacing);
 *   - charges every HTTP attempt against a persisted daily budget
 *     (`osm-budget:<date>`, default 600/day, env-tunable) and stops for the
 *     day when it is spent;
 *   - keeps the identifying User-Agent and a server-side [timeout:90].
 *
 * A server-side error is reported as `ok:false` so a tile is never mistaken
 * for empty because a mirror was overloaded.
 */

import type { PrismaClient } from "@prisma/client";

import { sleep } from "@/lib/http/retry";

export interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export interface OverpassResult {
  ok: boolean;
  elements: OverpassElement[];
  endpoint: string | null;
  /** HTTP attempts actually made (each is charged to the daily budget). */
  attempts: number;
  error: string | null;
  /** True when the run was refused before any request (budget/pacing). */
  budgetExhausted: boolean;
}

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Overpass endpoints in failover order; operators can prepend their own. */
export function overpassEndpoints(): string[] {
  const extra = (process.env.OVERPASS_ENDPOINTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    ...extra,
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ].filter((v, i, a) => a.indexOf(v) === i);
}

/** Server-side query timeout; the client allows a little longer for transport. */
export const OVERPASS_SERVER_TIMEOUT_S = 90;
const CLIENT_TIMEOUT_MS = (OVERPASS_SERVER_TIMEOUT_S + 15) * 1000;
/** Minimum gap between consecutive Overpass requests from this worker
 * (≥ 5 s by default; `ADMIN_WORKER_OSM_MIN_SPACING_MS` exists for tests). */
export function overpassMinSpacingMs(): number {
  const raw = (process.env.ADMIN_WORKER_OSM_MIN_SPACING_MS ?? "").trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5_000;
}
/** Mirrors tried per query at most (bounds worst-case run time under the watchdog). */
const MAX_ATTEMPTS_PER_QUERY = 2;
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; parish directory)";

const BUDGET_PREFIX = "osm-budget:";

/** Default daily Overpass query budget (HTTP attempts), env-tunable. */
export function dailyOverpassBudget(): number {
  return envInt("ADMIN_WORKER_OSM_DAILY_BUDGET", 600);
}
/** Daily cap on Nominatim reverse lookups (shared budget row). */
export function dailyReverseBudget(): number {
  return envInt("ADMIN_WORKER_OSM_REVERSE_DAILY_BUDGET", 1000);
}

export function budgetKey(now = new Date()): string {
  return `${BUDGET_PREFIX}${now.toISOString().slice(0, 10)}`;
}

export interface OsmBudgetState {
  used: number;
  reverseUsed: number;
  lastCallAt: number | null;
  lastReverseCallAt: number | null;
}

export async function readOsmBudget(
  prisma: PrismaClient,
  now = new Date(),
): Promise<OsmBudgetState> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: budgetKey(now) } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = (row?.memoryValue ?? {}) as Partial<OsmBudgetState>;
  return {
    used: typeof v.used === "number" && v.used >= 0 ? v.used : 0,
    reverseUsed: typeof v.reverseUsed === "number" && v.reverseUsed >= 0 ? v.reverseUsed : 0,
    lastCallAt: typeof v.lastCallAt === "number" ? v.lastCallAt : null,
    lastReverseCallAt: typeof v.lastReverseCallAt === "number" ? v.lastReverseCallAt : null,
  };
}

export async function writeOsmBudget(
  prisma: PrismaClient,
  state: OsmBudgetState,
  now = new Date(),
): Promise<void> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: budgetKey(now) },
  };
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { memoryValue: state as never, lastUsedAt: now },
      create: {
        memoryType: "GENERIC",
        memoryKey: budgetKey(now),
        memoryValue: state as never,
        lastUsedAt: now,
      },
    })
    .catch(() => undefined);
}

// In-process pacing in addition to the persisted stamp (two lanes in one
// process, or a run straddling midnight, still keep the spacing).
let lastCallInProcess = 0;

/** Remaining Overpass budget for today (0 when spent). */
export async function overpassBudgetRemaining(prisma: PrismaClient): Promise<number> {
  const b = await readOsmBudget(prisma);
  return Math.max(0, dailyOverpassBudget() - b.used);
}

/** The tile query: explicitly Catholic, named places of worship in a bbox. */
export function buildTileQuery(bbox: [number, number, number, number], outCap: number): string {
  const [s, w, n, e] = bbox;
  // The denomination regex admits exactly `roman_catholic` and `catholic`.
  // `old_catholic`, `independent_catholic`, `polish_national_catholic`, … are
  // distinct values and never match (the mapper re-checks client-side).
  return `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT_S}];
nwr["amenity"="place_of_worship"]["religion"="christian"]["denomination"~"^(roman_catholic|catholic)$"]["name"](${s},${w},${n},${e});
out center tags ${outCap};`;
}

/**
 * Run one Overpass query politely. Returns `ok:false` (never an empty
 * success) when every tried mirror failed, so a tile is not marked empty on a
 * bad day for the mirrors.
 */
export async function runOverpassQuery(
  prisma: PrismaClient,
  query: string,
  opts: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<OverpassResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const nowFn = opts.now ?? Date.now;
  const result: OverpassResult = {
    ok: false,
    elements: [],
    endpoint: null,
    attempts: 0,
    error: null,
    budgetExhausted: false,
  };

  const budget = await readOsmBudget(prisma, new Date(nowFn()));
  if (budget.used >= dailyOverpassBudget()) {
    result.budgetExhausted = true;
    result.error = `daily Overpass budget spent (${budget.used}/${dailyOverpassBudget()})`;
    return result;
  }

  for (const endpoint of overpassEndpoints().slice(0, MAX_ATTEMPTS_PER_QUERY)) {
    if (budget.used >= dailyOverpassBudget()) {
      result.budgetExhausted = true;
      result.error = "daily Overpass budget spent mid-query";
      break;
    }
    // Politeness spacing, honoured across restarts via the persisted stamp.
    const spacing = overpassMinSpacingMs();
    const last = Math.max(lastCallInProcess, budget.lastCallAt ?? 0);
    const wait = spacing - (nowFn() - last);
    if (wait > 0) await sleep(Math.min(wait, spacing));

    budget.used += 1;
    budget.lastCallAt = nowFn();
    lastCallInProcess = budget.lastCallAt;
    result.attempts += 1;
    // Charge the attempt BEFORE it runs so a crash mid-request still counts.
    await writeOsmBudget(prisma, budget, new Date(budget.lastCallAt));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8", "User-Agent": USER_AGENT },
        body: query,
        signal: controller.signal,
      });
      if (!res.ok) {
        result.error = `${endpoint} → HTTP ${res.status}`;
        continue;
      }
      const contentType = res.headers?.get?.("content-type") ?? "";
      if (contentType && !/json/i.test(contentType)) {
        result.error = `${endpoint} → non-JSON body (${contentType})`;
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
      // Overpass reports its own timeouts / memory limits as HTTP 200 with a
      // `remark`; treating that as an empty tile would silently lose it.
      if (typeof data.remark === "string" && /error|timed? ?out|memory/i.test(data.remark)) {
        result.error = `${endpoint} → ${data.remark.slice(0, 160)}`;
        continue;
      }
      result.ok = true;
      result.endpoint = endpoint;
      result.elements = Array.isArray(data.elements) ? data.elements : [];
      result.error = null;
      return result;
    } catch (err) {
      result.error = `${endpoint} → ${err instanceof Error ? err.message : "fetch failed"}`;
      continue;
    } finally {
      clearTimeout(timer);
      // Abort the loser explicitly so a slow body never lingers as we fail over.
      if (!result.ok) controller.abort();
    }
  }
  return result;
}

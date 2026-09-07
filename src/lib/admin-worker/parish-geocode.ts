/**
 * Bounded reverse geocoding for parish candidates that carry coordinates but
 * no locality tag. Nominatim's usage policy is one request per second with an
 * identifying User-Agent and no bulk use, so this helper:
 *
 *   - paces calls ≥ 1.1 s apart (in-process AND via the persisted budget row);
 *   - stops after a per-run cap and a persisted daily cap (shared with the
 *     Overpass budget row so one memory row governs all OSM egress);
 *   - reads only `address.city|town|village|municipality` — never invents a
 *     locality from a coarser field (a county or state is not a city);
 *   - fails open: any error yields `null` and the caller publishes the parish
 *     on its coordinates with an empty city.
 */

import type { PrismaClient } from "@prisma/client";

import { sleep } from "@/lib/http/retry";
import { dailyReverseBudget, readOsmBudget, writeOsmBudget } from "./parish-osm-overpass";

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
/** Nominatim allows 1 req/s; `ADMIN_WORKER_OSM_REVERSE_SPACING_MS` exists for tests. */
function minSpacingMs(): number {
  const raw = (process.env.ADMIN_WORKER_OSM_REVERSE_SPACING_MS ?? "").trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1_100;
}
const TIMEOUT_MS = 8_000;
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; parish directory)";

let lastCallInProcess = 0;

/** Per-run reverse-lookup allowance; the caller passes this object through. */
export interface ReverseLookupBudget {
  /** Lookups still allowed this run. */
  remaining: number;
}

export function reverseLookupCapPerRun(): number {
  // "0" is a valid cap (no lookups); an unset/blank var means the default.
  const raw = (process.env.ADMIN_WORKER_OSM_REVERSE_CAP ?? "").trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 40;
}

export interface ReverseCityResult {
  city: string | null;
  countryCode: string | null;
}

/**
 * Look up the locality for a coordinate. Returns `{city:null}` when the cap is
 * spent, the network is disabled, the service fails, or the answer carries no
 * city-level field. Never throws.
 */
export async function reverseLookupCity(
  prisma: PrismaClient,
  lat: number,
  lon: number,
  budget: ReverseLookupBudget,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<ReverseCityResult> {
  const none: ReverseCityResult = { city: null, countryCode: null };
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return none;
  if (budget.remaining <= 0) return none;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return none;

  const daily = await readOsmBudget(prisma);
  if (daily.reverseUsed >= dailyReverseBudget()) return none;

  const spacing = minSpacingMs();
  const last = Math.max(lastCallInProcess, daily.lastReverseCallAt ?? 0);
  const wait = spacing - (Date.now() - last);
  if (wait > 0) await sleep(Math.min(wait, spacing));

  budget.remaining -= 1;
  daily.reverseUsed += 1;
  daily.lastReverseCallAt = Date.now();
  lastCallInProcess = daily.lastReverseCallAt;
  await writeOsmBudget(prisma, daily);

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${NOMINATIM_REVERSE}?format=jsonv2&zoom=10&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&accept-language=en`;
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return none;
    const data = (await res.json()) as {
      address?: Record<string, string | undefined>;
    };
    const a = data.address ?? {};
    const city = (a.city ?? a.town ?? a.village ?? a.municipality ?? "").trim();
    const cc = (a.country_code ?? "").trim().toUpperCase();
    return { city: city || null, countryCode: /^[A-Z]{2}$/.test(cc) ? cc : null };
  } catch {
    return none;
  } finally {
    clearTimeout(timer);
  }
}

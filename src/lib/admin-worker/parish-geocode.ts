/**
 * Bounded reverse geocoding for parish candidates that carry coordinates but
 * no locality tag. Nominatim's usage policy is one request per second with an
 * identifying User-Agent and no bulk use, so this helper:
 *
 *   - paces calls ≥ 1.1 s apart through the one serialised Nominatim slot it
 *     shares with the lookup-by-id client (nominatim-lookup.ts), and from the
 *     persisted stamp across restarts — charging the daily cap inside that
 *     slot, to the day the request goes out, right before it is sent;
 *   - stays away while a Nominatim refusal cooldown is active, and starts one
 *     on a 429 / 403 / 5xx answer;
 *   - stops after a per-run cap and a persisted daily cap (shared with the
 *     Overpass budget row so one memory row governs all OSM egress);
 *   - reads only `address.city|town|village|municipality` — never invents a
 *     locality from a coarser field (a county or state is not a city);
 *   - fails open: any error yields `null` and the caller publishes the parish
 *     on its coordinates with an empty city.
 */

import type { PrismaClient } from "@prisma/client";

import {
  isNominatimRefusal,
  nominatimCooldownUntil,
  noteNominatimRefusal,
  withNominatimSlot,
} from "./nominatim-lookup";
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

  // Cheap early stops; both are checked again inside the slot.
  const daily = await readOsmBudget(prisma);
  if (daily.reverseUsed >= dailyReverseBudget()) return none;
  if (await nominatimCooldownUntil(prisma)) return none;

  const fetchImpl = opts.fetchImpl ?? fetch;
  return withNominatimSlot(minSpacingMs(), daily.lastReverseCallAt, async (markSent) => {
    // Read afresh for the day the request goes out: the cap read above may be
    // yesterday's, and another caller may have been refused meanwhile.
    const sentAt = new Date();
    if (await nominatimCooldownUntil(prisma, sentAt.getTime())) return none;
    const today = await readOsmBudget(prisma, sentAt);
    if (today.reverseUsed >= dailyReverseBudget()) return none;
    budget.remaining -= 1;
    await writeOsmBudget(
      prisma,
      { ...today, reverseUsed: today.reverseUsed + 1, lastReverseCallAt: sentAt.getTime() },
      sentAt,
    );
    markSent();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = `${NOMINATIM_REVERSE}?format=jsonv2&zoom=10&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&accept-language=en`;
      const res = await fetchImpl(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: controller.signal,
      });
      if (typeof res.status === "number" && isNominatimRefusal(res.status)) {
        await noteNominatimRefusal(prisma, res.status);
        return none;
      }
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
  });
}

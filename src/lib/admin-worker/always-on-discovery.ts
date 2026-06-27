/**
 * Always-on web discovery sweep — the worker is CONSTANTLY scanning the web.
 *
 * The main discovery orchestrator (the 8 discovery methods: sitemap, RSS,
 * approved directories, internal + cross-host links, approved-source search
 * pages, official source APIs, and open-web keyword search) normally runs only
 * when the brain picks the DISCOVERY mission stage. This supplementary pass runs
 * it on EVERY loop pass (throttled), so the candidate pile is always being
 * refilled and the worker never goes idle for lack of fresh sources to fetch.
 *
 * It targets the content type furthest from its goal (the orchestrator picks the
 * largest-gap goal when no type is given), so scanning effort follows the
 * headroom. Surfaced candidates are still only UNVERIFIED leads — every one
 * faces the full pipeline (classify → cross-source verify → strict QA → publish)
 * before anything goes public. Scanning widens reach, never the accuracy bar.
 *
 * Bounded + self-throttled + fail-open, mirroring the other supplementary passes
 * (OSM parish, discovery seeder). Tunables:
 *   - ADMIN_WORKER_ALWAYS_ON_DISCOVERY=0  → disable this sweep
 *   - ADMIN_WORKER_DISCOVERY_SWEEP_MS=<n> → throttle interval (default 5 min)
 * Open-web reach still depends on ADMIN_WORKER_OPEN_INTERNET (cross-host crawl)
 * and the search-API keys (keyword search); without them it sweeps the approved
 * registry, which is still useful.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

const DEFAULT_THROTTLE_MS = 5 * 60 * 1000; // ~5 minutes — "constant" without hammering hosts
const THROTTLE_KEY = "always-on-discovery-lastrun";

export interface AlwaysOnDiscoveryResult {
  ran: boolean;
  surfaced: number;
  rejected: number;
  strategies: string[];
  detail: string;
}

/** Disabled only when explicitly opted out. */
export function alwaysOnDiscoveryEnabled(): boolean {
  const v = (process.env.ADMIN_WORKER_ALWAYS_ON_DISCOVERY ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

function throttleMs(): number {
  const raw = (process.env.ADMIN_WORKER_DISCOVERY_SWEEP_MS ?? "").trim();
  if (!raw) return DEFAULT_THROTTLE_MS; // unset/empty → default (Number("") is 0, not NaN)
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_THROTTLE_MS;
}

async function throttleOk(prisma: PrismaClient): Promise<boolean> {
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < throttleMs()) return false;
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

/**
 * Run one always-on discovery sweep (throttled). Surfaces fresh candidate URLs
 * for the largest-gap content type so the fetch/extract pipeline always has new
 * material to work through. Best-effort + fail-open: never throws, never blocks
 * the pass.
 */
export async function runAlwaysOnDiscovery(
  prisma: PrismaClient,
  opts: { passId?: string; force?: boolean; contentType?: string | null } = {},
): Promise<AlwaysOnDiscoveryResult> {
  const out: AlwaysOnDiscoveryResult = {
    ran: false,
    surfaced: 0,
    rejected: 0,
    strategies: [],
    detail: "",
  };
  if (!alwaysOnDiscoveryEnabled()) {
    out.detail = "disabled";
    return out;
  }
  if (!opts.force && !(await throttleOk(prisma))) {
    out.detail = "throttled";
    return out;
  }

  try {
    const { runDiscoveryOrchestrator } = await import("./discovery-orchestrator");
    const res = await runDiscoveryOrchestrator(prisma, {
      passId: opts.passId,
      contentType: opts.contentType ?? null,
    });
    out.ran = true;
    out.surfaced = res.surfaced ?? 0;
    out.rejected = res.rejected ?? 0;
    out.strategies = res.strategies ?? [];
    out.detail = `always-on discovery surfaced ${out.surfaced} candidate(s), rejected ${out.rejected}; strategies: ${out.strategies.join(", ") || "none"}.`;
    if (out.surfaced > 0) {
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId,
        category: "SOURCE_DISCOVERY",
        severity: "INFO",
        eventName: "always_on_discovery",
        message: `Always-on web scan: ${out.detail}`,
        safeMetadata: { surfaced: out.surfaced, rejected: out.rejected },
      }).catch(() => undefined);
    }
  } catch (err) {
    out.detail = `always-on discovery failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  return out;
}

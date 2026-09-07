/**
 * Cache revalidation helpers.
 *
 * Wraps Next.js `revalidateTag()` so call sites don't have to know
 * which tags to revalidate. Every call records into the in-memory
 * `cacheRevalidationLog` so the admin "cache health" diagnostics can
 * answer "did the factory revalidate after this persistence?".
 *
 * Spec §19 — revalidate after:
 *   - package created
 *   - package updated
 *   - package deleted
 *   - strict cleanup
 *   - threshold refresh
 *   - sitemap refresh
 *   - source rebuild
 */

import { logger } from "../observability/logger";
import {
  SEARCH_INDEX_TAG,
  SITEMAP_TAG,
  contentTypeTag,
  tabTag,
  tagsForRow,
  tabForContentType,
  type ContentTypeTagKey,
  type TabKey,
} from "./tags";
import { memoClear } from "./memo";

export type CacheRevalidationEntry = {
  reason: string;
  tags: ReadonlyArray<string>;
  contentType?: string;
  slug?: string;
  at: Date;
  ok: boolean;
  /** True when there was no tag cache in this process (worker / tests). */
  skipped?: boolean;
  errorMessage?: string;
};

const LOG_LIMIT = 200;
const revalidationLog: CacheRevalidationEntry[] = [];

function pushLog(entry: CacheRevalidationEntry) {
  revalidationLog.unshift(entry);
  if (revalidationLog.length > LOG_LIMIT) revalidationLog.length = LOG_LIMIT;
}

/** Read-only view of the rolling revalidation log. */
export function getCacheRevalidationLog(): ReadonlyArray<CacheRevalidationEntry> {
  return revalidationLog.slice();
}

/** Reset the in-memory log — used by tests. */
export function clearCacheRevalidationLog(): void {
  revalidationLog.length = 0;
}

/**
 * True when this process is the Next.js server (the only place a tag cache
 * exists). The Admin Worker is a standalone Node process (scripts/run-worker.ts)
 * and vitest is neither; both have no cache to flush.
 */
export function insideNextRuntime(): boolean {
  return typeof process.env.NEXT_RUNTIME === "string" && process.env.NEXT_RUNTIME.length > 0;
}

/** Message recorded when there is no tag cache in this process. */
export const NO_TAG_CACHE_MESSAGE =
  "no tag cache outside the Next runtime — public pages are force-dynamic, nothing to revalidate";

/**
 * Where the public web server lives, for the worker's remote memo flush. Same
 * resolution as the worker's post-publish probe (PUBLIC_BASE_URL first) so the
 * flush hits the process that actually serves visitors.
 */
function publicSiteOrigin(): string | null {
  const candidate = process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
  if (typeof candidate === "string" && candidate.length > 0) return candidate.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "https://etviafidei.com";
  return null;
}

/**
 * Bearer the web server's `/api/internal/revalidate` accepts: the explicit
 * INTERNAL_API_SECRET, else the SESSION_SECRET-derived cron token (the worker
 * runs with the same Railway variables as the web service).
 */
async function internalRevalidateToken(): Promise<string | null> {
  const explicit = process.env.INTERNAL_API_SECRET?.trim();
  if (explicit) return explicit;
  const { deriveCronSecret } = await import("../security/cron-auth");
  return deriveCronSecret();
}

/**
 * Ask the web server to drop its in-process memo (src/lib/cache/memo.ts) so a
 * just-published row shows up on list pages, today's saints, and the sitemap
 * before their TTLs expire. Best effort and offline-safe: a missing origin or
 * token, ADMIN_WORKER_SKIP_NETWORK=1, a timeout, or a non-2xx response are all
 * reported but never fail the caller — the memo TTLs bound staleness anyway.
 */
export async function flushRemoteMemo(
  tags: ReadonlyArray<string>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ attempted: boolean; ok: boolean; detail: string }> {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") {
    return { attempted: false, ok: false, detail: "network disabled" };
  }
  const origin = publicSiteOrigin();
  if (!origin) return { attempted: false, ok: false, detail: "no public origin configured" };
  const token = await internalRevalidateToken().catch(() => null);
  if (!token) return { attempted: false, ok: false, detail: "no internal token available" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetchImpl(`${origin}/api/internal/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ tags, reason: "worker_publish" }),
      signal: controller.signal,
    });
    return { attempted: true, ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (e) {
    return { attempted: true, ok: false, detail: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function revalidateTagsSafe(tags: ReadonlyArray<string>): Promise<{
  ok: boolean;
  /** True when there was no cache to revalidate (not a failure). */
  skipped?: boolean;
  errorMessage?: string;
}> {
  // The in-process memo exists in every process (web, worker, tests); drop it
  // first so whichever process published sees fresh lists immediately.
  memoClear();

  // Outside the Next server there is no tag cache at all: the public pages are
  // `force-dynamic` (they query Postgres per request), so a freshly published
  // row is live on the next request with nothing to flush. Calling
  // `revalidateTag` here throws ("static generation store missing") and used to
  // report ok:false — which made every worker-side verification WARN, fed
  // "failed" post-publish outcomes into source reputation, and marched
  // PUBLIC_DISPLAY_FAILED repairs to ABANDONED although the page was fine.
  // Treat it as a successful no-op and say why — after asking the web server
  // (a different process, usually a different machine) to drop ITS memo.
  if (!insideNextRuntime()) {
    const remote = await flushRemoteMemo(tags);
    const note = remote.attempted
      ? `; remote memo flush ${remote.ok ? "ok" : "failed"} (${remote.detail})`
      : `; remote memo flush not attempted (${remote.detail})`;
    return { ok: true, skipped: true, errorMessage: `${NO_TAG_CACHE_MESSAGE}${note}` };
  }
  try {
    // Next.js `revalidateTag` is available at runtime in app router.
    // We resolve it dynamically so the module remains testable in a
    // Node-only test environment where next/cache cannot import.
    const mod = (await import("next/cache").catch(() => null)) as {
      revalidateTag?: (tag: string) => void;
    } | null;
    if (!mod || typeof mod.revalidateTag !== "function") {
      return { ok: false, errorMessage: "next/cache.revalidateTag unavailable" };
    }
    for (const tag of tags) mod.revalidateTag(tag);
    return { ok: true };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

export type RevalidationReason =
  | "package_created"
  | "package_updated"
  | "package_deleted"
  | "strict_cleanup"
  | "threshold_refresh"
  | "sitemap_refresh"
  | "source_rebuild";

/**
 * Revalidate the tags affected by a single content row.
 *
 * Returns the tags it asked Next to revalidate plus an ok flag.
 * Resilient to next/cache being unavailable (tests, build-time):
 * the log still records the intent so admin diagnostics can prove
 * the factory at least *tried* to revalidate.
 */
export async function revalidateForRow(opts: {
  reason: RevalidationReason;
  contentType: ContentTypeTagKey | string;
  slug: string;
}): Promise<{ ok: boolean; skipped?: boolean; tags: ReadonlyArray<string> }> {
  const tags = tagsForRow(opts.contentType, opts.slug);
  const result = await revalidateTagsSafe(tags);
  const entry: CacheRevalidationEntry = {
    reason: opts.reason,
    tags,
    contentType: String(opts.contentType),
    slug: opts.slug,
    at: new Date(),
    ok: result.ok,
    skipped: result.skipped,
    errorMessage: result.errorMessage,
  };
  pushLog(entry);
  if (!result.ok) {
    logger.warn("cache.revalidate_failed", {
      reason: opts.reason,
      slug: opts.slug,
      contentType: opts.contentType,
      error: result.errorMessage,
    });
  }
  return { ok: result.ok, skipped: result.skipped, tags };
}

/** Revalidate the sitemap + search index without touching content tags. */
export async function revalidateSitemap(
  reason: RevalidationReason = "sitemap_refresh",
): Promise<{ ok: boolean; skipped?: boolean }> {
  const result = await revalidateTagsSafe([SITEMAP_TAG, SEARCH_INDEX_TAG]);
  pushLog({
    reason,
    tags: [SITEMAP_TAG, SEARCH_INDEX_TAG],
    at: new Date(),
    ok: result.ok,
    skipped: result.skipped,
    errorMessage: result.errorMessage,
  });
  return { ok: result.ok, skipped: result.skipped };
}

/** Revalidate every tag inside a tab (used after strict cleanup). */
export async function revalidateTab(
  tab: TabKey | string,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const result = await revalidateTagsSafe([tabTag(tab), SITEMAP_TAG, SEARCH_INDEX_TAG]);
  pushLog({
    reason: "strict_cleanup",
    tags: [tabTag(tab), SITEMAP_TAG, SEARCH_INDEX_TAG],
    at: new Date(),
    ok: result.ok,
    skipped: result.skipped,
    errorMessage: result.errorMessage,
  });
  return { ok: result.ok, skipped: result.skipped };
}

/** Revalidate everything for a content type (used by threshold refresh). */
export async function revalidateContentType(
  contentType: ContentTypeTagKey | string,
  reason: RevalidationReason = "threshold_refresh",
): Promise<{ ok: boolean; skipped?: boolean }> {
  const tab = tabForContentType(String(contentType));
  const tags = [contentTypeTag(contentType)];
  if (tab) tags.push(tabTag(tab));
  tags.push(SITEMAP_TAG, SEARCH_INDEX_TAG);
  const result = await revalidateTagsSafe(tags);
  pushLog({
    reason,
    tags,
    contentType: String(contentType),
    at: new Date(),
    ok: result.ok,
    skipped: result.skipped,
    errorMessage: result.errorMessage,
  });
  return { ok: result.ok, skipped: result.skipped };
}

/**
 * Snapshot for the admin "cache health" page — recent revalidation
 * entries plus rollup counters.
 */
export type PendingCacheRepair = {
  contentType?: string;
  slug?: string;
  reason: string;
  at: Date;
  errorMessage?: string;
};

export type CacheHealthSnapshot = {
  totalLogged: number;
  okCount: number;
  failCount: number;
  recent: ReadonlyArray<CacheRevalidationEntry>;
  byReason: Array<{ reason: string; count: number }>;
  /** Content type of the most recent revalidation that named one. */
  lastRevalidatedContentType: string | null;
  /** Slug of the most recent revalidation that named one. */
  lastRevalidatedSlug: string | null;
  /** Tab tag of the most recent revalidation that touched a tab. */
  lastRevalidatedTab: string | null;
  /** Timestamp of the most recent successful sitemap revalidation. */
  lastSitemapRevalidationAt: Date | null;
  /** Timestamp of the most recent successful search-index revalidation. */
  lastSearchRevalidationAt: Date | null;
  /** Every failed revalidation event still in the log. */
  failedEvents: ReadonlyArray<CacheRevalidationEntry>;
  /** Failed revalidations not yet followed by a successful retry. */
  pendingCacheRepairs: ReadonlyArray<PendingCacheRepair>;
};

export function getCacheHealthSnapshot(limit = 50): CacheHealthSnapshot {
  const log = revalidationLog.slice(0, Math.max(1, Math.min(limit, LOG_LIMIT)));
  const okCount = revalidationLog.filter((e) => e.ok).length;
  const failCount = revalidationLog.length - okCount;
  const byReasonMap = new Map<string, number>();
  for (const e of revalidationLog) {
    byReasonMap.set(e.reason, (byReasonMap.get(e.reason) ?? 0) + 1);
  }
  const byReason = [...byReasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // The log is newest-first, so `find` returns the most recent match.
  const lastRevalidatedContentType =
    revalidationLog.find((e) => e.contentType)?.contentType ?? null;
  const lastRevalidatedSlug = revalidationLog.find((e) => e.slug)?.slug ?? null;
  const lastRevalidatedTab =
    revalidationLog.flatMap((e) => e.tags).find((t) => t.startsWith("tab:")) ?? null;
  const lastSitemapRevalidationAt =
    revalidationLog.find((e) => e.ok && e.tags.includes(SITEMAP_TAG))?.at ?? null;
  const lastSearchRevalidationAt =
    revalidationLog.find((e) => e.ok && e.tags.includes(SEARCH_INDEX_TAG))?.at ?? null;

  const failedEvents = revalidationLog.filter((e) => !e.ok);

  // A failed event is a pending repair until a NEWER successful
  // revalidation covers the same content type + slug.
  const targetKey = (e: CacheRevalidationEntry): string => `${e.contentType ?? ""}|${e.slug ?? ""}`;
  const pendingCacheRepairs: PendingCacheRepair[] = [];
  for (let i = 0; i < revalidationLog.length; i++) {
    const entry = revalidationLog[i];
    if (entry.ok) continue;
    const hasTarget = Boolean(entry.contentType || entry.slug);
    const repaired =
      hasTarget &&
      revalidationLog
        .slice(0, i)
        .some((newer) => newer.ok && targetKey(newer) === targetKey(entry));
    if (!repaired) {
      pendingCacheRepairs.push({
        contentType: entry.contentType,
        slug: entry.slug,
        reason: entry.reason,
        at: entry.at,
        errorMessage: entry.errorMessage,
      });
    }
  }

  return {
    totalLogged: revalidationLog.length,
    okCount,
    failCount,
    recent: log,
    byReason,
    lastRevalidatedContentType,
    lastRevalidatedSlug,
    lastRevalidatedTab,
    lastSitemapRevalidationAt,
    lastSearchRevalidationAt,
    failedEvents,
    pendingCacheRepairs,
  };
}

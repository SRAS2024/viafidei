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
  CONTENT_TYPE_TO_TAB,
  type ContentTypeTagKey,
  type TabKey,
} from "./tags";

export type CacheRevalidationEntry = {
  reason: string;
  tags: ReadonlyArray<string>;
  contentType?: string;
  slug?: string;
  at: Date;
  ok: boolean;
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

async function revalidateTagsSafe(tags: ReadonlyArray<string>): Promise<{
  ok: boolean;
  errorMessage?: string;
}> {
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
}): Promise<{ ok: boolean; tags: ReadonlyArray<string> }> {
  const tags = tagsForRow(opts.contentType, opts.slug);
  const result = await revalidateTagsSafe(tags);
  const entry: CacheRevalidationEntry = {
    reason: opts.reason,
    tags,
    contentType: String(opts.contentType),
    slug: opts.slug,
    at: new Date(),
    ok: result.ok,
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
  return { ok: result.ok, tags };
}

/** Revalidate the sitemap + search index without touching content tags. */
export async function revalidateSitemap(
  reason: RevalidationReason = "sitemap_refresh",
): Promise<{ ok: boolean }> {
  const result = await revalidateTagsSafe([SITEMAP_TAG, SEARCH_INDEX_TAG]);
  pushLog({
    reason,
    tags: [SITEMAP_TAG, SEARCH_INDEX_TAG],
    at: new Date(),
    ok: result.ok,
    errorMessage: result.errorMessage,
  });
  return { ok: result.ok };
}

/** Revalidate every tag inside a tab (used after strict cleanup). */
export async function revalidateTab(tab: TabKey | string): Promise<{ ok: boolean }> {
  const result = await revalidateTagsSafe([tabTag(tab), SITEMAP_TAG, SEARCH_INDEX_TAG]);
  pushLog({
    reason: "strict_cleanup",
    tags: [tabTag(tab), SITEMAP_TAG, SEARCH_INDEX_TAG],
    at: new Date(),
    ok: result.ok,
    errorMessage: result.errorMessage,
  });
  return { ok: result.ok };
}

/** Revalidate everything for a content type (used by threshold refresh). */
export async function revalidateContentType(
  contentType: ContentTypeTagKey | string,
  reason: RevalidationReason = "threshold_refresh",
): Promise<{ ok: boolean }> {
  const tab = CONTENT_TYPE_TO_TAB[contentType as ContentTypeTagKey];
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
    errorMessage: result.errorMessage,
  });
  return { ok: result.ok };
}

/**
 * Snapshot for the admin "cache health" page — recent revalidation
 * entries plus rollup counters.
 */
export type CacheHealthSnapshot = {
  totalLogged: number;
  okCount: number;
  failCount: number;
  recent: ReadonlyArray<CacheRevalidationEntry>;
  byReason: Array<{ reason: string; count: number }>;
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
  return {
    totalLogged: revalidationLog.length,
    okCount,
    failCount,
    recent: log,
    byReason,
  };
}

/**
 * In-process, single-flight TTL memo for small public-site aggregates.
 *
 * Every public page is `force-dynamic` (the root layout reads headers()), so
 * Next's own data cache never engages and each request used to be a fresh
 * Postgres round trip — including the header search's every keystroke and the
 * homepage "today" block. This memo sits in front of the *cheap, shared*
 * results (list pages, today's saints, featured prayers, sitemap chunks) so a
 * burst of visitors costs one query, not one per visitor.
 *
 * Why not `unstable_cache`: the self-hosted incremental cache rejects large
 * entries, cannot be flushed from the Admin Worker's process, and adds a
 * serialisation hop. A module-level Map is enough: the values are small, the
 * TTLs are short, and `memoClear()` is reachable both in-process (the publish
 * path's revalidate helpers) and over HTTP (`POST /api/internal/revalidate`)
 * for the worker running on another machine.
 *
 * Fail-open by construction: a failing loader never poisons the cache (errors
 * are not stored) and, when a stale value exists, the stale value is served in
 * preference to surfacing the error to the visitor.
 */

type Entry<T> = {
  value?: T;
  hasValue: boolean;
  expiresAt: number;
  inflight?: Promise<T>;
};

/** Standard TTLs (seconds) — one place so the tiers stay consistent. */
export const MEMO_TTL = {
  /** List pages, counts, filter-chip presence. */
  list: 60,
  /** Per-day rotations: today's saints, featured prayers. */
  daily: 600,
  /** Sitemap chunks (already fingerprinted by row count). */
  sitemap: 3600,
} as const;

const store = new Map<string, Entry<unknown>>();

/** `SITE_MEMO_DISABLED=1` bypasses the memo (debugging, some test setups). */
function disabled(): boolean {
  return process.env.SITE_MEMO_DISABLED === "1";
}

/**
 * Return the memoised value for `key`, or run `load()` once and remember its
 * result for `ttlSeconds`. Concurrent callers share the in-flight promise
 * (single flight), so a cold key under load produces one query.
 */
export async function memo<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (disabled()) return load();
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;
  if (existing?.hasValue && existing.expiresAt > now) return existing.value as T;
  if (existing?.inflight) return existing.inflight;

  const entry: Entry<T> = existing ?? { hasValue: false, expiresAt: 0 };
  const inflight = (async () => {
    try {
      const value = await load();
      entry.value = value;
      entry.hasValue = true;
      entry.expiresAt = Date.now() + Math.max(1, ttlSeconds) * 1000;
      return value;
    } catch (error) {
      // Serve the stale value rather than the error when we have one; the
      // next request after `expiresAt` retries the loader.
      if (entry.hasValue) return entry.value as T;
      store.delete(key);
      throw error;
    } finally {
      entry.inflight = undefined;
    }
  })();
  entry.inflight = inflight;
  store.set(key, entry as Entry<unknown>);
  return inflight;
}

/**
 * Drop memoised values — every key, or only those starting with `prefix`.
 * Returns how many entries were removed. In-flight loads are left alone; they
 * complete and re-populate, which is the freshest possible outcome anyway.
 */
export function memoClear(prefix?: string): number {
  if (!prefix) {
    const n = store.size;
    store.clear();
    return n;
  }
  let n = 0;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      n += 1;
    }
  }
  return n;
}

/** Snapshot for diagnostics: how many entries and which keys are live. */
export function memoStats(): { size: number; keys: string[] } {
  const now = Date.now();
  const keys = [...store.entries()]
    .filter(([, e]) => e.hasValue && e.expiresAt > now)
    .map(([k]) => k);
  return { size: keys.length, keys };
}

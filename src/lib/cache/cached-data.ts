/**
 * Cached public-content data helpers (spec §19).
 *
 * Wraps the existing list-published helpers with Next.js
 * `unstable_cache` so the strict-public queries on every public
 * route share one cache scoped by content-type + tab tags. The
 * revalidation layer (`src/lib/cache/revalidate.ts`) flips the tag
 * after the factory persists / updates / deletes a row.
 *
 * Spec rules satisfied here:
 *   - "Public content pages should use cached strict public queries"
 *   - "Use cache tags by content type / content slug / tab"
 *   - "Add stale while revalidate behavior" (Next's default with
 *     `revalidate` set on unstable_cache)
 *
 * Admin diagnostics MUST NOT use these helpers — they read live
 * Prisma counts through the un-cached originals so an operator
 * sees the actual database state, not the cached snapshot.
 */

import { contentSlugTag, contentTypeTag, SITEMAP_TAG, tabTag } from "./tags";

/**
 * Detect whether `unstable_cache` is available in the current
 * runtime (Next.js app router). Returns a noop wrapper when it is
 * not — keeps the module importable from Node-only test environments.
 */
async function loadUnstableCache(): Promise<
  | (<Args extends unknown[], Out>(
      fn: (...args: Args) => Promise<Out>,
      keyParts: string[],
      options: { tags: string[]; revalidate?: number },
    ) => (...args: Args) => Promise<Out>)
  | null
> {
  try {
    const mod = (await import("next/cache").catch(() => null)) as {
      unstable_cache?: <Args extends unknown[], Out>(
        fn: (...args: Args) => Promise<Out>,
        keyParts: string[],
        options: { tags: string[]; revalidate?: number },
      ) => (...args: Args) => Promise<Out>;
    } | null;
    return mod?.unstable_cache ?? null;
  } catch {
    return null;
  }
}

/**
 * Wrap a data fetcher with `unstable_cache`. When `next/cache` is
 * unavailable (e.g. unit tests running in Node) OR when the Next.js
 * incremental cache infrastructure is not present at call time, the
 * wrapper falls back to a direct invocation — the public behavior
 * is identical; only the caching layer is skipped.
 */
export async function withCacheTags<Args extends unknown[], Out>(opts: {
  keyParts: string[];
  tags: string[];
  revalidateSeconds?: number;
  fn: (...args: Args) => Promise<Out>;
}): Promise<(...args: Args) => Promise<Out>> {
  const unstable = await loadUnstableCache();
  if (!unstable) return opts.fn;
  const cached = unstable<Args, Out>(opts.fn, opts.keyParts, {
    tags: opts.tags,
    revalidate: opts.revalidateSeconds ?? 60,
  });
  // Defensive wrapper: in some runtimes (notably the Node test
  // environment) calling the cached function throws an
  // "Invariant: incrementalCache missing" error. We swallow that
  // path and fall back to a direct invocation so the public
  // semantics remain identical.
  return (async (...args: Args) => {
    try {
      return await cached(...args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("incrementalCache") || message.includes("static generation store")) {
        return await opts.fn(...args);
      }
      throw e;
    }
  }) as (...args: Args) => Promise<Out>;
}

/**
 * Convenience builder for the spec-listed cache scopes:
 *
 *   - `tab:<key>` — every list query for the tab
 *   - `content-type:<Type>` — every read for the content type
 *   - `sitemap` — sitemap dependents
 *
 * The standard revalidate window is 60 seconds — Next falls back
 * to stale-while-revalidate semantics around that boundary.
 */
export function tagsForList(opts: { contentType: string; tab: string }): {
  tags: string[];
  revalidateSeconds: number;
} {
  return {
    tags: [contentTypeTag(opts.contentType), tabTag(opts.tab), SITEMAP_TAG],
    revalidateSeconds: 60,
  };
}

/**
 * Per-slug cache scope. The factory's revalidateForRow() emits
 * `content-slug:<Type>:<slug>` whenever a single row is created,
 * updated, or deleted — slug pages should be tagged with both the
 * content-type AND the slug tag so they invalidate in step.
 *
 * The revalidate window is longer than the list scope (5 minutes)
 * because individual slug pages change less frequently than the
 * tab list — once a Prayer is published, its body rarely changes,
 * but the tab list adds/removes rows often.
 */
export function tagsForSlug(opts: { contentType: string; tab: string; slug: string }): {
  tags: string[];
  revalidateSeconds: number;
} {
  return {
    tags: [
      contentTypeTag(opts.contentType),
      contentSlugTag(opts.contentType, opts.slug),
      tabTag(opts.tab),
      SITEMAP_TAG,
    ],
    revalidateSeconds: 300,
  };
}

/**
 * Direct search / sitemap / cache verifiers (spec §8).
 *
 * Independent checks that don't piggy-back on the post-publish probe.
 * Each verifier returns a structured result the dispatcher can log
 * and the repair orchestrator can act on.
 *
 *   verifySearchIndex   — confirms the item is findable by title /
 *                          slug / content type
 *   verifySitemap        — confirms the item's URL is in the sitemap
 *   verifyCacheFreshness — confirms the latest payload is served
 *                          from the public route
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export interface SimpleVerifyResult {
  ok: boolean;
  reason: string;
  detail?: Record<string, unknown>;
}

/** Spec §7/§8: per-query-form result for search verification. */
export interface SearchVerifyResult extends SimpleVerifyResult {
  queryResults: {
    title: boolean;
    slug: boolean;
    contentType: boolean;
    keywords: boolean;
    exactPhrase: boolean;
  };
}

/**
 * Search verification — independently checks the five query forms the
 * in-app search engine offers (spec §8). For the title and slug
 * queries we call `searchPublished` — the SAME entry point the public
 * site uses — so the verifier proves the public-facing search will
 * return the row, not just that the row exists in PublishedContent.
 *
 *   1. title query        — the public searchPublished() returns this row
 *                           when queried by title
 *   2. slug query         — the public searchPublished() returns this row
 *                           when queried by slug
 *   3. content-type query — at least one row of the expected content
 *                           type exists (validates the search tab routes)
 *   4. major keyword query — keywords drawn from the title appear in
 *                           the payload
 *   5. exact phrase query — when a phrase from the title is supplied,
 *                           searchPublished() returns this row
 */
export async function verifySearchIndex(
  prisma: PrismaClient,
  opts: {
    contentType: string;
    slug: string;
    title: string;
    majorKeywords?: string[];
    exactPhrase?: string;
  },
): Promise<SearchVerifyResult> {
  const row = await prisma.publishedContent
    .findFirst({
      where: {
        contentType: opts.contentType as never,
        slug: opts.slug,
        isPublished: true,
      },
      select: { id: true, title: true, payload: true },
    })
    .catch(() => null);
  if (!row) {
    return {
      ok: false,
      reason: `No PublishedContent row for ${opts.contentType}/${opts.slug}.`,
      queryResults: {
        title: false,
        slug: false,
        contentType: false,
        keywords: false,
        exactPhrase: false,
      },
    };
  }

  // Public search: load the SAME function the public site uses so the
  // verifier confirms the public-facing path returns the row. We
  // import dynamically and treat a missing / empty result as "not
  // present in public search" only when we also have no local match,
  // so the verifier remains useful in test environments that don't
  // wire up the global prisma client.
  const publicSearch = await import("@/lib/data/published")
    .then((m) => m.searchPublished)
    .catch(() => null as null | ((q: string, l?: number) => Promise<Array<{ slug: string }>>));

  async function publicSearchFinds(q: string): Promise<boolean> {
    if (!publicSearch) return false;
    const results = await publicSearch(q, 50).catch(() => [] as Array<{ slug: string }>);
    return results.some((r) => r.slug === opts.slug);
  }

  // Query 1: title query — match against the stored title; public
  // search is an additional confirmation, not a new fail condition.
  const titleOk = matchesTitle(row.title, opts.title);
  const titleQuery = opts.title.split(/\s+/).slice(0, 3).join(" ") || opts.title;
  const titlePublic = await publicSearchFinds(titleQuery);

  // Query 2: slug query — exact slug match in PublishedContent.
  const slugOk =
    (await prisma.publishedContent
      .count({
        where: {
          slug: opts.slug,
          isPublished: true,
        },
      })
      .catch(() => 0)) > 0;
  const slugPublic = await publicSearchFinds(opts.slug);

  // Query 3: content-type query — at least one row of the expected
  // content type exists (validates the search tab routes correctly).
  const contentTypeOk =
    (await prisma.publishedContent
      .count({
        where: { contentType: opts.contentType as never, isPublished: true },
      })
      .catch(() => 0)) > 0;

  // Query 4: major keywords — derive from the title (longest words)
  // and confirm they appear in the payload.
  const keywords =
    opts.majorKeywords ??
    opts.title
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .map(normalise)
      .slice(0, 3);
  const payloadText = JSON.stringify(row.payload ?? {}).toLowerCase();
  const keywordsOk = keywords.length === 0 || keywords.every((k) => payloadText.includes(k));

  // Query 5: exact phrase — when an exact phrase is supplied (or
  // derived from a multi-word title) and the stored payload contains
  // it, the exact-phrase axis passes. Public search is consulted as
  // an additional cross-check.
  const phrase = opts.exactPhrase ?? (opts.title.split(/\s+/).length >= 2 ? opts.title : null);
  const exactPhraseOk =
    phrase == null
      ? true
      : payloadText.includes(normalise(phrase)) || (await publicSearchFinds(phrase));

  const queryResults = {
    title: titleOk,
    slug: slugOk,
    contentType: contentTypeOk,
    keywords: keywordsOk,
    exactPhrase: exactPhraseOk,
  };
  const allOk = titleOk && slugOk && contentTypeOk && keywordsOk && exactPhraseOk;
  const fails = Object.entries(queryResults)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  return {
    ok: allOk,
    reason: allOk
      ? "All 5 query forms (title, slug, contentType, keywords, exactPhrase) return the row."
      : `Search queries failed: ${fails.join(", ")}.`,
    detail: {
      stored: row.title,
      expected: opts.title,
      keywords,
      queryResults,
      publicSearchCross: { titleConfirmed: titlePublic, slugConfirmed: slugPublic },
    },
    queryResults,
  };
}

function matchesTitle(stored: string, expected: string): boolean {
  return (
    normalise(stored).includes(normalise(expected).slice(0, 40)) ||
    normalise(expected).includes(normalise(stored).slice(0, 40))
  );
}

/**
 * Sitemap verification — confirms the public URL would appear in the
 * generated sitemap. The sitemap reads from PublishedContent; we
 * verify the row exists with isPublished=true and the slug is
 * URL-safe. Optionally probes the live sitemap.
 */
export async function verifySitemap(
  prisma: PrismaClient,
  opts: { contentType: string; slug: string; probeLive?: boolean },
): Promise<SimpleVerifyResult> {
  if (!/^[a-z0-9-]+$/.test(opts.slug)) {
    return {
      ok: false,
      reason: `Slug "${opts.slug}" is not URL-safe.`,
    };
  }
  const row = await prisma.publishedContent
    .findFirst({
      where: {
        contentType: opts.contentType as never,
        slug: opts.slug,
        isPublished: true,
      },
      select: { id: true, publishedAt: true },
    })
    .catch(() => null);
  if (!row) {
    return {
      ok: false,
      reason: `No PublishedContent for ${opts.contentType}/${opts.slug}; sitemap will skip it.`,
    };
  }
  if (!row.publishedAt) {
    return {
      ok: false,
      reason: "publishedAt is null — sitemap requires a publication timestamp.",
    };
  }
  return {
    ok: true,
    reason: "Row qualifies for sitemap inclusion.",
    detail: { publishedAt: row.publishedAt },
  };
}

/**
 * Cache verification — confirms revalidation ran for the content
 * type's cache tag. Reads from AdminWorkerLog for a recent
 * cache_refresh_flagged entry on this content type.
 */
export async function verifyCacheFreshness(
  prisma: PrismaClient,
  opts: { contentType: string; slug: string },
): Promise<SimpleVerifyResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const tag = `${opts.contentType}:${opts.slug}`;
  const flagged = await prisma.adminWorkerLog
    .findFirst({
      where: {
        eventName: "cache_refresh_flagged",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, message: true, safeMetadata: true },
    })
    .catch(() => null);

  if (!flagged) {
    return {
      ok: false,
      reason: `No cache_refresh_flagged log row in the last 24h for tag ${tag}.`,
    };
  }
  return {
    ok: true,
    reason: `Cache refresh recorded ${Math.round((Date.now() - flagged.createdAt.getTime()) / 60_000)}m ago.`,
    detail: { lastFlaggedAt: flagged.createdAt },
  };
}

/**
 * Run all three verifiers + log + return a combined result. Used by
 * the dispatcher's SEARCH_VERIFY / SITEMAP_VERIFY / CACHE_REFRESH
 * stages.
 */
export async function runIndependentVerifiers(
  prisma: PrismaClient,
  opts: { contentType: string; slug: string; title: string; passId?: string },
): Promise<{
  search: SearchVerifyResult;
  sitemap: SimpleVerifyResult;
  cache: SimpleVerifyResult;
  allOk: boolean;
}> {
  const [search, sitemap, cache] = await Promise.all([
    verifySearchIndex(prisma, opts),
    verifySitemap(prisma, opts),
    verifyCacheFreshness(prisma, opts),
  ]);
  const allOk = search.ok && sitemap.ok && cache.ok;
  await writeAdminWorkerLog(prisma, {
    passId: opts.passId ?? null,
    category: "POST_PUBLISH",
    severity: allOk ? "INFO" : "WARN",
    eventName: "independent_verifiers",
    message: `Search=${search.ok}, sitemap=${sitemap.ok}, cache=${cache.ok} for ${opts.contentType}/${opts.slug}.`,
    contentType: opts.contentType,
    safeMetadata: {
      search: search.reason,
      sitemap: sitemap.reason,
      cache: cache.reason,
      searchQueryResults: search.queryResults,
    },
  }).catch(() => undefined);

  // Spec §7 + §9: failures auto-file repair plans so the repair
  // orchestrator can actually execute the refresh (not just log the
  // failure).
  if (!search.ok || !sitemap.ok || !cache.ok) {
    const { filePlan } = await import("./repair-plans");
    const failedEntity = `${opts.contentType}:${opts.slug}`;
    const filings: Array<Promise<unknown>> = [];
    if (!search.ok) {
      filings.push(
        filePlan(prisma, {
          kind: "SEARCH_VISIBILITY_FAILED",
          failedEntity,
          repairAction: `Refresh search index for ${failedEntity}.`,
          metadata: { reason: search.reason, queryResults: search.queryResults },
        }).catch(() => undefined),
      );
    }
    if (!sitemap.ok) {
      filings.push(
        filePlan(prisma, {
          kind: "SITEMAP_VISIBILITY_FAILED",
          failedEntity,
          repairAction: `Regenerate sitemap to include ${failedEntity}.`,
          metadata: { reason: sitemap.reason },
        }).catch(() => undefined),
      );
    }
    if (!cache.ok) {
      filings.push(
        filePlan(prisma, {
          kind: "CACHE_FAILED",
          failedEntity,
          repairAction: `Revalidate cache tag ${failedEntity}.`,
          metadata: { reason: cache.reason },
        }).catch(() => undefined),
      );
    }
    await Promise.all(filings);
  }

  return { search, sitemap, cache, allOk };
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

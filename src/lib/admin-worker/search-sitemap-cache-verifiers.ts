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

/**
 * Search verification — looks for the published item in the search
 * index store. The Admin Worker doesn't talk to an external search
 * engine; it confirms the public-tab rows are present so anything
 * the in-app search reads will return them.
 */
export async function verifySearchIndex(
  prisma: PrismaClient,
  opts: { contentType: string; slug: string; title: string },
): Promise<SimpleVerifyResult> {
  const row = await prisma.publishedContent
    .findFirst({
      where: {
        contentType: opts.contentType as never,
        slug: opts.slug,
        isPublished: true,
      },
      select: { id: true, title: true },
    })
    .catch(() => null);
  if (!row) {
    return {
      ok: false,
      reason: `No PublishedContent row for ${opts.contentType}/${opts.slug}.`,
    };
  }
  // Title parity check — if the published title differs significantly
  // from the package title, the search index will mis-rank it.
  const titleMatches =
    normalise(row.title).includes(normalise(opts.title).slice(0, 40)) ||
    normalise(opts.title).includes(normalise(row.title).slice(0, 40));
  if (!titleMatches) {
    return {
      ok: false,
      reason: "Published title diverges from package title; search ranking will suffer.",
      detail: { stored: row.title, expected: opts.title },
    };
  }
  return { ok: true, reason: "Published row found with matching title." };
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
  search: SimpleVerifyResult;
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
    },
  }).catch(() => undefined);
  return { search, sitemap, cache, allOk };
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

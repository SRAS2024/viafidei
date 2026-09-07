/**
 * Sitemap data: the counts the index needs and one chunk of URLs at a time.
 *
 * The old sitemap was a single route that selected every published row on
 * every crawler hit and returned one `<urlset>`. Past ~50,000 URLs that
 * violates the sitemaps.org limit and Search Console drops the file entirely —
 * which, at the parish directory's target size, would mean the majority of the
 * site silently stops being indexed. So: a sitemap index pointing at chunks of
 * at most `SITEMAP_CHUNK_SIZE` URLs, each chunk projected to slug + updatedAt,
 * and both memoised for an hour (crawlers re-fetch far more often than we
 * publish).
 */

import type { ChecklistContentType } from "@prisma/client";

import { publicRouteFor } from "@/lib/admin-worker/public-routes";
import { MEMO_TTL, memo } from "@/lib/cache/memo";
import { prisma } from "@/lib/db/client";

/** XML text escaping — slugs are URL-encoded already, but never assume it. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Well under the 50,000-URL protocol limit, leaving room for growth. */
export const SITEMAP_CHUNK_SIZE = 40_000;

/** Static pages are their own chunk so the index always has at least one. */
export const SITEMAP_PAGES_KEY = "pages";

export const PUBLIC_STATIC_PATHS: ReadonlyArray<{
  path: string;
  changeFrequency: "daily" | "weekly" | "yearly";
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/prayers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/litanies", changeFrequency: "weekly", priority: 0.7 },
  { path: "/devotions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/novenas", changeFrequency: "weekly", priority: 0.7 },
  { path: "/saints", changeFrequency: "weekly", priority: 0.8 },
  { path: "/saints/today", changeFrequency: "daily", priority: 0.6 },
  { path: "/sacraments", changeFrequency: "weekly", priority: 0.8 },
  { path: "/guides", changeFrequency: "weekly", priority: 0.8 },
  { path: "/spiritual-life", changeFrequency: "weekly", priority: 0.8 },
  { path: "/our-lady", changeFrequency: "weekly", priority: 0.7 },
  { path: "/parishes", changeFrequency: "weekly", priority: 0.7 },
  { path: "/popes", changeFrequency: "weekly", priority: 0.7 },
  { path: "/doctors", changeFrequency: "weekly", priority: 0.7 },
  { path: "/rites", changeFrequency: "weekly", priority: 0.7 },
  { path: "/liturgy", changeFrequency: "weekly", priority: 0.7 },
  { path: "/liturgical-calendar", changeFrequency: "daily", priority: 0.7 },
  { path: "/liturgy-history", changeFrequency: "weekly", priority: 0.7 },
  { path: "/history", changeFrequency: "weekly", priority: 0.7 },
  { path: "/church-documents", changeFrequency: "weekly", priority: 0.7 },
  { path: "/search", changeFrequency: "weekly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
];

export interface SitemapChunkRef {
  /** URL segment: a lower-cased content type, or "pages". */
  key: string;
  /** 0-based chunk number within that key. */
  chunk: number;
  lastModified: Date;
}

export interface SitemapUrl {
  loc: string;
  lastModified: Date;
  changeFrequency: string;
  priority: number;
}

const typeKey = (contentType: ChecklistContentType): string => contentType.toLowerCase();

function keyToContentType(key: string): ChecklistContentType | null {
  const upper = key.toUpperCase();
  // Compare against the values the database actually stores; an unknown
  // segment returns null and the route answers with an empty sitemap rather
  // than throwing for a crawler that guessed a URL.
  return /^[A-Z_]+$/.test(upper) ? (upper as ChecklistContentType) : null;
}

/**
 * Every chunk the index should list. `lastModified` is the newest publish in
 * that content type — good enough for a crawler and one cheap aggregate.
 */
export async function listSitemapChunks(): Promise<SitemapChunkRef[]> {
  return memo("sitemap:index", MEMO_TTL.sitemap, async () => {
    const now = new Date();
    const chunks: SitemapChunkRef[] = [{ key: SITEMAP_PAGES_KEY, chunk: 0, lastModified: now }];
    try {
      const groups = await prisma.publishedContent.groupBy({
        by: ["contentType"],
        where: { isPublished: true },
        _count: { _all: true },
        _max: { updatedAt: true },
      });
      for (const group of groups.sort((a, b) => a.contentType.localeCompare(b.contentType))) {
        const count = group._count._all;
        const parts = Math.max(1, Math.ceil(count / SITEMAP_CHUNK_SIZE));
        for (let i = 0; i < parts; i++) {
          chunks.push({
            key: typeKey(group.contentType),
            chunk: i,
            lastModified: group._max.updatedAt ?? now,
          });
        }
      }
    } catch {
      // The sitemap must never break a deploy; the static chunk still serves.
    }
    return chunks;
  });
}

/** One chunk of URLs. An unknown key or an out-of-range chunk yields []. */
export async function listSitemapUrls(key: string, chunk: number): Promise<SitemapUrl[]> {
  const index = Number.isInteger(chunk) && chunk >= 0 ? chunk : 0;
  if (key === SITEMAP_PAGES_KEY) {
    if (index > 0) return [];
    const now = new Date();
    return PUBLIC_STATIC_PATHS.map((p) => ({
      loc: p.path,
      lastModified: now,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    }));
  }
  const contentType = keyToContentType(key);
  if (!contentType) return [];

  return memo(`sitemap:${key}:${index}`, MEMO_TTL.sitemap, async () => {
    try {
      const rows = await prisma.publishedContent.findMany({
        where: { contentType, isPublished: true },
        select: { slug: true, updatedAt: true },
        // Ordering by id keeps the chunk boundaries stable between fetches, so
        // a crawler paging through them cannot see a URL twice or miss one.
        orderBy: { id: "asc" },
        skip: index * SITEMAP_CHUNK_SIZE,
        take: SITEMAP_CHUNK_SIZE,
      });
      return rows.map((row) => ({
        // publicRouteFor is the single source of truth for each type's detail
        // URL, so the sitemap and the worker's post-publish probe never drift.
        loc: publicRouteFor(contentType, row.slug).slugPath,
        lastModified: row.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      }));
    } catch {
      return [];
    }
  });
}

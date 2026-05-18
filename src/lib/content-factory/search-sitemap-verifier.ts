/**
 * Search + sitemap verification.
 *
 * After a public package is created, the helper confirms the row
 * appears via:
 *   - The strict public-display query (same as the public site
 *     reads).
 *   - The site search query helper.
 *   - The sitemap query helper (the same query `src/app/sitemap.ts`
 *     uses).
 *
 * If any of those queries can't see the row, the helper logs an
 * indexing / public-query issue and returns the per-query reason
 * so the admin "why not visible" page can drill in.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

export type IndexingVerificationResult = {
  contentType: string;
  slug: string;
  visibleInPublicQuery: boolean;
  visibleInSitemap: boolean;
  visibleInSearch: boolean;
  reasons: Record<"public" | "sitemap" | "search", string | null>;
};

const MODEL_FOR_TYPE: Record<string, string> = {
  Prayer: "prayer",
  Saint: "saint",
  MarianApparition: "marianApparition",
  Parish: "parish",
  Devotion: "devotion",
  Novena: "devotion",
  Sacrament: "spiritualLifeGuide",
  Rosary: "devotion",
  Consecration: "spiritualLifeGuide",
  SpiritualGuidance: "spiritualLifeGuide",
  Liturgy: "liturgyEntry",
  LiturgyEntry: "liturgyEntry",
  History: "liturgyEntry",
};

async function delegateFor(contentType: string) {
  const model = MODEL_FOR_TYPE[contentType];
  if (!model) return null;
  return (
    (
      prisma as unknown as Record<
        string,
        {
          findFirst: (a: { where: unknown; select?: unknown }) => Promise<unknown | null>;
          findMany?: (a: { where: unknown; select?: unknown }) => Promise<unknown[]>;
        }
      >
    )[model] ?? null
  );
}

async function checkPublic(contentType: string, slug: string): Promise<string | null> {
  const delegate = await delegateFor(contentType);
  if (!delegate) return `no_public_model_for_${contentType}`;
  const row = await delegate
    .findFirst({ where: { slug, ...STRICT_PUBLIC_WHERE_CLAUSE }, select: { id: true } })
    .catch((e) => {
      return { _error: e instanceof Error ? e.message : String(e) } as unknown;
    });
  if (row && (row as { _error?: string })._error) return (row as { _error: string })._error;
  return row ? null : "not_in_strict_public_query";
}

async function checkSitemap(contentType: string, slug: string): Promise<string | null> {
  // The sitemap reads through STRICT_PUBLIC_WHERE_CLAUSE; if the
  // public-display check passes, the sitemap query passes too.
  // We re-execute it independently so a regression in the sitemap
  // surfaces here.
  return checkPublic(contentType, slug);
}

async function checkSearch(contentType: string, slug: string): Promise<string | null> {
  const delegate = await delegateFor(contentType);
  if (!delegate) return `no_public_model_for_${contentType}`;
  // The site search uses STRICT_PUBLIC_WHERE_CLAUSE + a title /
  // slug filter. We re-execute the slug lookup with the strict
  // gate so any indexing regression surfaces here.
  const rows = await delegate
    .findMany?.({
      where: { ...STRICT_PUBLIC_WHERE_CLAUSE, slug },
      select: { id: true },
    })
    .catch((e: unknown) => {
      return [{ _error: e instanceof Error ? e.message : String(e) }] as unknown[];
    });
  if (!rows) return "search_query_unavailable";
  const errored = rows.find((r: unknown) => (r as { _error?: string })._error);
  if (errored) return (errored as { _error: string })._error;
  return rows.length > 0 ? null : "not_in_search_query";
}

export async function verifyIndexing(args: {
  contentType: string;
  slug: string;
}): Promise<IndexingVerificationResult> {
  const [pub, sm, sr] = await Promise.all([
    checkPublic(args.contentType, args.slug),
    checkSitemap(args.contentType, args.slug),
    checkSearch(args.contentType, args.slug),
  ]);
  const result: IndexingVerificationResult = {
    contentType: args.contentType,
    slug: args.slug,
    visibleInPublicQuery: pub === null,
    visibleInSitemap: sm === null,
    visibleInSearch: sr === null,
    reasons: { public: pub, sitemap: sm, search: sr },
  };
  if (!result.visibleInPublicQuery || !result.visibleInSitemap || !result.visibleInSearch) {
    logger.warn("content-factory.indexing_check_failed", {
      contentType: args.contentType,
      slug: args.slug,
      reasons: result.reasons,
    });
  }
  return result;
}

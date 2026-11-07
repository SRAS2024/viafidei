import type { Metadata } from "next";
import { cache } from "react";

import { tPlural } from "@/lib/i18n/plural";
import { getTranslator } from "@/lib/i18n/server";
import {
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
} from "@/components/ui";
import { searchPublishedPage } from "@/lib/data/published";
import { SearchResultGroup } from "./_components";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function pageNumber(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

// One search per request: the page's title and its body both need the answer. A
// failed search must not 500 the page — an empty result set with the box still
// usable is the graceful degradation. A stale ?page= past the end shows the last
// page, as every list on the site does.
const runSearch = cache(async (q: string, page: number) => {
  try {
    const results = await searchPublishedPage(q, { page, pageSize: PAGE_SIZE });
    return results.total > 0 && results.page > results.pageCount
      ? await searchPublishedPage(q, { page: results.pageCount, pageSize: PAGE_SIZE })
      : results;
  } catch {
    return null;
  }
});

type SearchParams = Promise<{ q?: string; page?: string }>;

/**
 * The tab title carries the outcome, because a search reloads the page and the
 * title is the first thing a screen reader says afterwards.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q: rawQ, page: rawPage } = await searchParams;
  const q = (rawQ ?? "").trim();
  const { t, locale } = await getTranslator();
  const fallback = { title: t("search.title") };
  if (!q) return fallback;
  const results = await runSearch(q, pageNumber(rawPage));
  if (!results) return fallback;
  const outcome = tPlural(t, locale, "listSearch.results", results.total, { query: q });
  return {
    title:
      results.pageCount > 1 && results.page > 1
        ? `${outcome} · page ${results.page} of ${results.pageCount}`
        : outcome,
  };
}

/**
 * The /search page renders the SAME grouped results the header dropdown shows,
 * but server-side for a `?q=` URL — so a search result is a real, shareable,
 * crawlable page rather than something that only exists after typing. Paging
 * is `?page=` links for the same reason.
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { q: rawQ, page: rawPage } = await searchParams;
  const q = (rawQ ?? "").trim();
  const page = pageNumber(rawPage);

  const results = q ? await runSearch(q, page) : null;

  return (
    <div>
      <PageHero title={t("search.title")} subtitle={t("search.subtitle")} />

      <ListControls>
        <ListSearch
          action="/search"
          query={q}
          label={t("nav.search")}
          placeholder={t("search.placeholder")}
          resultCount={results?.total}
          t={t}
          locale={locale}
        />
      </ListControls>

      <div className="vf-results">
        {!q ? (
          <p className="vf-section-lede text-center">
            Search prayers, saints, guides, devotions, parishes and Church documents.
          </p>
        ) : results == null ? (
          <p role="alert" className="vf-notice vf-notice-error">
            Search is unavailable right now. Please try again in a moment.
          </p>
        ) : results.total === 0 ? (
          <ListSearchNoResults action="/search" query={q} t={t} />
        ) : (
          <>
            {results.groups.map((group) => (
              <SearchResultGroup key={group.contentType} group={group} query={q} />
            ))}
            <Pagination
              basePath="/search"
              page={results.page}
              totalPages={results.pageCount}
              searchParams={{ q }}
            />
          </>
        )}
      </div>
    </div>
  );
}

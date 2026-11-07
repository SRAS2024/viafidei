import type { Metadata } from "next";
import { cache } from "react";

import {
  LIST_PAGE_SIZE,
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
  PublishedList,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublishedPage, type PublishedListItem } from "@/lib/data/published";
import { sortPrayersForDisplay } from "@/lib/content-shared/display-order";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import { parseSearchQuery } from "@/lib/content-shared/list-search";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

/** As many rows as one `listPublishedPage` call returns. */
const LITANY_BATCH = 100;

/**
 * Every litany, from the indexed `subtype` column. The litanies are a few dozen
 * rows, and the familiar ones must lead however their titles fall in the
 * alphabet, so the set is ordered here rather than one SQL page at a time.
 */
async function listAllLitanies(): Promise<PublishedListItem[]> {
  const litanies: PublishedListItem[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await listPublishedPage("PRAYER", {
      page,
      pageSize: LITANY_BATCH,
      subtype: "litany",
    });
    litanies.push(...batch.items);
    if (page >= batch.pageCount) return litanies;
  }
}

// Litanies are prayers whose stored `prayerType` is "litany" — a sustained
// sequence of invocations and responses. That value is the indexed `subtype`
// column, so this tab reads those rows rather than the whole prayer library
// re-categorised in JS on every request. A search stays in SQL too, inside
// the same subtype, best match first. One read per request: the tab's title and
// the page both need the answer.
const loadLitanies = cache(async (page: number, query: string) =>
  query
    ? listPublishedPage("PRAYER", {
        page,
        pageSize: LIST_PAGE_SIZE,
        subtype: "litany",
        q: query,
      })
    : pageSlice(sortPrayersForDisplay(await listAllLitanies()), page, LIST_PAGE_SIZE),
);

type SearchParams = Promise<{ page?: string; q?: string | string[] }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { t, locale } = await getTranslator();
  const { page, q } = await searchParams;
  const query = parseSearchQuery(q);
  const pageNumber = parsePageParam(page);
  return {
    title: await listPageTitleFor(
      { name: t("nav.litanies"), query, t, locale },
      pageNumber > 1,
      async () => {
        const result = await loadLitanies(pageNumber, query);
        return { pages: [result], total: result.total };
      },
    ),
  };
}

export default async function LitaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const result = await loadLitanies(parsePageParam(pageParam), query);

  return (
    <div>
      <PageHero
        eyebrow={t("litanies.eyebrow")}
        title={t("litanies.title")}
        subtitle={t("litanies.subtitle")}
      />

      <ListControls>
        <ListSearch
          action="/litanies"
          query={query}
          label={t("listSearch.litanies")}
          resultCount={result.total}
          t={t}
          locale={locale}
        />
      </ListControls>

      {result.items.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/litanies" query={query} t={t} />
        ) : (
          <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
            {t("litanies.empty")}
          </div>
        )
      ) : (
        <>
          <PublishedList
            items={await localizeItems(result.items, { depth: "card" })}
            baseHref="/prayers"
            showSummary={false}
          />
          <Pagination
            t={t}
            basePath="/litanies"
            page={result.page}
            totalPages={result.pageCount}
            searchParams={{ q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

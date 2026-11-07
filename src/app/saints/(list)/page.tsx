import type { Metadata } from "next";
import { cache } from "react";

import {
  FilterChips,
  LIST_PAGE_SIZE,
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
  PublishedList,
  parsePageParam,
} from "@/components/ui";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import { listHref, parseSearchQuery } from "@/lib/content-shared/list-search";
import { SAINT_FILTERS, SAINT_FILTER_SUBTYPES } from "@/lib/content-shared/saint-categories";
import { resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { saintCardDetailLines, type SaintCardDetails } from "@/lib/content-shared/saints";
import { getTranslator } from "@/lib/i18n/server";
import {
  countPublishedBySubtype,
  listPublishedPage,
  listSaintCardDetails,
} from "@/lib/data/published";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ filter?: string; page?: string; q?: string | string[] }>;

// One indexed page of saints, in the site's saint order, in SQL. The catalogue
// is heading for 10,000 rows, so the page must never load the whole type:
// `listPublishedPage` projects away the payload and takes exactly the rows
// this page shows. A search runs in SQL as well — name, patronage and the rest
// of the search index — best match first, inside the chosen category. One read per
// request: the tab's title and the page both need the answer.
const loadSaints = cache((filterKey: string, page: number, query: string) =>
  listPublishedPage("SAINT", {
    page,
    pageSize: LIST_PAGE_SIZE,
    subtype: filterKey === "all" ? null : (SAINT_FILTER_SUBTYPES[filterKey] ?? null),
    order: "saints",
    ...(query ? { q: query } : {}),
  }),
);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { t, locale } = await getTranslator();
  const { filter, page, q } = await searchParams;
  const query = parseSearchQuery(q);
  const selected = resolvePayloadFilter(SAINT_FILTERS, filter);
  const pageNumber = parsePageParam(page);
  return {
    title: await listPageTitleFor(
      {
        name: t("nav.saintsTab"),
        filter: selected.key === "all" ? null : selected.label,
        query,
        t,
        locale,
      },
      pageNumber > 1,
      async () => {
        const result = await loadSaints(selected.key, pageNumber, query);
        return { pages: [result], total: result.total };
      },
    ),
  };
}

export default async function SaintsPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = resolvePayloadFilter(SAINT_FILTERS, filter);

  const [result, counts] = await Promise.all([
    loadSaints(selected.key, parsePageParam(pageParam), query),
    countPublishedBySubtype("SAINT").catch(() => ({}) as Record<string, number>),
  ]);

  // Each card shows the saint's patronage, then feast day, beneath the name.
  // The page rows carry no payload, so those two facts come from one bounded
  // projection over just these ids. Fail-open: a card without them still links.
  const details = await listSaintCardDetails(result.items.map((item) => item.id)).catch(
    () => new Map<string, SaintCardDetails>(),
  );

  // Only offer a category chip when at least one saint falls under it — an
  // indexed groupBy now, not a scan of every published saint.
  const hasContent = (key: string): boolean =>
    (SAINT_FILTER_SUBTYPES[key] ?? []).some((value) => (counts[value] ?? 0) > 0);
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />
      <ListControls>
        <ListSearch
          action="/saints"
          query={query}
          label={t("listSearch.saints")}
          keep={keep}
          resultCount={result.total}
          t={t}
          locale={locale}
        />
        <FilterChips
          ariaLabel="Filter saints by category"
          activeKey={selected.key}
          items={SAINT_FILTERS.filter((f) => f.key === "all" || hasContent(f.key)).map((f) => ({
            key: f.key,
            label: f.label,
            // The chips keep the search, so a search can be narrowed by category.
            href: listHref("/saints", { filter: f.key === "all" ? undefined : f.key, q: query }),
          }))}
        />
      </ListControls>
      {result.items.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/saints" query={query} keep={keep} t={t} />
        ) : (
          <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
            No saints in this category yet.
          </div>
        )
      ) : (
        <>
          {/* A card reads name, patronage, feast day, and a patronage runs long, so
              three cards fit a row without cutting it short. */}
          <PublishedList
            items={await localizeItems(result.items, { depth: "card" })}
            baseHref="/saints"
            detailLinesFor={(item) => saintCardDetailLines(details.get(item.id), t)}
          />
          <Pagination
            t={t}
            basePath="/saints"
            page={result.page}
            totalPages={result.pageCount}
            searchParams={{ ...keep, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

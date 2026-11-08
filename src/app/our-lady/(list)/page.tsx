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
  entryPayload,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { apparitionEyebrow } from "@/lib/content-shared/apparitions";
import {
  sortApparitionsForDisplay,
  sortMarianTitlesForDisplay,
} from "@/lib/content-shared/display-order";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import {
  OUR_LADY_FILTERS,
  resolveOurLadyFilter,
  type OurLadyFilter,
} from "@/lib/content-shared/our-lady";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  filter?: string;
  page?: string;
  apage?: string;
  q?: string | string[];
}>;

// Both cards show the payload summary, and both types are small closed sets
// (the Marian titles and the Church-approved apparitions), so each is read
// whole and paged here. The two sections page independently — `?page=` walks
// the titles, `?apage=` the apparitions — because the "All" view shows both. One
// read per request: the tab's title and the page both need the answer.
const loadOurLady = cache(async (active: OurLadyFilter, page: number, apage: number, q: string) => {
  const view = resolveOurLadyFilter(active);
  const [allTitles, allApparitions] = await Promise.all([
    view.showTitles ? listPublished("MARIAN_TITLE") : Promise.resolve([]),
    view.showApparitions ? listPublished("APPARITION") : Promise.resolve([]),
  ]);
  const orderedTitles = sortMarianTitlesForDisplay(allTitles);
  const orderedApparitions = sortApparitionsForDisplay(allApparitions);
  const titles = q
    ? rankBySearch(orderedTitles, q, (m) => publishedSearchFields(m))
    : orderedTitles;
  const apparitions = q
    ? rankBySearch(orderedApparitions, q, (a) =>
        publishedSearchFields(a, [apparitionEyebrow(a.payload)]),
      )
    : orderedApparitions;
  return {
    titles,
    apparitions,
    titlePage: pageSlice(titles, page, LIST_PAGE_SIZE),
    apparitionPage: pageSlice(apparitions, apage, LIST_PAGE_SIZE),
  };
});

/**
 * The page opens on the Marian titles alone. A search made from there looks
 * through the titles AND the apparitions — "Lourdes" is an apparition — so
 * without an explicit filter a search shows both, sectioned as "All" does.
 * A filter the reader picked is kept.
 */
function viewFor(filter: unknown, query: string) {
  return resolveOurLadyFilter(typeof filter === "string" ? filter : query ? "all" : undefined);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { t, locale } = await getTranslator();
  const { filter, page, apage, q } = await searchParams;
  const query = parseSearchQuery(q);
  const view = viewFor(filter, query);
  const titlesPage = parsePageParam(page);
  const apparitionsPage = parsePageParam(apage);
  // Under "All" the page holds two lists, so each says which it is.
  const sectioned = view.showTitles && view.showApparitions;
  return {
    title: await listPageTitleFor(
      {
        name: t("nav.spiritualGuidance"),
        // The title says the filter and each list's name in the reader's language.
        filter: filter ? t(`ourLady.filter.${view.active}`) : null,
        query,
        t,
        locale,
      },
      (view.showTitles && titlesPage > 1) || (view.showApparitions && apparitionsPage > 1),
      async () => {
        const data = await loadOurLady(view.active, titlesPage, apparitionsPage, query);
        return {
          pages: [
            ...(view.showTitles
              ? [{ ...data.titlePage, of: sectioned ? t("ourLady.filter.titles") : undefined }]
              : []),
            ...(view.showApparitions
              ? [
                  {
                    ...data.apparitionPage,
                    of: sectioned ? t("ourLady.filter.apparitions") : undefined,
                  },
                ]
              : []),
          ],
          total: data.titles.length + data.apparitions.length,
        };
      },
    ),
  };
}

export default async function OurLadyPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, apage: apageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const view = viewFor(filter, query);
  const { titles, apparitions, titlePage, apparitionPage } = await loadOurLady(
    view.active,
    parsePageParam(pageParam),
    parsePageParam(apageParam),
    query,
  );
  // The filter as the URLs carry it. A search keeps even the default
  // ("titles"), because without it a search would widen to both again.
  const filterParam = view.active === "titles" && !filter ? undefined : view.active;
  const keep = { filter: filter ? view.active : undefined };
  const matches = titles.length + apparitions.length;
  // Under "All" each list has a section heading, so its cards are one level down.
  const sectioned = view.active === "all";
  const titleAs = sectioned ? "h3" : "h2";

  return (
    <div>
      <PageHero
        eyebrow="The Blessed Virgin Mary"
        title="Our Lady"
        subtitle="The different titles of Mary, the Mother of God."
      />

      <ListControls>
        <ListSearch
          action="/our-lady"
          query={query}
          label={t("listSearch.ourLady")}
          keep={keep}
          resultCount={matches}
          t={t}
          locale={locale}
        />
        {/* Filters (not separate tabs): actively narrow the page; the active
            one is highlighted. Only "All" shows both together. With a search
            in effect each filter keeps it. */}
        <FilterChips
          ariaLabel="Our Lady filter"
          activeKey={view.active}
          items={OUR_LADY_FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            href:
              f.key === "titles" && !query
                ? "/our-lady"
                : listHref("/our-lady", { filter: f.key, q: query }),
          }))}
        />
      </ListControls>

      {query && matches === 0 ? (
        <ListSearchNoResults action="/our-lady" query={query} keep={keep} t={t} />
      ) : (
        <div className="vf-stack-section">
          {view.showTitles && !(query && titles.length === 0) && (
            <section>
              {sectioned && (
                <div className="vf-section-head">
                  <h2 className="vf-section-title">Marian Titles</h2>
                </div>
              )}
              {titles.length === 0 ? (
                <p className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
                  No Marian titles are published yet. The worker adds verified titles as they are
                  approved and sourced.
                </p>
              ) : (
                <>
                  <PublishedList
                    items={await localizeItems(titlePage.items, { depth: "card" })}
                    baseHref="/our-lady"
                    titleAs={titleAs}
                    action={t("common.open")}
                  />
                  <Pagination
                    t={t}
                    label={t("pagination.marianTitles")}
                    basePath="/our-lady"
                    page={titlePage.page}
                    totalPages={titlePage.pageCount}
                    searchParams={{ filter: filterParam, apage: apageParam, q: query || undefined }}
                  />
                </>
              )}
            </section>
          )}

          {view.showApparitions && !(query && apparitions.length === 0) && (
            <section>
              {sectioned && (
                <div className="vf-section-head">
                  {/* Not "Approved": each card states its own standing, and some
                      are reported, or not yet judged. */}
                  <h2 className="vf-section-title">Apparitions</h2>
                </div>
              )}
              {apparitions.length === 0 ? (
                <p className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
                  No Marian apparitions are published yet. The worker adds verified apparitions with
                  their Church approval status.
                </p>
              ) : (
                <>
                  <PublishedList
                    items={await localizeItems(apparitionPage.items, { depth: "card" })}
                    baseHref="/our-lady"
                    titleAs={titleAs}
                    eyebrowFor={(item) => apparitionEyebrow(entryPayload(item))}
                    action={t("common.open")}
                  />
                  <Pagination
                    t={t}
                    label={t("pagination.apparitions")}
                    basePath="/our-lady"
                    pageParam="apage"
                    page={apparitionPage.page}
                    totalPages={apparitionPage.pageCount}
                    searchParams={{ filter: filterParam, page: pageParam, q: query || undefined }}
                  />
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

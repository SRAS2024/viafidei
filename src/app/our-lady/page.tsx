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
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { OUR_LADY_FILTERS, resolveOurLadyFilter } from "@/lib/content-shared/our-lady";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Our Lady" };

export default async function OurLadyPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; apage?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, apage: apageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  // The page opens on the Marian titles alone. A search made from there looks
  // through the titles AND the apparitions — "Lourdes" is an apparition — so
  // without an explicit filter a search shows both, sectioned as "All" does.
  // A filter the reader picked is kept.
  const view = resolveOurLadyFilter(filter ?? (query ? "all" : undefined));

  // Both cards show the payload summary, and both types are small closed sets
  // (the Marian titles and the Church-approved apparitions), so each is read
  // whole and paged here. The two sections page independently — `?page=` walks
  // the titles, `?apage=` the apparitions — because the "All" view shows both.
  const [allTitles, allApparitions] = await Promise.all([
    view.showTitles ? listPublished("MARIAN_TITLE") : Promise.resolve([]),
    view.showApparitions ? listPublished("APPARITION") : Promise.resolve([]),
  ]);
  const orderedTitles = sortMarianTitlesForDisplay(allTitles);
  const orderedApparitions = sortApparitionsForDisplay(allApparitions);
  const titles = query
    ? rankBySearch(orderedTitles, query, (m) => publishedSearchFields(m))
    : orderedTitles;
  const apparitions = query
    ? rankBySearch(orderedApparitions, query, (a) =>
        publishedSearchFields(a, [apparitionEyebrow(a.payload)]),
      )
    : orderedApparitions;
  const titlePage = pageSlice(titles, parsePageParam(pageParam), LIST_PAGE_SIZE);
  const apparitionPage = pageSlice(apparitions, parsePageParam(apageParam), LIST_PAGE_SIZE);
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
        subtitle="Marian titles and the Church-approved apparitions of the Blessed Virgin Mary."
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
                    label="Marian titles pages"
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
                    label="Apparitions pages"
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

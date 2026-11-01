import Link from "next/link";

import {
  LIST_PAGE_SIZE,
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
  const titles = query
    ? rankBySearch(allTitles, query, (m) => publishedSearchFields(m))
    : allTitles;
  const apparitions = query
    ? rankBySearch(allApparitions, query, (a) =>
        publishedSearchFields(a, [apparitionEyebrow(a.payload)]),
      )
    : allApparitions;
  const titlePage = pageSlice(titles, parsePageParam(pageParam), LIST_PAGE_SIZE);
  const apparitionPage = pageSlice(apparitions, parsePageParam(apageParam), LIST_PAGE_SIZE);
  // The filter as the URLs carry it. A search keeps even the default
  // ("titles"), because without it a search would widen to both again.
  const filterParam = view.active === "titles" && !filter ? undefined : view.active;
  const keep = { filter: filter ? view.active : undefined };
  const matches = titles.length + apparitions.length;

  return (
    <div>
      <PageHero
        eyebrow="The Blessed Virgin Mary"
        title="Our Lady"
        subtitle="Marian titles and the Church-approved apparitions of the Blessed Virgin Mary."
      />

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
      <nav aria-label="Our Lady filter" className="mb-6 flex flex-wrap gap-2">
        {OUR_LADY_FILTERS.map((f) => {
          const isActive = view.active === f.key;
          const href =
            f.key === "titles" && !query
              ? "/our-lady"
              : listHref("/our-lady", { filter: f.key, q: query });
          return (
            <Link
              key={f.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-300 text-ink-soft hover:border-ink/40"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {query && matches === 0 ? (
        <div className="mt-8">
          <ListSearchNoResults action="/our-lady" query={query} keep={keep} t={t} />
        </div>
      ) : (
        <>
          {view.showTitles && !(query && titles.length === 0) && (
            <section>
              {view.active === "all" && (
                <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Marian Titles</h2>
              )}
              {titles.length === 0 ? (
                <p className="mt-8 rounded border border-slate-200 bg-white p-6 text-center font-serif text-ink-faint">
                  No Marian titles are published yet. The worker adds verified titles as they are
                  approved and sourced.
                </p>
              ) : (
                <>
                  <PublishedList
                    items={await localizeItems(titlePage.items, { depth: "card" })}
                    baseHref="/our-lady"
                  />
                  <Pagination
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
              {view.active === "all" && (
                <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Approved Apparitions</h2>
              )}
              {apparitions.length === 0 ? (
                <p className="mt-8 rounded border border-slate-200 bg-white p-6 text-center font-serif text-ink-faint">
                  No Marian apparitions are published yet. The worker adds verified apparitions with
                  their Church approval status.
                </p>
              ) : (
                <>
                  <PublishedList
                    items={await localizeItems(apparitionPage.items, { depth: "card" })}
                    baseHref="/our-lady"
                    eyebrowFor={(item) => apparitionEyebrow(entryPayload(item))}
                  />
                  <Pagination
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
        </>
      )}
    </div>
  );
}

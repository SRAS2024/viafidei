import Link from "next/link";

import {
  LIST_PAGE_SIZE,
  PageHero,
  Pagination,
  PublishedList,
  entryPayload,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { apparitionEyebrow } from "@/lib/content-shared/apparitions";
import { OUR_LADY_FILTERS, resolveOurLadyFilter } from "@/lib/content-shared/our-lady";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Our Lady" };

export default async function OurLadyPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; apage?: string }>;
}) {
  const { filter, page: pageParam, apage: apageParam } = await searchParams;
  const view = resolveOurLadyFilter(filter);

  // Both cards show the payload summary, and both types are small closed sets
  // (the Marian titles and the Church-approved apparitions), so each is read
  // whole and paged here. The two sections page independently — `?page=` walks
  // the titles, `?apage=` the apparitions — because the "All" view shows both.
  const [titles, apparitions] = await Promise.all([
    view.showTitles ? listPublished("MARIAN_TITLE") : Promise.resolve([]),
    view.showApparitions ? listPublished("APPARITION") : Promise.resolve([]),
  ]);
  const titlePage = pageSlice(titles, parsePageParam(pageParam), LIST_PAGE_SIZE);
  const apparitionPage = pageSlice(apparitions, parsePageParam(apageParam), LIST_PAGE_SIZE);
  const filterParam = view.active === "titles" ? undefined : view.active;

  return (
    <div>
      <PageHero
        eyebrow="The Blessed Virgin Mary"
        title="Our Lady"
        subtitle="Marian titles and the Church-approved apparitions of the Blessed Virgin Mary."
      />

      {/* Filters (not separate tabs): actively narrow the page; the active
          one is highlighted. Only "All" shows both together. */}
      <nav aria-label="Our Lady filter" className="mt-8 flex flex-wrap gap-2">
        {OUR_LADY_FILTERS.map((f) => {
          const isActive = view.active === f.key;
          return (
            <Link
              key={f.key}
              href={f.key === "titles" ? "/our-lady" : `/our-lady?filter=${f.key}`}
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

      {view.showTitles && (
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
              <PublishedList items={titlePage.items} baseHref="/our-lady" />
              <Pagination
                basePath="/our-lady"
                page={titlePage.page}
                totalPages={titlePage.pageCount}
                searchParams={{ filter: filterParam, apage: apageParam }}
              />
            </>
          )}
        </section>
      )}

      {view.showApparitions && (
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
                items={apparitionPage.items}
                baseHref="/our-lady"
                eyebrowFor={(item) => apparitionEyebrow(entryPayload(item))}
              />
              <Pagination
                basePath="/our-lady"
                pageParam="apage"
                page={apparitionPage.page}
                totalPages={apparitionPage.pageCount}
                searchParams={{ filter: filterParam, page: pageParam }}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}

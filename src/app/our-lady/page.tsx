import Link from "next/link";

import { PageHero, PublishedList } from "@/components/ui";
import { apparitionEyebrow } from "@/lib/content-shared/apparitions";
import { OUR_LADY_FILTERS, resolveOurLadyFilter } from "@/lib/content-shared/our-lady";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Our Lady" };

export default async function OurLadyPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const view = resolveOurLadyFilter(filter);

  const [titles, apparitions] = await Promise.all([
    view.showTitles ? listPublished("MARIAN_TITLE") : Promise.resolve([]),
    view.showApparitions ? listPublished("APPARITION") : Promise.resolve([]),
  ]);

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
            <PublishedList items={titles} baseHref="/our-lady" />
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
            <PublishedList
              items={apparitions}
              baseHref="/our-lady"
              eyebrowFor={(item) => apparitionEyebrow(item.payload)}
            />
          )}
        </section>
      )}
    </div>
  );
}

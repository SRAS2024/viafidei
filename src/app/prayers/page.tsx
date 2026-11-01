import Link from "next/link";

import { getTranslator } from "@/lib/i18n/server";
import {
  FilterChips,
  LIST_PAGE_SIZE,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  PaginatedGrid,
  Pagination,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { listPublished } from "@/lib/data/published";
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import {
  PRAYER_CATEGORIES,
  categorizePrayer,
  prayerCategoryLabel,
} from "@/lib/content-shared/prayer-categories";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prayers" };

type Props = {
  searchParams: Promise<{ filter?: string; page?: string; q?: string | string[] }>;
};

export default async function PrayersPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  // A prayer card shows the opening lines of the prayer itself, which the
  // payload-free projection does not carry, so the library is read whole and
  // paged here. Only the current page of cards is rendered and serialised.
  const prayers = await listPublished("PRAYER");

  // Categorise each prayer (Marian / Angelic / Liturgical / …) so the filter
  // works against real data even before the worker emits canonical categories.
  const annotated = prayers.map((p) => ({
    prayer: p,
    category: categorizePrayer({
      title: p.title,
      prayerType: p.payload.prayerType as string | undefined,
      body: p.payload.body as string | undefined,
      category: p.payload.category as string | undefined,
    }),
  }));

  const present = new Set(annotated.map((a) => a.category));
  const selected = filter && PRAYER_CATEGORIES.some((c) => c.value === filter) ? filter : null;
  // The chips keep the search, so a reader can narrow a search by category.
  const filterChips = [
    { key: "__all__", label: "All", href: listHref("/prayers", { q: query }) },
    ...PRAYER_CATEGORIES.filter((c) => present.has(c.value)).map((c) => ({
      key: c.value,
      label: c.label,
      href: listHref("/prayers", { filter: c.value, q: query }),
    })),
  ];
  const inCategory = selected ? annotated.filter((a) => a.category === selected) : annotated;
  // Searched by title, the category on the card, and the prayer's own words.
  const visible = query
    ? rankBySearch(inCategory, query, ({ prayer, category }) =>
        publishedSearchFields(prayer, [prayerCategoryLabel(category)]),
      )
    : inCategory;
  const page = pageSlice(visible, parsePageParam(pageParam), LIST_PAGE_SIZE);
  const keep = { filter: selected ?? undefined };

  return (
    <div>
      <PageHero
        eyebrow={t("nav.prayers")}
        title={t("prayers.title")}
        subtitle={t("prayers.subtitle")}
      />

      <ListSearch
        action="/prayers"
        query={query}
        label={t("listSearch.prayers")}
        keep={keep}
        resultCount={visible.length}
        t={t}
        locale={locale}
      />

      {prayers.length > 0 ? (
        <FilterChips
          ariaLabel="Filter prayers by category"
          activeKey={selected ?? "__all__"}
          items={filterChips}
          className="mb-8"
          resetKey="__all__"
        />
      ) : null}

      {prayers.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          The prayer library will appear here as items are approved and published through the
          checklist-first worker.
        </div>
      ) : query && visible.length === 0 ? (
        <ListSearchNoResults action="/prayers" query={query} keep={keep} t={t} />
      ) : (
        <>
          <PaginatedGrid
            items={page.items.map(({ prayer: p, category }) => {
              const body =
                (p.payload.body as string | undefined) ??
                (p.payload.prayerText as string | undefined) ??
                "";
              return (
                <Link key={p.id} href={`/prayers/${p.slug}`} className="block h-full">
                  <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30 sm:p-7">
                    <p className="vf-eyebrow">{prayerCategoryLabel(category)}</p>
                    <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
                    <p className="mt-4 line-clamp-5 font-serif leading-relaxed text-ink-soft">
                      {body}
                    </p>
                  </article>
                </Link>
              );
            })}
          />
          <Pagination
            basePath="/prayers"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ filter: selected ?? undefined, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

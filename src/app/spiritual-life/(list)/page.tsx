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
import { formatEnumValue } from "@/lib/content-shared/field-presenters";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { SPIRITUAL_FILTERS } from "@/lib/content-shared/spiritual-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { countPublishedBySubtype, listPublished } from "@/lib/data/published";
import { localizeItems } from "@/lib/translation/localize";

/**
 * The stored `practiceKind` values behind each chip. `PublishedContent.subtype`
 * carries `practiceKind`, so chip presence is an indexed count rather than a
 * scan. Mirrors SPIRITUAL_FILTERS in content-shared/spiritual-categories.ts.
 */
const SPIRITUAL_FILTER_SUBTYPES: Readonly<Record<string, readonly string[]>> = {
  prayer: ["contemplative_prayer", "lectio_divina", "examen"],
  penance: ["fasting", "almsgiving", "mortification", "stations_of_the_cross"],
  pilgrimage: ["pilgrimage"],
  discernment: ["discernment", "vocation", "spiritual_direction"],
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ filter?: string; page?: string; q?: string | string[] }>;

// Practice cards show the practice's summary from the payload, so the type
// (a small, closed catalogue) is read whole and paged here. One read per request:
// the tab's title and the page both need the answer.
const loadPractices = cache(async (filterKey: string, pageNumber: number, query: string) => {
  const [all, counts] = await Promise.all([
    listPublished("SPIRITUAL_PRACTICE"),
    countPublishedBySubtype("SPIRITUAL_PRACTICE").catch(() => ({}) as Record<string, number>),
  ]);
  const practices = applyPayloadFilter(SPIRITUAL_FILTERS, all, filterKey);
  const visible = query
    ? rankBySearch(practices, query, (p) => publishedSearchFields(p))
    : practices;
  return { all, counts, visible, page: pageSlice(visible, pageNumber, LIST_PAGE_SIZE) };
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { t, locale } = await getTranslator();
  const { filter, page, q } = await searchParams;
  const query = parseSearchQuery(q);
  const selected = resolvePayloadFilter(SPIRITUAL_FILTERS, filter);
  const pageNumber = parsePageParam(page);
  return {
    title: await listPageTitleFor(
      {
        name: t("nav.spiritualLife"),
        filter: selected.key === "all" ? null : selected.label,
        query,
        t,
        locale,
      },
      pageNumber > 1,
      async () => {
        const data = await loadPractices(selected.key, pageNumber, query);
        return { pages: [data.page], total: data.visible.length };
      },
    ),
  };
}

export default async function SpiritualLifePage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = resolvePayloadFilter(SPIRITUAL_FILTERS, filter);
  const { all, counts, visible, page } = await loadPractices(
    selected.key,
    parsePageParam(pageParam),
    query,
  );
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  // Only offer a category chip when at least one practice falls under it. The
  // indexed `practiceKind` counts answer that without scanning the payloads.
  const present = new Set<string>();
  for (const f of SPIRITUAL_FILTERS) {
    if (f.key === "all") continue;
    // Counts first (indexed); the payload check is the fail-open half — a
    // stored value this map has not learned yet must never HIDE a chip that
    // has published content behind it.
    if (
      SPIRITUAL_FILTER_SUBTYPES[f.key]?.some((v) => (counts[v] ?? 0) > 0) ||
      all.some((p) => f.matches(p.payload))
    ) {
      present.add(f.key);
    }
  }

  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />
      <ListControls>
        <ListSearch
          action="/spiritual-life"
          query={query}
          label={t("listSearch.spiritualLife")}
          keep={keep}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
        <FilterChips
          ariaLabel="Filter practices by kind"
          activeKey={selected.key}
          items={SPIRITUAL_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map(
            (f) => ({
              key: f.key,
              label: f.label,
              href: listHref("/spiritual-life", {
                filter: f.key === "all" ? undefined : f.key,
                q: query,
              }),
            }),
          )}
        />
      </ListControls>
      {page.items.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/spiritual-life" query={query} keep={keep} t={t} />
        ) : (
          <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
            No practices in this category yet.
          </div>
        )
      ) : (
        <>
          {/* The line under the title is the humanised practice kind — never
              `lectio_divina` — and "Other" names no kind. */}
          <PublishedList
            items={await localizeItems(page.items, { depth: "card" })}
            baseHref="/spiritual-life"
            eyebrowFor={(item) => {
              const kind = entryPayload(item).practiceKind;
              return typeof kind === "string" && kind.trim() && kind !== "other"
                ? formatEnumValue("practiceKind", kind)
                : undefined;
            }}
            action={t("common.open")}
          />
          <Pagination
            t={t}
            basePath="/spiritual-life"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ ...keep, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

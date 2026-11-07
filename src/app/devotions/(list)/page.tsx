import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import {
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
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

// Devotion cards show the devotion's summary from the payload, so the type
// is read whole and paged here rather than through the projection. One read per
// request: the tab's title and the page both need the answer.
const loadDevotions = cache(async (pageNumber: number, query: string) => {
  const items = await listPublished("DEVOTION");
  const visible = query ? rankBySearch(items, query, (d) => publishedSearchFields(d)) : items;
  return { visible, page: pageSlice(visible, pageNumber, LIST_PAGE_SIZE) };
});

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
      { name: t("nav.devotions"), query, t, locale },
      pageNumber > 1,
      async () => {
        const data = await loadDevotions(pageNumber, query);
        return { pages: [data.page], total: data.visible.length };
      },
    ),
  };
}

export default async function DevotionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const { visible, page } = await loadDevotions(parsePageParam(pageParam), query);
  return (
    <div>
      <PageHero
        eyebrow={t("nav.devotions")}
        title={t("devotions.title")}
        subtitle={t("devotions.subtitle")}
      />
      <ListControls>
        <ListSearch
          action="/devotions"
          query={query}
          label={t("listSearch.devotions")}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
        <p className="basis-full text-center font-serif text-[length:var(--fs-note)] text-ink-soft">
          Looking for a nine-day novena?{" "}
          <Link href="/novenas" className="vf-link">
            Browse novenas <span aria-hidden="true">→</span>
          </Link>
        </p>
      </ListControls>
      {query && visible.length === 0 ? (
        <ListSearchNoResults action="/devotions" query={query} t={t} />
      ) : (
        <>
          {/* The line under the title is the humanised devotion type — never the
              stored value — and "General" names no type. */}
          <PublishedList
            items={await localizeItems(page.items, { depth: "card" })}
            baseHref="/devotions"
            eyebrowFor={(item) => {
              const type = entryPayload(item).devotionType;
              return typeof type === "string" && type.trim() && type !== "general"
                ? formatEnumValue("devotionType", type)
                : undefined;
            }}
            action={t("common.open")}
          />
          <Pagination
            t={t}
            basePath="/devotions"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

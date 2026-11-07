import Link from "next/link";

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
import {
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devotions" };

export default async function DevotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  // Devotion cards show the devotion's summary from the payload, so the type
  // is read whole and paged here rather than through the projection.
  const items = await listPublished("DEVOTION");
  const visible = query ? rankBySearch(items, query, (d) => publishedSearchFields(d)) : items;
  const page = pageSlice(visible, parsePageParam(pageParam), LIST_PAGE_SIZE);
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

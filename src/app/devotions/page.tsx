import Link from "next/link";

import {
  LIST_PAGE_SIZE,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
  PublishedList,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
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
      <ListSearch
        action="/devotions"
        query={query}
        label={t("listSearch.devotions")}
        resultCount={visible.length}
        t={t}
        locale={locale}
      />
      <p className="mb-8 text-center font-serif text-sm text-ink-soft">
        Looking for a nine-day novena?{" "}
        <Link href="/novenas" className="vf-nav-link">
          Browse novenas →
        </Link>
      </p>
      {query && visible.length === 0 ? (
        <ListSearchNoResults action="/devotions" query={query} t={t} />
      ) : (
        <>
          {/* The eyebrow is the humanised devotion type — never the stored value. */}
          <PublishedList
            items={await localizeItems(page.items, { depth: "card" })}
            baseHref="/devotions"
            eyebrowField="devotionType"
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

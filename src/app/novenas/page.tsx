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
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novenas" };

export default async function NovenasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  // Novena cards show the novena's summary from the payload, so the type is
  // read whole and paged here rather than through the projection.
  const items = await listPublished("NOVENA");
  const visible = query ? rankBySearch(items, query, (n) => publishedSearchFields(n)) : items;
  const page = pageSlice(visible, parsePageParam(pageParam), LIST_PAGE_SIZE);
  return (
    <div>
      <PageHero
        eyebrow="Nine days of prayer"
        title="Novenas"
        subtitle="Nine-day novenas — each day opens in its own dropdown with the full prayer."
      />
      <ListSearch
        action="/novenas"
        query={query}
        label={t("listSearch.novenas")}
        resultCount={visible.length}
        t={t}
        locale={locale}
      />
      {query && visible.length === 0 ? (
        <ListSearchNoResults action="/novenas" query={query} t={t} />
      ) : (
        <>
          <PublishedList
            items={await localizeItems(page.items, { depth: "card" })}
            baseHref="/novenas"
            eyebrowField="intentionTheme"
          />
          <Pagination
            basePath="/novenas"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

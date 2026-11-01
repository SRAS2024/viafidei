import {
  LIST_PAGE_SIZE,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
  PublishedList,
  parsePageParam,
} from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublishedPage } from "@/lib/data/published";
import { parseSearchQuery } from "@/lib/content-shared/list-search";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Litanies" };

export default async function LitaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);

  // Litanies are prayers whose stored `prayerType` is "litany" — a sustained
  // sequence of invocations and responses. That value is the indexed `subtype`
  // column, so this tab is one indexed page of prayers rather than the whole
  // prayer library re-categorised in JS on every request. A search stays in
  // SQL too, inside the same subtype.
  const result = await listPublishedPage("PRAYER", {
    page: parsePageParam(pageParam),
    pageSize: LIST_PAGE_SIZE,
    subtype: "litany",
    ...(query ? { q: query } : {}),
  });

  return (
    <div>
      <PageHero
        eyebrow={t("litanies.eyebrow")}
        title={t("litanies.title")}
        subtitle={t("litanies.subtitle")}
      />

      <ListSearch
        action="/litanies"
        query={query}
        label={t("listSearch.litanies")}
        resultCount={result.total}
        t={t}
        locale={locale}
      />

      {result.items.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/litanies" query={query} t={t} />
        ) : (
          <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
            {t("litanies.empty")}
          </div>
        )
      ) : (
        <>
          <PublishedList
            items={await localizeItems(result.items, { depth: "card" })}
            baseHref="/prayers"
            showSummary={false}
            detailLinesFor={() => ["Litany"]}
          />
          <Pagination
            basePath="/litanies"
            page={result.page}
            totalPages={result.pageCount}
            searchParams={{ q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

import {
  LIST_PAGE_SIZE,
  PageHero,
  Pagination,
  PublishedList,
  parsePageParam,
} from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublishedPage } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Litanies" };

export default async function LitaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t } = await getTranslator();
  const { page: pageParam } = await searchParams;

  // Litanies are prayers whose stored `prayerType` is "litany" — a sustained
  // sequence of invocations and responses. That value is the indexed `subtype`
  // column, so this tab is one indexed page of prayers rather than the whole
  // prayer library re-categorised in JS on every request.
  const result = await listPublishedPage("PRAYER", {
    page: parsePageParam(pageParam),
    pageSize: LIST_PAGE_SIZE,
    subtype: "litany",
  });

  return (
    <div>
      <PageHero
        eyebrow={t("litanies.eyebrow")}
        title={t("litanies.title")}
        subtitle={t("litanies.subtitle")}
      />

      {result.items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          {t("litanies.empty")}
        </div>
      ) : (
        <>
          <PublishedList items={result.items} baseHref="/prayers" eyebrowFor={() => "Litany"} />
          <Pagination basePath="/litanies" page={result.page} totalPages={result.pageCount} />
        </>
      )}
    </div>
  );
}

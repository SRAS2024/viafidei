import {
  FilterChips,
  LIST_PAGE_SIZE,
  PageHero,
  Pagination,
  PublishedList,
  parsePageParam,
} from "@/components/ui";
import {
  SAINT_FILTERS,
  SAINT_FILTER_SUBTYPES,
  saintSubtypeLabel,
} from "@/lib/content-shared/saint-categories";
import { resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { countPublishedBySubtype, listPublishedPage } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saints" };

export default async function SaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { t } = await getTranslator();
  const { filter, page: pageParam } = await searchParams;
  const selected = resolvePayloadFilter(SAINT_FILTERS, filter);
  const subtypes = selected.key === "all" ? null : (SAINT_FILTER_SUBTYPES[selected.key] ?? null);

  // One indexed page of saints, ordered chronologically in SQL by the stored
  // `sortYear` column. The catalogue is heading for 10,000 rows, so the page
  // must never load the whole type: `listPublishedPage` projects away the
  // payload and takes exactly the 30 rows this page shows.
  const [result, counts] = await Promise.all([
    listPublishedPage("SAINT", {
      page: parsePageParam(pageParam),
      pageSize: LIST_PAGE_SIZE,
      subtype: subtypes,
      order: "chronological",
    }),
    countPublishedBySubtype("SAINT").catch(() => ({}) as Record<string, number>),
  ]);

  // Only offer a category chip when at least one saint falls under it — an
  // indexed groupBy now, not a scan of every published saint.
  const hasContent = (key: string): boolean =>
    (SAINT_FILTER_SUBTYPES[key] ?? []).some((value) => (counts[value] ?? 0) > 0);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />
      <FilterChips
        ariaLabel="Filter saints by category"
        activeKey={selected.key}
        className="mt-8 mb-6"
        items={SAINT_FILTERS.filter((f) => f.key === "all" || hasContent(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/saints" : `/saints?filter=${f.key}`,
        }))}
      />
      {result.items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No saints in this category yet.
        </div>
      ) : (
        <>
          {/* Earliest saints first (Apostles → modern), each tagged with the
              one title label the spec permits for its type. */}
          <PublishedList
            items={result.items}
            baseHref="/saints"
            eyebrowFor={(item) => saintSubtypeLabel("subtype" in item ? item.subtype : null)}
          />
          <Pagination
            basePath="/saints"
            page={result.page}
            totalPages={result.pageCount}
            searchParams={{ filter: selected.key === "all" ? undefined : selected.key }}
          />
        </>
      )}
    </div>
  );
}

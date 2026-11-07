import {
  FilterChips,
  LIST_PAGE_SIZE,
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
  PublishedList,
  parsePageParam,
} from "@/components/ui";
import { listHref, parseSearchQuery } from "@/lib/content-shared/list-search";
import {
  SAINT_FILTERS,
  SAINT_FILTER_SUBTYPES,
  saintSubtypeLabel,
} from "@/lib/content-shared/saint-categories";
import { resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { saintCardDetailLines, type SaintCardDetails } from "@/lib/content-shared/saints";
import { getTranslator } from "@/lib/i18n/server";
import {
  countPublishedBySubtype,
  listPublishedPage,
  listSaintCardDetails,
} from "@/lib/data/published";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saints" };

export default async function SaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = resolvePayloadFilter(SAINT_FILTERS, filter);
  const subtypes = selected.key === "all" ? null : (SAINT_FILTER_SUBTYPES[selected.key] ?? null);

  // One indexed page of saints, in the site's saint order, in SQL. The catalogue
  // is heading for 10,000 rows, so the page must never load the whole type:
  // `listPublishedPage` projects away the payload and takes exactly the rows
  // this page shows. A search runs in SQL as well — name, patronage and the rest
  // of the search index — best match first, inside the chosen category.
  const [result, counts] = await Promise.all([
    listPublishedPage("SAINT", {
      page: parsePageParam(pageParam),
      pageSize: LIST_PAGE_SIZE,
      subtype: subtypes,
      order: "saints",
      ...(query ? { q: query } : {}),
    }),
    countPublishedBySubtype("SAINT").catch(() => ({}) as Record<string, number>),
  ]);

  // Each card shows the saint's patronage, then feast day, beneath the name.
  // The page rows carry no payload, so those two facts come from one bounded
  // projection over just these ids. Fail-open: a card without them still links.
  const details = await listSaintCardDetails(result.items.map((item) => item.id)).catch(
    () => new Map<string, SaintCardDetails>(),
  );

  // Only offer a category chip when at least one saint falls under it — an
  // indexed groupBy now, not a scan of every published saint.
  const hasContent = (key: string): boolean =>
    (SAINT_FILTER_SUBTYPES[key] ?? []).some((value) => (counts[value] ?? 0) > 0);
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />
      <ListControls>
        <ListSearch
          action="/saints"
          query={query}
          label={t("listSearch.saints")}
          keep={keep}
          resultCount={result.total}
          t={t}
          locale={locale}
        />
        <FilterChips
          ariaLabel="Filter saints by category"
          activeKey={selected.key}
          items={SAINT_FILTERS.filter((f) => f.key === "all" || hasContent(f.key)).map((f) => ({
            key: f.key,
            label: f.label,
            // The chips keep the search, so a search can be narrowed by category.
            href: listHref("/saints", { filter: f.key === "all" ? undefined : f.key, q: query }),
          }))}
        />
      </ListControls>
      {result.items.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/saints" query={query} keep={keep} t={t} />
        ) : (
          <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
            No saints in this category yet.
          </div>
        )
      ) : (
        <>
          {/* A name is short and its facts are brief, so four cards fit a row.
              Each card carries the one title label the spec permits for its type. */}
          <PublishedList
            items={await localizeItems(result.items, { depth: "card" })}
            baseHref="/saints"
            columns={4}
            eyebrowFor={(item) => saintSubtypeLabel("subtype" in item ? item.subtype : null)}
            detailLinesFor={(item) => saintCardDetailLines(details.get(item.id), t)}
          />
          <Pagination
            basePath="/saints"
            page={result.page}
            totalPages={result.pageCount}
            searchParams={{ ...keep, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

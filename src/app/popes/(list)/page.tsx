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
import { sortPopesForDisplay } from "@/lib/content-shared/display-order";
import {
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Popes" };

/** "1878–1903", "2025–Present", and one year alone for a reign within one year. */
function reignLabel(payload: Record<string, unknown>): string {
  const start = String(payload.papacyStart ?? "").trim();
  const end = String(payload.papacyEnd ?? "").trim();
  if (!start) return "";
  if (start === end) return start;
  return `${start}–${end || "Present"}`;
}

export default async function PopesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  // A pope card shows the reign years, which live in the payload, so the list
  // (bounded by the ~266 Roman Pontiffs) is read whole and paged here: only
  // one page of cards is rendered and serialised into the response.
  const popes = sortPopesForDisplay(await listPublished("POPE"));
  // Searched by regnal name, birth name and the years of the reign; equally
  // good matches keep the list's own order.
  const visible = query
    ? rankBySearch(popes, query, (p) =>
        publishedSearchFields(p, [reignLabel(p.payload as Record<string, unknown>)]),
      )
    : popes;
  const page = pageSlice(visible, parsePageParam(pageParam), LIST_PAGE_SIZE);

  return (
    <div>
      <PageHero
        eyebrow="The Roman Pontiffs"
        title="Popes"
        subtitle="The successors of Saint Peter."
      />

      <ListControls>
        <ListSearch
          action="/popes"
          query={query}
          label={t("listSearch.popes")}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
      </ListControls>

      {popes.length === 0 ? (
        <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
          The list of popes will appear here as records are approved and published through the
          checklist-first worker.
        </div>
      ) : query && visible.length === 0 ? (
        <ListSearchNoResults action="/popes" query={query} t={t} />
      ) : (
        <>
          {/* A name and its years are short, so four cards fit a row. The
              pope's name leads; the years are a line beneath it. */}
          <PublishedList
            items={page.items}
            baseHref="/popes"
            columns={4}
            showSummary={false}
            eyebrowFor={(item) => reignLabel(entryPayload(item))}
          />
          <Pagination
            basePath="/popes"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

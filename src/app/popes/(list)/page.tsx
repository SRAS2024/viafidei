import type { Metadata } from "next";
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
import { sortPopesForDisplay } from "@/lib/content-shared/display-order";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import {
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";

import { popePontificate } from "../[slug]/facts";

export const dynamic = "force-dynamic";

/** The reign as the pope's own page writes it, so the card and the page agree. */
function reignLabel(payload: Record<string, unknown>): string {
  return popePontificate(payload) ?? "";
}

// A pope card shows the reign years, which live in the payload, so the list
// (bounded by the ~266 Roman Pontiffs) is read whole and paged here: only
// one page of cards is rendered and serialised into the response. One read per
// request: the tab's title and the page both need the answer.
const loadPopes = cache(async (pageNumber: number, query: string) => {
  const popes = sortPopesForDisplay(await listPublished("POPE"));
  // Searched by regnal name, birth name and the years of the reign; equally
  // good matches keep the list's own order.
  const visible = query
    ? rankBySearch(popes, query, (p) =>
        publishedSearchFields(p, [reignLabel(p.payload as Record<string, unknown>)]),
      )
    : popes;
  return { popes, visible, page: pageSlice(visible, pageNumber, LIST_PAGE_SIZE) };
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
      { name: t("nav.popes"), query, t, locale },
      pageNumber > 1,
      async () => {
        const data = await loadPopes(pageNumber, query);
        return { pages: [data.page], total: data.visible.length };
      },
    ),
  };
}

export default async function PopesPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const { popes, visible, page } = await loadPopes(parsePageParam(pageParam), query);

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
            t={t}
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

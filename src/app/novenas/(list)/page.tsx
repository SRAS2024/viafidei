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
import { formatEnumValue } from "@/lib/content-shared/field-presenters";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import {
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

/**
 * A novena's intention as the sentence under its title. It is stored as a phrase
 * ("a holy death and the hope of glory") or, on older rows, as an enum
 * ("hopeless_causes"), so it is humanised and given a sentence's capital.
 */
function intentionSentence(payload: Record<string, unknown>): string | undefined {
  const theme = payload.intentionTheme;
  if (typeof theme !== "string" || !theme.trim()) return undefined;
  const text = formatEnumValue("intentionTheme", theme);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Novena cards show the novena's summary from the payload, so the type is
// read whole and paged here rather than through the projection. One read per
// request: the tab's title and the page both need the answer.
const loadNovenas = cache(async (pageNumber: number, query: string) => {
  const items = await listPublished("NOVENA");
  const visible = query ? rankBySearch(items, query, (n) => publishedSearchFields(n)) : items;
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
  const inDictionary = t("nav.novenas");
  return {
    title: await listPageTitleFor(
      { name: inDictionary === "nav.novenas" ? "Novenas" : inDictionary, query, t, locale },
      pageNumber > 1,
      async () => {
        const data = await loadNovenas(pageNumber, query);
        return { pages: [data.page], total: data.visible.length };
      },
    ),
  };
}

export default async function NovenasPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const { visible, page } = await loadNovenas(parsePageParam(pageParam), query);
  return (
    <div>
      <PageHero
        eyebrow="Nine days of prayer"
        title="Novenas"
        subtitle="A novena is a prayer made over nine days, most often in a row, to ask a particular grace or to prepare for a feast. It follows the nine days the Apostles spent in prayer with Mary between the Ascension and Pentecost."
      />
      <ListControls>
        <ListSearch
          action="/novenas"
          query={query}
          label={t("listSearch.novenas")}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
      </ListControls>
      {query && visible.length === 0 ? (
        <ListSearchNoResults action="/novenas" query={query} t={t} />
      ) : (
        <>
          <PublishedList
            items={await localizeItems(page.items, { depth: "card" })}
            baseHref="/novenas"
            themeFor={(item) => intentionSentence(entryPayload(item))}
            action={t("common.open")}
          />
          <Pagination
            t={t}
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

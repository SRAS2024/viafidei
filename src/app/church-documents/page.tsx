import type { Metadata } from "next";
import { cache } from "react";

import {
  ContentCard,
  FilterChips,
  LIST_PAGE_SIZE,
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  PaginatedGrid,
  Pagination,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import {
  DOCUMENT_CATEGORIES,
  documentCategory,
  documentTypeLabel,
  filterDocuments,
} from "@/lib/content-shared/church-documents";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Encyclicals, council documents, the Catechism, Canon Law, and other magisterial texts, with links to the official source.";

type Props = {
  searchParams: Promise<{ filter?: string; page?: string; q?: string | string[] }>;
};

// Each card shows the document's title, kind and summary (the summary is in
// the payload), so the magisterial corpus is read whole and paged here. The
// card has no "Read on vatican.va" line: that named the source, and the
// document's own page has "Read the full document". One read per request: the
// tab's title and the page both need the answer.
const loadDocuments = cache(async (filterKey: string, pageNumber: number, query: string) => {
  const all = await listPublished("CHURCH_DOCUMENT");
  const documents = filterDocuments(all, filterKey);
  // Searched by title, the kind on the card ("Encyclical"), the issuing pope
  // or council, the year, the key themes, and the summary.
  const visible = query
    ? rankBySearch(documents, query, (doc) =>
        publishedSearchFields(doc, [documentTypeLabel(doc.payload.documentType)]),
      )
    : documents;
  return { all, visible, page: pageSlice(visible, pageNumber, LIST_PAGE_SIZE) };
});

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { t, locale } = await getTranslator();
  const { filter, page, q } = await searchParams;
  const query = parseSearchQuery(q);
  const selected = documentCategory(filter);
  const pageNumber = parsePageParam(page);
  return {
    title: await listPageTitleFor(
      {
        name: t("nav.churchDocuments"),
        filter: selected.key === "all" ? null : selected.label,
        query,
        t,
        locale,
      },
      pageNumber > 1,
      async () => {
        const data = await loadDocuments(selected.key, pageNumber, query);
        return { pages: [data.page], total: data.visible.length };
      },
    ),
    description: DESCRIPTION,
  };
}

export default async function ChurchDocumentsPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = documentCategory(filter);
  const { all, visible, page } = await loadDocuments(
    selected.key,
    parsePageParam(pageParam),
    query,
  );
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  // Only offer a category chip when at least one document falls under it.
  const present = new Set<string>();
  for (const cat of DOCUMENT_CATEGORIES) {
    if (cat.key === "all") continue;
    if (all.some((d) => cat.matches(d.payload))) present.add(cat.key);
  }

  const cards = page.items.map((doc) => (
    <ContentCard
      key={doc.id}
      href={`/liturgy-history/${doc.slug}`}
      title={doc.title}
      meta={[documentTypeLabel(doc.payload.documentType)]}
      summary={typeof doc.payload.summary === "string" ? doc.payload.summary : null}
      action={t("common.open")}
    />
  ));

  return (
    <div>
      <PageHero
        eyebrow="The Magisterium"
        title="Church Documents"
        subtitle="Encyclicals, council documents, the Catechism, and Canon Law — each linked to its official source."
      />

      <ListControls>
        <ListSearch
          action="/church-documents"
          query={query}
          label={t("listSearch.churchDocuments")}
          keep={keep}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
        <FilterChips
          ariaLabel="Filter documents by category"
          activeKey={selected.key}
          items={DOCUMENT_CATEGORIES.filter((c) => c.key === "all" || present.has(c.key)).map(
            (c) => ({
              key: c.key,
              label: c.label,
              href: listHref("/church-documents", {
                filter: c.key === "all" ? undefined : c.key,
                q: query,
              }),
            }),
          )}
        />
      </ListControls>

      {cards.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/church-documents" query={query} keep={keep} t={t} />
        ) : (
          <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
            No documents in this category yet.
          </div>
        )
      ) : (
        <>
          <PaginatedGrid items={cards} />
          <Pagination
            t={t}
            basePath="/church-documents"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ ...keep, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}

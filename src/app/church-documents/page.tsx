import Link from "next/link";

import {
  FilterChips,
  LIST_PAGE_SIZE,
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
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church Documents",
  description:
    "Encyclicals, council documents, the Catechism, Canon Law, and other magisterial texts, with links to the official source.",
};

type Props = {
  searchParams: Promise<{ filter?: string; page?: string; q?: string | string[] }>;
};

export default async function ChurchDocumentsPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = documentCategory(filter);
  // Each card shows the document's kind, title and summary (the summary is in
  // the payload), so the magisterial corpus is read whole and paged here. The
  // card has no "Read on vatican.va" line: that named the source, and the
  // document's own page has "Read the full document".
  const all = await listPublished("CHURCH_DOCUMENT");
  const documents = filterDocuments(all, selected.key);
  // Searched by title, the kind on the card ("Encyclical"), the issuing pope
  // or council, the year, the key themes, and the summary.
  const visible = query
    ? rankBySearch(documents, query, (doc) =>
        publishedSearchFields(doc, [documentTypeLabel(doc.payload.documentType)]),
      )
    : documents;
  const page = pageSlice(visible, parsePageParam(pageParam), LIST_PAGE_SIZE);
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  // Only offer a category chip when at least one document falls under it.
  const present = new Set<string>();
  for (const cat of DOCUMENT_CATEGORIES) {
    if (cat.key === "all") continue;
    if (all.some((d) => cat.matches(d.payload))) present.add(cat.key);
  }

  const cards = page.items.map((doc) => {
    const summary = typeof doc.payload.summary === "string" ? doc.payload.summary : "";
    return (
      <article key={doc.id} className="vf-card flex h-full flex-col rounded-sm p-6 sm:p-7">
        <p className="vf-eyebrow">{documentTypeLabel(doc.payload.documentType)}</p>
        <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">
          <Link href={`/liturgy-history/${doc.slug}`} className="hover:underline">
            {doc.title}
          </Link>
        </h2>
        {summary && (
          <p className="mt-3 line-clamp-4 font-serif leading-relaxed text-ink-soft">{summary}</p>
        )}
      </article>
    );
  });

  return (
    <div>
      <PageHero
        eyebrow="The Magisterium"
        title="Church Documents"
        subtitle="Encyclicals, council documents, the Catechism, and Canon Law — each linked to its official source."
      />

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
        className="mb-6"
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

      {cards.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/church-documents" query={query} keep={keep} t={t} />
        ) : (
          <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
            No documents in this category yet.
          </div>
        )
      ) : (
        <>
          <PaginatedGrid items={cards} />
          <Pagination
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

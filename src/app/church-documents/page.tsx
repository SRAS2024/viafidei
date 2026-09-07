import Link from "next/link";

import {
  FilterChips,
  LIST_PAGE_SIZE,
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
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church Documents",
  description:
    "Encyclicals, council documents, the Catechism, Canon Law, and other magisterial texts, with links to the official source.",
};

type Props = { searchParams: Promise<{ filter?: string; page?: string }> };

function hostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "the official source";
  }
}

export default async function ChurchDocumentsPage({ searchParams }: Props) {
  const { filter, page: pageParam } = await searchParams;
  const selected = documentCategory(filter);
  // Each card shows the document's summary and its official-source link, both
  // in the payload, so the magisterial corpus is read whole and paged here.
  const all = await listPublished("CHURCH_DOCUMENT");
  const documents = filterDocuments(all, selected.key);
  const page = pageSlice(documents, parsePageParam(pageParam), LIST_PAGE_SIZE);

  // Only offer a category chip when at least one document falls under it.
  const present = new Set<string>();
  for (const cat of DOCUMENT_CATEGORIES) {
    if (cat.key === "all") continue;
    if (all.some((d) => cat.matches(d.payload))) present.add(cat.key);
  }

  const cards = page.items.map((doc) => {
    const url = typeof doc.payload.canonicalUrl === "string" ? doc.payload.canonicalUrl : undefined;
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
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="vf-nav-link mt-4 inline-block text-sm"
          >
            Read on {hostLabel(url)} →
          </a>
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

      <FilterChips
        ariaLabel="Filter documents by category"
        activeKey={selected.key}
        className="mb-6"
        items={DOCUMENT_CATEGORIES.filter((c) => c.key === "all" || present.has(c.key)).map(
          (c) => ({
            key: c.key,
            label: c.label,
            href: c.key === "all" ? "/church-documents" : `/church-documents?filter=${c.key}`,
          }),
        )}
      />

      {cards.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No documents in this category yet.
        </div>
      ) : (
        <>
          <PaginatedGrid items={cards} />
          <Pagination
            basePath="/church-documents"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ filter: selected.key === "all" ? undefined : selected.key }}
          />
        </>
      )}
    </div>
  );
}

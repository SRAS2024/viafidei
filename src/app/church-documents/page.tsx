import Link from "next/link";

import { PageHero } from "@/components/ui";
import { PaginatedGrid } from "@/components/ui/PaginatedGrid";
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

type Props = { searchParams: Promise<{ filter?: string }> };

function hostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "the official source";
  }
}

export default async function ChurchDocumentsPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const selected = documentCategory(filter);
  const all = await listPublished("CHURCH_DOCUMENT");
  const documents = filterDocuments(all, selected.key);

  // Only offer a category chip when at least one document falls under it.
  const present = new Set<string>();
  for (const cat of DOCUMENT_CATEGORIES) {
    if (cat.key === "all") continue;
    if (all.some((d) => cat.matches(d.payload))) present.add(cat.key);
  }

  const cards = documents.map((doc) => {
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

      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {DOCUMENT_CATEGORIES.filter((c) => c.key === "all" || present.has(c.key)).map((c) => {
          const active = c.key === selected.key;
          return (
            <Link
              key={c.key}
              href={c.key === "all" ? "/church-documents" : `/church-documents?filter=${c.key}`}
              aria-current={active ? "page" : undefined}
              className={`vf-btn !py-1 !px-4 text-xs ${active ? "vf-btn-primary" : "vf-btn-ghost"}`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No documents in this category yet.
        </div>
      ) : (
        <PaginatedGrid items={cards} />
      )}
    </div>
  );
}

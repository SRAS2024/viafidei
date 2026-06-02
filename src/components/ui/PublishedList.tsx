/**
 * Generic list renderer for published checklist items of one content type.
 */

import Link from "next/link";

import type { PublishedItem } from "@/lib/data/published";

import { PaginatedGrid } from "./PaginatedGrid";

export interface PublishedListProps {
  items: PublishedItem[];
  baseHref: string;
  emptyMessage?: string;
  eyebrowField?: string;
  summaryField?: string;
}

export function PublishedList({
  items,
  baseHref,
  emptyMessage,
  eyebrowField,
  summaryField = "summary",
}: PublishedListProps) {
  if (items.length === 0) {
    return (
      <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
        {emptyMessage ??
          "Items will appear here as the checklist-first worker publishes approved content."}
      </div>
    );
  }
  const cards = items.map((item) => {
    const eyebrow = eyebrowField ? (item.payload[eyebrowField] as string | undefined) : undefined;
    const summary = (item.payload[summaryField] as string | undefined) ?? "";
    return (
      <Link key={item.id} href={`${baseHref}/${item.slug}`} className="block h-full">
        <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30 sm:p-7">
          {eyebrow && <p className="vf-eyebrow">{eyebrow}</p>}
          <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{item.title}</h2>
          {summary && (
            <p className="mt-4 line-clamp-5 font-serif leading-relaxed text-ink-soft">{summary}</p>
          )}
        </article>
      </Link>
    );
  });
  return <PaginatedGrid items={cards} />;
}

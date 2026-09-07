/**
 * Generic list renderer for published checklist items of one content type.
 *
 * Accepts either shape the data layer returns:
 *   - `PublishedItem`     — the full row, payload included (small types, and
 *                           cards whose body is payload prose such as a
 *                           guide's summary or a rite's history);
 *   - `PublishedListItem` — the payload-free projection `listPublishedPage`
 *                           returns for the types that grow without bound.
 *
 * The caller decides which; this component never assumes a payload is there.
 */

import Link from "next/link";

import { formatEnumValue } from "@/lib/content-shared/field-presenters";
import type { PublishedItem, PublishedListItem } from "@/lib/data/published";

import { PaginatedGrid } from "./PaginatedGrid";

export type PublishedListEntry = PublishedItem | PublishedListItem;

/** The projection carries no payload; the full row does. */
function payloadOf(item: PublishedListEntry): Record<string, unknown> | null {
  return "payload" in item ? item.payload : null;
}

/**
 * The payload of a list entry, or `{}` for a projected row. Lets an
 * `eyebrowFor` callback keep using the payload helpers (`saintEyebrow`,
 * `apparitionEyebrow`) without having to narrow the union itself.
 */
export function entryPayload(item: PublishedListEntry): Record<string, unknown> {
  return payloadOf(item) ?? {};
}

export interface PublishedListProps {
  items: readonly PublishedListEntry[];
  baseHref: string;
  emptyMessage?: string;
  /**
   * Payload field (or, for a projected row, the indexed `subtype`) shown as the
   * card's eyebrow. The raw value is ALWAYS run through `formatEnumValue`, so a
   * stored enum such as `lent_preparation` or `contemplative_prayer` can never
   * reach a reader as-is.
   */
  eyebrowField?: string;
  summaryField?: string;
  /** Optional comparator to order items (payload rows only; SQL orders the rest). */
  sortItems?: (a: PublishedItem, b: PublishedItem) => number;
  /** Optional computed eyebrow; overrides `eyebrowField` when provided. */
  eyebrowFor?: (item: PublishedListEntry) => string | undefined;
  /**
   * Show the stored one-line subtitle as the card body for projected rows.
   * Off by default: for the big catalogues the subtitle is a type label
   * ("A saint of the Catholic Church"), which is noise on 30 cards at once.
   */
  showSubtitle?: boolean;
}

export function PublishedList({
  items,
  baseHref,
  emptyMessage,
  eyebrowField,
  summaryField = "summary",
  sortItems,
  eyebrowFor,
  showSubtitle = false,
}: PublishedListProps) {
  if (items.length === 0) {
    return (
      <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
        {emptyMessage ??
          "Items will appear here as the checklist-first worker publishes approved content."}
      </div>
    );
  }

  // Sorting is only meaningful for full rows; a projected page is already
  // ordered by the database and re-sorting it would only shuffle one page.
  const ordered =
    sortItems && items.every((i) => "payload" in i)
      ? [...(items as PublishedItem[])].sort(sortItems)
      : [...items];

  const cards = ordered.map((item) => {
    const payload = payloadOf(item);
    const rawEyebrow = eyebrowField
      ? payload
        ? payload[eyebrowField]
        : (item as PublishedListItem).subtype
      : undefined;
    const eyebrow = eyebrowFor
      ? eyebrowFor(item)
      : typeof rawEyebrow === "string" && rawEyebrow.trim()
        ? formatEnumValue(eyebrowField ?? "", rawEyebrow)
        : undefined;
    const summary = payload
      ? ((payload[summaryField] as string | undefined) ?? "")
      : showSubtitle
        ? item.subtitle
        : "";
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

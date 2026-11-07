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

import { formatEnumValue } from "@/lib/content-shared/field-presenters";
import type { PublishedItem, PublishedListItem } from "@/lib/data/published";
import { displayItem } from "@/lib/translation/display";

import { ContentCard } from "./ContentCard";
import { PaginatedGrid, type GridColumns } from "./PaginatedGrid";

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
  /**
   * Show `summaryField` from a full row as the card body (default). Off for a
   * card whose lines say everything it should — a saint's name, patronage and
   * feast day, never a clipped biography beneath them.
   */
  showSummary?: boolean;
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
  /**
   * Short facts shown directly beneath the title, one per line and in the order
   * given — a saint's patronage, then feast day. The caller supplies the text,
   * so this works for projected rows that carry no payload.
   */
  detailLinesFor?: (item: PublishedListEntry) => ReadonlyArray<string> | undefined;
  /** A thematic sentence for under the title (a novena's intention). */
  themeFor?: (item: PublishedListEntry) => string | undefined;
  /** The collection's grid: 3 (default) for long entries, 4 for short ones. */
  columns?: GridColumns;
  /** The card's quiet action on its bottom line ("Open"). */
  action?: string;
}

export function PublishedList({
  items,
  baseHref,
  emptyMessage,
  eyebrowField,
  summaryField = "summary",
  showSummary = true,
  sortItems,
  eyebrowFor,
  showSubtitle = false,
  detailLinesFor,
  themeFor,
  columns = 3,
  action,
}: PublishedListProps) {
  if (items.length === 0) {
    return (
      <div className="vf-card col-span-full rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
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
    // Eyebrows and ordering read the stored (English) fields; the card shows
    // the reader's language when the item carries a translation overlay.
    const shown = displayItem(item);
    const payload = payloadOf(item);
    const shownPayload = payloadOf(shown);
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
    const summary = !showSummary
      ? ""
      : shownPayload
        ? ((shownPayload[summaryField] as string | undefined) ?? "")
        : showSubtitle
          ? shown.subtitle
          : "";
    const details = (detailLinesFor?.(item) ?? []).filter((line) => line.trim());
    // The title leads; a brief category label and the facts follow it.
    return (
      <ContentCard
        key={item.id}
        href={`${baseHref}/${item.slug}`}
        title={shown.title}
        meta={[eyebrow, ...details]}
        theme={themeFor?.(item)}
        summary={summary}
        action={action}
      />
    );
  });
  return <PaginatedGrid items={cards} columns={columns} />;
}

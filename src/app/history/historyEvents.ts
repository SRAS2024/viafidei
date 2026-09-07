import type { PublishedItem } from "@/lib/data/published";
import {
  buildTimeline,
  timelineDocumentFromPayload,
  type TimelineDocument,
} from "@/lib/content-shared/church-history/timeline";

export {
  buildTimeline,
  documentDatePrecision,
  historyYearBounds,
  timelineDocumentFromPayload,
  type HistoryEvent,
  type HistoryEraSummary,
  type HistoryLink,
  type HistoryTimeline,
  type TimelineDocument,
} from "@/lib/content-shared/church-history/timeline";

/**
 * The /history page's adapter over the timeline builder. The merge itself is
 * pure and lives in `content-shared/church-history/timeline.ts`; this module
 * only turns full published rows into the body-free projection it takes.
 */
export function timelineDocumentFromPublished(item: PublishedItem): TimelineDocument {
  return timelineDocumentFromPayload(item.slug, item.title, item.payload);
}

/** Convenience for callers holding full published rows (tests, scripts). */
export function toHistoryTimeline(items: PublishedItem[]) {
  return buildTimeline(items.map(timelineDocumentFromPublished));
}

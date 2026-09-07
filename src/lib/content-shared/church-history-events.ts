/**
 * The Church-history timeline's static spine, aggregated.
 *
 * The 232 events live in four hand-curated parts under `church-history/`
 * (split only to keep each file reviewable). This module merges them into
 * one chronologically sorted list and re-exports the shared types and
 * helpers, so every consumer — the /history page, the content catalog, the
 * dataset test — reads a single ordered source and never sorts on its own.
 */

import { EVENTS_1 } from "./church-history/events-1";
import { EVENTS_2 } from "./church-history/events-2";
import { EVENTS_3 } from "./church-history/events-3";
import { EVENTS_4 } from "./church-history/events-4";
import { historySortKey, type ChurchHistoryEvent } from "./church-history/types";

export {
  HISTORY_ERAS,
  eraForYear,
  formatHistoryDate,
  historySortKey,
  type ChurchHistoryEvent,
  type DatePrecision,
  type HistoryEra,
  type HistoryKind,
} from "./church-history/types";

/**
 * Hosts an event may cite. Every event carries exactly one citation and it
 * must be an https page on one of these — the dataset test enforces it, so a
 * typo or an unvetted source never ships as a "Source" link.
 */
export const HISTORY_CITATION_HOSTS: ReadonlySet<string> = new Set([
  "en.wikipedia.org",
  "www.vatican.va",
  "vatican.va",
  "www.newadvent.org",
  "newadvent.org",
  "www.britannica.com",
  "britannica.com",
  "www.usccb.org",
  "usccb.org",
]);

/** Stable chronological order: sort key first, then title for same-day ties. */
export function compareHistoryEvents(
  a: Pick<ChurchHistoryEvent, "date" | "year" | "precision" | "title">,
  b: Pick<ChurchHistoryEvent, "date" | "year" | "precision" | "title">,
): number {
  const ka = historySortKey(a);
  const kb = historySortKey(b);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** Every static event, oldest first (Pentecost → today). */
export const CHURCH_HISTORY_EVENTS: ReadonlyArray<ChurchHistoryEvent> = [
  ...EVENTS_1,
  ...EVENTS_2,
  ...EVENTS_3,
  ...EVENTS_4,
].sort(compareHistoryEvents);

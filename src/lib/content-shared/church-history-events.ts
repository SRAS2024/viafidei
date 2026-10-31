/**
 * The Church-history timeline's static spine, aggregated.
 *
 * The events live in hand-curated parts under `church-history/`, split only
 * to keep each file reviewable: parts 1–4 are the original spine from
 * Pentecost to the present; parts 5–11 deepen one era each (the Apostolic Age
 * and the persecutions; the Fathers; the early and the high Middle Ages; the
 * Western Schism, Renaissance and Reformation; the early-modern era and the
 * nineteenth century; 1914 to the present); parts 12 and 13 fill the gaps
 * two completeness reviews found across them all. Every part must be registered
 * below — the dataset test fails on a part that is not. This module merges
 * them into one chronologically sorted list and re-exports the shared types
 * and helpers, so every consumer — the /history page, the content catalog,
 * the dataset test — reads a single ordered source and never sorts on its own.
 */

import { EVENTS_1 } from "./church-history/events-1";
import { EVENTS_2 } from "./church-history/events-2";
import { EVENTS_3 } from "./church-history/events-3";
import { EVENTS_4 } from "./church-history/events-4";
import { EVENTS_5 } from "./church-history/events-5";
import { EVENTS_6 } from "./church-history/events-6";
import { EVENTS_7 } from "./church-history/events-7";
import { EVENTS_8 } from "./church-history/events-8";
import { EVENTS_9 } from "./church-history/events-9";
import { EVENTS_10 } from "./church-history/events-10";
import { EVENTS_11 } from "./church-history/events-11";
import { EVENTS_12 } from "./church-history/events-12";
import { EVENTS_13 } from "./church-history/events-13";
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
  ...EVENTS_5,
  ...EVENTS_6,
  ...EVENTS_7,
  ...EVENTS_8,
  ...EVENTS_9,
  ...EVENTS_10,
  ...EVENTS_11,
  ...EVENTS_12,
  ...EVENTS_13,
].sort(compareHistoryEvents);

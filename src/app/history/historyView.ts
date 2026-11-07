/**
 * What one URL of /history shows: the filters, the era and page in effect, and
 * the one page of events, grouped under their era and century. Pure, so the
 * page renders only what is shown and the rest of the timeline never leaves the
 * server. Filters are keyed on the event's era, kind and tags, the fields every
 * event (static or document-derived) actually carries, never on title regexes
 * or period strings no event can have (audit HIST-01).
 */

import { parseSearchQuery, searchTier, type SearchFields } from "@/lib/content-shared/list-search";
import type {
  HistoryEraSummary,
  HistoryEvent,
  HistoryTimeline,
} from "@/lib/content-shared/church-history/timeline";
import {
  HISTORY_ERAS,
  eraForYear,
  type HistoryEra,
} from "@/lib/content-shared/church-history/types";

export type HistoryFilterKey =
  | "all"
  | "beginnings"
  | "councils"
  | "doctrine"
  | "saints"
  | "schisms"
  | "marian"
  | "modern";

export const FILTER_LABELS: Record<HistoryFilterKey, string> = {
  all: "All",
  beginnings: "Beginnings",
  councils: "Councils",
  doctrine: "Doctrine & Magisterium",
  saints: "Saints & Martyrs",
  schisms: "Schisms & Reform",
  marian: "Our Lady",
  modern: "Modern Era",
};

export const FILTER_KEYS = Object.keys(FILTER_LABELS) as HistoryFilterKey[];

const MODERN_ERAS: ReadonlySet<HistoryEra> = new Set([
  "revolution-19c",
  "twentieth",
  "post-conciliar",
]);

export function matchesHistoryFilter(event: HistoryEvent, filter: HistoryFilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "beginnings":
      return event.era === "apostolic" || event.era === "persecution";
    case "councils":
      return event.kind === "council";
    case "doctrine":
      return event.kind === "document";
    case "saints":
      return event.kind === "saint" || event.kind === "martyrdom" || event.tags.includes("doctor");
    case "schisms":
      return (
        event.kind === "schism" ||
        event.tags.includes("schism") ||
        event.tags.includes("reform") ||
        event.tags.includes("reformation")
      );
    case "marian":
      return event.kind === "apparition" || event.tags.includes("marian");
    case "modern":
      return MODERN_ERAS.has(event.era);
    default:
      return true;
  }
}

/**
 * How many events one page shows. Enough to read on from, few enough that the
 * page stays light on a phone.
 */
export const HISTORY_PAGE_SIZE = 60;

export type HistoryOrder = "oldest" | "newest";

export interface HistoryParams {
  era: HistoryEra | null;
  theme: HistoryFilterKey;
  q: string;
  order: HistoryOrder;
  page: number;
  year: number | null;
  event: string | null;
}

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The URL's parameters as the page receives them → a state it can trust.
 * Anything it does not recognise is the same as leaving the parameter out, so a
 * hand-edited link still shows the timeline rather than an error.
 */
export function parseHistoryParams(raw: RawParams): HistoryParams {
  const era = firstValue(raw.era);
  const theme = firstValue(raw.theme);
  const page = Number.parseInt(firstValue(raw.page) ?? "", 10);
  const year = firstValue(raw.year);
  const event = firstValue(raw.event);
  return {
    era: HISTORY_ERAS.some((e) => e.key === era) ? (era as HistoryEra) : null,
    theme: FILTER_KEYS.includes(theme as HistoryFilterKey) ? (theme as HistoryFilterKey) : "all",
    q: parseSearchQuery(raw.q),
    order: firstValue(raw.order) === "newest" ? "newest" : "oldest",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    year: year && /^\d{1,4}$/.test(year.trim()) ? Number.parseInt(year, 10) : null,
    event: event && /^[a-z0-9-]{1,200}$/.test(event) ? event : null,
  };
}

/** What a search reads: the row's own words and everything its details show. */
function searchFieldsOf(event: HistoryEvent): SearchFields {
  return {
    title: event.title,
    secondary: [event.location, event.kindLabel, event.dateLabel],
    prose: [event.context, event.significance, event.excerpt],
  };
}

/** "1st century", "2nd century", … "21st century"; the year 100 ends the first. */
export function centuryLabel(year: number): string {
  const century = Math.max(1, Math.ceil(year / 100));
  const tens = century % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : century % 10 === 1
        ? "st"
        : century % 10 === 2
          ? "nd"
          : century % 10 === 3
            ? "rd"
            : "th";
  return `${century}${suffix} century`;
}

/** The open-ended last era reads "1965–today". */
export function eraRange(era: HistoryEraSummary, maxYear: number): string {
  return era.to > maxYear ? `${era.from}–today` : `${era.from}–${era.to}`;
}

/** The same span for the ear: "from 1965 to today". */
export function eraRangeSpoken(era: HistoryEraSummary, maxYear: number): string {
  return era.to > maxYear ? `from ${era.from} to today` : `from ${era.from} to ${era.to}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function firstCrossing(
  chronological: readonly HistoryEvent[],
  year: number,
  order: HistoryOrder,
): HistoryEvent | undefined {
  if (order === "oldest") return chronological.find((e) => e.year >= year);
  return chronological.findLast((e) => e.year <= year);
}

/**
 * The event a year lands on: reading oldest first, the first at or after it;
 * reading newest first, the first at or before it, since that is where the list
 * crosses the year in the direction it reads. The era that year belongs to comes
 * first: a boundary year has events of the era it closes as well as the one it
 * opens, and 1054 should land among the High Middle Ages it names, not on the
 * last row of the age before. Past the end of the list it lands on the last
 * event there is. `chronological` is oldest first.
 */
export function eventAtYear(
  chronological: readonly HistoryEvent[],
  year: number,
  order: HistoryOrder,
): HistoryEvent | null {
  const era = eraForYear(year);
  return (
    firstCrossing(
      chronological.filter((e) => e.era === era),
      year,
      order,
    ) ??
    firstCrossing(chronological, year, order) ??
    (order === "oldest" ? chronological.at(-1) : chronological[0]) ??
    null
  );
}

export interface HistoryCenturyGroup {
  label: string;
  events: HistoryEvent[];
}

export interface HistoryEraGroup {
  era: HistoryEraSummary;
  /** How many events of this era the current filters leave, on any page. */
  count: number;
  centuries: HistoryCenturyGroup[];
}

export interface HistoryView {
  params: HistoryParams;
  /** The theme and search in effect: a deep link clears any that hide its event. */
  theme: HistoryFilterKey;
  q: string;
  /** The era in effect: the one asked for, or the one a year or event landed in. */
  era: HistoryEraSummary | null;
  /** Every era, whether it holds anything right now or not. */
  eraList: readonly HistoryEraSummary[];
  page: number;
  pageCount: number;
  /** 1-based positions of the first and last events shown; 0 when none are. */
  rangeStart: number;
  rangeEnd: number;
  /** How many events the filters leave in this view, on every page. */
  total: number;
  groups: HistoryEraGroup[];
  /** Events per era under the theme and search, for the era choices. */
  eraCounts: Readonly<Record<string, number>>;
  /** The same across all eras. */
  allErasCount: number;
  /** Events per theme under the era and search, for the theme choices. */
  themeCounts: Readonly<Record<HistoryFilterKey, number>>;
  /** The row a year or deep link landed on. */
  target: HistoryEvent | null;
  /** The year a year-jump asked for, inside the slider's range. */
  year: number | null;
  /** The row a deep link opens. */
  openSlug: string | null;
  /** Where the year slider stands. */
  sliderYear: number;
  /** The era of the event it stands on, when one is shown. */
  sliderEraLabel: string | null;
  sliderMin: number;
  sliderMax: number;
  /** The eras before and after this one in reading order, if they hold events. */
  previousEra: HistoryEraSummary | null;
  nextEra: HistoryEraSummary | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function groupByEraAndCentury(
  shown: readonly HistoryEvent[],
  eras: readonly HistoryEraSummary[],
  eraCounts: Readonly<Record<string, number>>,
): HistoryEraGroup[] {
  const groups: HistoryEraGroup[] = [];
  for (const event of shown) {
    let group = groups.at(-1);
    if (group?.era.key !== event.era) {
      const era = eras.find((e) => e.key === event.era);
      if (!era) continue;
      group = { era, count: eraCounts[era.key] ?? 0, centuries: [] };
      groups.push(group);
    }
    const label = centuryLabel(event.year);
    let century = group.centuries.at(-1);
    if (century?.label !== label) {
      century = { label, events: [] };
      group.centuries.push(century);
    }
    century.events.push(event);
  }
  return groups;
}

export function buildHistoryView(timeline: HistoryTimeline, params: HistoryParams): HistoryView {
  const { events, eras, maxYear } = timeline;
  const { order } = params;
  const sliderMin = events[0]?.year ?? timeline.minYear;
  const sliderMax = maxYear;

  // A deep link always shows its event: a theme or search that would hide it
  // yields to the link.
  const deepLinked = params.event ? (events.find((e) => e.slug === params.event) ?? null) : null;
  const hitsQuery = (event: HistoryEvent, q: string) =>
    searchTier(searchFieldsOf(event), q) !== null;
  const yields =
    deepLinked &&
    (!matchesHistoryFilter(deepLinked, params.theme) ||
      (params.q !== "" && !hitsQuery(deepLinked, params.q)));
  const theme = yields ? "all" : params.theme;
  const q = yields ? "" : params.q;

  const searched = q ? events.filter((event) => hitsQuery(event, q)) : events;
  const inTheme =
    theme === "all" ? searched : searched.filter((e) => matchesHistoryFilter(e, theme));

  const year = params.year === null ? null : clamp(params.year, sliderMin, sliderMax);
  const target = deepLinked ?? (year === null ? null : eventAtYear(inTheme, year, order));
  const eraKey = target?.era ?? params.era;
  const era = eras.find((e) => e.key === eraKey) ?? null;

  const eraCounts: Record<string, number> = {};
  for (const event of inTheme) eraCounts[event.era] = (eraCounts[event.era] ?? 0) + 1;

  const themeCounts = {} as Record<HistoryFilterKey, number>;
  const searchedInEra = era ? searched.filter((e) => e.era === era.key) : searched;
  for (const key of FILTER_KEYS) {
    themeCounts[key] =
      key === "all"
        ? searchedInEra.length
        : searchedInEra.filter((e) => matchesHistoryFilter(e, key)).length;
  }

  // Reading order runs era by era, each era oldest first. The timeline itself
  // is sorted by date, and a boundary-year event can close the era it ends
  // (Vatican II's close, December 1965) among the next era's first events, so
  // sorting by era (not by consecutive run) keeps one heading per era.
  const eraIndex = new Map(eras.map((e, i) => [e.key, i]));
  const inView = (era ? inTheme.filter((e) => e.era === era.key) : [...inTheme]).sort(
    (a, b) => (eraIndex.get(a.era) ?? 0) - (eraIndex.get(b.era) ?? 0),
  );
  if (order === "newest") inView.reverse();

  const total = inView.length;
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const targetIndex = target ? inView.indexOf(target) : -1;
  const page =
    targetIndex >= 0
      ? Math.floor(targetIndex / HISTORY_PAGE_SIZE) + 1
      : clamp(params.page, 1, pageCount);
  const start = (page - 1) * HISTORY_PAGE_SIZE;
  const shown = inView.slice(start, start + HISTORY_PAGE_SIZE);

  const groups = groupByEraAndCentury(shown, eras, eraCounts);

  // The eras that hold anything under these filters, in the order the list reads.
  const reading = eras.filter((e) => (eraCounts[e.key] ?? 0) > 0);
  if (order === "newest") reading.reverse();
  const eraPosition = era ? reading.findIndex((e) => e.key === era.key) : -1;

  const standsOn = target ?? shown[0] ?? null;
  const sliderYear = clamp(year ?? standsOn?.year ?? era?.from ?? sliderMin, sliderMin, sliderMax);
  const sliderEraLabel = standsOn
    ? (eras.find((e) => e.key === standsOn.era)?.label ?? null)
    : (era?.label ?? null);

  return {
    params,
    theme,
    q,
    era,
    eraList: eras,
    page,
    pageCount,
    rangeStart: shown.length > 0 ? start + 1 : 0,
    rangeEnd: start + shown.length,
    total,
    groups,
    eraCounts,
    allErasCount: inTheme.length,
    themeCounts,
    target,
    year,
    openSlug: deepLinked?.slug ?? null,
    sliderYear,
    sliderEraLabel,
    sliderMin,
    sliderMax,
    previousEra: eraPosition > 0 ? (reading[eraPosition - 1] ?? null) : null,
    nextEra: eraPosition >= 0 ? (reading[eraPosition + 1] ?? null) : null,
  };
}

/**
 * The sentence announced after every change of view. Spelled "61 to 120" rather
 * than with a dash so a screen reader reads it as a range.
 */
export function historyStatusText(view: HistoryView): string {
  const { total, rangeStart, rangeEnd, target, year } = view;
  if (total === 0) return "Showing no events";
  const shown = rangeEnd - rangeStart + 1;
  const count =
    total === 1
      ? "Showing 1 event"
      : rangeStart > 1
        ? `Showing ${formatCount(rangeStart)} to ${formatCount(rangeEnd)} of ${formatCount(total)} events`
        : shown === total
          ? `Showing all ${formatCount(total)} events`
          : `Showing ${formatCount(shown)} of ${formatCount(total)} events`;
  if (target && year !== null) return `${count}. At ${year}: ${target.title}.`;
  if (target) return `${count}. Opened: ${target.title}.`;
  return count;
}

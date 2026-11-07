/**
 * The URL of a view of the timeline. Every state of /history is a link: era,
 * theme, search, order, page, and a year or event to land on. This module is
 * shared with the page's two small client islands, so it stays free of server
 * imports and of anything the browser does not need.
 */

export const HISTORY_PATH = "/history";

/** The list of events, where the page links and a search bring the reader. */
export const HISTORY_RESULTS_ID = "history-results";

/** The count above the list, which a search hands the focus to. */
export const HISTORY_STATUS_ID = "history-status";

/** Marks the row a year landed on, so a link to a year scrolls without script. */
export const HISTORY_YEAR_TARGET_ID = "history-year-target";

/** Each row's id is this and the event's slug, as old links expect. */
export const HISTORY_EVENT_ID_PREFIX = "history-event-";

/** Arrow keys move 5 years; Shift+arrow moves 1. */
export const SLIDER_KEY_STEP = 5;

export interface HistoryLinkState {
  era?: string | null;
  theme?: string | null;
  q?: string | null;
  order?: string | null;
  page?: number | null;
  year?: number | null;
  event?: string | null;
}

/** The URL of a view, leaving out whatever is already the default. */
export function historyHref(state: HistoryLinkState = {}, hash?: string): string {
  const search = new URLSearchParams();
  if (state.era) search.set("era", state.era);
  if (state.theme && state.theme !== "all") search.set("theme", state.theme);
  if (state.q) search.set("q", state.q);
  if (state.order === "newest") search.set("order", "newest");
  if (state.page && state.page > 1) search.set("page", String(state.page));
  if (state.year != null) search.set("year", String(state.year));
  if (state.event) search.set("event", state.event);
  const qs = search.toString();
  return `${HISTORY_PATH}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

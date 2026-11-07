/**
 * What the content list pages share about the state a URL puts them in: which page
 * number can be asked for, and how the tab's title says what is showing.
 */
import { tPlural } from "@/lib/i18n/plural";
import type { Translator } from "@/lib/i18n/translator";

/**
 * The highest page a URL can ask for: far past the end of any list, and low enough
 * that the offset built from it can never overflow what the database accepts.
 */
export const MAX_PAGE_NUMBER = 1_000_000;

/** Where a reader is in one paged list. `of` names the list when a page holds two. */
export interface ListTitlePages {
  page: number;
  pageCount: number;
  of?: string;
}

export interface ListTitleState {
  /** The list's own name: "Saints". */
  name: string;
  /** The filter in effect, in the words of its chip; none for the list's plain view. */
  filter?: string | null;
  /** Where the reader is in the list, or in each list on a page that holds two. */
  pages?: ReadonlyArray<ListTitlePages>;
  /** The search in effect. */
  query?: string | null;
  /** How many items the search found, across every page of results. */
  total?: number;
  t: Translator;
  locale?: string;
}

/**
 * The tab's title for a list page, naming everything that sets this view apart from
 * the plain list: `34 results for “joseph” · Martyrs · Saints · page 2 of 4`.
 *
 * The title is the first thing a screen reader says after a search reloads the page,
 * and what the router announces after a filter or a page link, whose new cards would
 * otherwise appear in silence. So it leads with the outcome, as /search does.
 */
export function listPageTitle({
  name,
  filter,
  pages = [],
  query,
  total = 0,
  t,
  locale,
}: ListTitleState): string {
  const parts: string[] = [];
  if (query) parts.push(tPlural(t, locale, "listSearch.results", total, { query }));
  if (filter) parts.push(filter);
  parts.push(name);
  for (const { page, pageCount, of } of pages) {
    if (page <= 1) continue;
    const where = t("listSearch.pageOf", { page, count: pageCount });
    parts.push(of ? `${of} ${where}` : where);
  }
  return parts.join(" · ");
}

/**
 * The title for a list page, reading the page's data only where the URL alone cannot
 * say what is showing: how many results a search found, and how many pages there
 * are. Next asks for a page's metadata when it prefetches a link to it, and before it
 * sends the page's first bytes, so the plain view of a list must read nothing here. If
 * the read fails the page shows its own error, and the title stays with what is sure.
 */
export async function listPageTitleFor(
  state: Omit<ListTitleState, "pages" | "total">,
  pastFirstPage: boolean,
  read: () => Promise<Pick<ListTitleState, "pages" | "total">>,
): Promise<string> {
  const certain = { ...state, query: null };
  if (!state.query && !pastFirstPage) return listPageTitle(certain);
  try {
    return listPageTitle({ ...state, ...(await read()) });
  } catch {
    return listPageTitle(certain);
  }
}

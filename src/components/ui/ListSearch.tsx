import type { ReactNode } from "react";

import { SearchIcon } from "@/components/icons/SearchIcon";
import { listHref } from "@/lib/content-shared/list-search";
import { tPlural } from "@/lib/i18n/plural";
import type { Translator } from "@/lib/i18n/translator";

import { ClearSearchLink, ListSearchField } from "./ListSearchField";

/** Parameters a search keeps from the page it was made on (the active filter). */
export type ListSearchKeep = Readonly<Record<string, string | null | undefined>>;

type ListSearchProps = {
  /** The list page's own path; the form submits back to it as `?q=`. */
  action: string;
  /** The search in effect ("" when there is none). */
  query: string;
  /** The field's name, in the reader's language: "Search prayers". */
  label: string;
  /**
   * The hint inside the empty field; the label when absent. Given where the
   * label is too long for a phone's field ("Name, city or postal code").
   */
  placeholder?: string;
  /** Kept on the search and on "Clear search": the page's active filter. */
  keep?: ListSearchKeep;
  /** How many items match `query`, across every page of results. */
  resultCount?: number;
  t: Translator;
  locale?: string;
};

/**
 * Holds a list page's search and filter together, on one row where they fit: the
 * two are one control area, and the list follows at a related distance.
 */
export function ListControls({ children }: { children: ReactNode }) {
  return <div className="vf-list-controls">{children}</div>;
}

/** The field's id, which "Clear search" sends focus to from wherever it sits. */
function fieldIdFor(action: string): string {
  return `list-search${action.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}`;
}

/**
 * The search bar of a content list page (/prayers, /saints, /parishes, …).
 *
 * A plain GET form that submits back to the page as `?q=`, so a search is a
 * real URL: it works before any JavaScript has loaded, it can be shared and
 * bookmarked, and the page itself does the filtering on the server. Enter and
 * the button both submit. The active filter rides along as a hidden field, so
 * a search narrows the list the reader is looking at; paging starts again
 * from the first page.
 *
 * Under the form, while a search is in effect, a line says how many items
 * matched and offers to clear the search. A search that matches nothing is
 * shown by `ListSearchNoResults` in place of the list.
 */
export function ListSearch({
  action,
  query,
  label,
  placeholder,
  keep = {},
  resultCount,
  t,
  locale,
}: ListSearchProps) {
  const inputId = fieldIdFor(action);
  return (
    <div className="min-w-0 max-w-xl flex-1 basis-[22rem]">
      <form
        role="search"
        aria-label={label}
        method="get"
        action={action}
        className="flex items-stretch gap-1.5"
      >
        {Object.entries(keep).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <ListSearchField id={inputId} query={query} placeholder={placeholder ?? label} />
        {/* The word shows from the small breakpoint up; on a phone the icon
            alone leaves the field room, and the word stays its name. */}
        <button type="submit" className="vf-btn vf-btn-primary shrink-0 !px-3.5 sm:!px-5">
          <SearchIcon size={16} />
          <span className="sr-only sm:not-sr-only">{t("listSearch.submit")}</span>
        </button>
      </form>
      {query && typeof resultCount === "number" && resultCount > 0 ? (
        <p className="vf-fineprint mt-2 text-center [overflow-wrap:anywhere]">
          {tPlural(t, locale, "listSearch.results", resultCount, { query })}{" "}
          <span aria-hidden="true">·</span>{" "}
          <ClearSearchLink href={listHref(action, keep)} fieldId={inputId} className="vf-link">
            {t("listSearch.clear")}
          </ClearSearchLink>
        </p>
      ) : null}
    </div>
  );
}

/**
 * What a list page shows instead of its cards when a search matches nothing:
 * the query, a hint, and the way back to the unsearched list (keeping the
 * filter).
 */
export function ListSearchNoResults({
  action,
  query,
  keep = {},
  t,
}: {
  action: string;
  query: string;
  keep?: ListSearchKeep;
  t: Translator;
}) {
  return (
    // The side padding gives way on a phone, so that "Clear search" keeps its words whole at
    // enlarged text: "Suche zurücksetzen" did not fit inside 1.5rem either side at 200%.
    <div className="vf-card rounded-sm px-[min(1.5rem,5vw)] py-8 text-center font-serif text-ink-soft">
      {/* A long query with no spaces wraps inside the card: a reader can type anything. */}
      <p className="text-[1.1875rem] [overflow-wrap:anywhere]">{t("listSearch.none", { query })}</p>
      <p className="vf-fineprint mt-1">{t("listSearch.noneHint")}</p>
      <ClearSearchLink
        href={listHref(action, keep)}
        fieldId={fieldIdFor(action)}
        className="vf-btn vf-btn-ghost mt-4"
      >
        {t("listSearch.clear")}
      </ClearSearchLink>
    </div>
  );
}

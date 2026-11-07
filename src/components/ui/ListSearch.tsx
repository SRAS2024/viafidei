import Link from "next/link";
import type { ReactNode } from "react";

import { SearchIcon } from "@/components/icons/SearchIcon";
import { MAX_QUERY_LENGTH, listHref } from "@/lib/content-shared/list-search";
import { tPlural } from "@/lib/i18n/plural";
import type { Translator } from "@/lib/i18n/translator";

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
/**
 * Holds a list page's search and filter together, on one row where they fit: the
 * two are one control area, and the list follows at a related distance.
 */
export function ListControls({ children }: { children: ReactNode }) {
  return <div className="vf-list-controls">{children}</div>;
}

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
  const inputId = `list-search${action.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}`;
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
        {/* 16px text: anything smaller makes iOS zoom the page on focus.
            Keyed on the query because chips, page links and "Clear search"
            navigate in the browser, and an uncontrolled field reads its
            default only when it mounts. */}
        <input
          key={query}
          id={inputId}
          type="search"
          name="q"
          defaultValue={query}
          placeholder={placeholder ?? label}
          maxLength={MAX_QUERY_LENGTH}
          autoComplete="off"
          enterKeyHint="search"
          className="vf-input min-w-0 flex-1"
        />
        {/* The word shows from the small breakpoint up; on a phone the icon
            alone leaves the field room, and the word stays its name. */}
        <button type="submit" className="vf-btn vf-btn-primary shrink-0 !px-3.5 sm:!px-5">
          <SearchIcon size={16} />
          <span className="sr-only sm:not-sr-only">{t("listSearch.submit")}</span>
        </button>
      </form>
      {query && typeof resultCount === "number" && resultCount > 0 ? (
        <p className="vf-fineprint mt-2 text-center">
          {tPlural(t, locale, "listSearch.results", resultCount, { query })}{" "}
          <span aria-hidden="true">·</span>{" "}
          <Link href={listHref(action, keep)} className="vf-link">
            {t("listSearch.clear")}
          </Link>
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
    <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
      <p className="text-[1.1875rem]">{t("listSearch.none", { query })}</p>
      <p className="vf-fineprint mt-1">{t("listSearch.noneHint")}</p>
      <Link href={listHref(action, keep)} className="vf-btn vf-btn-ghost mt-4">
        {t("listSearch.clear")}
      </Link>
    </div>
  );
}

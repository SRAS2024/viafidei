/**
 * @vitest-environment jsdom
 */
/**
 * The shared search bar of the content list pages (src/components/ui/ListSearch.tsx).
 *
 * It is a plain GET form back to the page itself, so a search is a URL: it
 * works before JavaScript loads, it can be shared, and Enter or the button
 * submits it. The page's active filter rides along; a line under the bar says
 * how many items matched, in the reader's language and grammar, and offers to
 * clear the search.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";

import { ListSearch, ListSearchNoResults } from "@/components/ui/ListSearch";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

afterEach(() => cleanup());

const en = createTranslator("en");

function renderBar(over: Partial<Parameters<typeof ListSearch>[0]> = {}) {
  return render(
    <ListSearch action="/prayers" query="" label="Search prayers" t={en} locale="en" {...over} />,
  );
}

describe("ListSearch", () => {
  it("is a labelled search landmark that submits ?q= back to the page", () => {
    renderBar();
    const form = screen.getByRole("search", { name: "Search prayers" });
    expect(form).toHaveAttribute("action", "/prayers");
    expect(form).toHaveAttribute("method", "get");
    const input = within(form).getByRole("searchbox", { name: "Search prayers" });
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("placeholder", "Search prayers");
    expect(input).toHaveAttribute("enterkeyhint", "search");
    // A real submit button, named even where only its icon shows.
    const button = within(form).getByRole("button", { name: "Search" });
    expect(button).toHaveAttribute("type", "submit");
  });

  it("can hint with a shorter placeholder than its label", () => {
    renderBar({
      label: "Search by name, city or postal code",
      placeholder: "Name, city or postal code",
    });
    const input = screen.getByRole("searchbox", { name: "Search by name, city or postal code" });
    expect(input).toHaveAttribute("placeholder", "Name, city or postal code");
  });

  it("shows the search in effect and keeps the page's filter as a hidden field", () => {
    const { container } = renderBar({ query: "hail mary", keep: { filter: "marian", page: "" } });
    expect(screen.getByRole("searchbox")).toHaveValue("hail mary");
    const hidden = [...container.querySelectorAll('input[type="hidden"]')].map((el) => [
      el.getAttribute("name"),
      el.getAttribute("value"),
    ]);
    // An empty value is not carried.
    expect(hidden).toEqual([["filter", "marian"]]);
  });

  it("shows the new search after an in-app navigation, even over half-typed text", () => {
    // Chips, page links and "Clear search" navigate without reloading, and the
    // page re-renders with the URL's query; the field must follow it.
    const { rerender } = renderBar({ query: "mary" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "half-typ" } });
    rerender(
      <ListSearch action="/prayers" query="rosary" label="Search prayers" t={en} locale="en" />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("rosary");
  });

  it("submits with Enter like any form", () => {
    renderBar();
    const form = screen.getByRole("search");
    let submitted = false;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitted = true;
    });
    fireEvent.submit(screen.getByRole("searchbox"));
    expect(submitted).toBe(true);
  });

  it("says how many items matched and offers to clear the search, keeping the filter", () => {
    renderBar({ query: "mary", keep: { filter: "marian" }, resultCount: 12 });
    expect(screen.getByText(/12 results for “mary”/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/prayers?filter=marian",
    );
  });

  it("speaks of one result in the singular", () => {
    renderBar({ query: "memorare", resultCount: 1 });
    expect(screen.getByText(/^1 result for “memorare”/)).toBeInTheDocument();
  });

  it.each([
    ["pl", 1, "1 wynik dla „mary”"],
    ["pl", 3, "3 wyniki dla „mary”"],
    ["pl", 5, "5 wyników dla „mary”"],
    ["pl", 22, "22 wyniki dla „mary”"],
    ["fr", 1, "1 résultat pour « mary »"],
    ["fr", 2, "2 résultats pour « mary »"],
    ["de", 1250, "1.250 Ergebnisse für „mary“"],
    ["es", 2, "2 resultados para «mary»"],
    ["tl", 2, "2 resulta para sa “mary”"],
    ["zh", 3, "“mary”共有 3 个结果"],
  ] as const)("in %s, %d match(es) read %j", (locale, count, line) => {
    renderBar({
      query: "mary",
      resultCount: count,
      t: createTranslator(locale as Locale),
      locale,
    });
    expect(screen.getByText(line, { exact: false })).toBeInTheDocument();
  });

  it("says nothing extra when there is no search, or nothing matched", () => {
    renderBar({ query: "", resultCount: 40 });
    expect(screen.queryByRole("link", { name: "Clear search" })).not.toBeInTheDocument();
    cleanup();
    renderBar({ query: "zzz", resultCount: 0 });
    expect(screen.queryByText(/results? for/)).not.toBeInTheDocument();
  });

  it("has no obvious accessibility violations", async () => {
    const { container } = renderBar({ query: "mary", resultCount: 3 });
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("ListSearchNoResults", () => {
  it("names the query, suggests a fix and links back to the unsearched list", async () => {
    const { container } = render(
      <ListSearchNoResults action="/saints" query="zzz" keep={{ filter: "martyrs" }} t={en} />,
    );
    expect(screen.getByText("Nothing here matches “zzz”.")).toBeInTheDocument();
    expect(screen.getByText("Try fewer words or a different spelling.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/saints?filter=martyrs",
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});

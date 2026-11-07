/**
 * @vitest-environment jsdom
 */
/**
 * The /search results page.
 *
 * The old page printed raw enum names ("CHURCH_DOCUMENT") as labels, reported
 * `hits.length` — capped at 50 — as the total, built its own URL map from
 * slugs, and had no pagination at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { SearchResults } from "@/lib/data/published";

const { searchPublishedPage, reader } = vi.hoisted(() => ({
  searchPublishedPage: vi.fn(),
  reader: { locale: "en" },
}));

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return { ...actual, searchPublishedPage };
});

vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("@/lib/i18n/translator");
  return {
    getTranslator: async () => ({
      t: createTranslator(reader.locale as "en"),
      locale: reader.locale,
    }),
  };
});

// React's request-scoped cache exists only in the server runtime Next.js brings.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

import SearchPage, { generateMetadata } from "@/app/search/page";

function results(overrides: Partial<SearchResults> = {}): SearchResults {
  return {
    query: "mary",
    total: 412,
    page: 1,
    pageSize: 25,
    pageCount: 17,
    indexed: true,
    hits: [],
    groups: [
      {
        contentType: "MARIAN_TITLE",
        label: "Our Lady",
        total: 200,
        items: [
          {
            id: "1",
            contentType: "MARIAN_TITLE",
            slug: "our-lady-of-lourdes",
            title: "Our Lady of Lourdes",
            subtitle: "Apparition at Lourdes, 1858",
            typeLabel: "Our Lady",
            href: "/our-lady/our-lady-of-lourdes",
            rank: 9,
          },
        ],
      },
      {
        contentType: "PRAYER",
        label: "Prayer",
        total: 212,
        items: [
          {
            id: "2",
            contentType: "PRAYER",
            slug: "hail-mary",
            title: "Hail Mary",
            subtitle: "The angelic salutation",
            typeLabel: "Prayer",
            href: "/prayers/hail-mary",
            rank: 8,
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function renderSearch(params: { q?: string | string[]; page?: string | string[] }) {
  return render(await SearchPage({ searchParams: Promise.resolve(params) }));
}

/** One group holding these hits, with the group's total across all pages. */
function oneGroup(
  subtitles: Array<string | null>,
  total: number | null,
  title = "Our Lady of the Rosary",
): SearchResults["groups"] {
  return [
    {
      contentType: "PRAYER",
      label: "Prayer",
      total,
      items: subtitles.map((subtitle, i) => ({
        id: String(i),
        contentType: "PRAYER",
        slug: `prayer-${i}`,
        title,
        subtitle: subtitle ?? "",
        typeLabel: "Prayer",
        href: `/prayers/prayer-${i}`,
        rank: 1,
      })),
    },
  ];
}

afterEach(() => {
  cleanup();
  searchPublishedPage.mockReset();
  reader.locale = "en";
});

describe("/search in the reader's language", () => {
  beforeEach(() => {
    reader.locale = "es";
  });

  it("says the page in the tab title, as every list page does", async () => {
    searchPublishedPage.mockResolvedValue(results({ page: 2 }));
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ q: "mary", page: "2" }),
    });
    expect(meta.title).toBe("412 resultados para «mary» · página 2 de 17");
  });

  it("heads a group with its type beside the count, not in English", async () => {
    searchPublishedPage.mockResolvedValue(results({ groups: oneGroup(["a", "b"], 24) }));
    await renderSearch({ q: "zz" });
    expect(screen.getByRole("heading", { level: 2, name: "Oración" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Prayer" })).not.toBeInTheDocument();
    expect(screen.getByText("2 de 24 resultados")).toBeInTheDocument();
  });

  it("says the page's own words in that language", async () => {
    const { container } = await renderSearch({});
    expect(screen.getByRole("heading", { level: 1, name: "Buscar" })).toBeInTheDocument();
    expect(container).toHaveTextContent("Busca oraciones, santos, guías");
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      "Oraciones, santos, parroquias…",
    );
  });

  it("says a failure in that language", async () => {
    searchPublishedPage.mockRejectedValue(new Error("down"));
    await renderSearch({ q: "mary" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La búsqueda no está disponible en este momento.",
    );
  });
});

describe("/search page", () => {
  it("groups results under human labels and never prints an enum or a slug", async () => {
    searchPublishedPage.mockResolvedValue(results());
    const { container } = await renderSearch({ q: "mary" });
    expect(screen.getByRole("heading", { name: "Our Lady" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prayer" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("MARIAN_TITLE");
    expect(container.textContent).not.toContain("our-lady-of-lourdes");
  });

  it("shows the true total from the database, not the number of rows on screen", async () => {
    searchPublishedPage.mockResolvedValue(results());
    await renderSearch({ q: "mary" });
    expect(screen.getByText(/412 results for/)).toBeInTheDocument();
  });

  it("says the outcome in the tab title, the first thing a screen reader reads", async () => {
    searchPublishedPage.mockResolvedValue(results());
    const meta = await generateMetadata({ searchParams: Promise.resolve({ q: "mary" }) });
    expect(meta.title).toBe("412 results for “mary”");
  });

  it("gives each result a heading of its own, inside its group", async () => {
    searchPublishedPage.mockResolvedValue(results());
    await renderSearch({ q: "mary" });
    const hit = screen.getByRole("heading", { level: 3, name: /Our Lady of Lourdes/ });
    expect(within(hit).getByRole("link")).toHaveAttribute("href", "/our-lady/our-lady-of-lourdes");
    expect(screen.getByRole("heading", { level: 2, name: "Our Lady" })).toBeInTheDocument();
  });

  it("says how many of a group's results are on this page when the rest are on others", async () => {
    // The rows of a group run across pages, because results are ranked as one list.
    // The count once said "9 results" on the first page of 24.
    searchPublishedPage.mockResolvedValue(results({ groups: oneGroup(["a", "b"], 24) }));
    await renderSearch({ q: "zz" });
    expect(screen.getByText("2 of 24 results")).toBeInTheDocument();
  });

  it("says the plain count when all of a group's results are here", async () => {
    searchPublishedPage.mockResolvedValue(results({ groups: oneGroup(["a", "b"], 2) }));
    await renderSearch({ q: "zz" });
    expect(screen.getByText("2 results")).toBeInTheDocument();
    cleanup();
    searchPublishedPage.mockResolvedValue(results({ groups: oneGroup(["a"], 1) }));
    await renderSearch({ q: "zz" });
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("says nothing rather than a false count when the total is not known", async () => {
    searchPublishedPage.mockResolvedValue(results({ groups: oneGroup(["a", "b"], null) }));
    const { container } = await renderSearch({ q: "zz" });
    expect(container.querySelector(".vf-result-count")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Prayer" })).toBeInTheDocument();
  });

  it("keeps each group's list a list in Safari, which drops it with the markers", async () => {
    searchPublishedPage.mockResolvedValue(results());
    const { container } = await renderSearch({ q: "mary" });
    const lists = [...container.querySelectorAll("ul.vf-result-list")];
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list).toHaveAttribute("role", "list");
  });

  it("names a result's link by its whole title, whatever the mark splits", async () => {
    // Where a line wrapped just before a <mark>, WebKit dropped the space and read
    // "The Sorrowful Mysteries of theRosary". The name must not come from the pieces.
    searchPublishedPage.mockResolvedValue(
      results({ groups: oneGroup([null], 1, "The Sorrowful Mysteries of the Rosary") }),
    );
    const { container } = await renderSearch({ q: "rosary" });
    const link = screen.getByRole("link", { name: "The Sorrowful Mysteries of the Rosary" });
    expect(link).toHaveAttribute("aria-label", "The Sorrowful Mysteries of the Rosary");
    expect(within(link).getByText("Rosary").tagName).toBe("MARK");
    expect(container.querySelector("h3")).toHaveTextContent(
      "The Sorrowful Mysteries of the Rosary",
    );
  });

  it("reads a line of details whole, without its dots and without a stop at each mark", async () => {
    searchPublishedPage.mockResolvedValue(
      results({ groups: oneGroup(["Memorial · October 7 · Rosary month"], 1) }),
    );
    const { container } = await renderSearch({ q: "rosary" });
    const line = container.querySelector(".vf-entry-meta")!;
    const [spoken, drawn] = [...line.children];
    expect(spoken).toHaveClass("sr-only");
    expect(spoken).toHaveTextContent("Memorial, October 7, Rosary month");
    expect(spoken.textContent).not.toContain("·");
    expect(drawn).toHaveAttribute("aria-hidden", "true");
    expect(drawn).toHaveTextContent("Memorial · October 7 · Rosary month");
    expect(drawn.querySelector("mark")).toHaveTextContent("Rosary");
  });

  it("leaves a line with nothing to cut as plain text", async () => {
    searchPublishedPage.mockResolvedValue(results({ groups: oneGroup(["Angelic salutation"], 1) }));
    const { container } = await renderSearch({ q: "zz" });
    const line = container.querySelector(".vf-entry-meta")!;
    expect(line.children).toHaveLength(0);
    expect(line).toHaveTextContent("Angelic salutation");
  });

  it("links each hit to the canonical href the data layer computed", async () => {
    searchPublishedPage.mockResolvedValue(results());
    await renderSearch({ q: "mary" });
    expect(screen.getByRole("link", { name: "Our Lady of Lourdes" })).toHaveAttribute(
      "href",
      "/our-lady/our-lady-of-lourdes",
    );
  });

  it("shows the subtitle that tells two similar results apart", async () => {
    searchPublishedPage.mockResolvedValue(results());
    await renderSearch({ q: "mary" });
    expect(screen.getByText(/Apparition at Lourdes/)).toBeInTheDocument();
  });

  it("marks the matched text", async () => {
    searchPublishedPage.mockResolvedValue(results());
    const { container } = await renderSearch({ q: "mary" });
    const marks = [...container.querySelectorAll("mark")].map((m) => m.textContent?.toLowerCase());
    expect(marks).toContain("mary");
  });

  it("paginates with crawlable ?page= links", async () => {
    searchPublishedPage.mockResolvedValue(results({ page: 2 }));
    await renderSearch({ q: "mary", page: "2" });
    expect(screen.getByRole("link", { name: "Page 1" })).toHaveAttribute("href", "/search?q=mary");
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/search?q=mary&page=3",
    );
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(searchPublishedPage).toHaveBeenCalledWith("mary", { page: 2, pageSize: 25 });
  });

  it("shows the last page for a ?page= past the end", async () => {
    searchPublishedPage
      .mockResolvedValueOnce(results({ page: 99, groups: [], hits: [] }))
      .mockResolvedValueOnce(results({ page: 17 }));
    await renderSearch({ q: "mary", page: "99" });
    expect(searchPublishedPage).toHaveBeenLastCalledWith("mary", { page: 17, pageSize: 25 });
    expect(screen.getByRole("heading", { name: "Our Lady" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 17" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the query in a labelled search field that submits back to /search", async () => {
    searchPublishedPage.mockResolvedValue(results());
    await renderSearch({ q: "mary" });
    const field = screen.getByRole("searchbox", { name: "Search" });
    expect(field).toHaveValue("mary");
    expect(field.closest("form")).toHaveAttribute("action", "/search");
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/search");
  });

  it("shows an empty state, not a bare page, when nothing matches", async () => {
    searchPublishedPage.mockResolvedValue(
      results({ total: 0, groups: [], pageCount: 1, hits: [] }),
    );
    await renderSearch({ q: "zzzq" });
    expect(screen.getByText(/Nothing here matches “zzzq”/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/search");
  });

  it("degrades to a message instead of throwing when the search backend fails", async () => {
    searchPublishedPage.mockRejectedValue(new Error("db down"));
    await renderSearch({ q: "mary" });
    expect(screen.getByRole("alert")).toHaveTextContent(/Search is unavailable right now/);
  });

  it("uses the first value when q repeats, as every list page does, in page and title", async () => {
    // ?q=a&q=b arrives as an array, and .trim() on it answered HTTP 500.
    searchPublishedPage.mockResolvedValue(results());
    await renderSearch({ q: ["mary", "joseph"] });
    expect(searchPublishedPage).toHaveBeenCalledWith("mary", { page: 1, pageSize: 25 });
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("mary");
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ q: ["mary", "joseph"] }),
    });
    expect(meta.title).toBe("412 results for “mary”");
  });

  it("uses the first value when page repeats", async () => {
    searchPublishedPage.mockResolvedValue(results({ page: 2 }));
    await renderSearch({ q: "mary", page: ["2", "3"] });
    expect(searchPublishedPage).toHaveBeenCalledWith("mary", { page: 2, pageSize: 25 });
  });

  it("never asks the database for a page beyond what an offset can hold", async () => {
    // Past the end is the last page. A number this size used to reach SQL as an
    // offset, fail there, and show "Search is unavailable".
    searchPublishedPage
      .mockResolvedValueOnce(results({ page: 1_000_000, groups: [], hits: [] }))
      .mockResolvedValueOnce(results({ page: 17 }));
    await renderSearch({ q: "mary", page: "99999999999999999999" });
    expect(searchPublishedPage).toHaveBeenNthCalledWith(1, "mary", {
      page: 1_000_000,
      pageSize: 25,
    });
    expect(searchPublishedPage).toHaveBeenLastCalledWith("mary", { page: 17, pageSize: 25 });
  });

  it("prompts rather than searching when there is no query", async () => {
    await renderSearch({});
    expect(searchPublishedPage).not.toHaveBeenCalled();
    expect(screen.getByText(/Search prayers, saints, guides/)).toBeInTheDocument();
  });
});

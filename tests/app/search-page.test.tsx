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
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { SearchResults } from "@/lib/data/published";

const { searchPublishedPage } = vi.hoisted(() => ({ searchPublishedPage: vi.fn() }));

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return { ...actual, searchPublishedPage };
});

vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (key: string) => key }),
}));

import SearchPage from "@/app/search/page";

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

async function renderSearch(params: { q?: string; page?: string }) {
  return render(await SearchPage({ searchParams: Promise.resolve(params) }));
}

afterEach(() => {
  cleanup();
  searchPublishedPage.mockReset();
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

  it("links each hit to the canonical href the data layer computed", async () => {
    searchPublishedPage.mockResolvedValue(results());
    await renderSearch({ q: "mary" });
    expect(screen.getByRole("link", { name: /Our Lady of Lourdes/ })).toHaveAttribute(
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
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/search?q=mary&page=1",
    );
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/search?q=mary&page=3",
    );
    expect(searchPublishedPage).toHaveBeenCalledWith("mary", { page: 2, pageSize: 25 });
  });

  it("shows an empty state, not a bare page, when nothing matches", async () => {
    searchPublishedPage.mockResolvedValue(
      results({ total: 0, groups: [], pageCount: 1, hits: [] }),
    );
    await renderSearch({ q: "zzzq" });
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  it("degrades to a message instead of throwing when the search backend fails", async () => {
    searchPublishedPage.mockRejectedValue(new Error("db down"));
    await renderSearch({ q: "mary" });
    expect(screen.getByText(/Search is unavailable right now/)).toBeInTheDocument();
  });

  it("prompts rather than searching when there is no query", async () => {
    await renderSearch({});
    expect(searchPublishedPage).not.toHaveBeenCalled();
    expect(screen.getByText(/Search prayers, saints, guides/)).toBeInTheDocument();
  });
});

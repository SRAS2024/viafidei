/**
 * @vitest-environment jsdom
 */
/**
 * The public list pages after PUB-3 / PUB-1 / PUB-10.
 *
 * What these prove, all of which were broken before:
 *   - a list page asks the database for ONE page (skip/take in SQL) instead of
 *     loading the whole content type and slicing it in the browser;
 *   - the page numbers are real `?page=` links, so a crawler can reach page 2
 *     and the back button works;
 *   - a filter chip appears only when the indexed subtype count says it has
 *     content, and filtering pushes the subtype into the query;
 *   - /saints comes back chronologically ordered by SQL;
 *   - /litanies filters on the indexed subtype, not by re-categorising every
 *     prayer in the library;
 *   - /parishes ships one page of the directory, never the whole table;
 *   - the homepage's featured rail rotates daily and shows category LABELS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { PublishedListItem } from "@/lib/data/published";

const listPublishedPage = vi.fn();
const listParishPage = vi.fn();
const countPublishedBySubtype = vi.fn();
const listPublished = vi.fn();
const listFeaturedPrayers = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listPublishedPage: (...args: unknown[]) => listPublishedPage(...args),
  listParishPage: (...args: unknown[]) => listParishPage(...args),
  countPublishedBySubtype: (...args: unknown[]) => countPublishedBySubtype(...args),
  listPublished: (...args: unknown[]) => listPublished(...args),
  listFeaturedPrayers: (...args: unknown[]) => listFeaturedPrayers(...args),
}));

vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (key: string) => key }),
}));

import SaintsPage from "@/app/saints/page";
import GuidesPage from "@/app/guides/page";
import LitaniesPage from "@/app/litanies/page";
import ParishesPage from "@/app/parishes/page";
import LiturgyPage from "@/app/liturgy/page";

function projected(over: Partial<PublishedListItem> & { id: string }): PublishedListItem {
  return {
    contentType: "SAINT",
    slug: over.id,
    title: over.id,
    subtitle: "A saint of the Catholic Church",
    subtype: null,
    href: `/saints/${over.id}`,
    ...over,
  };
}

const page = <T,>(
  items: T[],
  over: Partial<{ total: number; page: number; pageCount: number }> = {},
) => ({
  items,
  total: over.total ?? items.length,
  page: over.page ?? 1,
  pageSize: 30,
  pageCount: over.pageCount ?? 1,
});

beforeEach(() => {
  listPublishedPage.mockReset();
  listParishPage.mockReset();
  countPublishedBySubtype.mockReset();
  listPublished.mockReset();
  listFeaturedPrayers.mockReset();
  countPublishedBySubtype.mockResolvedValue({});
  listPublished.mockResolvedValue([]);
});
afterEach(() => cleanup());

const hrefs = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("/saints", () => {
  it("asks for one chronologically-ordered SQL page and links the next one", async () => {
    listPublishedPage.mockResolvedValue(
      page([projected({ id: "peter", title: "St. Peter", subtype: "apostle" })], {
        total: 1896,
        page: 2,
        pageCount: 64,
      }),
    );
    countPublishedBySubtype.mockResolvedValue({ apostle: 39, martyr: 407 });

    render(await SaintsPage({ searchParams: Promise.resolve({ page: "2" }) }));

    expect(listPublishedPage).toHaveBeenCalledWith("SAINT", {
      page: 2,
      pageSize: 30,
      subtype: null,
      order: "chronological",
    });
    // Real, crawlable page links — not client-side buttons.
    expect(hrefs()).toContain("/saints?page=3");
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    // The one permitted title label, never the stored `apostle`.
    expect(screen.getByText("Apostle and Disciple of Jesus")).toBeInTheDocument();
    expect(screen.queryByText("apostle")).not.toBeInTheDocument();
  });

  it("shows a category chip only when the indexed counts say it has content", async () => {
    listPublishedPage.mockResolvedValue(page([projected({ id: "agnes", title: "St. Agnes" })]));
    countPublishedBySubtype.mockResolvedValue({ martyr: 407 });

    render(await SaintsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Martyrs/ })).toBeInTheDocument();
    // No apostles published → no Apostles chip.
    expect(screen.queryByRole("link", { name: /Apostles/ })).not.toBeInTheDocument();
  });

  it("pushes the chosen category into the SQL query as stored subtypes", async () => {
    listPublishedPage.mockResolvedValue(page([]));
    countPublishedBySubtype.mockResolvedValue({ religious: 307, founder: 177 });

    render(await SaintsPage({ searchParams: Promise.resolve({ filter: "religious" }) }));

    expect(listPublishedPage).toHaveBeenCalledWith("SAINT", {
      page: 1,
      pageSize: 30,
      subtype: ["religious", "founder", "missionary"],
      order: "chronological",
    });
  });
});

describe("/guides", () => {
  it("renders one page of guides with human eyebrows and a crawlable next page", async () => {
    const guides = Array.from({ length: 35 }, (_, i) => ({
      id: `g${i}`,
      checklistItemId: `g${i}`,
      contentType: "GUIDE" as const,
      slug: `g${i}`,
      title: `Guide ${i}`,
      subtitle: "A guide",
      payload: { kind: i === 0 ? "lent_preparation" : "general", summary: `Summary ${i}` },
      authorityLevel: "VATICAN",
      version: 1,
      publishedAt: new Date(),
    }));
    listPublished.mockResolvedValue(guides);
    countPublishedBySubtype.mockResolvedValue({ lent_preparation: 1, general: 34 });

    render(await GuidesPage({ searchParams: Promise.resolve({}) }));

    // 35 guides / 30 per page → only the first 30 cards are rendered.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(30);
    expect(hrefs()).toContain("/guides?page=2");
    // G-08: the eyebrow is the human label, never the stored enum.
    expect(screen.getByText("Lent")).toBeInTheDocument();
    expect(screen.queryByText("lent_preparation")).not.toBeInTheDocument();
  });
});

describe("/litanies", () => {
  it("filters on the indexed subtype instead of re-categorising every prayer", async () => {
    listPublishedPage.mockResolvedValue(
      page(
        [
          projected({
            id: "loreto",
            title: "Litany of Loreto",
            contentType: "PRAYER",
            subtype: "litany",
          }),
        ],
        { total: 40, pageCount: 2 },
      ),
    );

    render(await LitaniesPage({ searchParams: Promise.resolve({}) }));

    expect(listPublishedPage).toHaveBeenCalledWith("PRAYER", {
      page: 1,
      pageSize: 30,
      subtype: "litany",
    });
    expect(listPublished).not.toHaveBeenCalled();
    expect(screen.getByText("Litany")).toBeInTheDocument();
    // Cards link into the prayer detail route, which is where litanies live.
    expect(hrefs()).toContain("/prayers/loreto");
    expect(hrefs()).toContain("/litanies?page=2");
  });
});

describe("/parishes", () => {
  it("ships one page of the directory and keeps the filter + query on the page links", async () => {
    listParishPage.mockResolvedValue(
      page(
        [
          {
            id: "p1",
            slug: "st-mary",
            title: "St. Mary",
            subtitle: "A Catholic parish",
            designation: "minor-basilica",
            location: "Chicago, IL",
            city: "Chicago",
            state: "IL",
            country: "US",
            latitude: 41.9,
            longitude: -87.6,
            href: "/parishes/st-mary",
          },
        ],
        { total: 970, pageCount: 33 },
      ),
    );
    countPublishedBySubtype.mockResolvedValue({ parish: 970, "minor-basilica": 25 });

    render(await ParishesPage({ searchParams: Promise.resolve({ class: "basilica", q: "mary" }) }));

    expect(listParishPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 30,
      q: "mary",
      class: ["major-basilica", "minor-basilica", "basilica"],
    });
    expect(hrefs()).toContain("/parishes?class=basilica&q=mary&page=2");
    // Chips reflect the indexed counts: no cathedrals published → no chip.
    expect(screen.queryByRole("link", { name: /Cathedrals/ })).not.toBeInTheDocument();
    // The owner removed the designation from the parish card: the directory
    // card and the parish page are now the same ParishCard, which shows the
    // name, the place, the address and the website and nothing else. The raw
    // stored value was never shown and still is not.
    expect(screen.getByRole("heading", { name: "St. Mary" })).toBeInTheDocument();
    expect(screen.queryByText("minor-basilica")).not.toBeInTheDocument();
    // No location: the visitor has not located themselves, so no distance.
    expect(screen.queryByText(/away$/)).not.toBeInTheDocument();
  });

  it("says so plainly when a search matches nothing", async () => {
    listParishPage.mockResolvedValue(page([], { total: 0 }));
    render(await ParishesPage({ searchParams: Promise.resolve({ q: "zzzz" }) }));
    expect(screen.getByText(/No parishes match/)).toBeInTheDocument();
  });
});

describe("/liturgy chips", () => {
  const entry = (kind: string) => ({
    id: kind,
    checklistItemId: kind,
    contentType: "LITURGICAL" as const,
    slug: kind,
    title: `Entry ${kind.length}`,
    subtitle: "A liturgical entry",
    payload: { kind, summary: "Summary" },
    authorityLevel: "VATICAN",
    version: 1,
    publishedAt: new Date(),
  });

  it("shows a chip from the indexed counts and humanises the kind on the card", async () => {
    listPublished.mockResolvedValue([entry("liturgical_season")]);
    countPublishedBySubtype.mockResolvedValue({ liturgical_season: 6 });

    render(await LiturgyPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Seasons/ })).toBeInTheDocument();
    expect(screen.getByText("Liturgical season")).toBeInTheDocument();
    expect(screen.queryByText("liturgical_season")).not.toBeInTheDocument();
  });

  it("fails open: a chip with published content still appears when the counts miss it", async () => {
    // The counts come from the indexed subtype column; if a row was published
    // before that column existed, the chip must not disappear on the reader.
    listPublished.mockResolvedValue([entry("solemnity")]);
    countPublishedBySubtype.mockResolvedValue({});

    render(await LiturgyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: /Feasts & Solemnities/ })).toBeInTheDocument();
  });
});

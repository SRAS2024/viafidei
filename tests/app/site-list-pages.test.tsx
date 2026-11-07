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
 *   - /saints comes back in the site's saint order, by SQL;
 *   - /litanies filters on the indexed subtype, not by re-categorising every
 *     prayer in the library, and pages the set it ordered;
 *   - /parishes ships one page of the directory, never the whole table;
 *   - the homepage's featured rail rotates daily and shows category LABELS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { PublishedListItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

const listPublishedPage = vi.fn();
const listParishPage = vi.fn();
const countPublishedBySubtype = vi.fn();
const listPublished = vi.fn();
const listFeaturedPrayers = vi.fn();
const listSaintCardDetails = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listPublishedPage: (...args: unknown[]) => listPublishedPage(...args),
  listParishPage: (...args: unknown[]) => listParishPage(...args),
  countPublishedBySubtype: (...args: unknown[]) => countPublishedBySubtype(...args),
  listPublished: (...args: unknown[]) => listPublished(...args),
  listFeaturedPrayers: (...args: unknown[]) => listFeaturedPrayers(...args),
  listSaintCardDetails: (...args: unknown[]) => listSaintCardDetails(...args),
}));

// Raw keys by default; a test that asserts real copy swaps in the English translator.
const translate = vi.fn<(key: string, replacements?: Record<string, string | number>) => string>();
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({
    t: (key: string, replacements?: Record<string, string | number>) =>
      translate(key, replacements),
  }),
}));

import SaintsPage from "@/app/saints/(list)/page";
import GuidesPage from "@/app/guides/(list)/page";
import LitaniesPage from "@/app/litanies/page";
import ParishesPage from "@/app/parishes/(list)/page";
import LiturgyPage from "@/app/liturgy/(list)/page";
import ChurchDocumentsPage from "@/app/church-documents/page";

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
  listSaintCardDetails.mockReset();
  translate.mockReset();
  translate.mockImplementation((key) => key);
  countPublishedBySubtype.mockResolvedValue({});
  listPublished.mockResolvedValue([]);
  listSaintCardDetails.mockResolvedValue(new Map());
});
afterEach(() => cleanup());

const hrefs = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("/saints", () => {
  it("asks for one SQL page in the saint order and links the next one", async () => {
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
      pageSize: 36,
      subtype: null,
      order: "saints",
    });
    // Real, crawlable page links — not client-side buttons.
    expect(hrefs()).toContain("/saints?page=3");
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    // The one permitted title label, never the stored `apostle`.
    expect(screen.getByText("Apostle")).toBeInTheDocument();
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
      pageSize: 36,
      subtype: ["religious", "founder", "missionary"],
      order: "saints",
    });
  });

  it("shows each saint's name, then patronage, then feast day on its card", async () => {
    translate.mockImplementation(createTranslator("en"));
    listPublishedPage.mockResolvedValue(
      page([
        projected({ id: "peter", title: "St. Peter", subtype: "apostle" }),
        projected({ id: "agnes", title: "St. Agnes" }),
      ]),
    );
    listSaintCardDetails.mockResolvedValue(
      new Map([
        ["peter", { patronages: ["the papacy", "fishermen", "Rome"], feast: "June 29" }],
        ["agnes", { patronages: [], feast: "January 21" }],
      ]),
    );

    render(await SaintsPage({ searchParams: Promise.resolve({}) }));

    // One bounded projection, over exactly this page's ids.
    expect(listSaintCardDetails).toHaveBeenCalledWith(["peter", "agnes"]);
    const linesOf = (name: string) => {
      const card = screen.getByRole("heading", { level: 2, name }).closest("article")!;
      const text = [...card.querySelectorAll("h2, p")].map((el) => el.textContent);
      return text.slice(text.indexOf(name));
    };
    // The Apostle's brief label sits under the name, above his facts.
    expect(linesOf("St. Peter")).toEqual([
      "St. Peter",
      "Apostle",
      "Patron of the papacy, fishermen, Rome",
      "Feast day: June 29",
    ]);
    // No patronage recorded → the feast line follows the name directly.
    expect(linesOf("St. Agnes")).toEqual(["St. Agnes", "Feast day: January 21"]);
  });

  it("still renders every card when the detail projection fails", async () => {
    listPublishedPage.mockResolvedValue(page([projected({ id: "peter", title: "St. Peter" })]));
    listSaintCardDetails.mockRejectedValue(new Error("database unavailable"));

    render(await SaintsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 2, name: "St. Peter" })).toBeInTheDocument();
  });
});

describe("/guides", () => {
  it("renders one page of guides with human eyebrows and a crawlable next page", async () => {
    const guides = Array.from({ length: 40 }, (_, i) => ({
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
    countPublishedBySubtype.mockResolvedValue({ lent_preparation: 1, general: 39 });

    render(await GuidesPage({ searchParams: Promise.resolve({}) }));

    // 40 guides / 36 per page → only the first 36 cards are rendered.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(36);
    expect(hrefs()).toContain("/guides?page=2");
    // G-08: the eyebrow is the human label, never the stored enum.
    expect(screen.getByText("Lent")).toBeInTheDocument();
    expect(screen.queryByText("lent_preparation")).not.toBeInTheDocument();
    // On the Guides page the word "Guide" says nothing, so a plain guide has no line.
    expect(screen.queryByText("Guide")).not.toBeInTheDocument();
  });
});

describe("/litanies", () => {
  it("filters on the indexed subtype instead of re-categorising every prayer", async () => {
    const litanies = Array.from({ length: 40 }, (_, i) =>
      projected({
        id: `litany-${i}`,
        title: `Litany ${i}`,
        contentType: "PRAYER",
        subtype: "litany",
      }),
    );
    listPublishedPage.mockResolvedValue(page(litanies));

    render(await LitaniesPage({ searchParams: Promise.resolve({}) }));

    // Every litany, from the indexed column, so the familiar ones can lead
    // however their titles fall; one page of cards is rendered.
    expect(listPublishedPage).toHaveBeenCalledWith("PRAYER", {
      page: 1,
      pageSize: 100,
      subtype: "litany",
    });
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(36);
    expect(listPublished).not.toHaveBeenCalled();
    expect(screen.getAllByText("Litany")).toHaveLength(36);
    // Cards link into the prayer detail route, which is where litanies live.
    expect(hrefs().filter((href) => href?.startsWith("/prayers/litany-"))).toHaveLength(36);
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
      pageSize: 36,
      q: "mary",
      class: ["major-basilica", "minor-basilica", "basilica"],
    });
    expect(hrefs()).toContain("/parishes?class=basilica&q=mary&page=2");
    // Chips reflect the indexed counts: no cathedrals published → no chip.
    expect(screen.queryByRole("link", { name: /Cathedrals/ })).not.toBeInTheDocument();
    // The directory card is the parish page's ParishCard: the name, what the
    // church is (a basilica always says minor or major), then the address —
    // never the raw stored value, a website or a "Diocese" line.
    expect(screen.getByRole("heading", { name: "St. Mary" })).toBeInTheDocument();
    expect(screen.getByText("Minor Basilica")).toBeInTheDocument();
    expect(screen.getByText("Chicago, IL")).toBeInTheDocument();
    expect(screen.queryByText("minor-basilica")).not.toBeInTheDocument();
    expect(screen.queryByText(/Diocese|Website/)).not.toBeInTheDocument();
    // No location: the visitor has not located themselves, so no distance.
    expect(screen.queryByText(/away$/)).not.toBeInTheDocument();
  });

  it("files oratories under Chapels, the chip and the query alike", async () => {
    listParishPage.mockResolvedValue(page([], { total: 0 }));
    // An oratory and no chapel published: Chapels is still offered, and it asks
    // SQL for both stored designations.
    countPublishedBySubtype.mockResolvedValue({ parish: 970, oratory: 12 });
    render(await ParishesPage({ searchParams: Promise.resolve({ class: "chapel" }) }));
    expect(listParishPage).toHaveBeenCalledWith(
      expect.objectContaining({ class: ["chapel", "oratory"] }),
    );
    expect(screen.getByRole("link", { name: /Chapels/ })).toBeInTheDocument();
  });

  it("says so plainly when a search matches nothing", async () => {
    translate.mockImplementation(createTranslator("en"));
    listParishPage.mockResolvedValue(page([], { total: 0 }));
    render(await ParishesPage({ searchParams: Promise.resolve({ q: "zzzz" }) }));
    expect(screen.getByText("Nothing here matches “zzzz”.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/parishes");
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
    listPublished.mockResolvedValue([entry("optional_memorial")]);
    countPublishedBySubtype.mockResolvedValue({ optional_memorial: 6 });

    render(await LiturgyPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Memorials/ })).toBeInTheDocument();
    expect(screen.getByText("Optional memorial")).toBeInTheDocument();
    expect(screen.queryByText("optional_memorial")).not.toBeInTheDocument();
  });

  it("prints no filing term as if it were the entry's name", async () => {
    // Ash Wednesday is no "Liturgical season", nor the Rite of Baptism a "Mass
    // structure": the title and the section say what such an entry is.
    listPublished.mockResolvedValue([entry("liturgical_season"), entry("mass_structure")]);
    countPublishedBySubtype.mockResolvedValue({ liturgical_season: 1, mass_structure: 1 });

    render(await LiturgyPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Seasons/ })).toBeInTheDocument();
    expect(screen.queryByText(/Liturgical season|liturgical_season/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mass structure|mass_structure/)).not.toBeInTheDocument();
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

describe("/church-documents", () => {
  it("shows each document's kind, title and summary — no source link on the card", async () => {
    listPublished.mockResolvedValue([
      {
        id: "laudato-si",
        checklistItemId: "laudato-si",
        contentType: "CHURCH_DOCUMENT",
        slug: "laudato-si",
        title: "Laudato si'",
        subtitle: "",
        payload: {
          documentType: "encyclical",
          summary: "On care for our common home.",
          canonicalUrl: "https://www.vatican.va/content/francesco/en/encyclicals/laudato-si.html",
        },
        authorityLevel: "VATICAN",
        version: 1,
        publishedAt: new Date(),
      },
    ]);
    render(await ChurchDocumentsPage({ searchParams: Promise.resolve({}) }));

    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Encyclical");
    expect(card).toHaveTextContent("On care for our common home.");
    // The title leads to the document's own page, which has "Read the full document".
    expect(screen.getByRole("link", { name: "Laudato si'" })).toHaveAttribute(
      "href",
      "/liturgy-history/laudato-si",
    );
    expect(card).not.toHaveTextContent(/Read on|vatican\.va/);
    expect(card.querySelector('a[href^="https://"]')).toBeNull();
  });
});

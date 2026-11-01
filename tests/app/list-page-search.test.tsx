/**
 * @vitest-environment jsdom
 */
/**
 * Every content list page has a search bar that works when it is pressed.
 *
 * The owner asked for one on every content-type page except the sacraments,
 * the history timeline and the liturgical calendar. Each bar is the same GET
 * form back to its own page, so the search is a `?q=` URL rendered on the
 * server: the page shows only the matching items of ITS type, says how many,
 * keeps its filter and its paging, and says plainly when nothing matches.
 * The small types are filtered over the rows the page already reads; the
 * large ones (saints, litanies, parishes) hand the query to SQL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import type { PublishedItem, PublishedListItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

const listPublished = vi.fn();
const listPublishedPage = vi.fn();
const listParishPage = vi.fn();
const countPublishedBySubtype = vi.fn();
const listSaintCardDetails = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listPublished: (...args: unknown[]) => listPublished(...args),
  listPublishedPage: (...args: unknown[]) => listPublishedPage(...args),
  listParishPage: (...args: unknown[]) => listParishPage(...args),
  countPublishedBySubtype: (...args: unknown[]) => countPublishedBySubtype(...args),
  listSaintCardDetails: (...args: unknown[]) => listSaintCardDetails(...args),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en"), locale: "en" }),
}));
vi.mock("@/lib/translation/localize", () => ({
  localizeItems: async (items: unknown[]) => items,
  localizeParishes: async (items: unknown[]) => items,
}));
vi.mock("@/lib/i18n/rite-cookie", () => ({ getRiteCookieValue: async () => "roman" }));
vi.mock("@/lib/data/history-timeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/history-timeline")>(
    "@/lib/data/history-timeline",
  );
  return {
    ...actual,
    loadHistoryTimeline: async () =>
      actual.timelineFromInputs({
        documents: [],
        publishedSlugs: { popes: [], saints: [], doctors: [], apparitions: [] },
      }),
  };
});

import PrayersPage from "@/app/prayers/page";
import LitaniesPage from "@/app/litanies/page";
import SaintsPage from "@/app/saints/page";
import OurLadyPage from "@/app/our-lady/page";
import DoctorsPage from "@/app/doctors/page";
import PopesPage from "@/app/popes/page";
import ParishesPage from "@/app/parishes/page";
import SpiritualLifePage from "@/app/spiritual-life/page";
import GuidesPage from "@/app/guides/page";
import LiturgyPage from "@/app/liturgy/page";
import RitesPage from "@/app/rites/page";
import ChurchDocumentsPage from "@/app/church-documents/page";
import DevotionsPage from "@/app/devotions/page";
import NovenasPage from "@/app/novenas/page";
import SacramentsPage from "@/app/sacraments/page";
import HistoryPage from "@/app/history/page";
import LiturgicalCalendarPage from "@/app/liturgical-calendar/page";

type ContentType = PublishedItem["contentType"];

function published(
  contentType: ContentType,
  title: string,
  payload: Record<string, unknown> = {},
  subtitle = "",
): PublishedItem {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `${contentType}-${slug}`,
    checklistItemId: slug,
    contentType,
    slug,
    title,
    subtitle,
    payload,
    authorityLevel: "VATICAN",
    version: 1,
    publishedAt: new Date("2026-01-01"),
  };
}

function projected(
  contentType: ContentType,
  title: string,
  over: Partial<PublishedListItem> = {},
): PublishedListItem {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: slug,
    contentType,
    slug,
    title,
    subtitle: "",
    subtype: null,
    href: `/x/${slug}`,
    ...over,
  };
}

const onePage = <T,>(items: T[], total = items.length) => ({
  items,
  total,
  page: 1,
  pageSize: 30,
  pageCount: Math.max(1, Math.ceil(total / 30)),
});

/** Each small type's rows, keyed by content type, for `listPublished`. */
const CATALOGUE: Partial<Record<ContentType, PublishedItem[]>> = {
  PRAYER: [
    published("PRAYER", "Hail Mary", { body: "Hail Mary, full of grace…", category: "marian" }),
    published("PRAYER", "Memorare", { body: "Remember, O most gracious Virgin Mary…" }),
    published("PRAYER", "Glory Be", { body: "Glory be to the Father…" }),
  ],
  POPE: [
    published("POPE", "Pope St. John Paul II", { papacyStart: "1978", papacyEnd: "2005" }),
    published("POPE", "Pope Leo XIII", { papacyStart: "1878", papacyEnd: "1903" }),
    published("POPE", "Pope St. Peter", { papacyStart: "30", papacyEnd: "64" }),
  ],
  DOCTOR: [
    published("DOCTOR", "St. Thomas Aquinas", { doctorTitle: "Angelic Doctor" }),
    published("DOCTOR", "St. Thérèse of Lisieux", { doctorTitle: "Doctor of Merciful Love" }),
  ],
  NOVENA: [
    published("NOVENA", "Novena to St. Jude", { intentionTheme: "hopeless_causes" }),
    published("NOVENA", "Divine Mercy Novena", { summary: "Nine days before Mercy Sunday." }),
  ],
  DEVOTION: [
    published("DEVOTION", "The Brown Scapular", { devotionType: "sacramental" }),
    published("DEVOTION", "First Fridays", { summary: "Devotion to the Sacred Heart." }),
  ],
  GUIDE: [
    published("GUIDE", "How to Pray the Rosary", {
      kind: "prayer_method",
      summary: "Step by step.",
    }),
    published("GUIDE", "Preparing for Lent", { kind: "lent_preparation", summary: "Fasting." }),
  ],
  SPIRITUAL_PRACTICE: [
    published("SPIRITUAL_PRACTICE", "Lectio Divina", { practiceKind: "lectio_divina" }),
    published("SPIRITUAL_PRACTICE", "Fasting", { practiceKind: "fasting" }),
  ],
  LITURGICAL: [
    published("LITURGICAL", "Christmas", { kind: "solemnity", summary: "The Nativity." }),
    published("LITURGICAL", "Advent", { kind: "liturgical_season", summary: "Four weeks." }),
  ],
  RITE: [
    published("RITE", "Roman Rite", { family: "latin", history: "The rite of Rome." }),
    published("RITE", "Byzantine Rite", { family: "byzantine", history: "Of Constantinople." }),
  ],
  CHURCH_DOCUMENT: [
    published("CHURCH_DOCUMENT", "Rerum Novarum", {
      documentType: "encyclical",
      issuedDate: "1891-05-15",
      summary: "On capital and labour.",
    }),
    published("CHURCH_DOCUMENT", "Lumen Gentium", {
      documentType: "council_document",
      summary: "Dogmatic constitution on the Church.",
    }),
  ],
  MARIAN_TITLE: [
    published("MARIAN_TITLE", "Queen of Peace", { summary: "Regina pacis." }),
    published("MARIAN_TITLE", "Star of the Sea", { summary: "Stella maris." }),
  ],
  APPARITION: [
    published("APPARITION", "Our Lady of Lourdes", {
      location: "Lourdes",
      country: "France",
      yearOfApparition: 1858,
    }),
    published("APPARITION", "Our Lady of Fatima", { location: "Fátima", country: "Portugal" }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  listPublished.mockImplementation(async (type: ContentType) => CATALOGUE[type] ?? []);
  countPublishedBySubtype.mockResolvedValue({});
  listSaintCardDetails.mockResolvedValue(new Map());
  listPublishedPage.mockResolvedValue(onePage([]));
  listParishPage.mockResolvedValue(onePage([]));
});
afterEach(() => cleanup());

type Page = (props: { searchParams: Promise<Record<string, string>> }) => Promise<JSX.Element>;

async function show(page: Page, params: Record<string, string> = {}) {
  render(await page({ searchParams: Promise.resolve(params) }));
}

const titles = () => screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const hrefs = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));
const searchBar = () => screen.getByRole("search");

/** The pages searched over the rows they already read, with a hit and a miss each. */
const IN_MEMORY: Array<{
  name: string;
  page: Page;
  path: string;
  label: string;
  query: string;
  expect: string[];
}> = [
  {
    name: "prayers",
    page: PrayersPage as Page,
    path: "/prayers",
    label: "Search prayers",
    query: "full of grace",
    expect: ["Hail Mary"],
  },
  {
    name: "popes",
    page: PopesPage as Page,
    path: "/popes",
    label: "Search popes",
    query: "1978",
    expect: ["Pope St. John Paul II"],
  },
  {
    name: "doctors",
    page: DoctorsPage as Page,
    path: "/doctors",
    label: "Search the Doctors of the Church",
    query: "angelic",
    expect: ["St. Thomas Aquinas"],
  },
  {
    name: "novenas",
    page: NovenasPage as Page,
    path: "/novenas",
    label: "Search novenas",
    query: "saint jude",
    expect: ["Novena to St. Jude"],
  },
  {
    name: "devotions",
    page: DevotionsPage as Page,
    path: "/devotions",
    label: "Search devotions",
    query: "sacred heart",
    expect: ["First Fridays"],
  },
  {
    name: "guides",
    page: GuidesPage as Page,
    path: "/guides",
    label: "Search guides",
    query: "rosary",
    expect: ["How to Pray the Rosary"],
  },
  {
    name: "spiritual life",
    page: SpiritualLifePage as Page,
    path: "/spiritual-life",
    label: "Search spiritual practices",
    query: "lectio",
    expect: ["Lectio Divina"],
  },
  {
    name: "liturgy",
    page: LiturgyPage as Page,
    path: "/liturgy",
    label: "Search the liturgy",
    query: "nativity",
    expect: ["Christmas"],
  },
  {
    name: "rites",
    page: RitesPage as Page,
    path: "/rites",
    label: "Search rites",
    query: "constantinople",
    expect: ["Byzantine Rite"],
  },
  {
    name: "Church documents",
    page: ChurchDocumentsPage as Page,
    path: "/church-documents",
    label: "Search Church documents",
    query: "1891",
    expect: ["Rerum Novarum"],
  },
  {
    name: "Our Lady",
    page: OurLadyPage as Page,
    path: "/our-lady",
    label: "Search titles and apparitions",
    query: "stella maris",
    expect: ["Star of the Sea"],
  },
];

describe.each(IN_MEMORY)("/$name search", ({ page, path, label, query, expect: hits }) => {
  it("renders the shared search bar, submitting ?q= back to the page", async () => {
    await show(page);
    const form = searchBar();
    expect(form).toHaveAccessibleName(label);
    expect(form).toHaveAttribute("action", path);
    expect(within(form).getByRole("searchbox", { name: label })).toHaveAttribute("name", "q");
    expect(within(form).getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it(`filters the page to the matching items for “${query}”`, async () => {
    await show(page, { q: query });
    expect(titles().filter((t) => t !== "Marian Titles" && t !== "Approved Apparitions")).toEqual(
      hits,
    );
    expect(screen.getByRole("searchbox")).toHaveValue(query);
    expect(screen.getByText(new RegExp(`^${hits.length} results? for “${query}”`))).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", path);
  });

  it("says so plainly when nothing matches, with a way back", async () => {
    await show(page, { q: "zzzzqx" });
    expect(screen.getByText("Nothing here matches “zzzzqx”.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", path);
    expect(titles().filter((t) => t !== "Marian Titles" && t !== "Approved Apparitions")).toEqual(
      [],
    );
  });
});

describe("searching keeps the page's filter and paging", () => {
  it("carries the filter in the form and the search in every chip and page link", async () => {
    const many = Array.from({ length: 35 }, (_, i) =>
      published("PRAYER", `Prayer to Mary ${i + 1}`, { category: "marian", body: "Ave." }),
    );
    listPublished.mockImplementation(async () => many);
    await show(PrayersPage as Page, { q: "mary", filter: "marian" });

    // The filter rides along as a hidden field…
    const hidden = searchBar().querySelector('input[type="hidden"][name="filter"]');
    expect(hidden).toHaveAttribute("value", "marian");
    // …and the search rides along on the chips and the page links.
    expect(hrefs()).toContain("/prayers?filter=marian&q=mary&page=2");
    expect(hrefs()).toContain("/prayers?q=mary");
    expect(titles()).toHaveLength(30);
    expect(screen.getByText(/^35 results for “mary”/)).toBeInTheDocument();
    // Clearing the search keeps the filter.
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/prayers?filter=marian",
    );
  });

  it("searches Our Lady's titles and apparitions together from the default view", async () => {
    await show(OurLadyPage as Page, { q: "lourdes" });
    expect(titles()).toEqual(["Approved Apparitions", "Our Lady of Lourdes"]);
    // An explicit filter is kept, and narrows the search.
    cleanup();
    await show(OurLadyPage as Page, { q: "lourdes", filter: "titles" });
    expect(screen.getByText("Nothing here matches “lourdes”.")).toBeInTheDocument();
    expect(searchBar().querySelector('input[name="filter"]')).toHaveAttribute("value", "titles");
  });
});

describe("the large types search in SQL", () => {
  it("/saints hands the search and the category to the database", async () => {
    listPublishedPage.mockResolvedValue(
      onePage([projected("SAINT", "St. Nicholas", { subtype: "bishop" })], 1),
    );
    await show(SaintsPage as Page, { q: "sailors", filter: "bishops" });
    expect(listPublishedPage).toHaveBeenCalledWith(
      "SAINT",
      expect.objectContaining({ q: "sailors", order: "chronological" }),
    );
    expect(searchBar()).toHaveAccessibleName("Search saints");
    expect(titles()).toEqual(["St. Nicholas"]);
    expect(screen.getByText(/^1 result for “sailors”/)).toBeInTheDocument();
  });

  it("/saints says so when the database finds nothing", async () => {
    await show(SaintsPage as Page, { q: "zzzzqx" });
    expect(screen.getByText("Nothing here matches “zzzzqx”.")).toBeInTheDocument();
    expect(screen.queryByText("No saints in this category yet.")).not.toBeInTheDocument();
  });

  it("/litanies searches inside the litany subtype and keeps the search on its pages", async () => {
    listPublishedPage.mockResolvedValue(
      onePage([projected("PRAYER", "Litany of Loreto", { subtype: "litany" })], 45),
    );
    await show(LitaniesPage as Page, { q: "loreto" });
    expect(listPublishedPage).toHaveBeenCalledWith(
      "PRAYER",
      expect.objectContaining({ subtype: "litany", q: "loreto" }),
    );
    expect(searchBar()).toHaveAccessibleName("Search litanies");
    expect(hrefs()).toContain("/litanies?q=loreto&page=2");
  });

  it("/litanies says so when nothing matches", async () => {
    await show(LitaniesPage as Page, { q: "zzzzqx" });
    expect(screen.getByText("Nothing here matches “zzzzqx”.")).toBeInTheDocument();
  });

  it("/parishes uses the same bar, by name, city or postal code, and keeps the class", async () => {
    listParishPage.mockResolvedValue(
      onePage(
        [
          {
            id: "p1",
            slug: "st-mary",
            title: "St. Mary",
            subtitle: "A Catholic parish",
            designation: "parish",
            location: "Chicago, IL",
            address: null,
            postalCode: "60614",
            website: null,
            city: "Chicago",
            state: "IL",
            country: "US",
            countryCode: "US",
            latitude: null,
            longitude: null,
            href: "/parishes/st-mary",
          },
        ],
        1,
      ),
    );
    await show(ParishesPage as Page, { q: "60614", class: "parish" });
    expect(listParishPage).toHaveBeenCalledWith(expect.objectContaining({ q: "60614" }));
    expect(searchBar()).toHaveAccessibleName("Search by name, city or postal code");
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      "Name, city or postal code",
    );
    expect(searchBar().querySelector('input[name="class"]')).toHaveAttribute("value", "parish");
    expect(screen.getByRole("heading", { name: "St. Mary" })).toBeInTheDocument();
    expect(screen.getByText(/^1 result for “60614”/)).toBeInTheDocument();
    // Only one search form on the page: the old one-off form is gone.
    expect(screen.getAllByRole("search")).toHaveLength(1);
  });

  it("/parishes keeps Use my location next to a search that found nothing", async () => {
    await show(ParishesPage as Page, { q: "zzzzqx" });
    expect(screen.getByText("Nothing here matches “zzzzqx”.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use my location" })).toBeInTheDocument();
  });
});

describe("pages that get no search bar", () => {
  it.each([
    ["sacraments", SacramentsPage as unknown as Page],
    ["history", HistoryPage as unknown as Page],
    ["the liturgical calendar", LiturgicalCalendarPage as unknown as Page],
  ])("/%s has none", async (_name, page) => {
    const { container } = render(await page({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="q"]')).toBeNull();
  });
});

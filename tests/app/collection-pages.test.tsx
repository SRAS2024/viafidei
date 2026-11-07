/**
 * @vitest-environment jsdom
 */
/**
 * The collection pages on the shared visual system.
 *
 * A card names its item first; a brief label and short facts sit under the name;
 * a novena's long intention is a sentence below the title, not a shouted label;
 * the action shows on the collections that have description previews. Each list
 * runs in its display order, with a search's best match first and ties in that
 * order, and no page says what its order is. A loading placeholder reserves the
 * same grid and the same title as the page that replaces it.
 *
 * `display-order` is replaced by reversals here, so these tests prove each page
 * calls the right sort, and in the right place, whatever the sort itself does.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";

import type { PublishedItem, PublishedListItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

const listPublished = vi.fn();
const listPublishedPage = vi.fn();
const countPublishedBySubtype = vi.fn();
const listSaintCardDetails = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listPublished: (...args: unknown[]) => listPublished(...args),
  listPublishedPage: (...args: unknown[]) => listPublishedPage(...args),
  countPublishedBySubtype: (...args: unknown[]) => countPublishedBySubtype(...args),
  listSaintCardDetails: (...args: unknown[]) => listSaintCardDetails(...args),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en"), locale: "en" }),
}));
vi.mock("@/lib/translation/localize", () => ({
  localizeItems: async (items: unknown[]) => items,
}));
vi.mock("@/lib/i18n/rite-cookie", () => ({ getRiteCookieValue: async () => "roman" }));

// React's request-scoped cache exists only in the server runtime Next.js brings.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

// A sort anyone can recognise: the page shows the rows backwards.
vi.mock("@/lib/content-shared/display-order", () => {
  const reversed = <T,>(items: readonly T[]) => [...items].reverse();
  return {
    sortPrayersForDisplay: reversed,
    sortPopesForDisplay: reversed,
    sortApparitionsForDisplay: reversed,
    sortMarianTitlesForDisplay: reversed,
  };
});

import PrayersPage from "@/app/prayers/(list)/page";
import PrayersLoading from "@/app/prayers/(list)/loading";
import LitaniesPage from "@/app/litanies/page";
import LitaniesLoading from "@/app/litanies/loading";
import SaintsPage from "@/app/saints/(list)/page";
import SaintsLoading from "@/app/saints/(list)/loading";
import OurLadyPage from "@/app/our-lady/(list)/page";
import OurLadyLoading from "@/app/our-lady/(list)/loading";
import DoctorsPage from "@/app/doctors/(list)/page";
import DoctorsLoading from "@/app/doctors/(list)/loading";
import PopesPage from "@/app/popes/(list)/page";
import PopesLoading from "@/app/popes/(list)/loading";
import GuidesPage from "@/app/guides/(list)/page";
import GuidesLoading from "@/app/guides/(list)/loading";
import DevotionsPage from "@/app/devotions/(list)/page";
import DevotionsLoading from "@/app/devotions/(list)/loading";
import NovenasPage from "@/app/novenas/(list)/page";
import NovenasLoading from "@/app/novenas/(list)/loading";
import SpiritualLifePage from "@/app/spiritual-life/(list)/page";
import SpiritualLifeLoading from "@/app/spiritual-life/(list)/loading";
import RitesPage from "@/app/rites/(list)/page";
import RitesLoading from "@/app/rites/(list)/loading";
import ChurchDocumentsPage from "@/app/church-documents/page";
import ChurchDocumentsLoading from "@/app/church-documents/loading";
import LiturgyPage from "@/app/liturgy/(list)/page";
import LiturgyLoading from "@/app/liturgy/(list)/loading";
import { popeFactItems } from "@/app/popes/[slug]/facts";

type ContentType = PublishedItem["contentType"];
type Page = (props: { searchParams: Promise<Record<string, string>> }) => Promise<ReactElement>;

function published(
  contentType: ContentType,
  title: string,
  payload: Record<string, unknown> = {},
): PublishedItem {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `${contentType}-${slug}`,
    checklistItemId: slug,
    contentType,
    slug,
    title,
    subtitle: "",
    payload,
    authorityLevel: "VATICAN",
    version: 1,
    publishedAt: new Date("2026-01-01"),
  };
}

function projected(
  contentType: ContentType,
  title: string,
  subtype: string | null,
): PublishedListItem {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id: slug, contentType, slug, title, subtitle: "", subtype, href: `/x/${slug}` };
}

const onePage = <T,>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 36,
  pageCount: 1,
});

const CATALOGUE: Partial<Record<ContentType, PublishedItem[]>> = {
  PRAYER: [
    published("PRAYER", "Glory Be", { body: "Glory be to the Father.", category: "marian" }),
    published("PRAYER", "Hail Mary", { body: "Hail Mary, full of grace.", category: "marian" }),
    published("PRAYER", "Memorare", { body: "Remember, O most gracious Virgin." }),
  ],
  POPE: [
    published("POPE", "Pope Saint Peter", { papacyStart: "30", papacyEnd: "64" }),
    published("POPE", "Pope Mark", { papacyStart: "336", papacyEnd: "336", summary: "A pope." }),
    published("POPE", "Pope Leo XIV", { papacyStart: "2025" }),
  ],
  DOCTOR: [
    published("DOCTOR", "Saint Thomas Aquinas", {
      doctorTitle: "Angelic Doctor",
      summary: "The Summa.",
    }),
    published("DOCTOR", "Saint Ambrose of Milan", {
      doctorTitle: "Doctor of the Church",
      summary: "Bishop of Milan.",
    }),
  ],
  NOVENA: [
    published("NOVENA", "Novena to St. Jude", {
      intentionTheme: "hopeless_causes",
      summary: "Nine days to the apostle.",
    }),
    published("NOVENA", "Novena for the Assumption", {
      intentionTheme: "a holy death and the hope of glory",
      summary: "Kept from 6 to 14 August.",
    }),
  ],
  DEVOTION: [
    published("DEVOTION", "First Fridays", {
      devotionType: "christological",
      summary: "Devotion to the Sacred Heart.",
    }),
    published("DEVOTION", "A Plain Devotion", { devotionType: "general", summary: "Plain." }),
  ],
  GUIDE: [
    published("GUIDE", "How to Pray the Rosary", { kind: "rosary", summary: "Step by step." }),
  ],
  SPIRITUAL_PRACTICE: [
    published("SPIRITUAL_PRACTICE", "Lectio Divina", {
      practiceKind: "lectio_divina",
      summary: "Slow reading.",
    }),
    published("SPIRITUAL_PRACTICE", "A Rule of Life", {
      practiceKind: "other",
      summary: "A written plan.",
    }),
  ],
  LITURGICAL: [
    published("LITURGICAL", "The Nativity of the Lord", {
      slug: "solemnity-christmas",
      kind: "solemnity",
      feastDate: "12-25",
      summary: "Christmas.",
    }),
    published("LITURGICAL", "Season of Advent", {
      kind: "liturgical_season",
      summary: "Four weeks.",
    }),
  ],
  RITE: [
    published("RITE", "Roman Rite", { riteKey: "roman", family: "latin", history: "Of Rome." }),
    published("RITE", "Byzantine Rite", {
      riteKey: "byzantine",
      family: "byzantine",
      background: "Of Constantinople.",
    }),
  ],
  CHURCH_DOCUMENT: [
    published("CHURCH_DOCUMENT", "Rerum Novarum", {
      documentType: "encyclical",
      summary: "On capital and labour.",
    }),
  ],
  MARIAN_TITLE: [
    published("MARIAN_TITLE", "Queen of Peace", { summary: "Regina pacis." }),
    published("MARIAN_TITLE", "Star of the Sea", { summary: "Stella maris." }),
  ],
  APPARITION: [
    published("APPARITION", "Our Lady of Lourdes", {
      location: "Lourdes",
      approvedStatus: "approved",
      summary: "Bernadette at the grotto.",
    }),
    published("APPARITION", "Our Lady of Fatima", {
      location: "Fátima",
      summary: "Three shepherd children.",
    }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  listPublished.mockImplementation(async (type: ContentType) => CATALOGUE[type] ?? []);
  countPublishedBySubtype.mockResolvedValue({});
  listSaintCardDetails.mockResolvedValue(new Map());
  listPublishedPage.mockResolvedValue(onePage([]));
});
afterEach(() => cleanup());

async function show(page: unknown, params: Record<string, string> = {}) {
  return render(await (page as Page)({ searchParams: Promise.resolve(params) }));
}

/** The space that keeps a pope's numeral with his name reads as any other space. */
const spaced = (text: string) => text.replace(/\u00a0/g, " ");

/** A card's lines in reading order, title first. */
function cardLines(title: string): Array<string | null> {
  const card = screen
    .getByRole("link", { name: (name) => spaced(name) === title })
    .closest("article")!;
  return [...card.querySelectorAll("h2, h3, p")].map((el) => spaced(el.textContent ?? ""));
}

/** The titles of the cards on the page, in order. */
function cardTitles(): string[] {
  return [...document.querySelectorAll(".vf-entry-link")].map((el) => spaced(el.textContent ?? ""));
}

describe("every collection card puts its title first", () => {
  it.each<[string, unknown, string]>([
    ["prayers", PrayersPage, "Hail Mary"],
    ["doctors", DoctorsPage, "Saint Thomas Aquinas"],
    ["popes", PopesPage, "Pope Saint Peter"],
    ["guides", GuidesPage, "How to Pray the Rosary"],
    ["devotions", DevotionsPage, "First Fridays"],
    ["novenas", NovenasPage, "Novena to St. Jude"],
    ["spiritual life", SpiritualLifePage, "Lectio Divina"],
    ["rites", RitesPage, "Roman Rite"],
    ["Church documents", ChurchDocumentsPage, "Rerum Novarum"],
    ["liturgy", LiturgyPage, "Season of Advent"],
    ["Our Lady", OurLadyPage, "Star of the Sea"],
  ])("on %s", async (_name, page, title) => {
    await show(page);
    expect(cardLines(title)[0]).toBe(title);
  });

  it("gives a doctor's epithet and a pope's reign a line under the name", async () => {
    await show(DoctorsPage);
    // The clipped biography stays off: the name and epithet are the whole card.
    expect(cardLines("Saint Thomas Aquinas")).toEqual(["Saint Thomas Aquinas", "Angelic Doctor"]);
    // The page's own title says what every card on it is.
    expect(cardLines("Saint Ambrose of Milan")).toEqual(["Saint Ambrose of Milan"]);
    cleanup();
    await show(PopesPage);
    // Written as his own page writes it, so the card and the page never differ.
    expect(cardLines("Pope Saint Peter")).toEqual(["Pope Saint Peter", "30 – 64"]);
    expect(cardLines("Pope Leo XIV")).toEqual(["Pope Leo XIV", "Since 2025"]);
    // A reign within one year is one year, not "336 – 336".
    expect(cardLines("Pope Mark")).toEqual(["Pope Mark", "336"]);
  });

  it("writes a pope's reign the same on his card and in his facts", async () => {
    await show(PopesPage);
    const reign = (title: string, payload: Record<string, unknown>) => [
      cardLines(title)[1],
      popeFactItems(title, payload)[0]?.value,
    ];
    const peter = reign("Pope Saint Peter", { papacyStart: 30, papacyEnd: 64 });
    expect(peter[0]).toBe(peter[1]);
    const leo = reign("Pope Leo XIV", { papacyStart: 2025, papacyEnd: null });
    expect(leo[0]).toBe(leo[1]);
  });

  it("marks the reader's rite with a line under its name", async () => {
    await show(RitesPage);
    expect(cardLines("Roman Rite").slice(0, 2)).toEqual(["Roman Rite", "Your rite"]);
    expect(cardLines("Byzantine Rite")).toContain("Of Constantinople.");
    expect(cardLines("Byzantine Rite")).not.toContain("Your rite");
  });

  it("shows no label that names nothing", async () => {
    await show(DevotionsPage);
    expect(cardLines("First Fridays")[1]).toBe("Christological");
    expect(cardLines("A Plain Devotion")).not.toContain("General");
    cleanup();
    await show(SpiritualLifePage);
    expect(cardLines("A Rule of Life")).not.toContain("Other");
  });

  it("shows no label that only repeats the title", async () => {
    listPublished.mockImplementation(async (type: ContentType) =>
      type === "SPIRITUAL_PRACTICE"
        ? [
            published(type, "Almsgiving", { practiceKind: "almsgiving", summary: "Giving." }),
            published(type, "Friday Penance", { practiceKind: "penance", summary: "Fridays." }),
            published(type, "A Rule of Life", { practiceKind: "fasting", summary: "Daily." }),
          ]
        : [],
    );
    await show(SpiritualLifePage);
    expect(cardLines("Almsgiving")).toEqual(["Almsgiving", "Giving.", "Open →"]);
    expect(cardLines("Friday Penance")).toEqual(["Friday Penance", "Fridays.", "Open →"]);
    // A label that adds something stays.
    expect(cardLines("A Rule of Life")[1]).toBe("Fasting");
  });

  it('leaves "Litany" off the cards of the litanies', async () => {
    listPublishedPage.mockResolvedValue(
      onePage([projected("PRAYER", "Litany of Humility", "litany")]),
    );
    await show(LitaniesPage);
    expect(cardLines("Litany of Humility")).toEqual(["Litany of Humility"]);
  });
});

describe("a novena's intention", () => {
  it("is a sentence below the title, above the description, never a label", async () => {
    await show(NovenasPage);
    expect(cardLines("Novena for the Assumption")).toEqual([
      "Novena for the Assumption",
      "A holy death and the hope of glory",
      "Kept from 6 to 14 August.",
      "Open →",
    ]);
    const theme = screen.getByText("A holy death and the hope of glory");
    expect(theme).toHaveClass("vf-entry-theme");
    expect(theme).not.toHaveClass("vf-eyebrow");
  });

  it("never reaches a reader as a stored enum", async () => {
    await show(NovenasPage);
    expect(screen.getByText("Hopeless causes")).toHaveClass("vf-entry-theme");
    expect(screen.queryByText("hopeless_causes")).not.toBeInTheDocument();
  });
});

describe("the card's action", () => {
  it.each<[string, unknown, string]>([
    ["guides", GuidesPage, "How to Pray the Rosary"],
    ["devotions", DevotionsPage, "First Fridays"],
    ["novenas", NovenasPage, "Novena to St. Jude"],
    ["spiritual life", SpiritualLifePage, "Lectio Divina"],
    ["rites", RitesPage, "Roman Rite"],
    ["Church documents", ChurchDocumentsPage, "Rerum Novarum"],
    ["liturgy", LiturgyPage, "Season of Advent"],
    ["Marian titles", OurLadyPage, "Star of the Sea"],
  ])("closes a card with a description on %s", async (_name, page, title) => {
    await show(page);
    expect(cardLines(title).at(-1)).toBe("Open →");
    // The title's link stretches over the card, so a screen reader hears the
    // item's name once and no second link or "Open" to step through.
    const card = screen.getByRole("link", { name: title }).closest("article")!;
    expect(within(card).getAllByRole("link")).toHaveLength(1);
    expect(card.querySelector(".vf-entry-action")).toHaveAttribute("aria-hidden", "true");
  });

  it("closes an apparition's card too", async () => {
    await show(OurLadyPage, { filter: "apparitions" });
    expect(cardLines("Our Lady of Lourdes").at(-1)).toBe("Open →");
  });

  it.each<[string, unknown, string]>([
    ["prayers", PrayersPage, "Hail Mary"],
    ["doctors", DoctorsPage, "Saint Thomas Aquinas"],
    ["popes", PopesPage, "Pope Saint Peter"],
  ])("stays off a card that has no description on %s", async (_name, page, title) => {
    await show(page);
    expect(cardLines(title).join(" ")).not.toContain("Open");
  });

  it("stays off a saint's card", async () => {
    listPublishedPage.mockResolvedValue(onePage([projected("SAINT", "St. Agnes", "martyr")]));
    await show(SaintsPage);
    expect(cardLines("St. Agnes").join(" ")).not.toContain("Open");
  });
});

describe("Our Lady's filters", () => {
  it("are the site's chips, with the selected one blue and named as current", async () => {
    await show(OurLadyPage);
    const group = screen.getByRole("group", { name: "Our Lady filter" });
    const chips = within(group).getAllByRole("link");
    expect(chips.map((c) => c.textContent)).toEqual(["Marian Titles", "Apparitions", "All"]);
    expect(chips[0]).toHaveAttribute("aria-current", "page");
    expect(chips[0]).toHaveClass("vf-chip", "vf-filter-active");
    expect(chips[1]).not.toHaveAttribute("aria-current");
    expect(chips[1]).not.toHaveClass("vf-filter-active");
    for (const chip of chips) expect(chip.className).not.toMatch(/indigo|slate|rounded-full/);
    expect(chips.map((c) => c.getAttribute("href"))).toEqual([
      "/our-lady",
      "/our-lady?filter=apparitions",
      "/our-lady?filter=all",
    ]);
  });

  it("keep the search on every chip", async () => {
    await show(OurLadyPage, { q: "lourdes" });
    const group = screen.getByRole("group", { name: "Our Lady filter" });
    expect(
      within(group)
        .getAllByRole("link")
        .map((c) => c.getAttribute("href")),
    ).toEqual([
      "/our-lady?filter=titles&q=lourdes",
      "/our-lady?filter=apparitions&q=lourdes",
      "/our-lady?filter=all&q=lourdes",
    ]);
  });

  it("set each list under its own heading only when both are shown", async () => {
    await show(OurLadyPage, { filter: "all" });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Marian Titles", "Apparitions"]);
    expect(screen.getByRole("heading", { level: 3, name: "Star of the Sea" })).toBeInTheDocument();
    cleanup();
    await show(OurLadyPage);
    expect(screen.queryByRole("heading", { name: "Marian Titles" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Star of the Sea" })).toBeInTheDocument();
  });

  it("say so in the site's empty-state card when nothing is published", async () => {
    listPublished.mockResolvedValue([]);
    await show(OurLadyPage);
    const empty = screen.getByText(/No Marian titles are published yet/);
    expect(empty).toHaveClass("vf-card");
    expect(empty.className).not.toMatch(/slate/);
  });
});

describe("a selected chip", () => {
  it("is painted blue after the chip's own rule, so the chip cannot paint over it", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const chip = css.indexOf("\n  .vf-chip {");
    const selected = css.indexOf("\n  .vf-chip.vf-filter-active {");
    expect(chip).toBeGreaterThan(-1);
    expect(selected).toBeGreaterThan(chip);
    expect(css.slice(selected, selected + 140)).toContain("background: var(--accent-fill)");
  });
});

describe("the short closed lists stay on one page", () => {
  it.each<[string, unknown, ContentType]>([
    ["doctors", DoctorsPage, "DOCTOR"],
    ["rites", RitesPage, "RITE"],
  ])("%s, rather than strand a card or two on a second", async (_name, page, type) => {
    listPublished.mockResolvedValue(
      Array.from({ length: 38 }, (_, i) => published(type, `Entry ${i + 1}`, { history: "Text." })),
    );
    await show(page);
    expect(cardTitles()).toHaveLength(38);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });
});

describe("search and filter sit together", () => {
  it.each<[string, unknown]>([
    ["prayers", PrayersPage],
    ["guides", GuidesPage],
    ["spiritual life", SpiritualLifePage],
    ["rites", RitesPage],
    ["Church documents", ChurchDocumentsPage],
    ["liturgy", LiturgyPage],
    ["Our Lady", OurLadyPage],
  ])("in one control area on %s", async (_name, page) => {
    await show(page);
    const search = screen.getByRole("search");
    const controls = search.closest(".vf-list-controls")!;
    expect(controls).not.toBeNull();
    expect(controls.querySelector(".vf-chip")).not.toBeNull();
  });
});

describe("each list runs in its display order", () => {
  it("/prayers, and a search keeps the best match first with ties in that order", async () => {
    await show(PrayersPage);
    expect(cardTitles()).toEqual(["Memorare", "Hail Mary", "Glory Be"]);
    cleanup();
    // "Hail Mary" answers in its title, so it leads. The other two tie on their
    // text, and stay in the display order.
    listPublished.mockResolvedValue([
      published("PRAYER", "Glory Be", { body: "Mary and the Father." }),
      published("PRAYER", "Hail Mary", { body: "Hail, full of grace." }),
      published("PRAYER", "Memorare", { body: "Remember, O Mary." }),
    ]);
    await show(PrayersPage, { q: "mary" });
    expect(cardTitles()).toEqual(["Hail Mary", "Memorare", "Glory Be"]);
  });

  it("/popes", async () => {
    await show(PopesPage);
    expect(cardTitles()).toEqual(["Pope Leo XIV", "Pope Mark", "Pope Saint Peter"]);
  });

  it("/litanies orders every litany before paging them", async () => {
    const batch = Array.from({ length: 40 }, (_, i) =>
      projected("PRAYER", `Litany ${String(i + 1).padStart(2, "0")}`, "litany"),
    );
    listPublishedPage.mockResolvedValue(onePage(batch));
    await show(LitaniesPage);
    // Reversed across the whole set, not within one page of it.
    expect(cardTitles()).toHaveLength(36);
    expect(cardTitles()[0]).toBe("Litany 40");
    expect(cardTitles()[35]).toBe("Litany 05");
    cleanup();
    await show(LitaniesPage, { page: "2" });
    expect(cardTitles()).toEqual(["Litany 04", "Litany 03", "Litany 02", "Litany 01"]);
  });

  it("/litanies reads past one batch when there are more than one batch holds", async () => {
    listPublishedPage.mockImplementation(async (_type: string, opts: { page: number }) => ({
      ...onePage([projected("PRAYER", `Litany of batch ${opts.page}`, "litany")]),
      page: opts.page,
      total: 2,
      pageCount: 2,
    }));
    await show(LitaniesPage);
    expect(cardTitles()).toEqual(["Litany of batch 2", "Litany of batch 1"]);
  });

  it("/litanies leaves a search in the database's best-match order", async () => {
    listPublishedPage.mockResolvedValue(
      onePage([projected("PRAYER", "Best", "litany"), projected("PRAYER", "Next", "litany")]),
    );
    await show(LitaniesPage, { q: "loreto" });
    expect(cardTitles()).toEqual(["Best", "Next"]);
  });

  it("/our-lady's titles and apparitions", async () => {
    await show(OurLadyPage, { filter: "all" });
    expect(cardTitles()).toEqual([
      "Star of the Sea",
      "Queen of Peace",
      "Our Lady of Fatima",
      "Our Lady of Lourdes",
    ]);
  });

  it("/saints asks the database for the saint order, even under a search", async () => {
    await show(SaintsPage);
    expect(listPublishedPage).toHaveBeenLastCalledWith(
      "SAINT",
      expect.objectContaining({ order: "saints" }),
    );
    cleanup();
    await show(SaintsPage, { q: "agnes" });
    expect(listPublishedPage).toHaveBeenLastCalledWith(
      "SAINT",
      expect.objectContaining({ order: "saints", q: "agnes" }),
    );
  });
});

describe("/liturgy reads as one page", () => {
  it("sets the whole collection out by section, cards one level below the heading", async () => {
    await show(LiturgyPage);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Seasons", "Feasts & Solemnities"]);
    expect(cardTitles()).toEqual(["Season of Advent", "The Nativity of the Lord"]);
    expect(screen.getByRole("heading", { level: 3, name: "Season of Advent" })).toBeInTheDocument();
    // "Solemnity" is true of the entry; "Liturgical season" would not be, on a day.
    expect(cardLines("The Nativity of the Lord")[1]).toBe("Solemnity");
    expect(cardLines("Season of Advent")[1]).toBe("Four weeks.");
  });

  it("needs no headings for a filter, which is one section", async () => {
    await show(LiturgyPage, { filter: "seasons" });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Season of Advent"]);
  });

  it("needs no headings for a search, which is its best matches first", async () => {
    await show(LiturgyPage, { q: "christmas" });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["The Nativity of the Lord"]);
  });

  it("offers its filters in the order of its sections", async () => {
    await show(LiturgyPage);
    const group = screen.getByRole("group", { name: "Filter liturgy by kind" });
    expect(
      within(group)
        .getAllByRole("link")
        .map((chip) => chip.textContent),
    ).toEqual(["All", "Seasons", "Feasts & Solemnities"]);
  });
});

describe("no page says what its order is", () => {
  const LABELS = /chronological|earliest first|most popular|best known|well.known|in order\b/i;

  it.each<[string, unknown]>([
    ["prayers", PrayersPage],
    ["litanies", LitaniesPage],
    ["saints", SaintsPage],
    ["popes", PopesPage],
    ["Our Lady", OurLadyPage],
    ["liturgy", LiturgyPage],
  ])("on %s", async (_name, page) => {
    const { container } = await show(page);
    expect(container.textContent).not.toMatch(LABELS);
  });

  it("nor does /popes when it has nothing to show", async () => {
    listPublished.mockResolvedValue([]);
    const { container } = await show(PopesPage);
    expect(container.textContent).not.toMatch(LABELS);
    expect(screen.getByText("The successors of Saint Peter.")).toBeInTheDocument();
  });
});

describe("a loading placeholder reserves the page that replaces it", () => {
  const gridOf = (root: HTMLElement) => root.querySelector("ul.vf-grid")?.className;
  const titleOf = (root: HTMLElement) => root.querySelector("h1")?.textContent;
  /** A placeholder is a server component: it awaits the reader's language first. */
  const showPlaceholder = async (Loading: () => ReactElement | Promise<ReactElement>) => {
    const { type: Skeleton, props } = await Loading();
    return render(await (Skeleton as (p: object) => Promise<ReactElement>)(props as object));
  };

  it.each<[string, unknown, () => ReactElement | Promise<ReactElement>, Record<string, string>]>([
    ["prayers", PrayersPage, PrayersLoading, {}],
    ["litanies", LitaniesPage, LitaniesLoading, {}],
    ["saints", SaintsPage, SaintsLoading, {}],
    ["Our Lady", OurLadyPage, OurLadyLoading, {}],
    ["doctors", DoctorsPage, DoctorsLoading, {}],
    ["popes", PopesPage, PopesLoading, {}],
    ["guides", GuidesPage, GuidesLoading, {}],
    ["devotions", DevotionsPage, DevotionsLoading, {}],
    ["novenas", NovenasPage, NovenasLoading, {}],
    ["spiritual life", SpiritualLifePage, SpiritualLifeLoading, {}],
    ["rites", RitesPage, RitesLoading, {}],
    ["Church documents", ChurchDocumentsPage, ChurchDocumentsLoading, {}],
    ["liturgy", LiturgyPage, LiturgyLoading, { filter: "seasons" }],
  ])("on %s", async (_name, page, Loading, params) => {
    listPublishedPage.mockResolvedValue(
      onePage([projected("PRAYER", "Litany of the Saints", "litany")]),
    );
    const loaded = await show(page, params);
    const grid = gridOf(loaded.container);
    const title = titleOf(loaded.container);
    const hasSummary = loaded.container.querySelector(".vf-entry-summary") != null;
    const hasControls = loaded.container.querySelector(".vf-list-controls") != null;
    const hasFilter = loaded.container.querySelector(".vf-list-controls .vf-chip") != null;
    cleanup();

    const { container } = await showPlaceholder(Loading);
    expect(gridOf(container)).toBe(grid);
    expect(titleOf(container)).toBe(title);
    expect(container.querySelector(".vf-list-controls") != null).toBe(hasControls);
    // The search field stands where it will: the filter beside it has its room held.
    expect(
      container.querySelectorAll(".vf-list-controls > span.vf-skeleton, .vf-list-controls .vf-chip")
        .length > 0,
    ).toBe(hasFilter);
    // A row of cards with no description preview is a shorter row.
    const placeholder = screen.getAllByTestId("tab-loading-card")[0];
    expect(placeholder.querySelector(".vf-entry-summary") != null).toBe(hasSummary);
    // Twelve cards fill every row, in two, three or four columns.
    expect(screen.getAllByTestId("tab-loading-card")).toHaveLength(12);
    // Loading is announced from beside the busy wrapper, where nothing can hold it
    // back, and the placeholder cards themselves are not read out.
    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Loading the latest published content"));
    expect(status.closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByTestId("tab-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("tab-loading-cards")).toHaveAttribute("aria-hidden", "true");
  });

  it("holds the room of a saint's patronage and feast day", async () => {
    await showPlaceholder(SaintsLoading);
    const card = screen.getAllByTestId("tab-loading-card")[0];
    expect(card.querySelectorAll(".vf-entry-meta")).toHaveLength(3);
  });

  it("holds the room of a novena's intention", async () => {
    await showPlaceholder(NovenasLoading);
    const card = screen.getAllByTestId("tab-loading-card")[0];
    expect(card.querySelector(".vf-entry-theme")).not.toBeNull();
  });

  it("holds the room of /liturgy's first section heading", async () => {
    listPublished.mockResolvedValue([
      published("LITURGICAL", "The Order of Mass", {
        kind: "mass_structure",
        summary: "The parts of the Mass.",
      }),
    ]);
    const loaded = await show(LiturgyPage);
    const heading = loaded.container.querySelector(".vf-section-title")?.textContent;
    cleanup();
    const { container } = await showPlaceholder(LiturgyLoading);
    expect(container.querySelector(".vf-section-title")?.textContent).toBe(heading);
  });

  it("holds the room of the line under the search on /devotions", async () => {
    const loaded = await show(DevotionsPage);
    const hasNote = loaded.container.querySelector(".vf-list-controls > p") != null;
    cleanup();
    const { container } = await showPlaceholder(DevotionsLoading);
    expect(container.querySelector(".vf-list-controls > p") != null).toBe(hasNote);
  });
});

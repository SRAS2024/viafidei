/**
 * The homepage's featured rails. The worker's blocks keep a copy of each item's
 * title from when they were drafted, and on production that copy is often a raw
 * identifier ("saint-joseph-volotsky"); some of the pages they name have since
 * gone. The data layer reads every item from its own page's row, in one query.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const queryRaw = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    homePage: { findUnique: (...args: unknown[]) => findUnique(...args) },
    publishedContent: { findMany: (...args: unknown[]) => findMany(...args) },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { memoClear } from "@/lib/cache/memo";
import {
  featuredHrefFor,
  getPublishedFeaturedBlocks,
  parseFeaturedBlock,
} from "@/lib/data/homepage";

/** A row as the batched query returns it. */
function row(contentType: string, slug: string, title: string, extra: object = {}) {
  return {
    contentType,
    slug,
    title,
    subtitle: null,
    subtype: null,
    category: null,
    intentionTheme: null,
    patronages: null,
    patronage: null,
    feastDay: null,
    feastMonth: null,
    feastDayOfMonth: null,
    ...extra,
  };
}

function stored(blockType: string, items: Array<{ slug: string; title?: string }>) {
  return {
    blockKey: blockType,
    blockType,
    configJson: { heading: "Stored heading", items },
  };
}

function publishedWith(...blocks: ReturnType<typeof stored>[]) {
  findUnique.mockResolvedValue({ status: "PUBLISHED", blocks });
}

beforeEach(() => {
  memoClear();
  findUnique.mockReset();
  queryRaw.mockReset();
  queryRaw.mockResolvedValue([]);
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("getPublishedFeaturedBlocks", () => {
  it("keeps a rail at its drafted number when a page has gone", async () => {
    publishedWith(
      stored("featured-saints", [
        { slug: "saint-hyginus" },
        { slug: "saint-joseph-volotsky" },
        { slug: "saint-daniel-the-stylite" },
        { slug: "saint-pope-dionysius-of-alexandria" },
      ]),
    );
    queryRaw
      .mockResolvedValueOnce([
        row("SAINT", "saint-hyginus", "Saint Hyginus"),
        row("SAINT", "saint-pope-dionysius-of-alexandria", "Saint Dionysius"),
      ])
      .mockResolvedValueOnce([
        row("SAINT", "saint-joseph", "Saint Joseph"),
        row("SAINT", "saint-peter", "Saint Peter"),
        row("SAINT", "saint-paul", "Saint Paul"),
      ]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items.map((item) => item.title)).toEqual([
      "Saint Hyginus",
      "Saint Dionysius",
      "Saint Joseph",
      "Saint Peter",
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("asks for nothing more when a rail is whole", async () => {
    publishedWith(stored("featured-saints", [{ slug: "saint-hyginus" }]));
    queryRaw.mockResolvedValue([row("SAINT", "saint-hyginus", "Saint Hyginus")]);
    await getPublishedFeaturedBlocks();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("shows the page's real title, never the identifier the block stored", async () => {
    publishedWith(stored("featured-saints", [{ slug: "saint-hyginus", title: "saint-hyginus" }]));
    queryRaw.mockResolvedValue([row("SAINT", "saint-hyginus", "Saint Hyginus")]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items.map((item) => item.title)).toEqual(["Saint Hyginus"]);
  });

  it("drops an item whose page no longer exists, keeping the stored order", async () => {
    publishedWith(
      stored("featured-saints", [
        { slug: "saint-b", title: "saint-b" },
        { slug: "saint-joseph-volotsky", title: "saint-joseph-volotsky" },
        { slug: "saint-a", title: "saint-a" },
      ]),
    );
    queryRaw.mockResolvedValue([
      row("SAINT", "saint-a", "Saint A"),
      row("SAINT", "saint-b", "Saint B"),
    ]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items.map((item) => item.slug)).toEqual(["saint-b", "saint-a"]);
  });

  it("drops a rail with nothing left", async () => {
    publishedWith(
      stored("featured-saints", [{ slug: "gone", title: "gone" }]),
      stored("featured-prayers", [{ slug: "de-profundis", title: "De Profundis" }]),
    );
    queryRaw.mockResolvedValue([row("PRAYER", "de-profundis", "De Profundis")]);

    const rails = await getPublishedFeaturedBlocks();
    expect(rails.map((rail) => rail.blockType)).toEqual(["featured-prayers"]);
  });

  it("keeps a devotion rail at three from the head of the devotions list", async () => {
    publishedWith(
      stored("featured-devotions", [
        { slug: "a", title: "a" },
        { slug: "b", title: "b" },
        { slug: "gone", title: "gone" },
      ]),
    );
    queryRaw
      .mockResolvedValueOnce([row("DEVOTION", "a", "A"), row("DEVOTION", "b", "B")])
      .mockResolvedValueOnce([row("DEVOTION", "c", "C")]);
    findMany.mockResolvedValue([{ slug: "c" }]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items.map((item) => item.slug)).toEqual(["a", "b", "c"]);
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { contentType: "DEVOTION", isPublished: true, slug: { notIn: ["a", "b"] } },
      orderBy: { title: "asc" },
    });
  });

  it("makes up a rail whose cards have all gone, rather than dropping it", async () => {
    publishedWith(stored("featured-saints", [{ slug: "gone", title: "gone" }]));
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        row("SAINT", "saint-blessed-virgin-mary", "The Blessed Virgin Mary"),
      ]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.blockType).toBe("featured-saints");
    expect(rail!.items.map((item) => item.slug)).toEqual(["saint-blessed-virgin-mary"]);
  });

  it("matches a slug within its rail's own content type", async () => {
    publishedWith(stored("featured-prayers", [{ slug: "same-slug", title: "same-slug" }]));
    queryRaw.mockResolvedValue([row("SAINT", "same-slug", "A saint of that name")]);

    expect(await getPublishedFeaturedBlocks()).toEqual([]);
  });

  it("resolves every rail in one query, reading no whole payload", async () => {
    publishedWith(
      stored("featured-prayers", [{ slug: "p", title: "p" }]),
      stored("featured-saints", [{ slug: "s", title: "s" }]),
      stored("featured-devotions", [{ slug: "d", title: "d" }]),
      stored("featured-novenas", [{ slug: "n", title: "n" }]),
    );
    queryRaw.mockResolvedValue([
      row("PRAYER", "p", "P"),
      row("SAINT", "s", "S"),
      row("DEVOTION", "d", "D"),
      row("NOVENA", "n", "N"),
    ]);

    await getPublishedFeaturedBlocks();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = String(queryRaw.mock.calls[0]![0].sql ?? queryRaw.mock.calls[0]![0].strings);
    expect(sql).toMatch(/"isPublished"/);
    expect(sql).not.toMatch(/SELECT \*/);
    expect(sql).not.toMatch(/"payload"\s*,|,\s*payload\s*,/);
  });

  it("gives a prayer its type and names no type for a general one", async () => {
    publishedWith(
      stored("featured-prayers", [
        { slug: "de-profundis", title: "x" },
        { slug: "plain", title: "x" },
      ]),
    );
    queryRaw.mockResolvedValue([
      row("PRAYER", "de-profundis", "De Profundis (Psalm 130)", { category: "penitential" }),
      row("PRAYER", "plain", "A Prayer", { category: "general", subtype: "general" }),
    ]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items.map((item) => item.meta)).toEqual([["Penitential"], []]);
  });

  it("gives a saint their patronage and feast day", async () => {
    publishedWith(stored("featured-saints", [{ slug: "saint-joseph", title: "x" }]));
    queryRaw.mockResolvedValue([
      row("SAINT", "saint-joseph", "Saint Joseph", {
        patronages: ["workers", "fathers"],
        feastMonth: 3,
        feastDayOfMonth: 19,
      }),
    ]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items[0]!.saint).toEqual({
      patronages: ["workers", "fathers"],
      feast: "March 19",
    });
  });

  it("gives a devotion its particular subtitle, not one that restates the rail", async () => {
    publishedWith(
      stored("featured-devotions", [
        { slug: "a", title: "x" },
        { slug: "b", title: "x" },
        { slug: "c", title: "x" },
        { slug: "d", title: "x" },
        { slug: "e", title: "x" },
      ]),
    );
    queryRaw.mockResolvedValue([
      row("DEVOTION", "a", "A", { subtitle: "Eucharistic devotion · 60 min" }),
      row("DEVOTION", "b", "B", { subtitle: "A devotion of the Catholic faithful" }),
      row("DEVOTION", "c", "C", { subtitle: "Catholic devotion · 10 min" }),
      row("DEVOTION", "d", "D", {
        subtitle: "A devotion of the Catholic faithful",
        subtype: "marian",
      }),
      row("DEVOTION", "e", "E", { subtitle: "Catholic devotion", subtype: "general" }),
    ]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items.map((item) => item.meta)).toEqual([
      ["Eucharistic devotion · 60 min"],
      [],
      ["10 min"],
      ["Marian"],
      [],
    ]);
  });

  it("gives a novena what it is prayed for, as a sentence", async () => {
    publishedWith(
      stored("featured-novenas", [
        { slug: "a", title: "x" },
        { slug: "b", title: "x" },
        { slug: "c", title: "x" },
      ]),
    );
    queryRaw.mockResolvedValue([
      row("NOVENA", "a", "A", { intentionTheme: "the intercession of Mary Immaculate" }),
      row("NOVENA", "b", "B", { intentionTheme: "hopeless_causes" }),
      row("NOVENA", "c", "C", { subtitle: "A nine-day Catholic devotion" }),
    ]);

    const [rail] = await getPublishedFeaturedBlocks();
    expect(rail!.items.map((item) => item.meta)).toEqual([
      ["The intercession of Mary Immaculate"],
      ["Hopeless causes"],
      [],
    ]);
  });

  it("shows nothing until a makeover has been published", async () => {
    findUnique.mockResolvedValue({
      status: "DRAFT",
      blocks: [stored("featured-prayers", [{ slug: "p", title: "p" }])],
    });

    expect(await getPublishedFeaturedBlocks()).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("drops a block type with no pages to link to", async () => {
    publishedWith(stored("featured-history", [{ slug: "nicaea", title: "Nicaea" }]));

    expect(await getPublishedFeaturedBlocks()).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe("parseFeaturedBlock", () => {
  it("keeps an item that stored no title: its page supplies one", () => {
    const parsed = parseFeaturedBlock(stored("featured-saints", [{ slug: "saint-hyginus" }]));
    expect(parsed.items).toEqual([{ slug: "saint-hyginus", title: "saint-hyginus" }]);
  });

  it("ignores an item with no slug", () => {
    const parsed = parseFeaturedBlock(stored("featured-saints", [{ slug: "" }]));
    expect(parsed.items).toEqual([]);
  });
});

describe("featuredHrefFor", () => {
  it.each([
    ["featured-prayers", "/prayers/x"],
    ["featured-saints", "/saints/x"],
    ["featured-devotions", "/devotions/x"],
    ["featured-novenas", "/novenas/x"],
    ["featured-sacraments", "/sacraments/x"],
    ["featured-apparitions", "/our-lady/x"],
  ])("links a %s item to its page", (type, href) => {
    expect(featuredHrefFor(type, "x")).toBe(href);
  });
});

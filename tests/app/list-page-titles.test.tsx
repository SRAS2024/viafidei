/**
 * @vitest-environment jsdom
 */
/**
 * Every list page's tab title says what the page is showing, and the page's data is
 * read once for the title and the page together.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";

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
// A request's memory, as the server runtime gives React's cache. Tests ask for
// different arguments, so one test's answer is never another's.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
    const seen = new Map<string, R>();
    return (...args: A) => {
      const key = JSON.stringify(args);
      if (!seen.has(key)) seen.set(key, fn(...args));
      return seen.get(key)!;
    };
  },
}));

import * as Saints from "@/app/saints/(list)/page";
import * as Prayers from "@/app/prayers/(list)/page";
import * as Litanies from "@/app/litanies/page";
import * as OurLady from "@/app/our-lady/(list)/page";
import * as Doctors from "@/app/doctors/(list)/page";
import * as Popes from "@/app/popes/(list)/page";
import * as Guides from "@/app/guides/(list)/page";
import * as Devotions from "@/app/devotions/(list)/page";
import * as Novenas from "@/app/novenas/(list)/page";
import * as SpiritualLife from "@/app/spiritual-life/(list)/page";
import * as Rites from "@/app/rites/(list)/page";
import * as ChurchDocuments from "@/app/church-documents/page";
import * as Liturgy from "@/app/liturgy/(list)/page";
import * as Parishes from "@/app/parishes/(list)/page";

type ContentType = PublishedItem["contentType"];
type Params = Record<string, string | string[]>;
type PageModule = {
  default: (props: { searchParams: Promise<Params> }) => Promise<ReactElement>;
  generateMetadata: (props: {
    searchParams: Promise<Params>;
  }) => Promise<{ title?: unknown; description?: unknown }>;
};

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
    payload: { title, ...payload },
    authorityLevel: "VERIFIED",
    version: 1,
    publishedAt: null,
  };
}

const projected = (title: string): PublishedListItem => ({
  id: title,
  contentType: "SAINT",
  slug: title,
  title,
  subtitle: "",
  subtype: null,
  href: `/saints/${title}`,
});

const many = (type: ContentType, count: number, payload: Record<string, unknown> = {}) =>
  Array.from({ length: count }, (_, i) => published(type, `Entry ${i + 1}`, payload));

const CATALOGUE: Partial<Record<ContentType, PublishedItem[]>> = {
  PRAYER: many("PRAYER", 80, { prayerType: "marian", category: "marian", body: "Hail" }),
  MARIAN_TITLE: many("MARIAN_TITLE", 40, { summary: "A title." }),
  APPARITION: many("APPARITION", 40, { summary: "An apparition." }),
  DOCTOR: many("DOCTOR", 3, { doctorTitle: "Angelic Doctor" }),
  POPE: many("POPE", 80, { papacyStart: "1900", papacyEnd: "1910" }),
  GUIDE: many("GUIDE", 80, { kind: "confession", summary: "A guide." }),
  DEVOTION: many("DEVOTION", 80, { summary: "A devotion." }),
  NOVENA: many("NOVENA", 80, { summary: "A novena." }),
  SPIRITUAL_PRACTICE: many("SPIRITUAL_PRACTICE", 80, { practiceKind: "fasting", summary: "A." }),
  RITE: many("RITE", 3, { riteKey: "byzantine", history: "Old." }),
  CHURCH_DOCUMENT: many("CHURCH_DOCUMENT", 80, { documentType: "encyclical", summary: "A." }),
  LITURGICAL: many("LITURGICAL", 80, { kind: "feast", summary: "A feast." }),
};

beforeEach(() => {
  vi.clearAllMocks();
  listPublished.mockImplementation(async (type: ContentType) => CATALOGUE[type] ?? []);
  countPublishedBySubtype.mockResolvedValue({});
  listSaintCardDetails.mockResolvedValue(new Map());
  listPublishedPage.mockImplementation(
    async (_type, opts: { page?: number; pageSize?: number }) => ({
      items: [projected("Saint Joseph")],
      total: 100,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 36,
      pageCount: 3,
    }),
  );
  listParishPage.mockImplementation(async (opts: { page?: number }) => ({
    items: [],
    total: 100,
    page: opts.page ?? 1,
    pageSize: 36,
    pageCount: 3,
  }));
});
afterEach(() => cleanup());

async function titleOf(module: unknown, params: Params = {}): Promise<string> {
  const { generateMetadata } = module as PageModule;
  const { title } = await generateMetadata({ searchParams: Promise.resolve(params) });
  return String(title);
}

describe("the plain list says only its name", () => {
  it.each<[string, unknown, string]>([
    ["saints", Saints, "Saints"],
    ["prayers", Prayers, "Prayers"],
    ["litanies", Litanies, "Litanies"],
    ["Our Lady", OurLady, "Our Lady"],
    ["doctors", Doctors, "Doctors of the Church"],
    ["popes", Popes, "Popes"],
    ["guides", Guides, "Guides"],
    ["devotions", Devotions, "Devotions"],
    ["novenas", Novenas, "Novenas"],
    ["spiritual life", SpiritualLife, "Spiritual Life"],
    ["rites", Rites, "Rites"],
    ["Church documents", ChurchDocuments, "Church Documents"],
    ["liturgy", Liturgy, "Liturgy"],
    ["parishes", Parishes, "Parishes"],
  ])("on %s", async (_name, module, title) => {
    expect(await titleOf(module)).toBe(title);
  });
});

describe("a filter's label leads the title", () => {
  it.each<[string, unknown, Params, string]>([
    ["saints", Saints, { filter: "martyrs" }, "Martyrs · Saints"],
    ["prayers", Prayers, { filter: "marian" }, "Marian · Prayers"],
    ["Our Lady", OurLady, { filter: "apparitions" }, "Apparitions · Our Lady"],
    ["guides", Guides, { filter: "confession" }, "Confession · Guides"],
    ["spiritual life", SpiritualLife, { filter: "prayer" }, "Prayer · Spiritual Life"],
    ["rites", Rites, { filter: "latin" }, "Latin (Western) · Rites"],
    [
      "Church documents",
      ChurchDocuments,
      { filter: "encyclical" },
      "Encyclicals · Church Documents",
    ],
    ["liturgy", Liturgy, { filter: "feasts" }, "Feasts & Solemnities · Liturgy"],
    ["parishes", Parishes, { class: "cathedral" }, "Cathedrals · Parishes"],
  ])("on %s", async (_name, module, params, title) => {
    expect(await titleOf(module, params)).toBe(title);
  });

  it("is ignored when the URL names no such filter", async () => {
    expect(await titleOf(Saints, { filter: "nonsense" })).toBe("Saints");
    expect(await titleOf(Prayers, { filter: ["a", "b"] })).toBe("Prayers");
  });
});

describe("a page past the first says so", () => {
  it.each<[string, unknown, Params, string]>([
    ["saints", Saints, { page: "2" }, "Saints · page 2 of 3"],
    ["prayers", Prayers, { page: "2" }, "Prayers · page 2 of 3"],
    ["popes", Popes, { page: "2" }, "Popes · page 2 of 3"],
    ["guides", Guides, { page: "2" }, "Guides · page 2 of 3"],
    ["devotions", Devotions, { page: "2" }, "Devotions · page 2 of 3"],
    ["novenas", Novenas, { page: "2" }, "Novenas · page 2 of 3"],
    ["spiritual life", SpiritualLife, { page: "2" }, "Spiritual Life · page 2 of 3"],
    ["Church documents", ChurchDocuments, { page: "2" }, "Church Documents · page 2 of 3"],
    ["liturgy", Liturgy, { page: "2" }, "Liturgy · page 2 of 3"],
    ["parishes", Parishes, { page: "2" }, "Parishes · page 2 of 3"],
  ])("on %s", async (_name, module, params, title) => {
    expect(await titleOf(module, params)).toBe(title);
  });

  it("names the last page for a page past the end of a list paged in memory", async () => {
    expect(await titleOf(Devotions, { page: "99999999999999999999" })).toBe(
      "Devotions · page 3 of 3",
    );
  });

  it("says which list on /our-lady, whose two lists page apart", async () => {
    expect(await titleOf(OurLady, { filter: "all", apage: "2" })).toBe(
      "All · Our Lady · Apparitions page 2 of 2",
    );
    expect(await titleOf(OurLady, { filter: "apparitions", apage: "2" })).toBe(
      "Apparitions · Our Lady · page 2 of 2",
    );
    expect(await titleOf(OurLady, { page: "2" })).toBe("Our Lady · page 2 of 2");
  });
});

describe("a search's outcome leads the title", () => {
  it.each<[string, unknown, string]>([
    ["saints", Saints, "100 results for “entry” · Saints"],
    ["prayers", Prayers, "80 results for “entry” · Prayers"],
    ["litanies", Litanies, "100 results for “entry” · Litanies"],
    ["Our Lady", OurLady, "80 results for “entry” · Our Lady"],
    ["doctors", Doctors, "3 results for “entry” · Doctors of the Church"],
    ["popes", Popes, "80 results for “entry” · Popes"],
    ["guides", Guides, "80 results for “entry” · Guides"],
    ["devotions", Devotions, "80 results for “entry” · Devotions"],
    ["novenas", Novenas, "80 results for “entry” · Novenas"],
    ["spiritual life", SpiritualLife, "80 results for “entry” · Spiritual Life"],
    ["rites", Rites, "3 results for “entry” · Rites"],
    ["Church documents", ChurchDocuments, "80 results for “entry” · Church Documents"],
    ["liturgy", Liturgy, "80 results for “entry” · Liturgy"],
    ["parishes", Parishes, "100 results for “entry” · Parishes"],
  ])("on %s", async (_name, module, title) => {
    expect(await titleOf(module, { q: "entry" })).toBe(title);
  });

  it("says when nothing matched", async () => {
    expect(await titleOf(Prayers, { q: "zzzqqq" })).toBe("0 results for “zzzqqq” · Prayers");
  });

  it("reads the first of a repeated search", async () => {
    expect(await titleOf(Prayers, { q: ["zzz", "entry"] })).toBe("0 results for “zzz” · Prayers");
  });
});

describe("reading the page's data", () => {
  it("is one read for the title and the page together", async () => {
    const params = { filter: "virgins", page: "2", q: "once" };
    await titleOf(Saints, params);
    await (Saints as unknown as PageModule).default({ searchParams: Promise.resolve(params) });
    expect(listPublishedPage).toHaveBeenCalledTimes(1);
  });

  it("is one read on /parishes too", async () => {
    const params = { class: "shrine", page: "2", q: "once" };
    await titleOf(Parishes, params);
    render(
      await (Parishes as unknown as PageModule).default({ searchParams: Promise.resolve(params) }),
    );
    expect(listParishPage).toHaveBeenCalledTimes(1);
  });

  it("does not take the page down with it when it fails: the title falls back", async () => {
    listPublishedPage.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await titleOf(Saints, { q: "fails", filter: "martyrs" })).toBe("Martyrs · Saints");
    listPublished.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await titleOf(Novenas, { page: "4" })).toBe("Novenas");
  });

  it("is not needed for what the URL alone can say, so a prefetch of the link reads nothing", async () => {
    for (const [module, params] of [
      [Saints, {}],
      [Saints, { filter: "martyrs", page: "1" }],
      [Prayers, { filter: "marian" }],
      [Litanies, {}],
      [OurLady, { filter: "all" }],
      [Doctors, {}],
      [Popes, {}],
      [Guides, { filter: "confession" }],
      [Devotions, {}],
      [Novenas, {}],
      [SpiritualLife, { filter: "prayer" }],
      [Rites, { filter: "latin" }],
      [ChurchDocuments, { filter: "encyclical" }],
      [Liturgy, { filter: "feasts" }],
      [Parishes, { class: "cathedral" }],
    ] as Array<[unknown, Params]>) {
      await titleOf(module, params);
    }
    expect(listPublished).not.toHaveBeenCalled();
    expect(listPublishedPage).not.toHaveBeenCalled();
    expect(listParishPage).not.toHaveBeenCalled();
    expect(countPublishedBySubtype).not.toHaveBeenCalled();
  });

  it("keeps the description of /church-documents", async () => {
    const { description } = await (ChurchDocuments as unknown as PageModule).generateMetadata({
      searchParams: Promise.resolve({}),
    });
    expect(description).toMatch(/Encyclicals/);
  });
});

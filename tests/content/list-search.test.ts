/**
 * Search inside one content list page (src/lib/content-shared/list-search.ts).
 *
 * The small types are searched over the rows their page already has: every
 * word must start a word of the item, accents and case do not matter, "St."
 * and "Saint" are one word, and the title outranks the card's facts, which
 * outrank the prose. Ties keep the page's own order.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_QUERY_LENGTH,
  listHref,
  normalizeSearchText,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
  searchPublishedItems,
  searchTier,
  searchWords,
} from "@/lib/content-shared/list-search";
import type { PublishedItem } from "@/lib/data/published";

function item(
  title: string,
  over: Partial<Pick<PublishedItem, "contentType" | "subtitle" | "payload">> = {},
) {
  return {
    contentType: "PRAYER" as PublishedItem["contentType"],
    title,
    subtitle: "",
    payload: {},
    ...over,
  };
}

describe("parseSearchQuery", () => {
  it("trims, collapses whitespace and caps the length", () => {
    expect(parseSearchQuery("  hail   mary ")).toBe("hail mary");
    expect(parseSearchQuery("x".repeat(500))).toHaveLength(MAX_QUERY_LENGTH);
  });

  it("takes the first value of a repeated parameter and ignores anything else", () => {
    expect(parseSearchQuery(["rosary", "angelus"])).toBe("rosary");
    expect(parseSearchQuery(undefined)).toBe("");
    expect(parseSearchQuery(42)).toBe("");
  });
});

describe("normalizeSearchText / searchWords", () => {
  it("folds case and accents, drops apostrophes and splits on punctuation", () => {
    expect(normalizeSearchText("St. Thérèse's Novena")).toBe("st thereses novena");
    expect(normalizeSearchText("lent_preparation")).toBe("lent preparation");
    expect(normalizeSearchText("Jean-Marie Vianney")).toBe("jean marie vianney");
  });

  it("de-duplicates the query's words", () => {
    expect(searchWords("Mary mary MARY rosary")).toEqual(["mary", "rosary"]);
    expect(searchWords("!!!")).toEqual([]);
  });
});

describe("searchTier", () => {
  const fields = {
    title: "St. Francis of Assisi",
    secondary: ["Religious founder, patron of animals · Feast October 4"],
    prose: ["Born in Assisi in 1181, he renounced his inheritance."],
  };

  it("ranks the title before the card's facts before the prose", () => {
    expect(searchTier(fields, "St. Francis of Assisi")).toBe(0);
    expect(searchTier(fields, "st francis")).toBe(1);
    expect(searchTier(fields, "francis of assisi")).toBe(2);
    expect(searchTier(fields, "assisi francis")).toBe(3);
    expect(searchTier(fields, "francis animals")).toBe(4);
    expect(searchTier(fields, "inheritance")).toBe(5);
  });

  it("reads Saint and St. as one word, either way round, while the reader types", () => {
    expect(searchTier(fields, "Saint Francis")).toBe(3);
    expect(searchTier(fields, "sain fran")).toBe(3);
    expect(searchTier({ title: "Saint Joseph the Worker" }, "st joseph")).toBe(3);
  });

  it("matches the start of a word, not any letters inside one", () => {
    expect(searchTier(fields, "ranci")).toBeNull();
    // A partial word at the start of a title word is a match in the title.
    expect(searchTier(fields, "fran")).toBe(2);
  });

  it("needs every word", () => {
    expect(searchTier(fields, "francis xavier")).toBeNull();
  });

  it("ignores accents in the title and in the query alike", () => {
    expect(searchTier({ title: "St. Thérèse of Lisieux" }, "therese")).toBe(2);
    expect(searchTier({ title: "Our Lady of Lourdes" }, "LOURDES")).toBe(2);
    expect(searchTier({ title: "St. Therese of Lisieux" }, "thérèse")).toBe(2);
  });
});

describe("rankBySearch", () => {
  const prayers = [
    { title: "Angelus", body: "The Angel of the Lord declared unto Mary." },
    { title: "Memorare", body: "Remember, O most gracious Virgin Mary…" },
    { title: "Hail Mary", body: "Hail Mary, full of grace…" },
    { title: "Hail, Holy Queen", body: "Mother of mercy…" },
  ];
  const fieldsOf = (p: (typeof prayers)[number]) => ({ title: p.title, prose: [p.body] });

  it("puts title matches first and keeps the page's order among equals", () => {
    expect(rankBySearch(prayers, "mary", fieldsOf).map((p) => p.title)).toEqual([
      "Hail Mary",
      "Angelus",
      "Memorare",
    ]);
  });

  it("finds a prayer by a line of its text", () => {
    expect(rankBySearch(prayers, "full of grace", fieldsOf).map((p) => p.title)).toEqual([
      "Hail Mary",
    ]);
  });

  it("returns everything for no query and nothing for a query with no words", () => {
    expect(rankBySearch(prayers, "", fieldsOf)).toHaveLength(4);
    expect(rankBySearch(prayers, "!!!", fieldsOf)).toEqual([]);
  });
});

describe("publishedSearchFields", () => {
  it("searches a saint by patronage, and the stored enums as words", () => {
    const saint = item("St. Nicholas", {
      contentType: "SAINT",
      subtitle: "Bishop · Feast December 6",
      payload: { patronages: ["sailors", "children"], feastDay: "12-06" },
    });
    const fields = publishedSearchFields(saint);
    expect(fields.secondary).toEqual(
      expect.arrayContaining(["Bishop · Feast December 6", "sailors", "children"]),
    );
    expect(searchPublishedItems([saint], "sailors")).toHaveLength(1);
    expect(searchPublishedItems([saint], "fishermen")).toHaveLength(0);
  });

  it("reads numbers as text and nested lists one level deep", () => {
    const apparition = item("Our Lady of Lourdes", {
      contentType: "APPARITION",
      payload: { location: "Lourdes", country: "France", yearOfApparition: 1858 },
    });
    expect(searchPublishedItems([apparition], "1858 france")).toHaveLength(1);
  });

  it("adds the labels the page shows on the card", () => {
    const guide = item("Preparing for Easter", {
      contentType: "GUIDE",
      payload: { kind: "lent_preparation" },
    });
    expect(searchPublishedItems([guide], "lent")).toHaveLength(1);
    expect(searchPublishedItems([guide], "penitential", () => ["Penitential season"])).toHaveLength(
      1,
    );
  });

  it("finds a prayer by its Latin", () => {
    const hailMary = item("Hail Mary", { payload: { body: "Hail Mary…", latin: "Ave Maria…" } });
    expect(searchPublishedItems([hailMary], "ave maria")).toHaveLength(1);
  });
});

describe("listHref", () => {
  it("builds the page URL with the non-empty parameters, in order", () => {
    expect(listHref("/prayers", { filter: "marian", q: "hail mary" })).toBe(
      "/prayers?filter=marian&q=hail+mary",
    );
    expect(listHref("/prayers", { filter: undefined, q: "" })).toBe("/prayers");
    expect(listHref("/saints")).toBe("/saints");
  });
});

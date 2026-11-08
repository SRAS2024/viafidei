/**
 * The title of a list page, which is what a screen reader says first after a
 * search reloads the page and what the router announces after a filter or a page
 * link. It names everything that sets this view apart from the plain list.
 */
import { describe, expect, it, vi } from "vitest";

import { MAX_PAGE_NUMBER, listPageTitle, listPageTitleFor } from "@/lib/content-shared/list-page";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const t = createTranslator("en");
const title = (state: Omit<Parameters<typeof listPageTitle>[0], "t" | "locale" | "name">) =>
  listPageTitle({ name: "Saints", t, locale: "en", ...state });

describe("listPageTitle", () => {
  it("is the list's name alone for the plain list", () => {
    expect(title({})).toBe("Saints");
    expect(title({ pages: [{ page: 1, pageCount: 53 }] })).toBe("Saints");
  });

  it("names the filter in effect", () => {
    expect(title({ filter: "Martyrs" })).toBe("Martyrs · Saints");
  });

  it("gives the page once past the first", () => {
    expect(title({ pages: [{ page: 2, pageCount: 53 }] })).toBe("Saints · page 2 of 53");
    expect(title({ filter: "Martyrs", pages: [{ page: 3, pageCount: 12 }] })).toBe(
      "Martyrs · Saints · page 3 of 12",
    );
  });

  it("never says something impossible, such as page 2 of 1", () => {
    expect(title({ query: "zzzqqq", total: 0, pages: [{ page: 2, pageCount: 1 }] })).toBe(
      "0 results for “zzzqqq” · Saints",
    );
    expect(title({ pages: [{ page: 9999, pageCount: 53 }] })).toBe("Saints");
  });

  it("does not name a filter called what the list is called", () => {
    expect(listPageTitle({ name: "Parishes", filter: "Parishes", t, locale: "en" })).toBe(
      "Parishes",
    );
  });

  it("leads with a search's outcome, as /search does", () => {
    expect(title({ query: "joseph", total: 34 })).toBe("34 results for “joseph” · Saints");
    expect(title({ query: "joseph", total: 1 })).toBe("1 result for “joseph” · Saints");
    expect(title({ query: "zzzqqq", total: 0 })).toBe("0 results for “zzzqqq” · Saints");
    expect(
      title({ query: "joseph", total: 80, filter: "Martyrs", pages: [{ page: 2, pageCount: 3 }] }),
    ).toBe("80 results for “joseph” · Martyrs · Saints · page 2 of 3");
  });

  it("says which list a page belongs to when a page holds two", () => {
    expect(
      title({
        filter: "All",
        pages: [
          { page: 1, pageCount: 2, of: "Marian Titles" },
          { page: 2, pageCount: 2, of: "Apparitions" },
        ],
      }),
    ).toBe("All · Saints · Apparitions page 2 of 2");
  });

  it("writes a count the reader's way and in the reader's words", () => {
    expect(
      listPageTitle({
        name: "Heilige",
        pages: [{ page: 2, pageCount: 3 }],
        query: "x",
        total: 1250,
        t: createTranslator("de"),
        locale: "de",
      }),
    ).toBe("1.250 Ergebnisse für „x“ · Heilige · Seite 2 von 3");
  });
});

describe("listPageTitleFor", () => {
  const state = { name: "Saints", filter: "Martyrs", t, locale: "en" };
  const read = () => Promise.resolve({ pages: [{ page: 2, pageCount: 3 }], total: 80 });

  it("reads nothing for what the URL alone can say", async () => {
    const reader = vi.fn(read);
    await expect(listPageTitleFor({ ...state, query: "" }, false, reader)).resolves.toBe(
      "Martyrs · Saints",
    );
    expect(reader).not.toHaveBeenCalled();
  });

  it("reads for a search and for a page past the first", async () => {
    await expect(listPageTitleFor({ ...state, query: "joseph" }, false, read)).resolves.toBe(
      "80 results for “joseph” · Martyrs · Saints · page 2 of 3",
    );
    await expect(listPageTitleFor({ ...state, query: "" }, true, read)).resolves.toBe(
      "Martyrs · Saints · page 2 of 3",
    );
  });

  it("falls back to what is sure when the read fails, and never claims no results", async () => {
    const failing = () => Promise.reject(new Error("database unavailable"));
    await expect(listPageTitleFor({ ...state, query: "joseph" }, false, failing)).resolves.toBe(
      "Martyrs · Saints",
    );
  });
});

describe("listSearch.pageOf", () => {
  it("is written out in all twelve languages, keeping both numbers", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const text = DICTIONARIES[locale]["listSearch.pageOf"];
      expect(text, locale).toContain("{page}");
      expect(text, locale).toContain("{count}");
      if (locale !== "en") expect(text, locale).not.toBe(DICTIONARIES.en["listSearch.pageOf"]);
    }
  });
});

describe("MAX_PAGE_NUMBER", () => {
  it("is past the end of any list, and an offset built from it is safe", () => {
    // 271,945 parishes at 36 a page is under 8,000 pages.
    expect(MAX_PAGE_NUMBER).toBeGreaterThan(100_000);
    expect(MAX_PAGE_NUMBER * 100).toBeLessThan(2 ** 53);
  });
});

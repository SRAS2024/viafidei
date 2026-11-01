/**
 * The words of the content list pages' search bar, in every site language.
 *
 * Every non-English dictionary starts as a copy of English, so a key someone
 * forgot would silently show English to a Polish reader. These pin that each
 * `listSearch.*` string is written out in all twelve languages, keeps its
 * placeholders, and that `listSearch.results` has exactly the plural forms
 * each language's grammar uses — so a count never borrows English's form.
 */
import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { pluralCategory, tPlural } from "@/lib/i18n/plural";
import { createTranslator } from "@/lib/i18n/translator";

const EN = DICTIONARIES.en;
const PAGE_LABELS = [
  "prayers",
  "litanies",
  "saints",
  "ourLady",
  "doctors",
  "popes",
  "parishes",
  "spiritualLife",
  "guides",
  "liturgy",
  "rites",
  "churchDocuments",
  "devotions",
  "novenas",
].map((page) => `listSearch.${page}`);
const PHRASES = [
  "listSearch.submit",
  "listSearch.clear",
  "listSearch.none",
  "listSearch.noneHint",
  "listSearch.parishesPlaceholder",
];
/**
 * What shows inside the empty field: each page's label, except the parish
 * directory's, which has a shorter hint of its own.
 */
const PLACEHOLDERS = [
  ...PAGE_LABELS.filter((key) => key !== "listSearch.parishes"),
  "listSearch.parishesPlaceholder",
];
/** Characters a phone's field shows at 16px beside the search button (375px wide). */
const PHONE_FIELD_CHARS = 36;

/** The CLDR plural categories a language uses, as Intl reports them. */
function categoriesOf(locale: Locale): string[] {
  return new Intl.PluralRules(locale === "tl" ? "fil" : locale).resolvedOptions().pluralCategories;
}

describe("listSearch dictionaries", () => {
  it("labels every searchable list page in English", () => {
    for (const key of [...PAGE_LABELS, ...PHRASES]) {
      expect(typeof EN[key], key).toBe("string");
    }
  });

  it("is written out in every other language, not inherited from English", () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      for (const key of [...PAGE_LABELS, ...PHRASES]) {
        expect(DICTIONARIES[locale][key], `${locale} ${key}`).not.toBe(EN[key]);
      }
    }
  });

  it("fits every hint inside the field on a phone, in every language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of PLACEHOLDERS) {
        const text = DICTIONARIES[locale][key]!;
        expect([...text].length, `${locale} ${key}: ${text}`).toBeLessThanOrEqual(
          PHONE_FIELD_CHARS,
        );
      }
    }
  });

  it("keeps the {query} placeholder wherever the query is shown", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(DICTIONARIES[locale]["listSearch.none"], locale).toContain("{query}");
    }
  });

  it("has exactly the plural forms each language uses, each with {count} and {query}", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const category of categoriesOf(locale)) {
        const key = `listSearch.results.${category}`;
        const text = DICTIONARIES[locale][key];
        expect(typeof text, `${locale} ${key}`).toBe("string");
        expect(text, `${locale} ${key}`).toContain("{count}");
        expect(text, `${locale} ${key}`).toContain("{query}");
        if (locale !== "en") expect(text, `${locale} ${key}`).not.toBe(EN[key]);
      }
    }
  });

  it("reads a count in the reader's grammar and number format", () => {
    const line = (locale: Locale, count: number) =>
      tPlural(createTranslator(locale), locale, "listSearch.results", count, { query: "x" });
    expect(line("en", 1)).toBe("1 result for “x”");
    expect(line("en", 1250)).toBe("1,250 results for “x”");
    expect(line("pl", 2)).toBe("2 wyniki dla „x”");
    expect(line("pl", 12)).toBe("12 wyników dla „x”");
    expect(line("la", 1)).toBe("1 inventum pro «x»");
    expect(line("la", 7)).toBe("7 inventa pro «x»");
    expect(line("ko", 3)).toBe("“x” 검색 결과 3건");
    // A category a language has no phrase for falls back to its own "other".
    expect(line("es", 1_000_000)).toBe("1.000.000 de resultados para «x»");
    expect(pluralCategory("vi", 1)).toBe("other");
  });
});

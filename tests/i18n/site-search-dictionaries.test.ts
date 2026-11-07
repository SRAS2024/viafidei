/**
 * The words of the site search, in every site language: the header's own name,
 * which tells it from the search field and button a list page has, the count
 * beside each group of results, what each kind of content is called, and the
 * words of the suggestions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { typeLabelTranslations } from "@/lib/content-shared/content-type-labels";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { tPlural } from "@/lib/i18n/plural";
import { createTranslator } from "@/lib/i18n/translator";

const EN = DICTIONARIES.en;

/** The CLDR plural categories a language uses, as Intl reports them. */
function categoriesOf(locale: Locale): string[] {
  return new Intl.PluralRules(locale === "tl" ? "fil" : locale).resolvedOptions().pluralCategories;
}

/**
 * What a language's own file says, as opposed to what it inherits. Every dictionary
 * starts as a copy of English, and some of these words are the same in both ("Saint"
 * in French), so comparing with English cannot tell a translation from a gap.
 */
function ownKeys(locale: Locale): string {
  return readFileSync(join(process.cwd(), "src/lib/i18n/dictionaries", `${locale}.ts`), "utf8");
}

const TYPE_KEYS = Object.keys(EN).filter((key) => key.startsWith("search.type."));
const OWN_WORDS = [
  ...TYPE_KEYS,
  "search.title",
  "search.subtitle",
  "search.placeholder",
  "search.prompt",
  "search.unavailable",
  "search.suggest.searching",
  "search.suggest.unavailable",
  "search.suggest.none",
  "search.suggest.list",
  "search.suggest.keysSpoken",
  "search.suggest.keysShown",
  "search.suggest.all",
];
/** Characters a phone's field shows at 16px beside the search button (375px wide). */
const PHONE_FIELD_CHARS = 36;

describe("site search dictionaries", () => {
  it("writes out every word of the search in each language", () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      const source = ownKeys(locale);
      for (const key of [...OWN_WORDS, "nav.search"]) {
        expect(source.includes(`"${key}":`), `${locale} ${key}`).toBe(true);
      }
    }
  });

  it("calls each kind of content by a word of its own, in English as the data layer does", () => {
    expect(TYPE_KEYS).toHaveLength(16);
    for (const [label, word] of Object.entries(typeLabelTranslations(createTranslator("en")))) {
      expect(word).toBe(label);
    }
    for (const locale of SUPPORTED_LOCALES) {
      // Rows gather under these words, so two kinds with one word would read as one group.
      const words = TYPE_KEYS.map((key) => DICTIONARIES[locale][key]);
      expect(new Set(words).size, locale).toBe(words.length);
    }
  });

  it("keeps the placeholders that say what was searched for", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dict = DICTIONARIES[locale];
      expect(dict["search.suggest.none"], locale).toContain("{query}");
      expect(dict["search.suggest.all"], locale).toContain("{query}");
    }
  });

  it("fits the field's hint on a phone", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(DICTIONARIES[locale]["search.placeholder"].length, locale).toBeLessThanOrEqual(
        PHONE_FIELD_CHARS,
      );
    }
  });

  it("has exactly the plural forms each language uses for the suggestions' count", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const category of categoriesOf(locale)) {
        const key = `search.suggest.count.${category}`;
        expect(ownKeys(locale).includes(`"${key}":`), `${locale} ${key}`).toBe(true);
        expect(DICTIONARIES[locale][key], `${locale} ${key}`).toContain("{count}");
      }
    }
  });

  it("names the header's search apart from a page's own search and its button", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dict = DICTIONARIES[locale];
      const site = dict["search.site"];
      expect(typeof site, locale).toBe("string");
      expect(site, locale).not.toBe(dict["nav.search"]);
      expect(site, locale).not.toBe(dict["listSearch.submit"]);
    }
  });

  it("is written out in every other language, not inherited from English", () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
      expect(DICTIONARIES[locale]["search.site"], locale).not.toBe(EN["search.site"]);
      expect(DICTIONARIES[locale]["search.groupShown.other"], locale).not.toBe(
        EN["search.groupShown.other"],
      );
    }
  });

  it("has exactly the plural forms each language uses for a group's count", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const category of categoriesOf(locale)) {
        const key = `search.groupResults.${category}`;
        const text = DICTIONARIES[locale][key];
        expect(typeof text, `${locale} ${key}`).toBe("string");
        expect(text, `${locale} ${key}`).toContain("{count}");
        if (locale !== "en") expect(text, `${locale} ${key}`).not.toBe(EN[key]);
      }
    }
  });

  it("says how many of a group's results are here, in every language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const text = DICTIONARIES[locale]["search.groupShown.other"];
      expect(text, locale).toContain("{shown}");
      expect(text, locale).toContain("{count}");
    }
  });

  it("reads a count in the reader's grammar and number format", () => {
    const whole = (locale: Locale, count: number) =>
      tPlural(createTranslator(locale), locale, "search.groupResults", count);
    const part = (locale: Locale, shown: number, count: number) =>
      tPlural(createTranslator(locale), locale, "search.groupShown", count, { shown });
    expect(whole("en", 1)).toBe("1 result");
    expect(whole("en", 3)).toBe("3 results");
    expect(whole("pl", 2)).toBe("2 wyniki");
    expect(whole("pl", 12)).toBe("12 wyników");
    expect(whole("ko", 3)).toBe("결과 3건");
    expect(part("en", 9, 24)).toBe("9 of 24 results");
    expect(part("en", 25, 1250)).toBe("25 of 1,250 results");
    // Whatever the number's category, the one form after "of" serves.
    expect(part("pl", 9, 24)).toBe("9 z 24 wyników");
    expect(part("es", 9, 1_000_000)).toBe("9 de 1.000.000 resultados");
    expect(part("zh", 9, 24)).toBe("24 个结果中的 9 个");
  });
});

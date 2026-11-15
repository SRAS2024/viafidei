/**
 * The hero's buttons and the placeholders' sentence, in every site language. Every
 * non-English dictionary starts as a copy of English, so a key someone forgot would
 * silently show English to a Polish reader, beside whatever is already translated.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

const EN = DICTIONARIES.en!;

describe.each([
  "home.ctaExplore",
  "home.ctaJoin",
  "home.ctaProfile",
  "common.loadingContent",
  "common.loadingReadings",
  "common.loadingCalendar",
  "common.loadingLiturgy",
  "common.loadingPrayer",
  "common.loadingSaints",
])("%s", (key) => {
  it("has its English words", () => {
    expect(EN[key]).toBeTruthy();
  });

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "en"))(
    "is translated in %s",
    (locale) => {
      const text = DICTIONARIES[locale]![key];
      expect(text).toBeTruthy();
      expect(text).not.toBe(EN[key]);
    },
  );
});

/**
 * The homepage's own headings and paragraphs, the heads of the devotions, spiritual life
 * and guides, and the prayer language chips, written out in each language's own file. A
 * word may be the same as the English ("Latin" in French), so the file is read rather
 * than compared with English.
 */
const OWN_WORDS = [
  "home.title",
  "home.lede",
  "home.quickLinks.title",
  "home.newcomer.title",
  "home.newcomer.body",
  "home.featured.title",
  "home.mission.title",
  "home.mission.body",
  "home.catholic.title",
  "home.catholic.body",
  "devotions.title",
  "devotions.subtitle",
  "spiritualLife.title",
  "spiritualLife.subtitle",
  "guides.eyebrow",
  "guides.title",
  "guides.subtitle",
  "prayerLanguage.group",
  "prayerLanguage.groupFor",
  "prayerLanguage.en",
  "prayerLanguage.la",
  "prayerLanguage.el",
];

describe("the homepage and section heads in every language", () => {
  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "en"))("%s writes them out", (locale) => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/i18n/dictionaries", `${locale}.ts`),
      "utf8",
    );
    for (const key of OWN_WORDS) {
      expect(source.includes(`"${key}":`), `${locale} ${key}`).toBe(true);
      expect(DICTIONARIES[locale]![key], `${locale} ${key}`).toBeTruthy();
    }
    // The sentences are never the English.
    for (const key of OWN_WORDS.filter((k) => /\.(?:body|lede|subtitle|title)$/.test(k))) {
      if (key === "guides.title") continue; // "Guides" in French too
      expect(DICTIONARIES[locale]![key], `${locale} ${key}`).not.toBe(EN[key]);
    }
    expect(DICTIONARIES[locale]!["prayerLanguage.groupFor"]).toContain("{title}");
  });

  it("puts no filler under a page title in any language", () => {
    // The owner's rule: a line under a title only where it explains the subject.
    for (const locale of SUPPORTED_LOCALES) {
      const dict = DICTIONARIES[locale]!;
      expect(dict["search.subtitle"], locale).toBeUndefined();
      for (const key of ["home.lede", "devotions.subtitle", "spiritualLife.subtitle"]) {
        expect(dict[key], `${locale} ${key}`).not.toMatch(
          /curated|librar|biblio|and more|y más|et plus|altro ancora|und mehr|e muito mais|i nie tylko|et alia|at iba pa|Formation pathways|checklists/i,
        );
      }
      expect(dict["guides.subtitle"], locale).not.toMatch(/dropdown|steps first/i);
    }
  });
});

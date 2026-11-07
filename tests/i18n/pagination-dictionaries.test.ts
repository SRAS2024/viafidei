/**
 * What a voice says of a list's page links, in every site language. Read from each
 * language's own file: "Pagination" and "Page 2" are the same words in French, so
 * comparing with English cannot tell a translation from a gap, and every dictionary
 * falls back to English.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const ownFile = (locale: string) =>
  readFileSync(join(process.cwd(), "src/lib/i18n/dictionaries", `${locale}.ts`), "utf8");

describe.each([
  "pagination.label",
  "pagination.page",
  "pagination.marianTitles",
  "pagination.apparitions",
])("%s", (key) => {
  it.each(SUPPORTED_LOCALES)("is written out in %s", (locale) => {
    expect(ownFile(locale)).toContain(`"${key}":`);
    expect(DICTIONARIES[locale]![key]).toBeTruthy();
  });
});

describe("a page link's name", () => {
  it.each(SUPPORTED_LOCALES)("holds the page's number in %s", (locale) => {
    expect(createTranslator(locale)("pagination.page", { page: 7 })).toContain("7");
    expect(createTranslator(locale)("pagination.page", { page: 7 })).not.toContain("{");
  });

  it("is what English has always said", () => {
    const t = createTranslator("en");
    expect(t("pagination.page", { page: 2 })).toBe("Page 2");
    expect(t("pagination.label")).toBe("Pagination");
    expect(t("pagination.marianTitles")).toBe("Marian titles pages");
    expect(t("pagination.apparitions")).toBe("Apparitions pages");
  });
});

describe("a source that names a pager or a page in English", () => {
  it("is gone from the pager and the lists that use it", () => {
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    expect(read("src/components/ui/Pagination.tsx")).not.toMatch(/`Page \$\{|"Pagination"/);
    expect(read("src/app/history/HistoryTimeline.tsx")).not.toMatch(/`Page \$\{/);
    expect(read("src/app/our-lady/(list)/page.tsx")).not.toMatch(/label="[A-Z]/);
  });
});

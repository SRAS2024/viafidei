/**
 * The words the second i18n pass put into the dictionaries: /history's remaining
 * controls, the section name in /our-lady's tab title, a visionary's label that is
 * true of a man or a woman, and the new-tab note under a detail page's sources.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

const ownFile = (locale: string) =>
  readFileSync(join(process.cwd(), `src/lib/i18n/dictionaries/${locale}.ts`), "utf8");

const ENGLISH: Record<string, string> = {
  "history.order.oldest": "Oldest first",
  "history.order.newest": "Newest first",
  "history.eras.nav": "Eras",
  "history.theme.menu": "Filter the timeline by theme:",
  "history.theme.all": "All",
  "history.slider.go": "Go",
  "nav.spiritualGuidance": "Our Lady",
};

afterEach(() => {
  vi.doUnmock("react");
  vi.resetModules();
});

describe("second-pass dictionary words", () => {
  it("keeps the English exactly as the page said it", () => {
    for (const [key, value] of Object.entries(ENGLISH)) {
      expect(DICTIONARIES.en[key as keyof typeof DICTIONARIES.en]).toBe(value);
    }
  });

  it("writes every word out in each language's own file, in its own words", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const source = ownFile(locale);
      for (const [key, english] of Object.entries(ENGLISH)) {
        expect(source, `${locale} ${key}`).toContain(`"${key}":`);
        if (locale === "en") continue;
        const value = (DICTIONARIES[locale] as Record<string, string>)[key];
        expect(value, `${locale} ${key}`).toBeTruthy();
        expect(value, `${locale} ${key}`).not.toBe(english);
      }
    }
  });

  it("names a visionary with a word that is the same for a man or a woman", () => {
    // Bernadette, Mariette Beco, Catherine Labouré and Sister Agnes saw alone.
    expect(DICTIONARIES.fr["facts.visionaries"]).not.toBe("Voyants");
    expect(DICTIONARIES.de["facts.visionaries"]).not.toBe("Seher");
    expect(DICTIONARIES.pl["facts.visionaries"]).not.toBe("Wizjonerzy");
    expect(DICTIONARIES.fr["facts.visionaries"]).toBe("Témoins");
    expect(DICTIONARIES.de["facts.visionaries"]).toBe("Gesehen von");
    expect(DICTIONARIES.pl["facts.visionaries"]).toBe("Świadkowie");
  });
});

describe("the new-tab note under a detail page's sources", () => {
  it("is English when no language was chosen in this render", async () => {
    const { newTabNote } = await import("@/components/ui/WikipediaAttribution");
    expect(newTabNote()).toBe("(opens in a new tab)");
  });

  it("says the request's language once getLocale has chosen it", async () => {
    // Stand in for the server React's cache(): one box for the whole render.
    vi.resetModules();
    vi.doMock("react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react")>();
      return {
        ...actual,
        cache: <T,>(fn: () => T) => {
          let value: T | undefined;
          return () => (value ??= fn());
        },
      };
    });
    const { rememberRequestLocale } = await import("@/lib/i18n/request-locale");
    const { newTabNote } = await import("@/components/ui/WikipediaAttribution");
    const { PublicDomainAttribution } = await import("@/components/ui/PublicDomainAttribution");
    rememberRequestLocale("es");
    expect(newTabNote()).toBe(DICTIONARIES.es["common.opensInNewTab"]);
    rememberRequestLocale("ko");
    expect(newTabNote()).toBe(DICTIONARIES.ko["common.opensInNewTab"]);
    // The public-domain line reads the same note.
    const html = renderToStaticMarkup(
      <PublicDomainAttribution
        payload={{
          biography: "Saint Ita, called the Brigid of Munster.",
          provenance: {
            biography: "catholic-encyclopedia-1913",
            biographyUrl: "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)/St._Ita",
            biographyTitle: "St. Ita",
          },
        }}
      />,
    );
    expect(html).toContain(
      `<span class="sr-only"> ${DICTIONARIES.ko["common.opensInNewTab"]}</span>`,
    );
    expect(html).not.toContain("opens in a new tab");
  });
});

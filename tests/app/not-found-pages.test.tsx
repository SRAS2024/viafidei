/**
 * @vitest-environment jsdom
 */
/**
 * A missing page says one thing, the same way, in the reader's language: what is
 * missing, why that may be, and the way back. Its browser title says it too, because
 * that is the first thing a screen reader says. These used to read "Not found", "Entry
 * not found" and "Page not found" over a "404" label, in English under any language,
 * with the homepage's title and an "index, follow" that contradicted Next's own noindex.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const locale = vi.hoisted(() => ({ current: "en" as string }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator(locale.current as never) }),
}));

import * as Root from "@/app/not-found";
import * as Devotion from "@/app/devotions/[slug]/not-found";
import * as Doctor from "@/app/doctors/[slug]/not-found";
import * as Guide from "@/app/guides/[slug]/not-found";
import * as Liturgy from "@/app/liturgy-history/[slug]/not-found";
import * as Novena from "@/app/novenas/[slug]/not-found";
import * as OurLady from "@/app/our-lady/[slug]/not-found";
import * as Parish from "@/app/parishes/[slug]/not-found";
import * as Pope from "@/app/popes/[slug]/not-found";
import * as Prayer from "@/app/prayers/[slug]/not-found";
import * as Rite from "@/app/rites/[slug]/not-found";
import * as Sacrament from "@/app/sacraments/[slug]/not-found";
import * as Saint from "@/app/saints/[slug]/not-found";
import * as Practice from "@/app/spiritual-life/[slug]/not-found";

afterEach(() => {
  cleanup();
  locale.current = "en";
});

const PAGES = [
  ["/nope", Root, "Page not found", "Return home", "/"],
  ["/prayers/nope", Prayer, "Prayer not found", "Back to Prayers", "/prayers"],
  ["/saints/nope", Saint, "Saint not found", "Back to Saints", "/saints"],
  ["/novenas/nope", Novena, "Novena not found", "Back to Novenas", "/novenas"],
  ["/devotions/nope", Devotion, "Devotion not found", "Back to Devotions", "/devotions"],
  ["/guides/nope", Guide, "Guide not found", "Back to Guides", "/guides"],
  ["/sacraments/nope", Sacrament, "Sacrament not found", "Back to Sacraments", "/sacraments"],
  [
    "/spiritual-life/nope",
    Practice,
    "Spiritual practice not found",
    "Back to Spiritual Life",
    "/spiritual-life",
  ],
  ["/our-lady/nope", OurLady, "Page not found", "Back to Our Lady", "/our-lady"],
  ["/liturgy-history/nope", Liturgy, "Page not found", "Back to Liturgy", "/liturgy"],
  ["/parishes/nope", Parish, "Parish not found", "Back to Parishes", "/parishes"],
  ["/popes/nope", Pope, "Pope not found", "Back to Popes", "/popes"],
  [
    "/doctors/nope",
    Doctor,
    "Doctor of the Church not found",
    "Back to Doctors of the Church",
    "/doctors",
  ],
  ["/rites/nope", Rite, "Rite not found", "Back to Rites", "/rites"],
] as const;

describe("a not-found page", () => {
  it.each(PAGES)(
    "%s says what is missing and the way back",
    async (_path, page, title, back, to) => {
      render(await page.default());
      expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
      expect(
        screen.getByText("This page may have been removed, or the link may be incorrect."),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: back })).toHaveAttribute("href", to);
    },
  );

  it.each(PAGES)(
    "%s says it in its browser title, with no robots line of its own",
    async (_p, page, title) => {
      // Next adds its own noindex to a not-found answer. Null clears the root layout's
      // "index, follow", which would otherwise sit beside it and contradict it.
      await expect(page.generateMetadata()).resolves.toEqual({ title, robots: null });
    },
  );

  it("has no 404 label: the title says it in words", async () => {
    const { container } = render(await Saint.default());
    expect(container.textContent).not.toContain("404");
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
  });

  it("speaks the reader's language, on the page and in the title", async () => {
    locale.current = "es";
    render(await Saint.default());
    expect(
      screen.getByRole("heading", { level: 1, name: "Santo no encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a los santos" })).toBeInTheDocument();
    await expect(Saint.generateMetadata()).resolves.toMatchObject({ title: "Santo no encontrado" });
  });
});

describe("the not-found wording", () => {
  const KEYS = Object.keys(DICTIONARIES.en).filter((key) => key.startsWith("notFound."));

  it("is one shape for every kind of page", () => {
    expect(KEYS).toContain("notFound.body");
    for (const key of KEYS) {
      if (key.endsWith(".title")) expect(DICTIONARIES.en[key], key).toMatch(/ not found$/);
      if (key.endsWith(".back") && key !== "notFound.page.back") {
        expect(DICTIONARIES.en[key], key).toMatch(/^Back to /);
      }
    }
  });

  it.each(SUPPORTED_LOCALES.filter((lang) => lang !== "en"))(
    "is written out in %s, not left in English",
    (lang) => {
      const dict = DICTIONARIES[lang];
      const untranslated = [...KEYS, "home.ctaProfile"].filter(
        (key) => !dict[key] || dict[key] === DICTIONARIES.en[key],
      );
      expect(untranslated).toEqual([]);
    },
  );
});

describe("every detail route", () => {
  const APP = join(process.cwd(), "src", "app");
  const detailRoutes = readdirSync(APP, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(APP, name, "[slug]", "page.tsx")));

  it("is covered above", () => {
    expect(detailRoutes.sort()).toEqual(
      PAGES.slice(1)
        .map(([path]) => path.split("/")[1]!)
        .sort(),
    );
  });

  it.each(detailRoutes)("/%s has a not-found page that speaks for itself", (name) => {
    const source = readFileSync(join(APP, name, "[slug]", "not-found.tsx"), "utf8");
    expect(source).toContain("notFoundMetadata(");
    expect(source).toContain("notFoundPage(");
  });
});

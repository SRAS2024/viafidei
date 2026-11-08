/**
 * The /our-lady tab title in the reader's language. Under "All" the page holds two lists,
 * and the title names the one that has paged, as the pager beside it does: in Spanish
 * "Advocaciones marianas", not "Marian Titles", which a Spanish voice would misread.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedItem } from "@/lib/data/published";

const listPublished = vi.fn();
const language = vi.hoisted(() => ({ locale: "en" }));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => fn,
}));
vi.mock("@/lib/data/published", () => ({
  listPublished: (...args: unknown[]) => listPublished(...args),
}));
vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("@/lib/i18n/translator");
  return {
    getTranslator: async () => ({
      t: createTranslator(language.locale as "en"),
      locale: language.locale,
    }),
  };
});
vi.mock("@/lib/translation/localize", () => ({
  localizeItems: async (items: unknown[]) => items,
}));

import { generateMetadata } from "@/app/our-lady/(list)/page";

function entries(contentType: string, count: number): PublishedItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${contentType}-${i}`,
    contentType,
    slug: `${contentType.toLowerCase()}-${i}`,
    title: `Entry ${i + 1}`,
    subtitle: "",
    payload: { title: `Entry ${i + 1}`, summary: "A summary." },
    authorityLevel: "VERIFIED",
    version: 1,
    publishedAt: null,
  })) as unknown as PublishedItem[];
}

async function titleIn(locale: string, params: Record<string, string>): Promise<string> {
  language.locale = locale;
  const { title } = await generateMetadata({ searchParams: Promise.resolve(params) });
  return String(title);
}

beforeEach(() => {
  listPublished.mockImplementation(async (type: string) => entries(type, 40));
});

describe("the /our-lady tab title", () => {
  it("keeps its English", async () => {
    expect(await titleIn("en", { filter: "all", page: "2" })).toBe(
      "All · Our Lady · Marian Titles page 2 of 2",
    );
    expect(await titleIn("en", { filter: "all", apage: "2" })).toBe(
      "All · Our Lady · Apparitions page 2 of 2",
    );
  });

  it.each([
    ["es", "Todo", "Advocaciones marianas", "Apariciones"],
    ["fr", "Tout", "Titres marials", "Apparitions"],
    ["ko", "전체", "성모 칭호", "성모 발현"],
  ])("names the filter and the paged list in %s", async (locale, all, titles, apparitions) => {
    const first = await titleIn(locale, { filter: "all", page: "2" });
    const second = await titleIn(locale, { filter: "all", apage: "2" });
    expect(first.startsWith(`${all} · `)).toBe(true);
    expect(first).toContain(titles);
    expect(second).toContain(apparitions);
    for (const english of ["All ·", "Marian Titles"]) {
      expect(first).not.toContain(english);
      expect(second).not.toContain(english);
    }
  });
});

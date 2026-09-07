/**
 * @vitest-environment jsdom
 */
/**
 * The homepage's featured prayers rail (PUB-10).
 *
 * It used to call `listPublished("PRAYER")` — every prayer with its full body
 * — and take the first six alphabetically, so at the 1,000-prayer goal each
 * homepage view pulled megabytes of prayer text to print six titles, and the
 * rail read "Act of Contrition, Act of Faith, …" forever. It now asks for six
 * prayers keyed to the day, and it prints the category LABEL, which is what
 * kept "theological-virtue" and "dominical" off the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const listFeaturedPrayers = vi.fn();
const listPublished = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listFeaturedPrayers: (...args: unknown[]) => listFeaturedPrayers(...args),
  listPublished: (...args: unknown[]) => listPublished(...args),
}));
vi.mock("@/lib/data/homepage", () => ({ getPublishedFeaturedBlocks: async () => [] }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (key: string) => key }),
}));
// The other homepage blocks read the database or the network of their own
// accord; this file is about the featured rail, so they are stubbed out.
vi.mock("@/app/_sections", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  LiturgicalToday: () => null,
  HomePrayerOfTheDay: () => null,
  HomeToday: () => null,
}));

import HomePage from "@/app/page";

beforeEach(() => {
  listFeaturedPrayers.mockReset();
  listPublished.mockReset();
});
afterEach(() => cleanup());

describe("homepage featured prayers", () => {
  it("asks for the day's six prayers and never loads the prayer library", async () => {
    listFeaturedPrayers.mockResolvedValue([]);
    render(await HomePage());

    expect(listPublished).not.toHaveBeenCalled();
    expect(listFeaturedPrayers).toHaveBeenCalledTimes(1);
    // Keyed to a calendar day: the same set all day, a different set tomorrow.
    const dayKey = listFeaturedPrayers.mock.calls[0]![0] as string;
    expect(dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dayKey).toBe(new Date().toISOString().slice(0, 10));
  });

  it("renders the category LABEL as the eyebrow, never the stored value", async () => {
    listFeaturedPrayers.mockResolvedValue([
      {
        id: "faith",
        slug: "act-of-faith",
        title: "Act of Faith",
        category: "theological-virtue",
        categoryLabel: "Acts",
        href: "/prayers/act-of-faith",
      },
    ]);

    render(await HomePage());

    expect(screen.getByText("Acts")).toBeInTheDocument();
    expect(screen.queryByText("theological-virtue")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Act of Faith/ })).toHaveAttribute(
      "href",
      "/prayers/act-of-faith",
    );
  });

  it("falls open to the static rail when the query fails", async () => {
    listFeaturedPrayers.mockRejectedValue(new Error("db down"));
    render(await HomePage());
    // The homepage still renders its rail rather than erroring out.
    expect(screen.getByRole("link", { name: /Pater Noster/ })).toBeInTheDocument();
  });
});

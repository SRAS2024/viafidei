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
 *
 * The rail is always the day's prayers. A removed homepage makeover could once
 * publish rails of its own onto the HomePage record, and production may still
 * hold them; the page never reads that record.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const listFeaturedPrayers = vi.fn();
const listPublished = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listFeaturedPrayers: (...args: unknown[]) => listFeaturedPrayers(...args),
  listPublished: (...args: unknown[]) => listPublished(...args),
}));
// What a published makeover left behind: a PUBLISHED HomePage with a rail on it.
const homePageFindUnique = vi.fn(async () => ({
  slug: "homepage",
  status: "PUBLISHED",
  blocks: [
    {
      blockKey: "featured-saints",
      blockType: "featured-saints",
      sortOrder: 2,
      configJson: {
        heading: "Featured Saints",
        items: [{ slug: "saint-hyginus", title: "Saint Hyginus" }],
      },
    },
  ],
}));
vi.mock("@/lib/db/client", () => ({
  prisma: { homePage: { findUnique: (...args: unknown[]) => homePageFindUnique(...args) } },
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({}) }));
// The other homepage blocks read the database or the network of their own
// accord; this file is about the featured rail, so they are stubbed out.
vi.mock("@/app/_sections", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  HomeTodaySection: () => null,
}));

import HomePage from "@/app/page";

beforeEach(() => {
  listFeaturedPrayers.mockReset();
  listPublished.mockReset();
  homePageFindUnique.mockClear();
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

  it("shows the day's prayers whatever the HomePage record holds", async () => {
    listFeaturedPrayers.mockResolvedValue([
      {
        id: "profundis",
        slug: "de-profundis",
        title: "De Profundis",
        category: "penitential",
        categoryLabel: "Penitential",
        href: "/prayers/de-profundis",
      },
    ]);
    render(await HomePage());

    expect(listFeaturedPrayers).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /De Profundis/ })).toBeInTheDocument();
    expect(screen.queryByText("Saint Hyginus")).not.toBeInTheDocument();
    expect(homePageFindUnique).not.toHaveBeenCalled();
  });

  it("renders the category LABEL as the card's line, never the stored value", async () => {
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

  it("names no type for a general prayer", async () => {
    listFeaturedPrayers.mockResolvedValue([
      {
        id: "peace",
        slug: "prayer-for-peace",
        title: "Prayer for Peace",
        category: "general",
        categoryLabel: "General",
        href: "/prayers/prayer-for-peace",
      },
    ]);

    render(await HomePage());

    expect(screen.getByRole("link", { name: "Prayer for Peace" })).toBeInTheDocument();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
  });

  it("falls open to the static rail when the query fails", async () => {
    listFeaturedPrayers.mockRejectedValue(new Error("db down"));
    render(await HomePage());
    // The homepage still renders its rail rather than erroring out.
    expect(screen.getByRole("link", { name: /Pater Noster/ })).toBeInTheDocument();
  });
});

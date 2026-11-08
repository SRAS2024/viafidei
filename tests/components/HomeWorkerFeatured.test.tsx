/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { railColumns } from "@/app/_sections/FeaturedRail";
import { HomeWorkerFeatured } from "@/app/_sections/HomeWorkerFeatured";
import type { FeaturedBlockView } from "@/lib/data/homepage";

vi.mock("@/lib/data/homepage", () => ({
  featuredHrefFor: (type: string, slug: string) =>
    `/${type.replace("featured-", "")}/${encodeURIComponent(slug)}`,
}));

afterEach(() => cleanup());

const WORDS: Record<string, string> = {
  "home.featured.section": "Featured",
  "home.featured.novenas": "Novenas",
  "nav.prayers": "Prayers",
  "home.featured.saints": "Saints",
  "home.featured.devotions": "Devotions",
  "common.open": "Open",
  "saints.feastDay": "Feast day",
};
const t = (key: string, vars?: Record<string, string | number>) =>
  key === "saints.card.patronOf" ? `Patron of ${vars?.patronages}` : (WORDS[key] ?? key);

function block(
  kind: string,
  items: FeaturedBlockView["items"],
  heading = `Featured ${kind[0]!.toUpperCase()}${kind.slice(1)}`,
): FeaturedBlockView {
  return { blockKey: `featured-${kind}`, blockType: `featured-${kind}`, heading, items };
}

const nItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ slug: `item-${i}`, title: `Item ${i}` }));

/** The column class of the grid under a rail's heading. */
function gridOf(name: string): Element {
  const rail = screen.getByRole("heading", { level: 3, name }).parentElement!;
  return rail.querySelector(".vf-grid")!;
}

describe("railColumns", () => {
  it.each([
    [2, 2],
    [3, 3],
    [4, 2],
    [6, 3],
    [8, 2],
    [9, 3],
  ])("keeps %i cards in whole rows of %i", (count, columns) => {
    expect(railColumns(count)).toBe(columns);
    expect(count % columns).toBe(0);
  });

  it.each([1, 5, 7])("gives %i cards rows of three, the last row sharing its width", (count) => {
    expect(railColumns(count)).toBe(3);
  });
});

describe("HomeWorkerFeatured", () => {
  it("is one section, 'Featured', with each rail a subsection beneath it", () => {
    render(
      <HomeWorkerFeatured
        t={t}
        blocks={[
          block("prayers", nItems(4)),
          block("saints", nItems(4)),
          block("devotions", nItems(3)),
          block("novenas", nItems(3)),
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "Featured" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    for (const name of ["Prayers", "Saints", "Devotions", "Novenas"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("pairs four cards and sets three in a row", () => {
    render(
      <HomeWorkerFeatured
        t={t}
        blocks={[block("prayers", nItems(4)), block("novenas", nItems(3))]}
      />,
    );

    expect(gridOf("Prayers")).toHaveClass("vf-grid--2");
    expect(gridOf("Novenas")).toHaveClass("vf-grid--3");
  });

  it("gives every card a heading link, an action, and the same metadata treatment", () => {
    render(
      <HomeWorkerFeatured
        t={t}
        blocks={[
          block("prayers", [
            { slug: "de-profundis", title: "De Profundis (Psalm 130)", meta: ["Penitential"] },
          ]),
          block("saints", [
            {
              slug: "saint-hyginus",
              title: "Saint Hyginus",
              meta: [],
              saint: { patronages: ["the Church of Rome"], feast: "January 11" },
            },
          ]),
          block("devotions", [
            { slug: "devotion-to-saint-joseph", title: "Devotion to Saint Joseph" },
          ]),
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: "De Profundis (Psalm 130)" });
    expect(link).toHaveAttribute("href", "/prayers/de-profundis");
    expect(link.closest("h4")).not.toBeNull();
    expect(screen.getByText("Penitential")).toHaveClass("vf-entry-meta");

    // A saint: name, patronage, then feast day.
    const saint = screen.getByRole("link", { name: "Saint Hyginus" }).closest("article")!;
    expect([...saint.querySelectorAll(".vf-entry-meta")].map((line) => line.textContent)).toEqual([
      "Patron of the Church of Rome",
      "Feast day: January\u00a011",
    ]);

    // A card with no metadata is still a whole card.
    const plain = screen
      .getByRole("link", { name: "Devotion to Saint Joseph" })
      .closest("article")!;
    expect(plain.querySelectorAll(".vf-entry-meta")).toHaveLength(0);
    expect(within(plain as HTMLElement).getByText("Open", { exact: false })).toHaveClass(
      "vf-entry-action",
    );
  });

  it("words the kinds it knows in the reader's language, and a custom rail as stored", () => {
    render(
      <HomeWorkerFeatured
        t={(key) => (key === "nav.prayers" ? "Oraciones" : t(key))}
        blocks={[
          block("prayers", nItems(1)),
          block("sacraments", nItems(1), "Featured Sacraments"),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Oraciones" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Sacraments" })).toBeInTheDocument();
  });

  it("renders nothing without rails", () => {
    const { container } = render(<HomeWorkerFeatured t={t} blocks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

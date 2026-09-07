/**
 * @vitest-environment jsdom
 */
/**
 * PublishedList takes either shape the data layer returns (PUB-3):
 * the full `PublishedItem` (payload included) for the small catalogues whose
 * cards show payload prose, and the payload-free `PublishedListItem`
 * projection for the types that grow without bound.
 *
 * The rule both modes share: a card NEVER prints a raw stored enum (G-08).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PublishedList } from "@/components/ui/PublishedList";
import { guideEyebrow } from "@/lib/content-shared/guide-categories";
import type { PublishedItem, PublishedListItem } from "@/lib/data/published";

afterEach(() => cleanup());

function projected(over: Partial<PublishedListItem> & { id: string }): PublishedListItem {
  return {
    contentType: "SAINT",
    slug: over.id,
    title: over.id,
    subtitle: "A saint of the Catholic Church",
    subtype: null,
    href: `/saints/${over.id}`,
    ...over,
  };
}

function full(id: string, payload: Record<string, unknown>): PublishedItem {
  return {
    id,
    checklistItemId: id,
    contentType: "GUIDE",
    slug: id,
    title: id,
    subtitle: "A guide to Catholic life and practice",
    payload,
    authorityLevel: "VATICAN",
    version: 1,
    publishedAt: new Date(),
  };
}

describe("PublishedList — projected rows", () => {
  it("links each row and shows no summary line by default", () => {
    render(
      <PublishedList
        items={[projected({ id: "agnes", title: "Saint Agnes", subtype: "virgin" })]}
        baseHref="/saints"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/saints/agnes");
    // The stored subtitle is a type label; 30 copies of it is noise, so it is
    // opt-in rather than the default.
    expect(screen.queryByText(/A saint of the Catholic Church/)).not.toBeInTheDocument();
  });

  it("shows the stored subtitle when the page asks for it", () => {
    render(
      <PublishedList
        items={[projected({ id: "agnes", title: "Saint Agnes" })]}
        baseHref="/saints"
        showSubtitle
      />,
    );
    expect(screen.getByText("A saint of the Catholic Church")).toBeInTheDocument();
  });

  it("humanises the indexed subtype used as the eyebrow — never the raw enum", () => {
    render(
      <PublishedList
        items={[
          projected({
            id: "advent",
            title: "Preparing for Advent",
            contentType: "GUIDE",
            subtype: "lent_preparation",
          }),
        ]}
        baseHref="/guides"
        eyebrowField="kind"
      />,
    );
    expect(screen.getByText("Lent")).toBeInTheDocument();
    expect(screen.queryByText("lent_preparation")).not.toBeInTheDocument();
  });

  it("does not re-sort a page the database already ordered", () => {
    // sortItems only applies to full rows; a projected page is one SQL page,
    // and re-sorting it would shuffle 30 rows out of the global order.
    render(
      <PublishedList
        items={[projected({ id: "b", title: "Second" }), projected({ id: "a", title: "First" })]}
        baseHref="/saints"
        sortItems={(x, y) => x.title.localeCompare(y.title)}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Second",
      "First",
    ]);
  });
});

describe("PublishedList — full rows", () => {
  it("keeps rendering the payload summary", () => {
    render(
      <PublishedList
        items={[
          full("holy-hour", {
            kind: "adoration",
            summary: "An hour before the Blessed Sacrament.",
          }),
        ]}
        baseHref="/guides"
      />,
    );
    expect(screen.getByText("An hour before the Blessed Sacrament.")).toBeInTheDocument();
  });

  it("humanises a payload enum eyebrow (G-08: no `lent_preparation` / `rcia` on a card)", () => {
    render(
      <PublishedList
        items={[
          full("ocia", { kind: "rcia", summary: "Becoming Catholic." }),
          full("lent", { kind: "lent_preparation", summary: "Preparing for Lent." }),
          full("plain", { kind: "general", summary: "A guide." }),
        ]}
        baseHref="/guides"
        eyebrowField="kind"
      />,
    );
    expect(screen.getByText("OCIA")).toBeInTheDocument();
    expect(screen.getByText("Lent")).toBeInTheDocument();
    expect(screen.getByText("Guide")).toBeInTheDocument();
    for (const raw of ["rcia", "lent_preparation", "general"]) {
      expect(screen.queryByText(raw)).not.toBeInTheDocument();
    }
  });

  it("uses the computed guide eyebrow when the page supplies one", () => {
    render(
      <PublishedList
        items={[full("consecrate", { kind: "consecration", summary: "Total consecration." })]}
        baseHref="/guides"
        eyebrowFor={(item) => guideEyebrow("payload" in item ? item.payload : {})}
      />,
    );
    expect(screen.getByText("Consecration")).toBeInTheDocument();
  });
});

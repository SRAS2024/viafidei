/**
 * @vitest-environment jsdom
 */
/**
 * /sacraments groups the seven cards under the Catechism's three names, in the
 * Catechism's order, and its loading placeholder is that same composition.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { PublishedItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

let published: PublishedItem[] = [];

vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en") }),
}));

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return { ...actual, listPublished: async () => published };
});

import SacramentsPage from "@/app/sacraments/(list)/page";
import SacramentsLoading from "@/app/sacraments/(list)/loading";

function sacrament(slug: string, title: string, sacramentKey: string): PublishedItem {
  return {
    id: slug,
    contentType: "SACRAMENT",
    slug,
    title,
    subtitle: "",
    authorityLevel: "VATICAN",
    version: 1,
    payload: { sacramentKey },
  } as unknown as PublishedItem;
}

const ALL = [
  sacrament("baptism", "Baptism", "baptism"),
  sacrament("eucharist", "The Holy Eucharist", "eucharist"),
  sacrament("confirmation", "Confirmation", "confirmation"),
  sacrament("reconciliation", "The Sacrament of Reconciliation", "reconciliation"),
  sacrament("anointing-of-the-sick", "The Anointing of the Sick", "anointing_of_the_sick"),
  sacrament("matrimony", "Matrimony", "matrimony"),
  sacrament("holy-orders", "Holy Orders", "holy_orders"),
];

/** Each group's heading, then its cards' names, as a screen reader meets them. */
const groups = () =>
  screen.getAllByRole("region").map((region) => ({
    heading: within(region).getByRole("heading", { level: 2 }).textContent,
    cards: within(region)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent),
  }));

beforeEach(() => {
  published = ALL;
});
afterEach(() => cleanup());

describe("/sacraments", () => {
  it("groups the seven under the Catechism's names, in its order", async () => {
    render(await SacramentsPage());
    expect(groups()).toEqual([
      {
        heading: "Sacraments of Christian Initiation",
        cards: ["Baptism", "Confirmation", "Holy Communion"],
      },
      { heading: "Sacraments of Healing", cards: ["Confession", "Anointing of the Sick"] },
      { heading: "Sacraments at the Service of Communion", cards: ["Holy Orders", "Matrimony"] },
    ]);
  });

  it("links each card to its own sacrament, by its record and not its position", async () => {
    render(await SacramentsPage());
    for (const [name, href] of [
      ["Baptism", "/sacraments/baptism"],
      ["Confirmation", "/sacraments/confirmation"],
      ["Holy Communion", "/sacraments/eucharist"],
      ["Confession", "/sacraments/reconciliation"],
      ["Anointing of the Sick", "/sacraments/anointing-of-the-sick"],
      ["Holy Orders", "/sacraments/holy-orders"],
      ["Matrimony", "/sacraments/matrimony"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("lays the first group out three across and the others two across", async () => {
    const { container } = render(await SacramentsPage());
    const grids = Array.from(container.querySelectorAll("ul.vf-sacrament-grid"));
    expect(grids.map((grid) => grid.classList.contains("vf-sacrament-grid--3"))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("calls each group a list out loud, since Safari drops the role with the markers", async () => {
    const { container } = render(await SacramentsPage());
    const grids = Array.from(container.querySelectorAll("ul.vf-sacrament-grid"));
    expect(grids).toHaveLength(3);
    for (const grid of grids) expect(grid).toHaveAttribute("role", "list");
  });

  it("keeps the badges out of what a screen reader hears", async () => {
    const { container } = render(await SacramentsPage());
    const badges = container.querySelectorAll("svg.vf-sacrament-badge");
    expect(badges).toHaveLength(7);
    for (const badge of badges) expect(badge).toHaveAttribute("aria-hidden");
  });

  it("shows a sacrament with no page as a card that is not a link", async () => {
    published = ALL.filter((item) => item.slug !== "matrimony");
    render(await SacramentsPage());
    expect(screen.getByRole("heading", { level: 3, name: "Matrimony" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Matrimony" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });
});

describe("/sacraments while it loads", () => {
  it("holds the finished composition, with nothing to follow yet", async () => {
    const { container } = render(await SacramentsLoading());
    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Loading the latest published content"));
    // Beside the busy wrapper, not in it, where a screen reader may hold it back.
    expect(status.closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByTestId("tab-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The Seven Sacraments");
    const grids = Array.from(container.querySelectorAll("ul.vf-sacrament-grid"));
    expect(grids.map((grid) => grid.querySelectorAll("li").length)).toEqual([3, 2, 2]);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});

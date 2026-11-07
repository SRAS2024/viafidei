/**
 * @vitest-environment jsdom
 */
/**
 * The parish pages' loading placeholders hold the finished pages' shape, so
 * nothing rearranges when the content arrives: the directory's opening, control
 * row and three columns of cards, and a parish page's single column. The parish
 * page has its own placeholder because the nearest one would otherwise be the
 * directory's, three columns of cards standing in for a page that has none.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import ParishLoading from "@/app/parishes/[slug]/loading";
import ParishesLoading from "@/app/parishes/loading";

afterEach(() => cleanup());

describe("/parishes loading", () => {
  it("opens with the page's own title, sentence and control row", () => {
    render(<ParishesLoading />);
    expect(screen.getByRole("heading", { level: 1, name: "Parishes" })).toBeInTheDocument();
    expect(screen.getByText(/use your location to find the nearest/)).toBeInTheDocument();
    expect(document.querySelector(".vf-locator .vf-list-controls")?.children).toHaveLength(2);
    expect(document.querySelector(".vf-locator-actions")?.children).toHaveLength(2);
  });

  it("reserves three columns of cards with the finished card's rows", () => {
    render(<ParishesLoading />);
    expect(screen.getByTestId("tab-loading-cards")).toHaveClass("vf-grid", "vf-grid--3");
    const cards = screen.getAllByTestId("tab-loading-card");
    expect(cards.length % 3).toBe(0);
    for (const card of cards) {
      expect(card).toHaveClass("vf-entry");
      expect(card.querySelector(".vf-entry-title")).not.toBeNull();
      expect(card.querySelector(".vf-entry-meta")).not.toBeNull();
      expect(card.querySelectorAll(".vf-address > span")).toHaveLength(3);
      expect(card.querySelector(".vf-entry-action")).not.toBeNull();
    }
  });

  it("tells a screen reader it is loading and hides the shapes from it", () => {
    render(<ParishesLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(screen.getByTestId("tab-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("tab-loading-cards").closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("/parishes/[slug] loading", () => {
  it("holds the reading column: title, designation, address lines, controls", () => {
    render(<ParishLoading />);
    const page = screen.getByTestId("detail-loading");
    expect(page).toHaveClass("vf-detail");
    expect(page.querySelector(".vf-detail-title")).not.toBeNull();
    expect(page.querySelector(".vf-detail-subtitle")).not.toBeNull();
    expect(page.querySelectorAll(".vf-address > span")).toHaveLength(3);
    expect(page.querySelector(".vf-detail-actions")?.children).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });
});

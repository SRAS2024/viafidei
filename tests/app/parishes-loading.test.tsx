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
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { createTranslator } from "@/lib/i18n/translator";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "es" }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator(locale.current) }),
}));

import ParishLoading from "@/app/parishes/[slug]/loading";
import ParishesLoading from "@/app/parishes/(list)/loading";

afterEach(() => {
  cleanup();
  locale.current = "en";
});

describe("/parishes loading", () => {
  it("opens with the page's own title, sentence and control row", async () => {
    render(await ParishesLoading());
    expect(screen.getByRole("heading", { level: 1, name: "Parishes" })).toBeInTheDocument();
    expect(screen.getByText(/use your location to find the nearest/)).toBeInTheDocument();
    expect(document.querySelector(".vf-locator .vf-list-controls")?.children).toHaveLength(2);
    expect(document.querySelector(".vf-locator-actions")?.children).toHaveLength(2);
  });

  it("reserves three columns of cards with the finished card's rows", async () => {
    render(await ParishesLoading());
    expect(screen.getByTestId("tab-loading-cards")).toHaveClass("vf-grid", "vf-grid--3");
    const cards = screen.getAllByTestId("tab-loading-card");
    expect(cards.length % 3).toBe(0);
    for (const card of cards) {
      expect(card).toHaveClass("vf-entry");
      expect(card.querySelector(".vf-entry-title")).not.toBeNull();
      expect(card.querySelector(".vf-entry-meta")).not.toBeNull();
      expect(card.querySelectorAll(".vf-address > span").length).toBeGreaterThanOrEqual(2);
      expect(card.querySelector(".vf-entry-action")).not.toBeNull();
    }
  });

  it("holds the first rows as tall as the directory's: one line of name, a third line of address", async () => {
    render(await ParishesLoading());
    const cards = screen.getAllByTestId("tab-loading-card");
    expect(cards.map((card) => card.querySelectorAll(".vf-address > span").length)).toEqual([
      2, 3, 2, 3, 2, 2, 2, 2, 2,
    ]);
    for (const card of cards) {
      expect(card.querySelector(".vf-entry-title")?.children).toHaveLength(1);
    }
  });

  it("holds the directory's sentence by its words, so it takes the lines it will take", async () => {
    render(await ParishesLoading());
    const line = document.querySelector(".vf-locator-line");
    expect(line?.firstElementChild).toHaveClass("invisible");
    expect(line).toHaveTextContent("parishes in the directory.");
    expect(line?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("gives the search button its real width, so the field does not shift", async () => {
    render(await ParishesLoading());
    const row = document.querySelector(".vf-locator .vf-list-controls > div");
    expect(row?.children[1]).toHaveClass("w-[2.875rem]", "sm:w-[7.7375rem]");
  });

  it("tells a screen reader it is loading and hides the shapes from it", async () => {
    render(await ParishesLoading());
    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent(/loading/i));
    // Beside the busy wrapper, not in it, where a screen reader may hold it back.
    expect(status.closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByTestId("tab-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("tab-loading-cards").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("says so in the reader's language", async () => {
    locale.current = "es";
    render(await ParishesLoading());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Cargando el contenido publicado"),
    );
  });
});

describe("/parishes/[slug] loading", () => {
  it("holds the reading column: title, designation, address lines, controls", async () => {
    render(await ParishLoading());
    const page = screen.getByTestId("detail-loading");
    expect(page).toHaveClass("vf-detail");
    expect(page.querySelector(".vf-detail-title")).not.toBeNull();
    expect(page.querySelector(".vf-detail-subtitle")).not.toBeNull();
    expect(page.querySelectorAll(".vf-address > span")).toHaveLength(3);
    expect(page.querySelector(".vf-detail-actions")?.children).toHaveLength(3);
    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent(/loading/i));
    expect(status.closest('[aria-busy="true"]')).toBeNull();
    expect(page).toHaveAttribute("aria-busy", "true");
  });

  it("says so in the reader's language", async () => {
    locale.current = "es";
    render(await ParishLoading());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Cargando el contenido publicado"),
    );
  });
});

/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { FavoritesBrowser, type FavoriteItem } from "@/app/profile/favorites/FavoritesBrowser";

const ITEMS: FavoriteItem[] = [
  {
    id: "1",
    contentType: "PRAYER",
    kind: "prayers",
    slug: "the-memorare",
    title: "The Memorare",
    href: "/prayers/the-memorare",
    typeLabel: "Prayer",
    savedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "2",
    contentType: "SAINT",
    kind: "saints",
    slug: "saint-francis",
    title: "Saint Francis",
    href: "/saints/saint-francis",
    typeLabel: "Saint",
    savedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "3",
    contentType: "APPARITION",
    kind: "apparitions",
    slug: "our-lady-of-lourdes",
    title: "Our Lady of Lourdes",
    href: "/our-lady/our-lady-of-lourdes",
    typeLabel: "Our Lady",
    savedAt: "2026-01-03T00:00:00.000Z",
  },
];

const filterTrigger = () => screen.getByRole("button", { name: /^Filter favorites by type/ });

/** A filter inside the opened dropdown, by the words on it. */
const filterOption = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  vi.spyOn(window, "confirm");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FavoritesBrowser", () => {
  it("shows all favorites by default with per-type counts", () => {
    render(<FavoritesBrowser items={ITEMS} />);
    expect(screen.getByRole("link", { name: "The Memorare" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saint Francis" })).toBeInTheDocument();
    // "Our Lady" is held together by a no-break space, which a voice reads as a space.
    expect(screen.getByRole("link", { name: /^Our\sLady of Lourdes$/ })).toBeInTheDocument();
    // Six type filters → a single dropdown trigger (unfiltered shows "Filter").
    const trigger = filterTrigger();
    expect(trigger).toHaveTextContent("Filter");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Inside the dropdown, "All" is selected and counts everything.
    fireEvent.click(trigger);
    const allOption = filterOption(/^All/);
    expect(allOption).toHaveAttribute("aria-pressed", "true");
    expect(allOption).toHaveTextContent("3");
  });

  it("filters to a single content type when its chip is selected", () => {
    render(<FavoritesBrowser items={ITEMS} />);
    fireEvent.click(filterTrigger());
    fireEvent.click(filterOption(/^Saints/));
    expect(screen.getByRole("link", { name: "Saint Francis" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "The Memorare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Our Lady of Lourdes" })).not.toBeInTheDocument();
    // The option that was focused is gone with the menu; focus returns to the trigger.
    expect(filterTrigger()).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("1 favorite");
  });

  it("lands focus only on a trigger that already names the choice, and only once", () => {
    render(<FavoritesBrowser items={ITEMS} />);
    const trigger = filterTrigger();
    fireEvent.click(trigger);
    const namesWhenFocused: Array<string | null> = [];
    trigger.addEventListener("focus", () => {
      namesWhenFocused.push(trigger.getAttribute("aria-label"));
    });
    fireEvent.click(filterOption(/^Prayers/));
    expect(namesWhenFocused).toEqual(["Filter favorites by type: Prayers"]);
  });

  it("gives every card its title as a heading, its link, and its type", () => {
    render(<FavoritesBrowser items={ITEMS} />);
    const heading = screen.getByRole("heading", { name: "The Memorare" });
    expect(within(heading).getByRole("link")).toHaveAttribute("href", "/prayers/the-memorare");
    expect(screen.getByText("Prayer")).toBeInTheDocument();
  });

  it("removes a favorite via DELETE /api/saved/<kind> after confirming, not before", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<FavoritesBrowser items={ITEMS} />);
    // The control names what it removes, among a page of identical buttons.
    fireEvent.click(screen.getByRole("button", { name: "Remove: The Memorare" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("The Memorare");
    expect(window.confirm).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/saved/prayers?id=the-memorare",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "The Memorare" })).not.toBeInTheDocument(),
    );
    // The button that was focused is gone; focus moves to the card that took its place.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Saint Francis" })),
    );
  });

  it("keeps the favorite when the confirmation is cancelled", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<FavoritesBrowser items={ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove: The Memorare" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The Memorare" })).toBeInTheDocument();
  });

  it("says so, and keeps the card, when the removal fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }) as Response),
    );
    render(<FavoritesBrowser items={ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove: The Memorare" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not remove/);
    expect(screen.getByRole("link", { name: "The Memorare" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no favorites", () => {
    render(<FavoritesBrowser items={[]} />);
    expect(screen.getByText(/haven't favorited anything yet/i)).toBeInTheDocument();
  });

  it("supports favorited parishes under the Parishes tab", () => {
    const parish: FavoriteItem = {
      id: "p1",
      contentType: "PARISH",
      kind: "parishes",
      slug: "st-marys-cathedral",
      title: "St. Mary's Cathedral",
      href: "/parishes/st-marys-cathedral",
      typeLabel: "Parish",
      savedAt: "2026-01-04T00:00:00.000Z",
    };
    render(<FavoritesBrowser items={[...ITEMS, parish]} />);
    fireEvent.click(filterTrigger());
    fireEvent.click(filterOption(/^Parishes/));
    expect(screen.getByRole("link", { name: "St. Mary's Cathedral" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "The Memorare" })).not.toBeInTheDocument();
  });
});

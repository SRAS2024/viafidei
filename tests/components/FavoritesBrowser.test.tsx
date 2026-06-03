/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FavoritesBrowser", () => {
  it("shows all favorites by default with per-type counts", () => {
    render(<FavoritesBrowser items={ITEMS} />);
    expect(screen.getByText("The Memorare")).toBeInTheDocument();
    expect(screen.getByText("Saint Francis")).toBeInTheDocument();
    expect(screen.getByText("Our Lady of Lourdes")).toBeInTheDocument();
    // "All" tab is selected and counts everything.
    const allTab = screen.getByRole("tab", { name: /All/ });
    expect(allTab).toHaveAttribute("aria-selected", "true");
    expect(allTab).toHaveTextContent("3");
  });

  it("filters to a single content type when its tab is selected", () => {
    render(<FavoritesBrowser items={ITEMS} />);
    fireEvent.click(screen.getByRole("tab", { name: /Saints/ }));
    expect(screen.getByText("Saint Francis")).toBeInTheDocument();
    expect(screen.queryByText("The Memorare")).not.toBeInTheDocument();
    expect(screen.queryByText("Our Lady of Lourdes")).not.toBeInTheDocument();
  });

  it("removes a favorite via DELETE /api/saved/<kind> and drops it from the list", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<FavoritesBrowser items={ITEMS} />);
    // Items render in the order passed; the first card is the Memorare (prayers).
    const removeButtons = screen.getAllByText("Remove");
    fireEvent.click(removeButtons[0]!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/saved/prayers?id=the-memorare",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("The Memorare")).not.toBeInTheDocument());
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
    fireEvent.click(screen.getByRole("tab", { name: /Parishes/ }));
    expect(screen.getByText("St. Mary's Cathedral")).toBeInTheDocument();
    expect(screen.queryByText("The Memorare")).not.toBeInTheDocument();
  });
});

/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { HomeToday } from "@/app/_sections/HomeToday";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const saints = (names: string[]) =>
  names.map((name) => ({ slug: name.toLowerCase().replace(/\s+/g, "-"), name, biography: "" }));

function respondWith(total: number, names: string[], month = 8, day = 28) {
  fetchSpy.mockResolvedValue(
    new Response(JSON.stringify({ month, day, total, items: saints(names) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("HomeToday — homepage 'Today's Feast Day Saints' section", () => {
  it("says it is loading, in a live region, then shows the saints list", async () => {
    respondWith(1, ["St. Augustine of Hippo"]);

    render(<HomeToday />);
    // The screen reader's message, not a sentence on the page: sighted readers
    // get placeholders that hold the list's shape instead.
    expect(screen.getByRole("status")).toHaveTextContent(/loading the day/i);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    // After the fetch resolves, the saint link appears and the message is gone.
    expect(await screen.findByRole("link", { name: "St. Augustine of Hippo" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("names the list after its heading, each saint a link to their page", async () => {
    respondWith(2, ["Saint Monica", "Saint Augustine"]);

    render(<HomeToday />);
    const list = await screen.findByRole("list", { name: "Today's Feast Day Saints" });
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/saints/saint-monica", "/saints/saint-augustine"]);
  });

  it("links to the rest of the day's saints when there are more than it shows", async () => {
    respondWith(11, ["A", "B", "C", "D", "E"], 11, 7);

    render(<HomeToday />);
    expect(await screen.findByRole("link", { name: "See more saints (6)" })).toHaveAttribute(
      "href",
      "/saints/today?month=11&day=7",
    );
  });

  it("links to the full list when it shows every saint of the day", async () => {
    respondWith(2, ["A", "B"], 11, 7);

    render(<HomeToday />);
    expect(
      await screen.findByRole("link", { name: "See the full feast day list" }),
    ).toHaveAttribute("href", "/saints/today?month=11&day=7");
  });

  it("shows the empty-state copy when the API returns zero matches", async () => {
    respondWith(0, [], 1, 1);

    render(<HomeToday />);
    expect(await screen.findByText(/no saints in our catalog/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse all saints/i })).toHaveAttribute(
      "href",
      "/saints",
    );
  });

  it("announces an error when the fetch throws", async () => {
    fetchSpy.mockRejectedValue(new Error("network"));
    render(<HomeToday />);
    expect(await screen.findByText(/could not load today/i)).toBe(screen.getByRole("status"));
    expect(screen.getByRole("status")).not.toHaveClass("sr-only");
  });
});

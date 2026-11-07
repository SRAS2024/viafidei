/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";

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

const ERROR = "Could not load today's feast list.";

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

    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    // The screen reader's message, not a sentence on the page: sighted readers
    // get placeholders that hold the list's shape instead.
    expect(screen.getByRole("status")).toHaveTextContent("Loading the day's saints…");
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    // After the fetch resolves, the saint link appears and the message is gone.
    expect(await screen.findByRole("link", { name: "St. Augustine of Hippo" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("names the list after its heading, each saint a link to their page", async () => {
    respondWith(2, ["Saint Monica", "Saint Augustine"]);

    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    const list = await screen.findByRole("list", { name: "Today's Feast Day Saints" });
    // Said out loud, because Safari drops the role along with the markers.
    expect(list).toHaveAttribute("role", "list");
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/saints/saint-monica", "/saints/saint-augustine"]);
  });

  it("links to the rest of the day's saints when there are more than it shows", async () => {
    respondWith(11, ["A", "B", "C", "D", "E"], 11, 7);

    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    expect(await screen.findByRole("link", { name: "See more saints (6)" })).toHaveAttribute(
      "href",
      "/saints/today?month=11&day=7",
    );
  });

  it("links to the full list when it shows every saint of the day", async () => {
    respondWith(2, ["A", "B"], 11, 7);

    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    expect(
      await screen.findByRole("link", { name: "See the full feast day list" }),
    ).toHaveAttribute("href", "/saints/today?month=11&day=7");
  });

  it("shows the empty-state copy when the API returns zero matches", async () => {
    respondWith(0, [], 1, 1);

    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    expect(await screen.findByText(/no saints in our catalog/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse all saints/i })).toHaveAttribute(
      "href",
      "/saints",
    );
  });

  it("asks for the new day's saints when the visitor comes back the next morning", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 7, 21, 0));
    respondWith(1, ["Saint Willibrord"], 11, 7);
    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    expect(await screen.findByRole("link", { name: "Saint Willibrord" })).toBeInTheDocument();
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("month=11&day=7&");

    respondWith(1, ["Saint Godfrey"], 11, 8);
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
      window.dispatchEvent(new Event("focus"));
    });
    expect(await screen.findByRole("link", { name: "Saint Godfrey" })).toBeInTheDocument();
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("month=11&day=8&");
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /full feast/ })).toHaveAttribute(
        "href",
        "/saints/today?month=11&day=8",
      ),
    );
    vi.useRealTimers();
  });

  it("does not ask again when the visitor comes back on the same day", async () => {
    respondWith(1, ["Saint Monica"]);
    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    expect(await screen.findByRole("link", { name: "Saint Monica" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("announces an error when the fetch throws", async () => {
    fetchSpy.mockRejectedValue(new Error("network"));
    render(<HomeToday loadingLabel="Loading the day's saints…" errorLabel={ERROR} />);
    expect(await screen.findByText(/could not load today/i)).toBe(screen.getByRole("status"));
    expect(screen.getByRole("status")).not.toHaveClass("sr-only");
  });

  it("says so in the words it is given, the reader's, and nothing in English", async () => {
    fetchSpy.mockRejectedValue(new Error("network"));
    render(
      <HomeToday
        loadingLabel="Cargando los santos del día…"
        errorLabel="No se pudo cargar la lista de santos del día."
      />,
    );
    expect(await screen.findByText("No se pudo cargar la lista de santos del día.")).toBe(
      screen.getByRole("status"),
    );
    expect(screen.queryByText(/could not load/i)).toBeNull();
  });
});

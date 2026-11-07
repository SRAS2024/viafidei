/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { HomePrayerOfTheDay } from "@/app/_sections/HomePrayerOfTheDay";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function respondWith(prayer: Record<string, unknown>) {
  fetchSpy.mockResolvedValue(
    new Response(JSON.stringify({ date: "2026-09-06", prayer }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("HomePrayerOfTheDay — homepage 'Prayer of the Day' section", () => {
  it("asks the API for the visitor's local date and renders the day's prayer", async () => {
    respondWith({
      slug: "anima-christi",
      title: "Anima Christi",
      subtitle: null,
      category: "eucharistic",
      excerpt: "Soul of Christ, sanctify me.",
    });

    render(<HomePrayerOfTheDay />);
    // Placeholders for the eye, a live message for a screen reader.
    expect(screen.getByRole("status")).toHaveTextContent(/choosing today/i);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(await screen.findByText("Anima Christi")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByText("Eucharistic")).toBeInTheDocument();
    expect(screen.getByText("Soul of Christ, sanctify me.")).toBeInTheDocument();
    // One link, named for the prayer: a screen reader never hears "Pray it in full"
    // with nothing to say which prayer it means.
    expect(screen.getByRole("link", { name: "Anima Christi" })).toHaveAttribute(
      "href",
      "/prayers/anima-christi",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toMatch(/^\/api\/prayers\/today\?date=\d{4}-\d{2}-\d{2}$/);
  });

  it("names no type for a general prayer", async () => {
    respondWith({
      slug: "evening-prayer",
      title: "An Evening Prayer",
      subtitle: null,
      category: "general",
      excerpt: "",
    });

    render(<HomePrayerOfTheDay />);
    expect(await screen.findByText("An Evening Prayer")).toBeInTheDocument();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.queryByText("Prayer")).not.toBeInTheDocument();
  });

  it("falls back to a library link when the API fails", async () => {
    fetchSpy.mockRejectedValue(new Error("offline"));
    render(<HomePrayerOfTheDay />);
    expect(
      await screen.findByRole("link", { name: /browse the prayer library/i }),
    ).toBeInTheDocument();
  });
});

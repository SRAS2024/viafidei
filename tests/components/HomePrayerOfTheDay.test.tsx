/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { HomePrayerOfTheDay } from "@/app/_sections/HomePrayerOfTheDay";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomePrayerOfTheDay — homepage 'Prayer of the Day' section", () => {
  it("asks the API for the visitor's local date and renders the day's prayer", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          date: "2026-09-06",
          prayer: {
            slug: "anima-christi",
            title: "Anima Christi",
            subtitle: null,
            category: "eucharistic",
            excerpt: "Soul of Christ, sanctify me.",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<HomePrayerOfTheDay />);
    expect(screen.getByText(/choosing today/i)).toBeInTheDocument();
    expect(await screen.findByText("Anima Christi")).toBeInTheDocument();
    expect(screen.getByText("Eucharistic")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/prayers/anima-christi");
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toMatch(/^\/api\/prayers\/today\?date=\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to a library link when the API fails", async () => {
    fetchSpy.mockRejectedValue(new Error("offline"));
    render(<HomePrayerOfTheDay />);
    expect(
      await screen.findByRole("link", { name: /browse the prayer library/i }),
    ).toBeInTheDocument();
  });
});

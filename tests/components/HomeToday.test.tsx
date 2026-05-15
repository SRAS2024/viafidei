/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { HomeToday } from "@/app/_sections/HomeToday";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomeToday — homepage 'Today's Feast Day Saints' section", () => {
  it("renders the loading state then the saints list when the API returns matches", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          month: 8,
          day: 28,
          total: 1,
          items: [{ slug: "st-augustine-of-hippo", name: "St. Augustine of Hippo", biography: "" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<HomeToday />);
    // The loading text is rendered first.
    expect(screen.getByText(/loading the day/i)).toBeInTheDocument();
    // After the fetch resolves, the saint link appears.
    expect(await screen.findByRole("link", { name: "St. Augustine of Hippo" })).toBeInTheDocument();
  });

  it("shows the empty-state copy when the API returns zero matches", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ month: 1, day: 1, total: 0, items: [] }), { status: 200 }),
    );

    render(<HomeToday />);
    expect(await screen.findByText(/no saints in our catalog/i)).toBeInTheDocument();
  });

  it("shows an error message when the fetch throws", async () => {
    fetchSpy.mockRejectedValue(new Error("network"));
    render(<HomeToday />);
    expect(await screen.findByText(/could not load today/i)).toBeInTheDocument();
  });
});

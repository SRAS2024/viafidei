/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { LiturgicalToday } from "@/app/_sections/LiturgicalToday";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LiturgicalToday (homepage Today's Scripture Readings)", () => {
  it("shows today's season and a link to the official Mass readings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00")); // Ordinary Time, cycle A / II
    render(<LiturgicalToday />);

    expect(screen.getByText("Today's Scripture Readings")).toBeInTheDocument();
    expect(screen.getByText(/Ordinary Time/)).toBeInTheDocument();
    expect(screen.getByText(/Sunday Cycle A/)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Read today's Mass readings/ });
    expect(link).toHaveAttribute("href", "https://bible.usccb.org/bible/readings/070126.cfm");
  });

  it("flags a Jubilee year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01T12:00:00")); // 2025 is a Jubilee year
    render(<LiturgicalToday />);
    expect(screen.getByText(/Jubilee Year/)).toBeInTheDocument();
  });
});

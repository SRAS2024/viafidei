/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { LiturgicalToday } from "@/app/_sections/LiturgicalToday";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The value beside a fact's label, as a reader finds it in the definition list. */
function fact(label: string): string | null | undefined {
  return screen.getByText(label).nextElementSibling?.textContent;
}

describe("LiturgicalToday (homepage Today's Scripture Readings)", () => {
  it("shows today's season and a link to the in-app Mass readings page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00")); // Ordinary Time, cycle A / II
    render(<LiturgicalToday />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Today's Scripture Readings" }),
    ).toBeInTheDocument();
    expect(fact("Season")).toBe("Ordinary Time");
    expect(fact("Sunday cycle")).toBe("A");
    // Seen as the numeral, spoken as the number.
    expect(fact("Weekday cycle")).toBe("II2");
    expect(fact("Liturgical colour")).toBe("Green");

    // The primary CTA points at the internal readings page (the external source
    // is shown modestly at the bottom of that page), deep-linked to the resolved
    // liturgical day so the page opens on the same day the block is describing.
    const link = screen.getByRole("link", { name: "Read today's Mass readings" });
    expect(link).toHaveAttribute("href", "/liturgy/readings?date=2026-07-01");
    expect(screen.getByRole("link", { name: /liturgical calendar/ })).toHaveAttribute(
      "href",
      "/liturgical-calendar",
    );
  });

  it("flags a Jubilee year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01T12:00:00")); // 2025 is a Jubilee year
    render(<LiturgicalToday />);
    expect(screen.getByText(/Jubilee Year/)).toBeInTheDocument();
  });

  it("offers the Sunday Vigil readings on a Saturday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00")); // A Saturday
    render(<LiturgicalToday />);
    expect(screen.getByRole("link", { name: /Sunday Vigil \(Saturday evening\)/ })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-07&mass=vigil",
    );
  });

  it.each([
    ["a Friday", "2026-11-06T12:00:00"],
    ["a Sunday", "2026-11-08T12:00:00"],
  ])("does not offer them on %s", (_day, instant) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    render(<LiturgicalToday />);
    expect(screen.queryByRole("link", { name: /Vigil/ })).not.toBeInTheDocument();
  });

  it("reserves its shape on the server, and tells only a screen reader it is loading", () => {
    const html = renderToStaticMarkup(<LiturgicalToday />);

    // What is the same every day is already there: the labels, the button, the
    // calendar link. The button names no date until the device has been read.
    expect(html).toContain("Liturgical colour");
    expect(html).toContain('href="/liturgy/readings"');
    expect(html).toContain('href="/liturgical-calendar"');
    expect(html).not.toContain("mass=vigil");
    expect(html).toContain("vf-skeleton");
    expect(html).toMatch(/role="status" class="sr-only">Loading today/);
  });

  it("follows the visitor's own date, whatever the time of day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 30)); // Late on Saturday, local time
    render(<LiturgicalToday />);
    expect(screen.getByRole("link", { name: "Read today's Mass readings" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-07",
    );
    expect(screen.getByRole("link", { name: /Sunday Vigil/ })).toBeInTheDocument();
  });
});

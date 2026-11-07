/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Today's Scripture Readings" }),
    ).toBeInTheDocument();
    expect(fact("Season")).toBe("Ordinary Time");
    expect(fact("Sunday cycle")).toBe("A");
    // Spoken as the number, then seen as the numeral. The number has to come first: Safari's
    // accessibility tree drops a line of text that begins with something hidden from it.
    expect(fact("Weekday cycle")).toBe("2II");
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
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
    expect(screen.getByText(/Jubilee Year/)).toBeInTheDocument();
  });

  it("offers the Sunday Vigil readings on a Saturday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00")); // A Saturday
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
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
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
    expect(screen.queryByRole("link", { name: /Vigil/ })).not.toBeInTheDocument();
  });

  it("reserves its shape on the server, and tells only a screen reader it is loading", () => {
    const html = renderToStaticMarkup(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);

    // What is the same every day is already there: the labels, the button, the
    // calendar link. The button names no date until the device has been read.
    expect(html).toContain("Liturgical colour");
    expect(html).toContain('href="/liturgy/readings"');
    expect(html).toContain('href="/liturgical-calendar"');
    expect(html).not.toContain("mass=vigil");
    expect(html).toContain("vf-skeleton");
    expect(html).toMatch(/role="status" class="sr-only">Loading today/);
  });

  it.each([
    ["Gaudete", new Date(2026, 11, 13, 12), "Rose or violet"],
    ["Laetare", new Date(2027, 2, 7, 12), "Rose or violet"],
    ["All Souls", new Date(2026, 10, 2, 12), "Violet, white or black"],
    ["the Day of Prayer", new Date(2027, 0, 22, 12), "White or violet"],
    ["an ordinary day", new Date(2026, 6, 1, 12), "Green"],
  ])("gives the same liturgical colour as the calendar on %s", (_day, now, colour) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
    expect(fact("Liturgical colour")).toBe(colour);
  });

  it("moves to the new day at the visitor's midnight, with no reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 59)); // Saturday, late
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
    expect(screen.getByRole("link", { name: /Sunday Vigil/ })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(screen.getByRole("link", { name: "Read today's Mass readings" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-08",
    );
    expect(screen.queryByRole("link", { name: /Sunday Vigil/ })).not.toBeInTheDocument();
  });

  it("is the new day when the visitor comes back to a tab left open overnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 21, 0));
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
    act(() => {
      // The timer slept with the device, and only the return to the tab wakes the page.
      vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("link", { name: "Read today's Mass readings" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-08",
    );
  });

  it("offers the Ascension where it is kept on Thursday, on that Thursday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 4, 6, 12, 0));
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
    expect(screen.getByRole("link", { name: "Read today's Mass readings" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2027-05-06",
    );
    expect(screen.getByRole("link", { name: /^The Ascension, where kept/ })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2027-05-06&ascension=thursday",
    );
  });

  it("follows the visitor's own date, whatever the time of day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 30)); // Late on Saturday, local time
    render(<LiturgicalToday loadingLabel="Loading today's liturgy…" />);
    expect(screen.getByRole("link", { name: "Read today's Mass readings" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-07",
    );
    expect(screen.getByRole("link", { name: /Sunday Vigil/ })).toBeInTheDocument();
  });
});

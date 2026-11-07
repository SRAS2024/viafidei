/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { TodayDateHeading } from "@/app/_sections/TodayDateHeading";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TodayDateHeading", () => {
  it("is the visitor's own date, written out in full", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 21, 30)); // Evening, local time
    render(<TodayDateHeading id="today" />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveAccessibleName("Friday, November 6, 2026");
    expect(heading).toHaveAttribute("id", "today");
    expect(heading.querySelector("time")).toHaveAttribute("datetime", "2026-11-06");
  });

  it("holds its place on the server, where a screen reader hears 'Today'", () => {
    const html = renderToStaticMarkup(<TodayDateHeading id="today" />);

    expect(html).toContain("Today");
    expect(html).not.toMatch(/\d{4}/);
    expect(html).toMatch(/vf-home-date-placeholder[^>]*aria-hidden="true"/);
  });
});

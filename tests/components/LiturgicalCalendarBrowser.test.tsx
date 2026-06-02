/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { LiturgicalCalendarBrowser } from "@/app/liturgical-calendar/LiturgicalCalendarBrowser";

afterEach(() => cleanup());

describe("LiturgicalCalendarBrowser", () => {
  it("shows the season, colour, and readings link for a chosen date", () => {
    render(<LiturgicalCalendarBrowser riteLabel="Roman Rite" isRoman />);
    const input = screen.getByLabelText(/choose a date/i);

    fireEvent.change(input, { target: { value: "2026-04-03" } }); // Good Friday
    expect(screen.getByText("Sacred Triduum")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Official Mass readings/ });
    expect(link).toHaveAttribute("href", "https://bible.usccb.org/bible/readings/040326.cfm");
  });

  it("notes the proper calendar only for non-Roman rites", () => {
    const { rerender } = render(
      <LiturgicalCalendarBrowser riteLabel="Byzantine Rite" isRoman={false} />,
    );
    expect(screen.getByText(/observes its own proper calendar/)).toBeInTheDocument();
    expect(screen.getByText(/Byzantine Rite/)).toBeInTheDocument();

    rerender(<LiturgicalCalendarBrowser riteLabel="Roman Rite" isRoman />);
    expect(screen.queryByText(/observes its own proper calendar/)).not.toBeInTheDocument();
  });
});

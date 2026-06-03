/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { LiturgicalCalendarBrowser } from "@/app/liturgical-calendar/LiturgicalCalendarBrowser";

const RITES = [
  { value: "roman", label: "Roman Rite" },
  { value: "byzantine", label: "Byzantine Rite" },
];

afterEach(() => cleanup());

describe("LiturgicalCalendarBrowser", () => {
  it("shows the season, colour, and readings link for a chosen date", () => {
    render(<LiturgicalCalendarBrowser rites={RITES} initialRite="roman" />);
    const input = screen.getByLabelText(/choose a date/i);

    fireEvent.change(input, { target: { value: "2026-04-03" } }); // Good Friday
    expect(screen.getByText("Sacred Triduum")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Official Mass readings/ });
    expect(link).toHaveAttribute("href", "https://bible.usccb.org/bible/readings/040326.cfm");
  });

  it("is toggleable by rite, showing the proper-calendar note only for non-Roman rites", () => {
    render(<LiturgicalCalendarBrowser rites={RITES} initialRite="roman" />);
    // Roman: no note.
    expect(screen.queryByText(/observes its own proper calendar/)).not.toBeInTheDocument();

    // Switch the rite toggle to Byzantine → the note appears.
    fireEvent.change(screen.getByLabelText(/^rite$/i), { target: { value: "byzantine" } });
    expect(screen.getByText(/observes its own proper calendar/)).toBeInTheDocument();

    // Back to Roman → note gone.
    fireEvent.change(screen.getByLabelText(/^rite$/i), { target: { value: "roman" } });
    expect(screen.queryByText(/observes its own proper calendar/)).not.toBeInTheDocument();
  });

  it("starts on the visitor's saved rite", () => {
    render(<LiturgicalCalendarBrowser rites={RITES} initialRite="byzantine" />);
    expect(screen.getByText(/observes its own proper calendar/)).toBeInTheDocument();
  });
});

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

    // The readings button routes to the INTERNAL daily-readings page for the
    // chosen day (the worker keeps it current) — not an external site.
    const link = screen.getByRole("link", { name: "Readings for this day" });
    expect(link).toHaveAttribute("href", "/liturgy/readings?date=2026-04-03");
    // Good Friday has no evening Mass to offer beside it.
    expect(screen.queryByRole("link", { name: /Vigil/ })).not.toBeInTheDocument();
  });

  it("offers both Masses on a Saturday, inside a navigation that names the date", () => {
    render(<LiturgicalCalendarBrowser rites={RITES} initialRite="roman" />);
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: "2026-11-07" } });
    expect(screen.getByRole("navigation", { name: /November 7, 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saturday Mass" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-07",
    );
    expect(screen.getByRole("link", { name: "Sunday Vigil (Saturday evening)" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-07&mass=vigil",
    );
  });

  it("offers both Masses on the eve of a holy day, and none on Holy Saturday", () => {
    render(<LiturgicalCalendarBrowser rites={RITES} initialRite="roman" />);
    const input = screen.getByLabelText(/choose a date/i);
    fireEvent.change(input, { target: { value: "2026-12-07" } });
    expect(screen.getByRole("link", { name: "Monday Mass" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Immaculate Conception Vigil (Monday evening)" }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2026-12-07&mass=vigil");

    fireEvent.change(input, { target: { value: "2027-03-27" } });
    expect(screen.getByRole("link", { name: "Readings for this day" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Vigil \(/ })).not.toBeInTheDocument();
    expect(screen.getByText("Paschal Triduum")).toBeInTheDocument();
  });

  it("says rose or violet on Gaudete Sunday, and names what the date became", () => {
    render(<LiturgicalCalendarBrowser rites={RITES} initialRite="roman" />);
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: "2026-12-13" } });
    expect(screen.getByText("Rose or violet")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sunday, December 13, 2026: 3rd Sunday of Advent. Advent. Liturgical colour Rose or violet.",
    );
  });

  it("labels the date and rite controls for assistive technology", () => {
    render(<LiturgicalCalendarBrowser rites={RITES} initialRite="roman" />);
    expect(screen.getByLabelText(/choose a date/i)).toHaveClass("vf-input");
    expect(screen.getByLabelText(/^rite$/i)).toHaveClass("vf-input");
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
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

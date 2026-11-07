/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { LiturgicalCalendarBrowser } from "@/app/liturgical-calendar/LiturgicalCalendarBrowser";
import { CALENDAR_HERO } from "@/app/liturgical-calendar/hero";

const RITES = [
  { value: "roman", label: "Roman (Latin)" },
  { value: "byzantine", label: "Byzantine" },
  { value: "ethiopic", label: "Ethiopic / Ge'ez" },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The live region that says what the date became. */
const dayStatus = () => screen.getAllByRole("status")[1];
/** The live region that holds the rite's note. */
const riteStatus = () => screen.getAllByRole("status")[2];

describe("LiturgicalCalendarBrowser", () => {
  it("shows the season, colour, and readings link for a chosen date", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
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
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
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
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
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
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: "2026-12-13" } });
    expect(screen.getByText("Rose or violet")).toBeInTheDocument();
    expect(dayStatus()).toHaveTextContent(
      "Sunday, December 13, 2026: 3rd Sunday of Advent. Advent. Liturgical colour Rose or violet.",
    );
  });

  it("says plainly which calendar it is", () => {
    expect(CALENDAR_HERO.subtitle).toMatch(/Dioceses of the United States/);
  });

  it("speaks the weekday cycle as a number, as the homepage and readings page do", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: "2026-11-07" } });
    const value = screen.getByText("Weekday cycle").nextElementSibling!;
    expect(value).toHaveTextContent("Year 2II");
    expect(value.querySelector('[aria-hidden="true"]')).toHaveTextContent("II");
    expect(value.querySelector(".vf-sr-inline")).toHaveTextContent("2");
    expect(value.querySelector(".sr-only")).toBeNull();
  });

  it("hides the separator in the rank from a screen reader", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: "2026-12-08" } });
    const rank = screen.getByText("Rank").nextElementSibling!;
    expect(rank).toHaveTextContent("Solemnity");
    expect(rank).toHaveTextContent("Holy day of obligation");
    expect(rank.querySelector('[aria-hidden="true"]')).toHaveTextContent("·");
  });

  it("sets the Mass choice as the readings page does, in chips and sentence case", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: "2026-11-07" } });
    for (const name of ["Saturday Mass", "Sunday Vigil (Saturday evening)"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveClass("vf-chip");
      expect(link).not.toHaveClass("vf-btn");
      // Nothing is chosen on the calendar: each is a way to the readings.
      expect(link).not.toHaveClass("vf-filter-active");
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});

describe("LiturgicalCalendarBrowser — the Ascension's two observances", () => {
  const show = (date: string) => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: date } });
  };

  it("on the Thursday says who keeps it, and links to both Masses", () => {
    show("2027-05-06");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Thursday of the 6th Week of Easter",
    );
    expect(screen.getByRole("link", { name: "Thursday Mass" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2027-05-06",
    );
    expect(
      screen.getByRole("link", { name: "The Ascension, where kept on Thursday" }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2027-05-06&ascension=thursday");
    const note =
      "In the ecclesiastical provinces of Boston, Hartford, New York, Omaha and Philadelphia, the Ascension of the Lord is kept on Thursday, May 6, as a holy day of obligation. All other provinces of the United States keep it on Sunday, May 9.";
    expect(screen.getByText(note)).toHaveClass("vf-fineprint");
    // A blind reader who picks this date hears it, not only one who reads on.
    expect(dayStatus()).toHaveTextContent(note);
  });

  it("on the Sunday links to the Ascension and to the Seventh Sunday", () => {
    show("2027-05-09");
    expect(screen.getByRole("link", { name: "The Ascension of the Lord" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2027-05-09",
    );
    expect(
      screen.getByRole("link", {
        name: "7th Sunday of Easter, where the Ascension was on Thursday",
      }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2027-05-09&ascension=thursday");
  });

  it("on the evenings before them links to each Vigil", () => {
    show("2027-05-05");
    expect(
      screen.getByRole("link", {
        name: "Ascension Vigil (Wednesday evening), where kept on Thursday",
      }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2027-05-05&mass=vigil&ascension=thursday");
    cleanup();
    show("2027-05-08");
    const nav = screen.getByRole("navigation", { name: /May 8, 2027/ });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Saturday Mass",
      "Ascension Vigil (Saturday evening)",
      "7th Sunday of Easter Vigil (Saturday evening), where the Ascension was on Thursday",
    ]);
  });

  it("says nothing of it on any other date", () => {
    show("2027-05-07");
    expect(screen.queryByText(/ecclesiastical provinces/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Readings for this day" })).toBeInTheDocument();
  });
});

describe("LiturgicalCalendarBrowser — typing a date", () => {
  /** One keystroke in Chromium's year segment, whose interim values are real dates. */
  const type = (field: HTMLElement, value: string) =>
    fireEvent.change(field, { target: { value } });

  it("holds the result and its announcement until the year is whole", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    const field = screen.getByLabelText<HTMLInputElement>(/choose a date/i);
    type(field, "2026-03-24");
    const before = dayStatus().textContent;
    const link = screen.getByRole("link", { name: "Readings for this day" }).getAttribute("href");

    for (const interim of ["0002-03-24", "0020-03-24", "0202-03-24"]) {
      type(field, interim);
      expect(dayStatus().textContent, interim).toBe(before);
      // The field keeps what is being typed, or the year could never be finished.
      expect(field.value, interim).toBe(interim);
      expect(screen.getByRole("link", { name: "Readings for this day" })).toHaveAttribute(
        "href",
        link!,
      );
      expect(field, interim).not.toHaveAttribute("aria-invalid");
    }

    type(field, "2027-03-24");
    expect(field.value).toBe("2027-03-24");
    expect(dayStatus()).toHaveTextContent(/^Wednesday, March 24, 2027: Wednesday of Holy Week/);
  });

  it("offers only the calendar's years, and says so when a whole year is outside them", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    const field = screen.getByLabelText<HTMLInputElement>(/choose a date/i);
    expect(field).toHaveAttribute("min", "1970-01-01");
    expect(field).toHaveAttribute("max", "2099-12-31");
    type(field, "2026-03-21");
    const before = dayStatus().textContent;

    type(field, "1850-03-21");
    expect(dayStatus().textContent).toBe(before);
    expect(field).toHaveAttribute("aria-invalid", "true");
    const hint = screen.getByText("This calendar covers the years 1970 to 2099.");
    expect(field).toHaveAttribute("aria-describedby", hint.id);

    // Leaving the field puts it back on the date the result still shows.
    fireEvent.blur(field);
    expect(field.value).toBe("2026-03-21");
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(hint).toBeEmptyDOMElement();
  });

  it("says so too when a digit too many has made a year of five or six", () => {
    // Safari's year takes up to six digits and does not move on by itself.
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    const field = screen.getByLabelText<HTMLInputElement>(/choose a date/i);
    type(field, "2026-03-21");
    const before = dayStatus().textContent;

    for (const year of ["20271", "50000", "275760"]) {
      type(field, `${year}-03-21`);
      expect(field.value, year).toBe(`${year}-03-21`);
      expect(dayStatus().textContent, year).toBe(before);
      expect(field, year).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("This calendar covers the years 1970 to 2099.")).toBeInTheDocument();
    }

    fireEvent.blur(field);
    expect(field.value).toBe("2026-03-21");
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("does not fight a field being edited, and goes back to today when left empty", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 12, 0));
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    const field = screen.getByLabelText<HTMLInputElement>(/choose a date/i);
    type(field, "2026-03-21");
    // A browser reports an empty value while a segment of the date is blank.
    type(field, "");
    expect(field.value).toBe("");
    expect(dayStatus()).toHaveTextContent(/^Saturday, March 21, 2026/);
    fireEvent.blur(field);
    expect(field.value).toBe("2026-11-07");
    expect(dayStatus()).toHaveTextContent(/^Saturday, November 7, 2026/);
  });
});

describe("LiturgicalCalendarBrowser — the day it opens on", () => {
  it("follows the day across midnight until the visitor picks one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 59));
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    const field = screen.getByLabelText<HTMLInputElement>(/choose a date/i);
    expect(field.value).toBe("2026-11-07");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(field.value).toBe("2026-11-08");
    expect(dayStatus()).toHaveTextContent(/^Sunday, November 8, 2026/);

    fireEvent.change(field, { target: { value: "2026-12-25" } });
    fireEvent.blur(field);
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60_000);
    });
    expect(field.value).toBe("2026-12-25");
  });

  it("holds its place until the device has been read", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    expect(html).not.toContain('type="date"');
    // Its words are the page's, in the reader's language, and go beside the busy panel.
    expect(html).toMatch(
      /^<p role="status" class="sr-only">Loading the calendar…<\/p><div [^>]*aria-busy="true"/,
    );
    expect(html).not.toMatch(/role="status"[^>]*aria-busy/);
    expect(
      renderToStaticMarkup(
        <LiturgicalCalendarBrowser
          rites={RITES}
          initialRite="roman"
          loadingLabel="Cargando el calendario…"
        />,
      ),
    ).toContain(">Cargando el calendario…<");
  });
});

describe("LiturgicalCalendarBrowser — the rite", () => {
  it("labels the date and rite controls for assistive technology", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    expect(screen.getByLabelText(/choose a date/i)).toHaveClass("vf-input");
    expect(screen.getByLabelText(/^rite$/i)).toHaveClass("vf-input");
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("is toggleable by rite, showing the proper-calendar note only for non-Roman rites", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
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
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="byzantine"
        loadingLabel="Loading the calendar…"
      />,
    );
    expect(screen.getByText(/observes its own proper calendar/)).toBeInTheDocument();
  });

  it("names the calendar this is and gives the rite a noun", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    fireEvent.change(screen.getByLabelText(/^rite$/i), { target: { value: "ethiopic" } });
    expect(riteStatus().textContent).toBe(
      "This is the Roman Rite's calendar for the Dioceses of the United States. The Ethiopic / Ge'ez Rite observes its own proper calendar, which may differ in its seasons and feasts.",
    );
    expect(screen.queryByText(/General Roman Calendar/)).not.toBeInTheDocument();
  });

  it("announces the note, in a region that was there before the rite changed", () => {
    render(
      <LiturgicalCalendarBrowser
        rites={RITES}
        initialRite="roman"
        loadingLabel="Loading the calendar…"
      />,
    );
    const region = riteStatus();
    expect(region).toBeEmptyDOMElement();
    const dayBefore = dayStatus().textContent;

    fireEvent.change(screen.getByLabelText(/^rite$/i), { target: { value: "byzantine" } });
    expect(riteStatus()).toBe(region);
    expect(region).toHaveTextContent(/The Byzantine Rite observes its own proper calendar/);
    // Only what changed is announced: the day is the same day.
    expect(dayStatus().textContent).toBe(dayBefore);

    // A later date is announced alone: the note has not changed, so it is not repeated.
    const noteBefore = region.textContent;
    fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: "2026-12-25" } });
    expect(region.textContent).toBe(noteBefore);
    expect(dayStatus()).toHaveTextContent(/^Friday, December 25, 2026/);
  });
});

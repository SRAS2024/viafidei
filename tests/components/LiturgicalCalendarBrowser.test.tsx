/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextRequest } from "next/server";

vi.mock("@/lib/db/client", () => ({
  prisma: { dailyReading: { findUnique: vi.fn().mockResolvedValue(null) } },
}));

import { GET as readingsRoute } from "@/app/api/readings/route";
import { LiturgicalCalendarBrowser } from "@/app/liturgical-calendar/LiturgicalCalendarBrowser";
import { CALENDAR_HERO } from "@/app/liturgical-calendar/hero";

const RITES = [
  { value: "roman", label: "Roman (Latin)" },
  { value: "byzantine", label: "Byzantine" },
  { value: "ethiopic", label: "Ethiopic / Ge'ez" },
];

/** What the calendar asked /api/readings, in order. */
let asked: string[] = [];

beforeEach(() => {
  asked = [];
  // The calendar's readings come from the real route, so it shows what the site would.
  vi.stubGlobal("fetch", async (input: string) => {
    asked.push(input);
    return readingsRoute(new NextRequest(new Request(`http://localhost${input}`)));
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The live region that says what the date became. */
const dayStatus = () => document.querySelector('.vf-calendar-result > p[role="status"]')!;
/** The live region that holds the rite's note. */
const riteStatus = () => document.querySelector('.vf-calendar-result > div[role="status"]')!;
/** The line naming the Mass whose readings are shown, once they have come. */
const readingsTitle = () => document.querySelector(".vf-calendar-readings-title");

function showCalendar() {
  render(
    <LiturgicalCalendarBrowser
      rites={RITES}
      initialRite="roman"
      loadingLabel="Loading the calendar…"
    />,
  );
}

function pick(date: string) {
  fireEvent.change(screen.getByLabelText(/choose a date/i), { target: { value: date } });
}

/** Today, for the calendar: a fixed device clock, with every other timer left running. */
function deviceClock(at: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at);
}

describe("LiturgicalCalendarBrowser", () => {
  it("shows the season and colour of a chosen date, and its readings with no button to press", async () => {
    showCalendar();
    pick("2026-04-03"); // Good Friday
    expect(screen.getByText("Sacred Triduum")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();

    // One celebration, so no choice: its readings are simply there.
    expect(await screen.findByRole("heading", { level: 3, name: "Gospel" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Mass readings for/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No Mass is celebrated on Good Friday/)).toHaveClass("vf-fineprint");
    expect(
      screen.getByRole("link", { name: "Open these readings on their own page" }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2026-04-03");
    expect(asked.at(-1)).toBe("/api/readings?date=2026-04-03");
  });

  it("heads each reading under the day, so a voice can go from one to the next", async () => {
    showCalendar();
    pick("2026-11-05");
    await screen.findByRole("heading", { level: 3, name: "Gospel" });
    // The day is the panel's heading, and its readings are the parts of it.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Thursday of the 31st Week in Ordinary Time",
    );
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("offers both Masses on a Saturday it is not, on the day's own Mass", async () => {
    deviceClock(new Date(2026, 10, 9, 15, 0)); // a Monday afternoon
    showCalendar();
    pick("2026-11-07");
    const group = await screen.findByRole("group", {
      name: "Mass readings for Saturday, November 7, 2026",
    });
    const own = within(group).getByRole("button", { name: "Saturday Mass" });
    const vigil = within(group).getByRole("button", { name: "Sunday Vigil (Saturday evening)" });
    expect(own).toHaveAttribute("aria-pressed", "true");
    expect(vigil).toHaveAttribute("aria-pressed", "false");
    await waitFor(() =>
      expect(readingsTitle()).toHaveTextContent(
        "Saturday of the 31st Week in Ordinary Time, · Lectionary 490",
      ),
    );

    fireEvent.click(vigil);
    // Pressed at once, and the button keeps its place while the readings come.
    expect(vigil).toHaveAttribute("aria-pressed", "true");
    expect(own).toHaveAttribute("aria-pressed", "false");
    await waitFor(() =>
      expect(readingsTitle()).toHaveTextContent("Vigil of the 32nd Sunday in Ordinary Time"),
    );
    expect(vigil).toBeInTheDocument();
    // Which readings now stand below is said, as a press changes nothing else on the page.
    expect(
      screen.getByText(
        "Sunday Vigil (Saturday evening): Vigil of the 32nd Sunday in Ordinary Time.",
      ),
    ).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("link", { name: "Open these readings on their own page" }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2026-11-07&mass=vigil");

    // Back to the day's own, without asking again.
    const before = asked.length;
    fireEvent.click(own);
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("Lectionary 490"));
    expect(asked.length).toBe(before + 1);
    fireEvent.click(vigil);
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("Vigil of the 32nd Sunday"));
    expect(asked.length).toBe(before + 1);
    expect(
      screen.getByRole("link", { name: "Open these readings on their own page" }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2026-11-07&mass=vigil");
  });

  it("sets the choice as the readings page does, in chips and sentence case", async () => {
    deviceClock(new Date(2026, 10, 9, 15, 0)); // not that Saturday: its own Mass is chosen
    showCalendar();
    pick("2026-11-07");
    await screen.findByRole("group", { name: /Mass readings for/ });
    for (const name of ["Saturday Mass", "Sunday Vigil (Saturday evening)"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("vf-chip");
      expect(button).not.toHaveClass("vf-btn");
    }
    expect(screen.getByRole("button", { name: "Saturday Mass" })).toHaveClass("vf-filter-active");
  });

  it("offers both Masses on the eve of a holy day, and none on Holy Saturday", async () => {
    showCalendar();
    pick("2026-12-07");
    const group = await screen.findByRole("group", { name: /December 7, 2026/ });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Monday Mass", "Immaculate Conception Vigil (Monday evening)"]);

    pick("2027-03-27");
    expect(screen.getByText("Paschal Triduum")).toBeInTheDocument();
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("Holy Saturday"));
    expect(screen.queryByRole("group", { name: /Mass readings for/ })).not.toBeInTheDocument();
    expect(screen.getByText(/The Easter Vigil, celebrated after nightfall/)).toBeInTheDocument();
  });

  it("offers each of Christmas's own Masses", async () => {
    showCalendar();
    pick("2026-12-25");
    const group = await screen.findByRole("group", { name: /December 25, 2026/ });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "Vigil Mass (evening before)",
      "Mass during the Night",
      "Mass at Dawn",
      "Mass during the Day",
    ]);
  });

  it("offers the Vigil's own formularies once the Vigil is pressed, the first chosen", async () => {
    deviceClock(new Date(2027, 4, 10, 9, 0)); // not that Saturday
    showCalendar();
    pick("2027-05-15"); // the Saturday before Pentecost
    const masses = await screen.findByRole("group", { name: /May 15, 2027/ });
    fireEvent.click(within(masses).getByRole("button", { name: /Pentecost Vigil/ }));
    const formularies = await screen.findByRole("group", { name: "Readings of this Mass" });
    expect(within(formularies).getByRole("button", { name: "Vigil Mass" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(within(formularies).getByRole("button", { name: "Extended Vigil" }));
    await waitFor(() =>
      expect(within(formularies).getByRole("button", { name: "Extended Vigil" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    // The Mass is still the Vigil.
    expect(within(masses).getByRole("button", { name: /Pentecost Vigil/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says when the readings cannot be had, and where they are", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 503 }));
    showCalendar();
    pick("2026-11-05");
    expect(await screen.findByText(/could not be loaded just now/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open them on their own page" })).toHaveAttribute(
      "href",
      "/liturgy/readings?date=2026-11-05",
    );
  });

  it("says rose or violet on Gaudete Sunday, and names what the date became", () => {
    showCalendar();
    pick("2026-12-13");
    expect(screen.getByText("Rose or violet")).toBeInTheDocument();
    expect(dayStatus()).toHaveTextContent(
      "Sunday, December 13, 2026: 3rd Sunday of Advent. Advent. Liturgical colour Rose or violet.",
    );
  });

  it("says plainly which calendar it is, and that its readings are there", () => {
    expect(CALENDAR_HERO.subtitle).toMatch(/Dioceses of the United States/);
    expect(CALENDAR_HERO.subtitle).toMatch(/Mass readings/);
    expect(CALENDAR_HERO.subtitle).not.toMatch(/link/);
  });

  it("speaks the weekday cycle as a number, as the homepage and readings page do", () => {
    showCalendar();
    pick("2026-11-07");
    const value = screen.getByText("Weekday cycle").nextElementSibling!;
    expect(value).toHaveTextContent("Year 2II");
    expect(value.querySelector('[aria-hidden="true"]')).toHaveTextContent("II");
    expect(value.querySelector(".vf-sr-inline")).toHaveTextContent("2");
    expect(value.querySelector(".sr-only")).toBeNull();
  });

  it("hides the separator in the rank from a screen reader", () => {
    showCalendar();
    pick("2026-12-08");
    const rank = screen.getByText("Rank").nextElementSibling!;
    expect(rank).toHaveTextContent("Solemnity");
    expect(rank).toHaveTextContent("Holy day of obligation");
    expect(rank.querySelector('[aria-hidden="true"]')).toHaveTextContent("·");
  });
});

describe("LiturgicalCalendarBrowser — the Mass it opens on", () => {
  const SATURDAY = "2026-11-07";
  const ownPressed = () =>
    screen.getByRole("button", { name: "Saturday Mass" }).getAttribute("aria-pressed");

  it("is the day's own Mass on the visitor's Saturday morning", async () => {
    deviceClock(new Date(2026, 10, 7, 11, 59));
    showCalendar();
    await screen.findByRole("group", { name: /November 7, 2026/ });
    expect(ownPressed()).toBe("true");
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("Lectionary 490"));
    expect(asked[0]).toBe(`/api/readings?date=${SATURDAY}`);
  });

  it("is Sunday's Vigil from noon, and only for today", async () => {
    deviceClock(new Date(2026, 10, 7, 12, 0));
    showCalendar();
    await screen.findByRole("group", { name: /November 7, 2026/ });
    await waitFor(() =>
      expect(readingsTitle()).toHaveTextContent("Vigil of the 32nd Sunday in Ordinary Time"),
    );
    expect(screen.getByRole("button", { name: "Sunday Vigil (Saturday evening)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(ownPressed()).toBe("false");
    expect(asked[0]).toBe(`/api/readings?date=${SATURDAY}&prefer=evening`);

    // Another Saturday, ahead or behind, opens on its own Mass.
    pick("2026-11-14");
    await screen.findByRole("group", { name: /November 14, 2026/ });
    await waitFor(() => expect(ownPressed()).toBe("true"));
    pick("2026-10-31");
    await screen.findByRole("group", { name: /October 31, 2026/ });
    await waitFor(() => expect(ownPressed()).toBe("true"));

    // Back to today, the afternoon's choice again.
    pick(SATURDAY);
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("Vigil of the 32nd Sunday"));
  });

  it("is the holy day's Vigil on the afternoon of its eve", async () => {
    deviceClock(new Date(2026, 11, 7, 15, 30));
    showCalendar();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Immaculate Conception Vigil (Monday evening)" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("is the one Mass of a day that has one, whatever the hour", async () => {
    deviceClock(new Date(2026, 10, 5, 18, 0));
    showCalendar();
    await screen.findByRole("heading", { level: 3, name: "Gospel" });
    expect(screen.queryByRole("group", { name: /Mass readings for/ })).not.toBeInTheDocument();
  });

  it("keeps what the visitor pressed until the date changes", async () => {
    deviceClock(new Date(2026, 10, 7, 13, 0));
    showCalendar();
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("Vigil of the 32nd Sunday"));
    fireEvent.click(screen.getByRole("button", { name: "Saturday Mass" }));
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("Lectionary 490"));
    expect(ownPressed()).toBe("true");
  });
});

describe("LiturgicalCalendarBrowser — the Ascension's two observances", () => {
  it("on the Thursday says who keeps it, once, and offers both Masses", async () => {
    showCalendar();
    pick("2027-05-06");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Thursday of the 6th Week of Easter",
    );
    const group = await screen.findByRole("group", { name: /May 6, 2027/ });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Thursday Mass", "The Ascension, where kept on Thursday"]);
    const note =
      "In the ecclesiastical provinces of Boston, Hartford, New York, Omaha and Philadelphia, the Ascension of the Lord is kept on Thursday, May 6, as a holy day of obligation. All other provinces of the United States keep it on Sunday, May 9.";
    await waitFor(() => expect(readingsTitle()).not.toBeNull());
    expect(screen.getAllByText(note)).toHaveLength(1);
    expect(screen.getByText(note)).toHaveClass("vf-fineprint");
    // A blind reader who picks this date hears it, not only one who reads on.
    expect(dayStatus()).toHaveTextContent(note);

    fireEvent.click(within(group).getByRole("button", { name: /where kept on Thursday/ }));
    await waitFor(() => expect(readingsTitle()).toHaveTextContent("The Ascension of the Lord"));
  });

  it("on the evening before the Sunday offers each Vigil beside the Saturday's Mass", async () => {
    showCalendar();
    pick("2027-05-08");
    const group = await screen.findByRole("group", { name: /May 8, 2027/ });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "Saturday Mass",
      "Ascension Vigil (Saturday evening)",
      "7th Sunday of Easter Vigil (Saturday evening), where the Ascension was on Thursday",
    ]);
  });

  it("says nothing of it on any other date", async () => {
    showCalendar();
    pick("2027-05-07");
    await screen.findByRole("heading", { level: 3, name: "Gospel" });
    expect(screen.queryByText(/ecclesiastical provinces/)).not.toBeInTheDocument();
  });
});

describe("LiturgicalCalendarBrowser — typing a date", () => {
  /** One keystroke in Chromium's year segment, whose interim values are real dates. */
  const type = (field: HTMLElement, value: string) =>
    fireEvent.change(field, { target: { value } });

  it("holds the result, its announcement and its readings until the year is whole", async () => {
    showCalendar();
    const field = screen.getByLabelText<HTMLInputElement>(/choose a date/i);
    type(field, "2026-03-24");
    const before = dayStatus().textContent;
    await screen.findByRole("heading", { level: 3, name: "Gospel" });
    const sent = asked.length;

    for (const interim of ["0002-03-24", "0020-03-24", "0202-03-24"]) {
      type(field, interim);
      expect(dayStatus().textContent, interim).toBe(before);
      // The field keeps what is being typed, or the year could never be finished.
      expect(field.value, interim).toBe(interim);
      expect(field, interim).not.toHaveAttribute("aria-invalid");
    }
    // No year on its way was asked for its readings.
    expect(asked.length).toBe(sent);

    type(field, "2027-03-24");
    expect(field.value).toBe("2027-03-24");
    expect(dayStatus()).toHaveTextContent(/^Wednesday, March 24, 2027: Wednesday of Holy Week/);
    await waitFor(() => expect(asked.at(-1)).toBe("/api/readings?date=2027-03-24"));
  });

  it("offers only the calendar's years, and says so when a whole year is outside them", () => {
    showCalendar();
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
    showCalendar();
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
    showCalendar();
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
  it("stays on its day under a reader at midnight, and moves on when they come back", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 59));
    showCalendar();
    const field = screen.getByLabelText<HTMLInputElement>(/choose a date/i);
    expect(field.value).toBe("2026-11-07");

    // Midnight passes with the page in front of them: the readings stay where they are.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(field.value).toBe("2026-11-07");

    // Away a while, and back: it is the new day.
    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(40 * 60_000);
      window.dispatchEvent(new Event("focus"));
    });
    expect(field.value).toBe("2026-11-08");
    expect(dayStatus()).toHaveTextContent(/^Sunday, November 8, 2026/);

    // A day the visitor picked stays picked.
    fireEvent.change(field, { target: { value: "2026-12-25" } });
    fireEvent.blur(field);
    act(() => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(24 * 60 * 60_000);
      window.dispatchEvent(new Event("focus"));
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
    showCalendar();
    expect(screen.getByLabelText(/choose a date/i)).toHaveClass("vf-input");
    expect(screen.getByLabelText(/^rite$/i)).toHaveClass("vf-input");
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("is toggleable by rite, showing the proper-calendar note only for non-Roman rites", () => {
    showCalendar();
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
    showCalendar();
    fireEvent.change(screen.getByLabelText(/^rite$/i), { target: { value: "ethiopic" } });
    expect(riteStatus().textContent).toBe(
      "This is the Roman Rite's calendar for the Dioceses of the United States. The Ethiopic / Ge'ez Rite observes its own proper calendar, which may differ in its seasons and feasts.",
    );
    expect(screen.queryByText(/General Roman Calendar/)).not.toBeInTheDocument();
  });

  it("announces the note, in a region that was there before the rite changed", () => {
    showCalendar();
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
    pick("2026-12-25");
    expect(region.textContent).toBe(noteBefore);
    expect(dayStatus()).toHaveTextContent(/^Friday, December 25, 2026/);
  });
});

/**
 * @vitest-environment jsdom
 */
/**
 * The daily readings page.
 *
 * The rules proved here are the ones the page got wrong before: a worker
 * REVIEW skeleton must never shadow readings the page can compute; the Sunday
 * and weekday cycles must reach the resolver (cycle-keyed Sundays were
 * unreachable without them); "today" must be the VISITOR's date, not the
 * server's UTC one; and a citation-only section must render as a compact line
 * rather than a paragraph-shaped placeholder.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const findUnique = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/db/client", () => ({ prisma: { dailyReading: { findUnique } } }));

import DailyReadingsPage, { generateMetadata } from "@/app/liturgy/readings/page";
import { ReadingSections } from "@/app/liturgy/readings/ReadingSections";
import { TodayDateSync } from "@/app/liturgy/readings/TodayDateSync";
import {
  buildReadingsView,
  calendarFromParam,
  parseDateParam,
  storedRowDate,
  type StoredReadingRow,
} from "@/app/liturgy/readings/readings-view";
import {
  citationReference,
  layoutFromText,
  resolveAlternative,
} from "@/lib/content-shared/lectionary";
import { eveningMass } from "@/lib/content-shared/liturgical-calendar";

const D = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * A line of text as Safari's accessibility tree joins it into one item: without what is
 * hidden from it, and without what is absolutely positioned, which it leaves out of the
 * line. Spaces count, because nothing else keeps the line's words apart in that tree.
 */
function spoken(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"], .sr-only').forEach((gone) => gone.remove());
  return copy.textContent ?? "";
}

afterEach(() => {
  cleanup();
  replace.mockClear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("buildReadingsView — the page always computes from the tables", () => {
  it("renders the day's readings with NO stored row at all", () => {
    const view = buildReadingsView(D("2026-09-08"));
    expect(view.sections.length).toBeGreaterThanOrEqual(3);
    expect(view.hasText).toBe(true);
    expect(view.lectionaryNumber).toBeTruthy();
    expect(view.framing.celebration).toBeTruthy();
  });

  it("a REVIEW skeleton row does NOT shadow the computed readings", () => {
    // Exactly what the worker's backfill used to write for ~770 days.
    const row: StoredReadingRow = {
      status: "REVIEW",
      sections: [
        { kind: "FIRST_READING", label: "First Reading", citation: null, body: null },
        { kind: "GOSPEL", label: "Gospel", citation: null, body: null },
      ],
    };
    const view = buildReadingsView(D("2026-09-08"), { row });
    expect(view.hasText).toBe(true);
    expect(view.sections.every((s) => s.overlaid)).toBe(false);
    expect(view.sections.find((s) => s.kind === "GOSPEL")!.citation).toBeTruthy();
  });

  it("a PUBLISHED row WITHOUT bodies is ignored too (only text may override)", () => {
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sections: [{ kind: "GOSPEL", label: "Gospel", citation: "Mk 1:1", body: null }],
    };
    const view = buildReadingsView(D("2026-09-08"), { row });
    const gospel = view.sections.find((s) => s.kind === "GOSPEL")!;
    expect(gospel.overlaid).toBe(false);
    expect(gospel.citation).not.toBe("Mk 1:1");
  });

  it("a PUBLISHED row WITH text of the same reading overlays that section only", () => {
    const computed = buildReadingsView(D("2026-09-08")).sections.find((s) => s.kind === "GOSPEL")!;
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sections: [
        { kind: "GOSPEL", label: "Gospel", citation: computed.citation, body: "A corrected text." },
      ],
    };
    const view = buildReadingsView(D("2026-09-08"), { row });
    const gospel = view.sections.find((s) => s.kind === "GOSPEL")!;
    expect(gospel.overlaid).toBe(true);
    expect(gospel.body).toBe("A corrected text.");
    expect(gospel.layout).toEqual({ form: "prose", paragraphs: ["A corrected text."] });
    // Every other section still comes from the tables.
    expect(view.sections.filter((s) => s.overlaid)).toHaveLength(1);
  });

  it("a stored row citing another reading is out of date and does not undo a correction", () => {
    // What a row written before the psalm tables were corrected still says.
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sections: [
        {
          kind: "PSALM",
          label: "Responsorial Psalm",
          citation: "Ps 145:2-3, 4-5, 10-11",
          body: "Old.",
        },
      ],
    };
    const psalm = buildReadingsView(D("2026-11-07"), { row }).sections.find(
      (s) => s.kind === "PSALM",
    )!;
    expect(psalm.overlaid).toBe(false);
    expect(psalm.citation).toBe("Ps 112:1b-2, 5-6, 8a and 9");
    expect(psalm.body).not.toBe("Old.");
  });

  it("the worker's own copy of a reading does not undo a correction to the Scripture", () => {
    // What a row written before the Douay-Rheims store was corrected still says: the
    // same citation, under the name the worker stores every row with.
    const computed = buildReadingsView(D("2026-12-09")).sections.find((s) => s.kind === "PSALM")!;
    expect(computed.body).toContain("The Lord is compassionate");
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sourceName: "USCCB",
      sections: [
        {
          kind: "PSALM",
          label: "Responsorial Psalm",
          citation: computed.citation,
          body: computed.body!.replace("The Lord is", "The ford is"),
        },
      ],
    };
    const psalm = buildReadingsView(D("2026-12-09"), { row }).sections.find(
      (s) => s.kind === "PSALM",
    )!;
    expect(psalm.overlaid).toBe(false);
    expect(psalm.body).toContain("The Lord is compassionate");
    expect(psalm.body).not.toContain("The ford");
  });

  it("passes the Sunday cycle through, so cycle-keyed Sundays resolve", () => {
    // Pentecost in two different Sunday cycles: the Second Reading differs.
    const c = buildReadingsView(D("2025-06-08")); // cycle C
    const a = buildReadingsView(D("2026-05-24")); // cycle A
    expect(c.framing.sundayCycle).not.toBe(a.framing.sundayCycle);
    const second = (v: typeof a) => v.sections.find((s) => s.kind === "SECOND_READING")!.citation;
    expect(second(c)).not.toBe(second(a));
  });

  it("passes the weekday cycle through (Year I vs Year II first readings)", () => {
    const yearII = buildReadingsView(D("2026-02-17"));
    const yearI = buildReadingsView(D("2027-02-16"));
    expect(yearII.framing.weekdayCycle).not.toBe(yearI.framing.weekdayCycle);
    const first = (v: typeof yearI) => v.sections.find((s) => s.kind === "FIRST_READING")!.citation;
    expect(first(yearI)).not.toBe(first(yearII));
  });

  it("offers the day's other Masses and honours ?variant", () => {
    const day = buildReadingsView(D("2025-12-25"));
    expect(day.masses.map((m) => m.variant)).toEqual(
      expect.arrayContaining(["vigil", "night", "dawn", "day"]),
    );
    expect(day.masses.find((m) => m.isActive)!.variant).toBe("day");

    const night = buildReadingsView(D("2025-12-25"), { variant: "night" });
    expect(night.activeVariant).toBe("night");
    expect(night.lectionaryNumber).not.toBe(day.lectionaryNumber);
    expect(night.masses.find((m) => m.isActive)!.variant).toBe("night");
  });

  it("lists a day's Masses in the order they are celebrated", () => {
    expect(buildReadingsView(D("2025-12-25")).masses.map((m) => m.variant)).toEqual([
      "vigil",
      "night",
      "dawn",
      "day",
    ]);
    expect(buildReadingsView(D("2027-03-21")).masses.map((m) => m.label)).toEqual([
      "At the Procession with Palms",
      "At the Mass",
    ]);
    expect(buildReadingsView(D("2027-03-25")).masses.map((m) => m.label)).toEqual([
      "Chrism Mass",
      "Evening Mass of the Lord's Supper",
    ]);
  });

  it("puts a memorial's two halves together, with both Lectionary numbers", () => {
    const martha = buildReadingsView(D("2026-07-29"));
    expect(martha.lectionaryNumber).toBe("403/607");
    expect(martha.sections.map((s) => s.citation)).toEqual([
      "Jer 15:10, 16-21",
      "Ps 59:2-3, 4, 10-11, 17, 18",
      "Jn 8:12",
      "Jn 11:19-27 or Lk 10:38-42",
    ]);
  });

  it("falls back to the principal Mass for an unknown ?variant (never blank)", () => {
    const view = buildReadingsView(D("2025-12-25"), { variant: "nonsense" });
    expect(view.activeVariant).toBe("day");
    expect(view.sections.length).toBeGreaterThan(0);
  });

  it("does not overlay a stored row onto an ALTERNATIVE Mass", () => {
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sections: [{ kind: "GOSPEL", label: "Gospel", citation: "Jn 1:1-18", body: "Day Mass." }],
    };
    const night = buildReadingsView(D("2025-12-25"), { variant: "night", row });
    expect(night.sections.find((s) => s.kind === "GOSPEL")!.overlaid).toBe(false);
  });

  it("carries the source link and the catholic-resources credit line", () => {
    const view = buildReadingsView(D("2026-09-08"));
    expect(view.sourceUrl).toMatch(/usccb\.org/);
    expect(view.attribution.some((a) => a.note.includes("Rev. Felix Just"))).toBe(true);
  });
});

describe("buildReadingsView — the Saturday Vigil", () => {
  it("offers Saturday's Mass and Sunday's Vigil, on the day's Mass by default", () => {
    const view = buildReadingsView(D("2026-11-07"));
    expect(view.isVigil).toBe(false);
    expect(view.title).toBe("Saturday of the 31st Week in Ordinary Time");
    expect(view.dateLine).toBe("Saturday, November 7, 2026");
    expect(view.lectionaryNumber).toBe("490");
    expect(view.masses).toEqual([
      {
        variant: null,
        label: "Saturday Mass",
        href: "/liturgy/readings?date=2026-11-07",
        isActive: true,
      },
      {
        variant: "evening",
        label: "Sunday Vigil (Saturday evening)",
        href: "/liturgy/readings?date=2026-11-07&mass=vigil",
        isActive: false,
      },
    ]);
  });

  it("shows the next day's celebration, cycle and readings under this date", () => {
    const view = buildReadingsView(D("2026-11-07"), { mass: "vigil" });
    expect(view.isVigil).toBe(true);
    expect(view.date).toBe("2026-11-07");
    expect(view.title).toBe("Vigil of the 32nd Sunday in Ordinary Time");
    expect(view.dateLine).toBe("Saturday, November 7, 2026, evening");
    expect(view.lectionaryNumber).toBe("154");
    expect(view.framing.sundayCycle).toBe("A");
    expect(view.framing.seasonLabel).toBe("Ordinary Time");
    expect(view.sections.map((s) => s.citation)).toEqual([
      "Wis 6:12-16",
      "Ps 63:2, 3-4, 5-6, 7-8",
      "1 Thes 4:13-18 or 1 Thes 4:13-14",
      "Mt 24:42a and 44",
      "Mt 25:1-13",
    ]);
    expect(view.masses.find((m) => m.isActive)!.label).toBe("Sunday Vigil (Saturday evening)");
    // The USCCB files these readings under the Sunday.
    expect(view.sourceUrl).toBe("https://bible.usccb.org/bible/readings/110826.cfm");
  });

  it("uses the Vigil's own formulary where the Lectionary has one", () => {
    const christmas = buildReadingsView(D("2026-12-24"), { mass: "vigil" });
    expect(christmas.title).toBe("Vigil of the Nativity of the Lord");
    expect(christmas.lectionaryNumber).toBe("13");
    expect(christmas.sections[0].citation).toBe("Is 62:1-5");
    expect(christmas.activeVariant).toBe("vigil");
    expect(christmas.framing.celebration).toBe("The Nativity of the Lord");
    expect(christmas.framing.colorLabel).toBe("White");
    // The morning of the 24th is the Advent weekday.
    const morning = buildReadingsView(D("2026-12-24"));
    expect(morning.lectionaryNumber).toBe("200");
    expect(morning.masses.map((m) => m.label)).toEqual([
      "Thursday Mass",
      "Christmas Vigil (Thursday evening)",
    ]);
  });

  it("keeps Pentecost's Vigil and Extended Vigil together inside the Vigil view", () => {
    const view = buildReadingsView(D("2027-05-15"), { mass: "vigil" });
    expect(view.lectionaryNumber).toBe("62");
    expect(view.sections[0].citation).toBe(
      "Gn 11:1-9 or Ex 19:3-8a, 16-20b or Ez 37:1-14 or Jl 3:1-5",
    );
    expect(view.formularies.map((f) => [f.label, f.href, f.isActive])).toEqual([
      ["Vigil Mass", "/liturgy/readings?date=2027-05-15&mass=vigil&variant=vigil", true],
      [
        "Extended Vigil",
        "/liturgy/readings?date=2027-05-15&mass=vigil&variant=extended-vigil",
        false,
      ],
    ]);
    const extended = buildReadingsView(D("2027-05-15"), {
      mass: "vigil",
      variant: "extended-vigil",
    });
    expect(extended.lectionaryNumber).toBe("62");
    expect(extended.sections.filter((s) => s.kind === "PSALM")).toHaveLength(4);
    expect(extended.formularies.find((f) => f.isActive)!.label).toBe("Extended Vigil");
    // The Mass during the Day is not one of them.
    expect(view.formularies.some((f) => f.variant === "day")).toBe(false);
  });

  it("keeps Palm Sunday's Procession and Mass inside the Vigil view", () => {
    const view = buildReadingsView(D("2027-03-20"), { mass: "vigil" });
    expect(view.title).toBe("Vigil of Palm Sunday of the Passion of the Lord");
    expect(view.lectionaryNumber).toBe("38");
    expect(view.formularies.map((f) => f.label)).toEqual([
      "At the Procession with Palms",
      "At the Mass",
    ]);
    const procession = buildReadingsView(D("2027-03-20"), { mass: "vigil", variant: "procession" });
    expect(procession.lectionaryNumber).toBe("37");
    expect(procession.sections.map((s) => s.citation)).toEqual(["Mk 11:1-10 or Jn 12:12-16"]);
    expect(procession.isVigil).toBe(true);
  });

  it("keeps the Scrutiny readings inside the Vigil view", () => {
    const view = buildReadingsView(D("2027-03-06"), { mass: "vigil" });
    expect(view.lectionaryNumber).toBe("32");
    expect(view.framing.colorLabel).toBe("Rose or violet");
    expect(view.formularies.map((f) => f.label)).toEqual(["Year B readings", "Year A readings"]);
  });

  it("offers no false choice on Holy Saturday", () => {
    const view = buildReadingsView(D("2027-03-27"));
    expect(view.masses).toEqual([]);
    expect(view.title).toBe("Holy Saturday (Easter Vigil)");
    expect(view.dateLine).toBe("Saturday, March 27, 2027, after nightfall");
    expect(view.massNote).toMatch(/no Mass during the day/);
    expect(view.lectionaryNumber).toBe("41");
    // A shared ?mass=vigil link is the same page.
    const asked = buildReadingsView(D("2027-03-27"), { mass: "vigil" });
    expect(asked.isVigil).toBe(false);
    expect(asked.lectionaryNumber).toBe("41");
  });

  it("does not fall to the weekday's Gospel for an unknown ?variant on a memorial", () => {
    const view = buildReadingsView(D("2026-07-29"), { variant: "nonsense" });
    expect(view.lectionaryNumber).toBe("403/607");
    expect(view.sections.at(-1)?.citation).toBe("Jn 11:19-27 or Lk 10:38-42");
  });

  it("says what the calendar leaves open, and that Good Friday has no Mass", () => {
    expect(buildReadingsView(D("2027-03-26")).massNote).toMatch(/No Mass is celebrated/);
    expect(buildReadingsView(D("2026-11-02")).massNote).toMatch(/Masses for the Dead/);
    expect(buildReadingsView(D("2027-01-22")).massNote).toMatch(/Day of Prayer/);
    expect(buildReadingsView(D("2026-11-26")).massNote).toMatch(/Thanksgiving/);
    expect(buildReadingsView(D("2026-07-04")).massNote).toMatch(/Independence Day/);
    // A Sunday on the Fourth is the Sunday's, and an ordinary day has nothing to say.
    expect(buildReadingsView(D("2027-07-04")).massNote).toBeNull();
    expect(buildReadingsView(D("2026-11-05")).massNote).toBeNull();
  });

  it("falls back to the day's Mass for ?mass=vigil on a date with no evening Mass", () => {
    const view = buildReadingsView(D("2026-11-09"), { mass: "vigil" });
    expect(view.isVigil).toBe(false);
    expect(view.masses).toEqual([]);
    expect(view.title).toBe("The Dedication of the Lateran Basilica");
  });

  it("a solemn Saturday keeps its own Masses and adds Sunday's evening", () => {
    const view = buildReadingsView(D("2026-08-15"));
    expect(view.lectionaryNumber).toBe("622");
    expect(view.masses.map((m) => [m.label, m.isActive])).toEqual([
      ["Vigil Mass (evening before)", false],
      ["Mass during the Day", true],
      ["Sunday Vigil (Saturday evening)", false],
    ]);
    const evening = buildReadingsView(D("2026-08-15"), { mass: "vigil" });
    expect(evening.title).toBe("Vigil of the 20th Sunday in Ordinary Time");
    expect(evening.lectionaryNumber).toBe("118");
  });

  it("does not overlay a stored row on a Vigil with its own readings", () => {
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sections: [
        { kind: "FIRST_READING", label: "First Reading", citation: "Is 62:1-5", body: "Stored." },
      ],
    };
    const view = buildReadingsView(D("2026-12-24"), { mass: "vigil", row });
    expect(view.sections[0].overlaid).toBe(false);
  });

  it("names the row date a Vigil view may overlay", () => {
    expect(storedRowDate(D("2026-11-07"), null)?.toISOString().slice(0, 10)).toBe("2026-11-07");
    expect(storedRowDate(D("2026-11-07"), "vigil")?.toISOString().slice(0, 10)).toBe("2026-11-08");
    expect(storedRowDate(D("2026-12-24"), "vigil")).toBeNull();
    expect(storedRowDate(D("2027-03-27"), "vigil")?.toISOString().slice(0, 10)).toBe("2027-03-27");
  });

  it("never offers a toggle between two identical sets of readings", () => {
    for (let t = Date.UTC(2020, 0, 1); t <= Date.UTC(2050, 11, 31); t += 86_400_000) {
      const date = new Date(t);
      const evening = eveningMass(date);
      if (!evening) continue;
      const day = buildReadingsView(date);
      const vigil = buildReadingsView(date, { mass: "vigil" });
      const list = (v: typeof day) => v.sections.map((s) => s.citation).join("|");
      expect(list(day), day.date).not.toBe(list(vigil));
      expect(
        day.masses.some((m) => m.variant === "evening"),
        day.date,
      ).toBe(true);
    }
  });
});

describe("buildReadingsView — the Ascension's two observances", () => {
  const THURSDAY = { ascensionOnThursday: true } as const;
  const options = (view: ReturnType<typeof buildReadingsView>) =>
    view.masses.map((m) => [m.label, m.href, m.isActive]);
  // As the printed USCCB calendar for 2027 has them, note 6b and the May columns.
  const WHERE_THURSDAY =
    "In the ecclesiastical provinces of Boston, Hartford, New York, Omaha and Philadelphia, the Ascension of the Lord is kept on Thursday, May 6, as a holy day of obligation. All other provinces of the United States keep it on Sunday, May 9.";

  it("the Thursday: the weekday first, the Ascension where it is kept", () => {
    const weekday = buildReadingsView(D("2027-05-06"));
    expect(weekday.title).toBe("Thursday of the 6th Week of Easter");
    expect(weekday.lectionaryNumber).toBe("294");
    expect(weekday.massNote).toBe(WHERE_THURSDAY);
    expect(options(weekday)).toEqual([
      ["Thursday Mass", "/liturgy/readings?date=2027-05-06", true],
      [
        "The Ascension, where kept on Thursday",
        "/liturgy/readings?date=2027-05-06&ascension=thursday",
        false,
      ],
    ]);

    const ascension = buildReadingsView(D("2027-05-06"), { calendar: THURSDAY });
    expect(ascension.title).toBe("The Ascension of the Lord");
    expect(ascension.lectionaryNumber).toBe("58");
    expect(ascension.massNote).toBe(WHERE_THURSDAY);
    expect(ascension.sections.map((s) => s.citation)).toEqual([
      "Acts 1:1-11",
      "Ps 47:2-3, 6-7, 8-9",
      "Eph 1:17-23 or Eph 4:1-13 or Eph 4:1-7, 11-13",
      "Mt 28:19a and 20b",
      "Mk 16:15-20",
    ]);
    expect(ascension.masses.map((m) => m.isActive)).toEqual([false, true]);
  });

  it("the Sunday: the Ascension first, the Seventh Sunday where it was kept on Thursday", () => {
    const ascension = buildReadingsView(D("2027-05-09"));
    expect(ascension.title).toBe("The Ascension of the Lord");
    expect(ascension.lectionaryNumber).toBe("58");
    expect(options(ascension)).toEqual([
      ["The Ascension of the Lord", "/liturgy/readings?date=2027-05-09", true],
      [
        "7th Sunday of Easter, where the Ascension was on Thursday",
        "/liturgy/readings?date=2027-05-09&ascension=thursday",
        false,
      ],
    ]);

    const sunday = buildReadingsView(D("2027-05-09"), { calendar: THURSDAY });
    expect(sunday.title).toBe("7th Sunday of Easter");
    expect(sunday.lectionaryNumber).toBe("60");
    expect(sunday.sections.map((s) => s.citation)).toEqual([
      "Acts 1:15-17, 20a, 20c-26",
      "Ps 103:1-2, 11-12, 19-20",
      "1 Jn 4:11-16",
      "cf. Jn 14:18",
      "Jn 17:11b-19",
    ]);
    expect(sunday.masses.map((m) => m.isActive)).toEqual([false, true]);
    expect(sunday.massNote).toBe(WHERE_THURSDAY);
  });

  it("the evening before the Thursday: its Mass, and the Vigil where it is kept", () => {
    const wednesday = buildReadingsView(D("2027-05-05"));
    expect(wednesday.title).toBe("Wednesday of the 6th Week of Easter");
    expect(wednesday.massNote).toBe(WHERE_THURSDAY);
    expect(options(wednesday)).toEqual([
      ["Wednesday Mass", "/liturgy/readings?date=2027-05-05", true],
      [
        "Ascension Vigil (Wednesday evening), where kept on Thursday",
        "/liturgy/readings?date=2027-05-05&mass=vigil&ascension=thursday",
        false,
      ],
    ]);

    const vigil = buildReadingsView(D("2027-05-05"), { mass: "vigil", calendar: THURSDAY });
    expect(vigil.title).toBe("Vigil of the Ascension of the Lord");
    expect(vigil.dateLine).toBe("Wednesday, May 5, 2027, evening");
    expect(vigil.lectionaryNumber).toBe("58");
    expect(vigil.massNote).toBe(WHERE_THURSDAY);
    expect(vigil.masses.map((m) => m.isActive)).toEqual([false, true]);

    // The Wednesday's own Mass is the same everywhere, whichever is asked for.
    const asked = buildReadingsView(D("2027-05-05"), { calendar: THURSDAY });
    expect(asked.title).toBe("Wednesday of the 6th Week of Easter");
    expect(asked.masses.map((m) => m.isActive)).toEqual([true, false]);
    // With no province named, there is no Vigil on this evening to give.
    const noneNamed = buildReadingsView(D("2027-05-05"), { mass: "vigil" });
    expect(noneNamed.isVigil).toBe(false);
    expect(noneNamed.masses.map((m) => m.isActive)).toEqual([true, false]);
  });

  it("the evening before the Sunday: both Vigils stand beside the Saturday's Mass", () => {
    const saturday = buildReadingsView(D("2027-05-08"));
    expect(options(saturday)).toEqual([
      ["Saturday Mass", "/liturgy/readings?date=2027-05-08", true],
      ["Ascension Vigil (Saturday evening)", "/liturgy/readings?date=2027-05-08&mass=vigil", false],
      [
        "7th Sunday of Easter Vigil (Saturday evening), where the Ascension was on Thursday",
        "/liturgy/readings?date=2027-05-08&mass=vigil&ascension=thursday",
        false,
      ],
    ]);

    const vigil = buildReadingsView(D("2027-05-08"), { mass: "vigil" });
    expect(vigil.title).toBe("Vigil of the Ascension of the Lord");
    expect(vigil.lectionaryNumber).toBe("58");
    expect(vigil.masses.map((m) => m.isActive)).toEqual([false, true, false]);

    const seventh = buildReadingsView(D("2027-05-08"), { mass: "vigil", calendar: THURSDAY });
    expect(seventh.title).toBe("Vigil of the 7th Sunday of Easter");
    expect(seventh.lectionaryNumber).toBe("60");
    expect(seventh.masses.map((m) => m.isActive)).toEqual([false, false, true]);
    expect(seventh.massNote).toBe(WHERE_THURSDAY);
  });

  it("a feast on the Thursday is the day's Mass where the Ascension is on Sunday", () => {
    // The 2026 calendar's note: 'on Thursday, May 14, the Feast of Saint Matthias'.
    const view = buildReadingsView(D("2026-05-14"));
    expect(view.title).toBe("Saint Matthias, Apostle");
    expect(view.masses.map((m) => m.label)).toEqual([
      "Thursday Mass",
      "The Ascension, where kept on Thursday",
    ]);
    expect(view.massNote).toMatch(/kept on Thursday, May 14.*keep it on Sunday, May 17\./);
    expect(buildReadingsView(D("2026-05-14"), { calendar: THURSDAY }).lectionaryNumber).toBe("58");
  });

  it("says nothing of it on the dates around them, and ignores the choice there", () => {
    for (const iso of ["2027-05-04", "2027-05-07", "2027-05-10", "2027-05-12"]) {
      const view = buildReadingsView(D(iso));
      expect(view.massNote, iso).toBeNull();
      expect(view.masses, iso).toEqual([]);
      expect(buildReadingsView(D(iso), { calendar: THURSDAY }).sections, iso).toEqual(
        view.sections,
      );
    }
  });

  it("reads ?ascension=thursday and nothing else as the choice", () => {
    expect(calendarFromParam("thursday")).toEqual({ ascensionOnThursday: true });
    expect(calendarFromParam("sunday")).toBeUndefined();
    expect(calendarFromParam(undefined)).toBeUndefined();
  });

  it("names the row of the day the evening anticipates, in that observance", () => {
    const thursdayVigil = storedRowDate(D("2027-05-05"), "vigil", THURSDAY);
    expect(thursdayVigil?.toISOString().slice(0, 10)).toBe("2027-05-06");
    expect(storedRowDate(D("2027-05-05"), "vigil")?.toISOString().slice(0, 10)).toBe("2027-05-05");
  });

  it("does not let a stored row of the other observance stand in for the readings", () => {
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sections: [{ kind: "GOSPEL", label: "Gospel", citation: "Mk 16:15-20", body: "The Sunday." }],
    };
    const sunday = buildReadingsView(D("2027-05-09"), { row, calendar: THURSDAY });
    expect(sunday.sections.find((s) => s.kind === "GOSPEL")!.overlaid).toBe(false);
    expect(buildReadingsView(D("2027-05-09"), { row }).sections.at(-1)!.overlaid).toBe(true);
  });

  it("gives the Sixth Sunday's option, at its Mass and at its Vigil", () => {
    // The USCCB calendars' footnote: 'may be read on the Sixth Sunday of Easter'.
    const note = /Seventh Sunday of Easter \(Lectionary 60\) may be read at this Mass/;
    expect(buildReadingsView(D("2027-05-02")).massNote).toMatch(note);
    expect(buildReadingsView(D("2027-05-01"), { mass: "vigil" }).massNote).toMatch(note);
    expect(buildReadingsView(D("2027-05-01")).massNote).toBeNull();
    expect(buildReadingsView(D("2026-05-10")).massNote).toMatch(/Lectionary 59/);
    expect(buildReadingsView(D("2028-05-21")).massNote).toMatch(/Lectionary 61/);
  });
});

describe("the text keeps its structure and its words", () => {
  const words = (text: string) => text.replace(/\s+/g, " ").trim();

  it("sets a responsorial psalm as the citation's stanzas, one line per verse", () => {
    const psalm = buildReadingsView(D("2026-11-08")).sections.find((s) => s.kind === "PSALM")!;
    expect(psalm.citation).toBe("Ps 63:2, 3-4, 5-6, 7-8");
    expect(psalm.layout?.form).toBe("verse");
    if (psalm.layout?.form !== "verse") throw new Error("not verse");
    expect(psalm.layout.stanzas.map((s) => s.length)).toEqual([1, 2, 2, 2]);
    expect(words(psalm.layout.stanzas.flat().join(" "))).toBe(words(psalm.body!));
  });

  it("keeps a verse the citation joins with 'and' in one stanza", () => {
    const psalm = resolveAlternative("Ps 116:12-13, 15 and 16bc, 17-18", "PSALM");
    if (psalm.layout?.form !== "verse") throw new Error("not verse");
    expect(psalm.layout.stanzas.map((s) => s.length)).toEqual([2, 2, 2]);
  });

  it("sets poetry as verse and leaves the prose chapters of the same books as prose", () => {
    expect(resolveAlternative("Is 55:1-11").layout?.form).toBe("verse");
    expect(resolveAlternative("Wis 6:12-16").layout?.form).toBe("verse");
    expect(resolveAlternative("Is 6:1-8").layout?.form).toBe("prose");
    expect(resolveAlternative("Jb 1:6-22").layout?.form).toBe("prose");
    expect(resolveAlternative("Mt 25:1-13").layout?.form).toBe("prose");
    expect(resolveAlternative("Is 12:2-3, 4bcd, 5-6", "PSALM").layout?.form).toBe("verse");
  });

  it("breaks prose between verses, at a sentence's end, into readable paragraphs", () => {
    const gospel = resolveAlternative("Mt 25:1-13");
    if (gospel.layout?.form !== "prose") throw new Error("not prose");
    expect(gospel.layout.paragraphs.length).toBeGreaterThan(1);
    // Not one word of the Scripture is added, dropped or reordered.
    expect(words(gospel.layout.paragraphs.join(" "))).toBe(words(gospel.body!));
    for (const paragraph of gospel.layout.paragraphs.slice(0, -1)) {
      expect(paragraph.length).toBeGreaterThanOrEqual(240);
      expect(paragraph.length).toBeLessThan(1000);
    }
  });

  it("keeps every verse whole and every word, on every reading of a year", () => {
    for (let t = Date.UTC(2027, 0, 1); t <= Date.UTC(2027, 11, 31); t += 86_400_000) {
      for (const section of buildReadingsView(new Date(t)).sections) {
        for (const alt of section.alternatives) {
          if (!alt.body || !alt.layout) continue;
          const text =
            alt.layout.form === "verse"
              ? alt.layout.stanzas.flat().join(" ")
              : alt.layout.paragraphs.join(" ");
          expect(words(text)).toBe(words(alt.body));
        }
      }
    }
  });

  it("breaks up a passage that arrives as one string without changing it", () => {
    const body = Array.from(
      { length: 12 },
      (_, i) => `Sentence number ${i} of this long reading goes on a while.`,
    ).join(" ");
    const layout = layoutFromText(body, "prose");
    if (layout.form !== "prose") throw new Error("not prose");
    expect(layout.paragraphs.length).toBeGreaterThan(1);
    expect(words(layout.paragraphs.join(" "))).toBe(words(body));
    expect(layoutFromText("R. Blessed be God.\nFirst line.\n\nSecond stanza.", "verse")).toEqual({
      form: "verse",
      stanzas: [["R. Blessed be God.", "First line."], ["Second stanza."]],
    });
  });

  it("writes references out in full, for reading aloud", () => {
    expect(citationReference("Jn 1:1-18")).toBe("John 1:1-18");
    expect(citationReference("cf. Ps 80:4")).toBe("See Psalm 80:4");
    expect(citationReference("1 Thes 4:13-18")).toBe("1 Thessalonians 4:13-18");
    expect(citationReference("Ps 116:12-13, 15 and 16bc, 17-18")).toBe(
      "Psalm 116:12-13, 15 and 16bc, 17-18",
    );
    expect(citationReference("Jl 2:12-18 and 2 Cor 5:20—6:2")).toBe(
      "Joel 2:12-18 and 2 Corinthians 5:20—6:2",
    );
  });
});

describe("parseDateParam", () => {
  it("honours a valid ?date and rejects nonsense", () => {
    expect(parseDateParam("2026-04-05").toISOString()).toBe("2026-04-05T00:00:00.000Z");
    expect(parseDateParam("2026-02-30").getTime()).not.toBeNaN(); // invalid → today
    expect(parseDateParam("not-a-date").getTime()).not.toBeNaN();
    expect(parseDateParam(undefined).getUTCHours()).toBe(0);
  });

  it("treats a date outside the calendar's years as no date at all", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    for (const raw of ["0002-03-21", "1969-12-31", "2100-01-01", "9999-12-31"]) {
      expect(parseDateParam(raw).toISOString().slice(0, 10), raw).toBe("2026-11-07");
    }
    expect(parseDateParam("1970-01-01").toISOString().slice(0, 10)).toBe("1970-01-01");
    expect(parseDateParam("2099-12-31").toISOString().slice(0, 10)).toBe("2099-12-31");
  });

  it("the last day it accepts still has an evening Mass that can be read", () => {
    const view = buildReadingsView(parseDateParam("2099-12-31"), { mass: "vigil" });
    expect(view.isVigil).toBe(true);
    expect(view.title).toBe("Vigil of Mary, the Holy Mother of God");
    expect(view.dateLine).toBe("Thursday, December 31, 2099, evening");
    expect(view.sections.length).toBeGreaterThan(0);
  });
});

describe("TodayDateSync — 'today' is the visitor's date, not the server's", () => {
  it("replaces the URL when the device's local date differs from the rendered one", () => {
    vi.useFakeTimers();
    // 20:30 Saturday in New York is already Sunday in UTC: the server rendered
    // the 6th, the visitor's own calendar says the 5th.
    vi.setSystemTime(new Date("2026-09-05T20:30:00"));
    render(<TodayDateSync renderedDate="2026-09-06" enabled />);
    expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-05");
  });

  it("does nothing when the dates agree", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00"));
    render(<TodayDateSync renderedDate="2026-09-05" enabled />);
    expect(replace).not.toHaveBeenCalled();
  });

  /** The address bar, which the sync reads and, as a last resort, replaces. */
  function stubLocation(search = "") {
    const location = { pathname: "/liturgy/readings", search, replace: vi.fn() };
    vi.stubGlobal("location", location);
    return location;
  }

  it("keeps whatever else was asked for when it corrects the date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T20:30:00"));
    stubLocation("?mass=vigil");
    render(<TodayDateSync renderedDate="2026-11-08" enabled />);
    expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-11-07&mass=vigil");
    cleanup();
    replace.mockClear();

    // A date that could not be read is replaced, and the rest stays.
    stubLocation("?date=2026-02-30&mass=vigil&ascension=thursday");
    render(<TodayDateSync renderedDate="2026-11-08" enabled />);
    expect(replace).toHaveBeenCalledWith(
      "/liturgy/readings?date=2026-11-07&mass=vigil&ascension=thursday",
    );
  });

  it("never rewrites an explicitly requested date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00"));
    render(<TodayDateSync renderedDate="2025-12-25" enabled={false} />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("loads the page at the right address when the router never commits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T20:30:00"));
    const location = stubLocation();
    render(<TodayDateSync renderedDate="2026-09-06" enabled />);
    expect(replace).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1999);
    expect(location.replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(location.replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-05");
    expect(location.replace).toHaveBeenCalledTimes(1);
  });

  it("does not load it again when the router has got there", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T20:30:00"));
    const location = stubLocation();
    render(<TodayDateSync renderedDate="2026-09-06" enabled />);
    // The router commits a beat late: the address has changed, the page has not yet.
    location.search = "?date=2026-09-05";
    vi.advanceTimersByTime(5000);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("does not pull the visitor back from a page they have left for", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T20:30:00"));
    const location = stubLocation();
    const { unmount } = render(<TodayDateSync renderedDate="2026-09-06" enabled />);
    unmount();
    vi.advanceTimersByTime(5000);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("stands down once the page it asked for has rendered", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T20:30:00"));
    const location = stubLocation();
    const { rerender } = render(<TodayDateSync renderedDate="2026-09-06" enabled />);
    rerender(<TodayDateSync renderedDate="2026-09-05" enabled={false} />);
    vi.advanceTimersByTime(5000);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("cannot reload for ever on a device set outside the calendar's years", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("1960-06-15T12:00:00"));
    const location = stubLocation("?date=1960-06-15");
    render(<TodayDateSync renderedDate="2026-11-07" enabled />);
    vi.advanceTimersByTime(5000);
    expect(replace).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it("corrects a tab left open overnight when the visitor comes back to it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T23:59:00"));
    stubLocation();
    render(<TodayDateSync renderedDate="2026-09-05" enabled />);
    expect(replace).not.toHaveBeenCalled();
    act(() => {
      vi.setSystemTime(new Date("2026-09-06T08:00:00"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-06");
  });

  describe("does not move under someone who is still reading", () => {
    /** The tab's own state, which outlives one render as it does one page. */
    afterEach(() => {
      window.sessionStorage.clear();
      window.history.replaceState(null, "");
    });

    function setHidden(hidden: boolean) {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => (hidden ? "hidden" : "visible"),
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }

    afterEach(() => {
      Reflect.deleteProperty(document, "visibilityState");
    });

    it("at midnight", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T23:59:00"));
      stubLocation();
      render(<TodayDateSync renderedDate="2026-09-05" enabled />);
      act(() => {
        vi.advanceTimersByTime(3 * 60_000);
      });
      expect(new Date().getDate()).toBe(6);
      expect(replace).not.toHaveBeenCalled();
    });

    it("after a moment in another app, past midnight", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T23:50:00"));
      stubLocation();
      render(<TodayDateSync renderedDate="2026-09-05" enabled />);
      act(() => {
        vi.setSystemTime(new Date("2026-09-06T00:05:00"));
        window.dispatchEvent(new Event("blur"));
        vi.setSystemTime(new Date("2026-09-06T00:07:00"));
        window.dispatchEvent(new Event("focus"));
      });
      expect(replace).not.toHaveBeenCalled();
    });

    it("after a moment on another tab, whichever of a return's events comes last", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T23:50:00"));
      stubLocation();
      render(<TodayDateSync renderedDate="2026-09-05" enabled />);
      act(() => {
        vi.setSystemTime(new Date("2026-09-06T00:05:00"));
        setHidden(true);
        window.dispatchEvent(new Event("blur"));
        vi.setSystemTime(new Date("2026-09-06T00:07:00"));
        setHidden(false);
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("pageshow"));
      });
      expect(replace).not.toHaveBeenCalled();
    });

    it("but moves on when the visitor has been away a while", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T23:50:00"));
      stubLocation();
      render(<TodayDateSync renderedDate="2026-09-05" enabled />);
      act(() => {
        // Reading past midnight first, and only then putting the phone down.
        vi.setSystemTime(new Date("2026-09-06T00:30:00"));
        setHidden(true);
        vi.setSystemTime(new Date("2026-09-06T07:30:00"));
        setHidden(false);
      });
      expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-06");
    });
  });

  describe("goes on following the day, whatever the hour the tab was opened", () => {
    afterEach(() => {
      window.sessionStorage.clear();
      window.history.replaceState(null, "");
    });

    /** Friday 20:30 on the device, when the server has rendered Saturday. */
    function openOnFridayEvening() {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-04T20:30:00"));
      const location = stubLocation();
      const view = render(<TodayDateSync renderedDate="2026-09-05" enabled />);
      expect(replace).toHaveBeenLastCalledWith("/liturgy/readings?date=2026-09-04");
      return { location, ...view };
    }

    function comeBackOn(when: string) {
      act(() => {
        vi.setSystemTime(new Date(when));
        window.dispatchEvent(new Event("focus"));
      });
    }

    it("after the router has corrected it", () => {
      const { location, rerender } = openOnFridayEvening();
      location.search = "?date=2026-09-04";
      rerender(<TodayDateSync renderedDate="2026-09-04" enabled={false} />);
      replace.mockClear();

      comeBackOn("2026-09-05T08:00:00");
      expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-05");
      location.search = "?date=2026-09-05";
      // The router clears the history entry's state each time it commits.
      window.history.replaceState(null, "");
      rerender(<TodayDateSync renderedDate="2026-09-05" enabled={false} />);
      replace.mockClear();

      comeBackOn("2026-09-06T08:00:00");
      expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-06");
    });

    it("after the page has been loaded at the right address", () => {
      const { location, unmount } = openOnFridayEvening();
      vi.advanceTimersByTime(2000);
      expect(location.replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-04");
      // A new document: nothing of this render is left but the tab's own storage.
      unmount();
      location.search = "?date=2026-09-04";
      replace.mockClear();
      render(<TodayDateSync renderedDate="2026-09-04" enabled={false} />);

      comeBackOn("2026-09-05T08:00:00");
      expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-05");
    });

    it("but not a date the visitor opened for themselves", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-04T20:30:00"));
      stubLocation("?date=2026-09-04");
      render(<TodayDateSync renderedDate="2026-09-04" enabled={false} />);
      comeBackOn("2026-09-05T08:00:00");
      expect(replace).not.toHaveBeenCalled();
    });

    it("nor the same date, opened from a link after leaving for another page", () => {
      const { location, rerender, unmount } = openOnFridayEvening();
      location.search = "?date=2026-09-04";
      rerender(<TodayDateSync renderedDate="2026-09-04" enabled={false} />);
      // Gone to the calendar, a new history entry, and back by its link to the same date.
      location.pathname = "/liturgical-calendar";
      location.search = "";
      unmount();
      window.history.replaceState(null, "");
      location.pathname = "/liturgy/readings";
      location.search = "?date=2026-09-04";
      replace.mockClear();
      render(<TodayDateSync renderedDate="2026-09-04" enabled={false} />);

      comeBackOn("2026-09-05T08:00:00");
      expect(replace).not.toHaveBeenCalled();
    });

    it("nor a correction overtaken by leaving, whose address is opened later", () => {
      const { location, unmount } = openOnFridayEvening();
      location.pathname = "/saints";
      location.search = "";
      unmount();
      location.pathname = "/liturgy/readings";
      location.search = "?date=2026-09-04";
      replace.mockClear();
      render(<TodayDateSync renderedDate="2026-09-04" enabled={false} />);

      comeBackOn("2026-09-05T08:00:00");
      expect(replace).not.toHaveBeenCalled();
    });

    it("still cannot reload for ever on a device outside the calendar's years", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("1960-06-15T12:00:00"));
      const location = stubLocation();
      const { rerender } = render(<TodayDateSync renderedDate="2026-11-07" enabled />);
      expect(replace).toHaveBeenCalledTimes(1);
      location.search = "?date=1960-06-15";
      rerender(<TodayDateSync renderedDate="2026-11-08" enabled />);
      vi.advanceTimersByTime(5000);
      expect(replace).toHaveBeenCalledTimes(1);
      expect(location.replace).not.toHaveBeenCalled();
    });
  });

  describe("leaves what the visitor has pressed alone", () => {
    afterEach(() => {
      window.sessionStorage.clear();
    });

    it.each([
      [
        "a link, whose page is still on its way",
        () => {
          const link = document.createElement("a");
          link.href = "/saints";
          // As next/link does, so that the browser does not follow it as well.
          link.addEventListener("click", (event) => event.preventDefault());
          document.body.append(link);
          fireEvent.click(link);
          link.remove();
        },
      ],
      [
        "a control, whose menu has just opened",
        () => {
          const button = document.createElement("button");
          document.body.append(button);
          fireEvent.click(button);
          button.remove();
        },
      ],
      [
        "a form, sent with the return key",
        () => {
          const form = document.createElement("form");
          form.addEventListener("submit", (event) => event.preventDefault());
          document.body.append(form);
          fireEvent.submit(form);
          form.remove();
        },
      ],
      ["the Back button", () => window.dispatchEvent(new PopStateEvent("popstate"))],
    ])("%s", (_what, press) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T20:30:00"));
      const location = stubLocation();
      render(<TodayDateSync renderedDate="2026-09-06" enabled />);
      vi.advanceTimersByTime(1200);
      press();
      vi.advanceTimersByTime(10_000);
      expect(location.replace).not.toHaveBeenCalled();
    });

    it("but the visitor's own day still comes, if the press has led nowhere", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T20:30:00"));
      const location = stubLocation();
      render(<TodayDateSync renderedDate="2026-09-06" enabled />);
      vi.advanceTimersByTime(1200);
      fireEvent.click(document.body);
      vi.advanceTimersByTime(29_999);
      expect(location.replace).not.toHaveBeenCalled();
      // Another press, and it waits as long again.
      fireEvent.click(document.body);
      vi.advanceTimersByTime(29_999);
      expect(location.replace).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(location.replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-09-05");
      expect(location.replace).toHaveBeenCalledTimes(1);
    });

    it("and nothing is left waiting once the visitor has gone", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-05T20:30:00"));
      const location = stubLocation();
      const { unmount } = render(<TodayDateSync renderedDate="2026-09-06" enabled />);
      fireEvent.click(document.body);
      location.pathname = "/saints";
      unmount();
      fireEvent.click(document.body);
      vi.advanceTimersByTime(60_000);
      expect(location.replace).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});

describe("the page, as a screen reader gets it", () => {
  const page = async (search: Record<string, string>) =>
    render(await DailyReadingsPage({ searchParams: Promise.resolve(search) }));

  it("speaks the weekday cycle as a number, and hides the separators from it", async () => {
    const { container } = await page({ date: "2026-11-07" });
    const meta = container.querySelectorAll(".vf-reading-meta");
    expect(spoken(meta[0])).toBe("Ordinary Time,\u00a0Sunday Cycle A,\u00a0Weekday Cycle 2");
    expect(spoken(meta[1])).toBe("Liturgical colour: Green,\u00a0Lectionary: 490");
    // The eye still gets the dots and the numeral, and nothing else that was spoken.
    const seen = [...meta[0].querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent);
    expect(seen).toEqual(["· ", "· ", "II"]);
    meta[0].querySelectorAll(".vf-sr-inline").forEach((voice) => voice.remove());
    expect(meta[0].textContent).toBe("Ordinary Time\u00a0· Sunday Cycle A\u00a0· Weekday Cycle II");
  });

  it("keeps the Jubilee Year in the same line", async () => {
    const { container } = await page({ date: "2025-06-15" });
    expect(spoken(container.querySelector(".vf-reading-meta")!)).toBe(
      "Ordinary Time,\u00a0Sunday Cycle C,\u00a0Weekday Cycle 1,\u00a0Jubilee Year",
    );
  });

  it("names its links without their arrows, and says which leaves the site", async () => {
    await page({ date: "2026-11-07" });
    expect(screen.getByRole("link", { name: "Open the liturgical calendar" })).toHaveAttribute(
      "href",
      "/liturgical-calendar",
    );
    const source = screen.getByRole("link", { name: "USCCB (opens in a new tab)" });
    expect(source).toHaveAttribute("target", "_blank");
  });

  it("offers the Ascension's choice, by link, on the dates it differs", async () => {
    await page({ date: "2027-05-06", ascension: "thursday" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "The Ascension of the Lord",
    );
    const nav = screen.getByRole("navigation", { name: "Masses on this date" });
    expect(nav).toHaveTextContent("Thursday Mass");
    expect(screen.getByRole("link", { name: /^The Ascension, where kept/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByText(/ecclesiastical provinces of Boston/)).toBeInTheDocument();
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ date: "2027-05-06", ascension: "thursday" }),
    });
    expect(String(meta.title)).toMatch(/^The Ascension of the Lord/);
  });

  it.each(["2026-02-30", "garbage", "0002-03-21", "9999-12-31"])(
    "finds the visitor's own day for the unusable date %s",
    async (date) => {
      vi.useFakeTimers();
      vi.stubGlobal("location", { pathname: "/liturgy/readings", search: `?date=${date}` });
      // The server renders its own UTC day; this device's is two days on.
      vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
      const rendered = await DailyReadingsPage({ searchParams: Promise.resolve({ date }) });
      vi.setSystemTime(new Date(2026, 10, 9, 12, 0));
      render(rendered);
      expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-11-09");
    },
  );

  it("leaves a date it can read alone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 1, 0));
    await page({ date: "2026-11-07" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders the last day of the calendar's years with its Vigil, and past them today", async () => {
    await page({ date: "2099-12-26", mass: "vigil" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Vigil of/);
    cleanup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    // The Vigil of a day in the year 10000 is what used to bring the page down.
    await page({ date: "9999-12-31", mass: "vigil" });
    expect(screen.getByText("Saturday, November 7, 2026, evening")).toBeInTheDocument();
  });
});

describe("ReadingSections", () => {
  const alternative = (reference: string, body: string | null) => ({
    citation: reference.replace("John", "Jn"),
    reference,
    body,
    layout: body ? ({ form: "prose", paragraphs: [body] } as const) : null,
    douayCitation: reference,
    alignment: body ? ("exact" as const) : ("unverified" as const),
    partialVerses: false,
    note: null,
  });
  const base = {
    kind: "GOSPEL" as const,
    label: "Gospel",
    citation: "Jn 1:1-18 or Jn 1:1-5, 9-14",
    reference: "John 1:1-18",
    body: "In the beginning was the Word.",
    layout: { form: "prose", paragraphs: ["In the beginning was the Word."] } as const,
    douayCitation: "John 1:1-18",
    alignment: "exact" as const,
    partialVerses: false,
    note: null,
    response: null,
    source: "usccb" as const,
    overlaid: false,
    alternatives: [
      alternative("John 1:1-18", "In the beginning was the Word."),
      alternative("John 1:1-5, 9-14", "The short form."),
    ],
  };

  it("toggles between the readings the Lectionary offers, and says which is chosen", () => {
    render(<ReadingSections sections={[base]} />);
    expect(screen.getByRole("group", { name: "Choose the Gospel" })).toBeInTheDocument();
    const long = screen.getByRole("button", { name: "John 1:1-18" });
    const short = screen.getByRole("button", { name: "John 1:1-5, 9-14" });
    expect(long).toHaveAttribute("aria-pressed", "true");
    expect(short).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("In the beginning was the Word.")).toBeInTheDocument();
    fireEvent.click(short);
    expect(short).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("The short form.")).toBeInTheDocument();
    expect(screen.queryByText("In the beginning was the Word.")).not.toBeInTheDocument();
  });

  it("gives each reading a heading and a reference apart from its text", () => {
    render(<ReadingSections sections={[base]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Gospel" })).toBeInTheDocument();
    expect(screen.getAllByText("John 1:1-18").length).toBeGreaterThan(0);
  });

  it("renders a citation-only acclamation compactly, with no placeholder paragraph", () => {
    render(
      <ReadingSections
        sections={[
          {
            ...base,
            kind: "ACCLAMATION",
            label: "Gospel Acclamation",
            citation: "Mt 11:25",
            reference: "Matthew 11:25",
            body: null,
            layout: null,
            alternatives: [alternative("Matthew 11:25", null)],
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Gospel Acclamation" })).toBeInTheDocument();
    expect(screen.getByText("Matthew 11:25")).toBeInTheDocument();
    expect(screen.queryByText(/Douay-Rheims/)).not.toBeInTheDocument();
  });

  it("says why a reading has no text, and where to read it", () => {
    render(
      <ReadingSections
        sourceUrl="https://bible.usccb.org/bible/readings/122726.cfm"
        sourceName="USCCB"
        sections={[
          {
            ...base,
            kind: "FIRST_READING",
            label: "First Reading",
            citation: "Sir 3:2-6, 12-14",
            reference: "Sirach 3:2-6, 12-14",
            body: null,
            layout: null,
            alternatives: [alternative("Sirach 3:2-6, 12-14", null)],
          },
        ]}
      />,
    );
    expect(screen.getByText(/numbers this passage differently/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Read it at USCCB (opens in a new tab)" }),
    ).toHaveAttribute("href", "https://bible.usccb.org/bible/readings/122726.cfm");
  });

  it("keeps the choice when the first reading offered has no text but another does", () => {
    render(
      <ReadingSections
        sections={[
          {
            ...base,
            kind: "FIRST_READING",
            label: "First Reading",
            citation: "Sir 3:2-6, 12-14 or Gn 15:1-6; 21:1-3",
            reference: "Sirach 3:2-6, 12-14",
            body: null,
            layout: null,
            alternatives: [
              alternative("Sirach 3:2-6, 12-14", null),
              alternative("Genesis 15:1-6; 21:1-3", "Now when these things were done."),
            ],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Genesis 15:1-6; 21:1-3" }));
    expect(screen.getByText("Now when these things were done.")).toBeInTheDocument();
  });

  it("sets verse as stanzas of lines, and a response the same way every time", () => {
    render(
      <ReadingSections
        sections={[
          {
            ...base,
            kind: "PSALM",
            label: "Responsorial Psalm",
            citation: "Ps 23:1-3",
            reference: "Psalm 23:1-3",
            body: "The Lord ruleth me. He hath set me. R. The Lord is my shepherd.",
            layout: {
              form: "verse",
              stanzas: [
                ["The Lord ruleth me.", "He hath set me."],
                ["R. The Lord is my shepherd."],
              ],
            },
            alternatives: [
              {
                ...alternative("Psalm 23:1-3", "x"),
                layout: {
                  form: "verse",
                  stanzas: [
                    ["The Lord ruleth me.", "He hath set me."],
                    ["R. The Lord is my shepherd."],
                  ],
                },
              },
            ],
          },
        ]}
      />,
    );
    const line = screen.getByText("The Lord ruleth me.");
    expect(line).toHaveClass("vf-prayer-line");
    expect(line.parentElement).toHaveClass("vf-prayer-stanza");
    expect(screen.getByText("R.").closest(".vf-prayer-response")).not.toBeNull();
    expect(screen.getByTitle("Response")).toBeInTheDocument();
  });

  it("shows the whole-verse note when the Lectionary reads only part of a verse", () => {
    render(
      <ReadingSections
        sections={[
          {
            ...base,
            alternatives: [
              {
                ...base.alternatives[0],
                partialVerses: true,
                note: "Where the lectionary reads only part of a verse (a/b/c), the whole Douay-Rheims verse is shown.",
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText(/whole Douay-Rheims verse is shown/)).toBeInTheDocument();
  });
});

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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { ReadingSections } from "@/app/liturgy/readings/ReadingSections";
import { TodayDateSync } from "@/app/liturgy/readings/TodayDateSync";
import {
  buildReadingsView,
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

afterEach(() => {
  cleanup();
  replace.mockClear();
  vi.useRealTimers();
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

  it("keeps the Vigil the Vigil when it corrects the date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T20:30:00"));
    render(<TodayDateSync renderedDate="2026-11-08" enabled mass="vigil" />);
    expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-11-07&mass=vigil");
  });

  it("never rewrites an explicitly requested date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00"));
    render(<TodayDateSync renderedDate="2025-12-25" enabled={false} />);
    expect(replace).not.toHaveBeenCalled();
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
    expect(screen.getByRole("link", { name: "Read it at USCCB" })).toHaveAttribute(
      "href",
      "https://bible.usccb.org/bible/readings/122726.cfm",
    );
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

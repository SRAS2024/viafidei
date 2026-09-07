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
  type StoredReadingRow,
} from "@/app/liturgy/readings/readings-view";

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

  it("a PUBLISHED row WITH text overlays that section only", () => {
    const row: StoredReadingRow = {
      status: "PUBLISHED",
      sections: [
        { kind: "GOSPEL", label: "Gospel", citation: "Lk 1:1-4", body: "A corrected text." },
      ],
    };
    const view = buildReadingsView(D("2026-09-08"), { row });
    const gospel = view.sections.find((s) => s.kind === "GOSPEL")!;
    expect(gospel.overlaid).toBe(true);
    expect(gospel.body).toBe("A corrected text.");
    expect(gospel.citation).toBe("Lk 1:1-4");
    // Every other section still comes from the tables.
    expect(view.sections.filter((s) => s.overlaid)).toHaveLength(1);
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

  it("never rewrites an explicitly requested date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00"));
    render(<TodayDateSync renderedDate="2025-12-25" enabled={false} />);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("ReadingSections", () => {
  const base = {
    kind: "GOSPEL" as const,
    label: "Gospel",
    citation: "Jn 1:1-18 or Jn 1:1-5, 9-14",
    body: "In the beginning was the Word.",
    douayCitation: "John 1:1-18",
    alignment: "exact" as const,
    partialVerses: false,
    note: null,
    response: null,
    source: "usccb" as const,
    overlaid: false,
    alternatives: [
      {
        citation: "Jn 1:1-18",
        body: "In the beginning was the Word.",
        douayCitation: "John 1:1-18",
        alignment: "exact" as const,
        partialVerses: false,
        note: null,
      },
      {
        citation: "Jn 1:1-5, 9-14",
        body: "The short form.",
        douayCitation: "John 1:1-5, 9-14",
        alignment: "exact" as const,
        partialVerses: false,
        note: null,
      },
    ],
  };

  it("toggles between the readings the Lectionary offers", () => {
    render(<ReadingSections sections={[base]} />);
    expect(screen.getByText("In the beginning was the Word.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jn 1:1-5, 9-14" }));
    expect(screen.getByText("The short form.")).toBeInTheDocument();
    expect(screen.queryByText("In the beginning was the Word.")).not.toBeInTheDocument();
  });

  it("renders a citation-only section compactly, with no placeholder paragraph", () => {
    render(
      <ReadingSections
        sections={[
          {
            ...base,
            kind: "ACCLAMATION",
            label: "Gospel Acclamation",
            citation: "Mt 11:25",
            body: null,
            alternatives: [
              {
                citation: "Mt 11:25",
                body: null,
                douayCitation: "",
                alignment: "unverified",
                partialVerses: false,
                note: null,
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText("Gospel Acclamation")).toBeInTheDocument();
    expect(screen.getByText(/Mt 11:25/)).toBeInTheDocument();
    expect(screen.queryByText(/Available from the source below/)).not.toBeInTheDocument();
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

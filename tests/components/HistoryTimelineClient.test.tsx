/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import {
  HistoryTimelineClient,
  type HistoryEraSummary,
  type HistoryEvent,
} from "@/app/history/HistoryTimelineClient";
import { HISTORY_ERAS } from "@/lib/content-shared/church-history-events";

afterEach(() => cleanup());

function event(partial: Partial<HistoryEvent> & Pick<HistoryEvent, "slug" | "title" | "year">) {
  const e: HistoryEvent = {
    dateLabel: String(partial.year),
    precision: "year",
    sortKey: `${String(partial.year).padStart(4, "0")}-00-01`,
    era: "fathers",
    kind: "event",
    kindLabel: "Event",
    tags: [],
    links: [],
    fromDataset: true,
    ...partial,
  };
  return e;
}

const events: HistoryEvent[] = [
  event({
    slug: "pentecost",
    title: "Pentecost",
    year: 33,
    dateLabel: "c. 33",
    precision: "circa",
    sortKey: "0033-00-00",
    era: "apostolic",
  }),
  event({
    slug: "nicaea",
    title: "First Council of Nicaea",
    year: 325,
    dateLabel: "20 May 325",
    precision: "day",
    sortKey: "0325-05-20",
    era: "fathers",
    kind: "council",
    kindLabel: "Council",
    links: [{ href: "/liturgy-history/nicaea", label: "Read the document" }],
  }),
  event({
    slug: "great-schism",
    title: "Great Schism of 1054",
    year: 1054,
    era: "high-medieval",
    kind: "schism",
    kindLabel: "Schism",
    tags: ["schism"],
  }),
  event({
    slug: "rerum-novarum",
    title: "Rerum Novarum",
    year: 1891,
    dateLabel: "15 May 1891",
    precision: "day",
    sortKey: "1891-05-15",
    era: "revolution-19c",
    kind: "document",
    kindLabel: "Encyclical",
    fromDataset: false,
  }),
  event({
    slug: "fatima",
    title: "Our Lady of Fatima",
    year: 1917,
    era: "twentieth",
    kind: "apparition",
    kindLabel: "Apparition",
    tags: ["marian"],
  }),
];

const eras: HistoryEraSummary[] = HISTORY_ERAS.map((era) => ({
  ...era,
  count: events.filter((e) => e.era === era.key).length,
}));

function renderTimeline() {
  return render(<HistoryTimelineClient events={events} eras={eras} minYear={30} maxYear={2026} />);
}

function titles(): string[] {
  return screen
    .getAllByRole("button", { expanded: false })
    .map((b) => b.textContent ?? "")
    .filter((t) => events.some((e) => t.includes(e.title)))
    .map((t) => events.find((e) => t.includes(e.title))!.title);
}

function pickFilter(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Filter the timeline by theme" }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`^${label}`) }));
}

describe("HistoryTimelineClient", () => {
  it("lists every event oldest-first under era headers with counts", () => {
    renderTimeline();
    expect(titles()).toEqual([
      "Pentecost",
      "First Council of Nicaea",
      "Great Schism of 1054",
      "Rerum Novarum",
      "Our Lady of Fatima",
    ]);
    const headers = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headers[0]).toBe("Apostolic Age · 30–100 · 1 event");
    expect(headers).toContain("Twentieth Century · 1914–1965 · 1 event");
    expect(screen.getByText(/Showing 5 events through 2026 AD/)).toBeInTheDocument();
    // The formatted date and kind badge are rendered, never raw ISO.
    expect(screen.getByText("20 May 325")).toBeInTheDocument();
    expect(screen.getByText("Council")).toBeInTheDocument();
    expect(screen.queryByText("0325-05-20")).not.toBeInTheDocument();
  });

  it("toggles to newest-first", () => {
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Newest first" }));
    expect(titles()[0]).toBe("Our Lady of Fatima");
    expect(screen.getByRole("button", { name: "Oldest first" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("filters by era, kind and tags — every filter yields something here", () => {
    renderTimeline();
    pickFilter("Beginnings");
    expect(titles()).toEqual(["Pentecost"]);
    pickFilter("Councils");
    expect(titles()).toEqual(["First Council of Nicaea"]);
    pickFilter("Schisms & Reform");
    expect(titles()).toEqual(["Great Schism of 1054"]);
    pickFilter("Doctrine & Magisterium");
    expect(titles()).toEqual(["Rerum Novarum"]);
    pickFilter("Our Lady");
    expect(titles()).toEqual(["Our Lady of Fatima"]);
    pickFilter("Modern Era");
    expect(titles()).toEqual(["Rerum Novarum", "Our Lady of Fatima"]);
  });

  it("hides events later than the chosen year and exposes the era in aria-valuetext", () => {
    renderTimeline();
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", "2026 AD · Post-Conciliar Church");
    fireEvent.change(slider, { target: { value: "1000" } });
    expect(titles()).toEqual(["Pentecost", "First Council of Nicaea"]);
    expect(slider).toHaveAttribute("aria-valuetext", "1000 AD · Early Middle Ages");
  });

  it("steps five years with the arrow keys and one year with Shift", () => {
    renderTimeline();
    const slider = screen.getByRole("slider");
    // The slider and the "jump to year" box mirror one value, so assert on
    // the labelled input rather than an ambiguous display-value lookup.
    const yearBox = screen.getByLabelText("Or jump to year");
    fireEvent.change(slider, { target: { value: "1000" } });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(yearBox).toHaveValue(1005);
    fireEvent.keyDown(slider, { key: "ArrowLeft", shiftKey: true });
    expect(yearBox).toHaveValue(1004);
    // Never past the ends.
    fireEvent.change(slider, { target: { value: "2025" } });
    fireEvent.keyDown(slider, { key: "ArrowUp" });
    expect(yearBox).toHaveValue(2026);
    fireEvent.change(slider, { target: { value: "31" } });
    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(yearBox).toHaveValue(30);
  });

  it("jumps to an era from the era buttons", () => {
    renderTimeline();
    const group = screen.getByRole("group", { name: "Jump to an era" });
    expect(within(group).getAllByRole("button")).toHaveLength(HISTORY_ERAS.length);
    fireEvent.click(within(group).getByRole("button", { name: /Fathers & First Councils/ }));
    // The era's last year is selected, so everything through 589 shows.
    expect(screen.getByLabelText("Or jump to year")).toHaveValue(589);
    expect(titles()).toEqual(["Pentecost", "First Council of Nicaea"]);
    expect(within(group).getByRole("button", { name: /Fathers & First Councils/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("jumps to a typed year", () => {
    renderTimeline();
    fireEvent.change(screen.getByLabelText("Or jump to year"), { target: { value: "1100" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(titles()).toEqual(["Pentecost", "First Council of Nicaea", "Great Schism of 1054"]);
  });
});

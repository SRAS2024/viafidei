/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HistoryTimelineClient, type HistoryEvent } from "@/app/history/HistoryTimelineClient";

afterEach(() => cleanup());

const events: HistoryEvent[] = [
  {
    slug: "nicaea",
    title: "First Council of Nicaea",
    date: "0325-06-19",
    sortYear: 325,
    period: "council_document",
    periodLabel: "Council Document",
    documentType: "council_document",
  },
  {
    slug: "rerum-novarum",
    title: "Rerum Novarum",
    date: "1891-05-15",
    sortYear: 1891,
    period: "encyclical",
    periodLabel: "Encyclical",
    documentType: "encyclical",
  },
];

describe("HistoryTimelineClient (document-fed)", () => {
  it("shows all events through the current slider year", () => {
    render(<HistoryTimelineClient events={events} minYear={30} maxYear={2026} />);
    expect(screen.getByText("First Council of Nicaea")).toBeInTheDocument();
    expect(screen.getByText("Rerum Novarum")).toBeInTheDocument();
  });

  it("filters councils vs doctrine by documentType", () => {
    render(<HistoryTimelineClient events={events} minYear={30} maxYear={2026} />);
    // Five themes → the filters collapse into a dropdown; open it to choose.
    const openMenu = () =>
      fireEvent.click(screen.getByRole("button", { name: "Filter the timeline by theme" }));

    openMenu();
    fireEvent.click(screen.getByRole("option", { name: "Councils" }));
    expect(screen.getByText("First Council of Nicaea")).toBeInTheDocument();
    expect(screen.queryByText("Rerum Novarum")).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole("option", { name: "Doctrine & Magisterium" }));
    expect(screen.getByText("Rerum Novarum")).toBeInTheDocument();
    expect(screen.queryByText("First Council of Nicaea")).not.toBeInTheDocument();
  });

  it("hides events later than the chosen year", () => {
    render(<HistoryTimelineClient events={events} minYear={30} maxYear={2026} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "1000" } });
    expect(screen.getByText("First Council of Nicaea")).toBeInTheDocument();
    expect(screen.queryByText("Rerum Novarum")).not.toBeInTheDocument();
  });
});

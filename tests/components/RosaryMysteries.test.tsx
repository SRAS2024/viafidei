/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { RosaryMysteries } from "@/components/ui/RosaryMysteries";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RosaryMysteries", () => {
  it("defaults to Thursday's Luminous mysteries and marks them Today", () => {
    // 2026-06-04 is a Thursday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T09:00:00"));
    render(<RosaryMysteries />);

    expect(new Date().getDay()).toBe(4);
    const todayButton = screen.getByRole("button", { name: /Luminous · Today/ });
    expect(todayButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("The Baptism of Jesus in the Jordan")).toBeInTheDocument();
    // A mystery from a different set is not shown.
    expect(screen.queryByText("The Annunciation")).not.toBeInTheDocument();
  });

  it("renders all four mystery-set toggles", () => {
    render(<RosaryMysteries />);
    const group = screen.getByRole("group", { name: /mystery set/i });
    expect(within(group).getAllByRole("button")).toHaveLength(4);
  });

  it("switches the displayed mysteries when another set is chosen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T09:00:00")); // Thursday → Luminous
    render(<RosaryMysteries />);
    expect(screen.getByText("The Baptism of Jesus in the Jordan")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Joyful/ }));
    expect(screen.getByText("The Annunciation")).toBeInTheDocument();
    expect(screen.queryByText("The Baptism of Jesus in the Jordan")).not.toBeInTheDocument();
  });

  it("names today's own weekday, not the first of the set's days", () => {
    // 2026-06-06 is a Saturday: the Joyful Mysteries, shared with Monday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T09:00:00"));
    render(<RosaryMysteries />);
    expect(screen.getByText(/Today \(Saturday\) the Joyful Mysteries are prayed/)).toBeVisible();
  });

  it("uses the site's filter chips, selected in blue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T09:00:00"));
    render(<RosaryMysteries />);
    const today = screen.getByRole("button", { name: /Luminous · Today/ });
    expect(today).toHaveClass("vf-chip", "vf-filter-active");
    expect(screen.getByRole("button", { name: "Joyful" })).toHaveClass("vf-chip");
    expect(screen.getByRole("button", { name: "Joyful" })).not.toHaveClass("vf-filter-active");
  });

  it("sets a mystery's fruit as text, in the column's numbered steps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T09:00:00"));
    const { container } = render(<RosaryMysteries />);
    const facts = container.querySelector(".vf-mystery-facts")!;
    expect(facts).toHaveTextContent(/^Fruit: /);
    expect(facts.innerHTML).not.toMatch(/rounded|bg-|border|uppercase/);
    expect(container.querySelector("ol")).toHaveClass("vf-steps");
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(5);
    expect(container.firstElementChild?.className).not.toMatch(/max-w-3xl|px-4/);
  });

  it("announces the set that has come up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T09:00:00"));
    render(<RosaryMysteries />);
    fireEvent.click(screen.getByRole("button", { name: /^Joyful/ }));
    const heading = screen.getByRole("heading", { name: "Joyful Mysteries", level: 3 });
    expect(heading.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("shows each mystery's meditation reading and fruit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T09:00:00"));
    render(<RosaryMysteries />);
    fireEvent.click(screen.getByRole("button", { name: /^Joyful/ }));
    // The Annunciation → Luke 1:26–38, fruit Humility.
    expect(screen.getByText("Luke 1:26–38")).toBeInTheDocument();
    expect(screen.getByText(/Fruit: Humility/)).toBeInTheDocument();
  });
});

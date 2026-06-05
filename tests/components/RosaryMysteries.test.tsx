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

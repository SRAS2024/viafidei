/**
 * @vitest-environment jsdom
 */
/**
 * The date under "Today's Feast Day Saints" is always the date of the list below
 * it. A link from the homepage names the reader's own day; a plain visit is
 * rendered on the server's clock, whose day can differ from the reader's by the
 * evening, and asks for the reader's day rather than label one day's saints with
 * another's date.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { TodayDateLabel } from "@/app/saints/today/TodayDateLabel";

beforeEach(() => {
  replace.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 7, 20, 30));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("TodayDateLabel", () => {
  it("adds the year when the list's date is today on the reader's device", () => {
    render(<TodayDateLabel serverMonth={11} serverDay={7} dateFromUrl />);
    expect(screen.getByText("November 7, 2026")).toHaveClass("vf-page-hero-lede");
    expect(replace).not.toHaveBeenCalled();
  });

  it("names the date in the URL, not today, when the two differ", () => {
    render(<TodayDateLabel serverMonth={12} serverDay={25} dateFromUrl />);
    expect(screen.getByText("December 25")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("asks for the reader's day when a plain visit got the server's", () => {
    // Evening in the Americas: the server's clock has already reached tomorrow.
    render(<TodayDateLabel serverMonth={11} serverDay={8} />);
    expect(replace).toHaveBeenCalledWith("/saints/today?month=11&day=7");
    // Until the reader's list arrives, the label still describes the list shown.
    expect(screen.getByText("November 8")).toBeInTheDocument();
  });

  it("leaves a plain visit alone when the two clocks agree", () => {
    render(<TodayDateLabel serverMonth={11} serverDay={7} />);
    expect(screen.getByText("November 7, 2026")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { parseFeastDayText } from "@/lib/data/saints";

describe("parseFeastDayText", () => {
  it("parses the canonical 'Month Day' form", () => {
    expect(parseFeastDayText("August 28")).toEqual({ month: 8, day: 28 });
    expect(parseFeastDayText("October 1")).toEqual({ month: 10, day: 1 });
    expect(parseFeastDayText("March 19")).toEqual({ month: 3, day: 19 });
    expect(parseFeastDayText("May 15")).toEqual({ month: 5, day: 15 });
  });

  it("parses three-letter abbreviated months", () => {
    expect(parseFeastDayText("Aug 28")).toEqual({ month: 8, day: 28 });
    expect(parseFeastDayText("Oct 1")).toEqual({ month: 10, day: 1 });
    expect(parseFeastDayText("Dec 25")).toEqual({ month: 12, day: 25 });
  });

  it("ignores trailing prose after the date", () => {
    expect(parseFeastDayText("January 28 — Doctor of the Church")).toEqual({
      month: 1,
      day: 28,
    });
    expect(parseFeastDayText("August 4 / 5 (1969 reform)")).toEqual({
      month: 8,
      day: 4,
    });
  });

  it("accepts ordinal suffixes (1st, 2nd, 3rd, 4th)", () => {
    expect(parseFeastDayText("October 1st")).toEqual({ month: 10, day: 1 });
    expect(parseFeastDayText("November 22nd")).toEqual({ month: 11, day: 22 });
    expect(parseFeastDayText("April 3rd")).toEqual({ month: 4, day: 3 });
  });

  it("returns null for missing / blank input", () => {
    expect(parseFeastDayText(null)).toBeNull();
    expect(parseFeastDayText(undefined)).toBeNull();
    expect(parseFeastDayText("")).toBeNull();
  });

  it("returns null when no recognisable month name is present", () => {
    expect(parseFeastDayText("28 of the month")).toBeNull();
    expect(parseFeastDayText("the 1st")).toBeNull();
  });

  it("returns null when no day-of-month number is present", () => {
    expect(parseFeastDayText("August")).toBeNull();
    expect(parseFeastDayText("the month of October")).toBeNull();
  });

  it("rejects out-of-range day numbers", () => {
    // 32 is not a valid day; the regex caps at 1-31.
    expect(parseFeastDayText("August 32")).toBeNull();
    expect(parseFeastDayText("August 99")).toBeNull();
  });
});

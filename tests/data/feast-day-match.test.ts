import { describe, expect, it } from "vitest";
import { feastDayMatchesDate } from "@/lib/data/saints";

describe("feastDayMatchesDate", () => {
  it("matches the canonical 'Month Day' form", () => {
    expect(feastDayMatchesDate("August 28", 8, 28)).toBe(true);
    expect(feastDayMatchesDate("October 1", 10, 1)).toBe(true);
    expect(feastDayMatchesDate("March 19", 3, 19)).toBe(true);
  });

  it("matches abbreviated month forms", () => {
    expect(feastDayMatchesDate("Aug 28", 8, 28)).toBe(true);
    expect(feastDayMatchesDate("Oct 1", 10, 1)).toBe(true);
  });

  it("matches even when the feast string has trailing prose", () => {
    expect(feastDayMatchesDate("January 28 — Doctor of the Church", 1, 28)).toBe(true);
  });

  it("handles ordinal suffixes (1st, 2nd, 3rd, 4th)", () => {
    expect(feastDayMatchesDate("October 1st", 10, 1)).toBe(true);
    expect(feastDayMatchesDate("November 22nd", 11, 22)).toBe(true);
  });

  it("matches one component of a multi-feast string", () => {
    expect(feastDayMatchesDate("August 4 / 5 (1969 reform)", 8, 4)).toBe(true);
    expect(feastDayMatchesDate("August 4 / 5 (1969 reform)", 8, 5)).toBe(true);
  });

  it("rejects wrong month / day combinations", () => {
    expect(feastDayMatchesDate("August 28", 8, 27)).toBe(false);
    expect(feastDayMatchesDate("August 28", 9, 28)).toBe(false);
  });

  it("returns false for missing / blank feast strings", () => {
    expect(feastDayMatchesDate(null, 8, 28)).toBe(false);
    expect(feastDayMatchesDate(undefined, 8, 28)).toBe(false);
    expect(feastDayMatchesDate("", 8, 28)).toBe(false);
  });

  it("rejects out-of-range month values", () => {
    expect(feastDayMatchesDate("August 28", 13, 28)).toBe(false);
    expect(feastDayMatchesDate("August 28", 0, 28)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  ROSARY_MYSTERY_SETS,
  daysForMysterySet,
  isRosaryGuide,
  mysterySet,
  mysterySetForWeekday,
  type MysterySetKey,
} from "@/lib/content-shared/rosary";

describe("rosary mystery structure", () => {
  it("has the four mystery sets, each with exactly five mysteries", () => {
    expect(ROSARY_MYSTERY_SETS.map((s) => s.key)).toEqual([
      "joyful",
      "sorrowful",
      "glorious",
      "luminous",
    ]);
    for (const set of ROSARY_MYSTERY_SETS) {
      expect(set.mysteries).toHaveLength(5);
    }
  });

  it("maps each weekday to the traditional set (Luminous on Thursday)", () => {
    const expected: Record<number, MysterySetKey> = {
      0: "glorious", // Sunday
      1: "joyful", // Monday
      2: "sorrowful", // Tuesday
      3: "glorious", // Wednesday
      4: "luminous", // Thursday
      5: "sorrowful", // Friday
      6: "joyful", // Saturday
    };
    for (const [day, key] of Object.entries(expected)) {
      expect(mysterySetForWeekday(Number(day))).toBe(key);
    }
  });

  it("wraps out-of-range weekdays", () => {
    expect(mysterySetForWeekday(7)).toBe(mysterySetForWeekday(0));
    expect(mysterySetForWeekday(-1)).toBe(mysterySetForWeekday(6));
  });

  it("lists the weekdays each set is prayed", () => {
    expect(daysForMysterySet("joyful")).toBe("Monday & Saturday");
    expect(daysForMysterySet("sorrowful")).toBe("Tuesday & Friday");
    expect(daysForMysterySet("glorious")).toBe("Sunday & Wednesday");
    expect(daysForMysterySet("luminous")).toBe("Thursday");
  });

  it("returns a set by key with the canonical mysteries", () => {
    expect(mysterySet("joyful").mysteries[0]).toBe("The Annunciation");
    expect(mysterySet("luminous").mysteries).toContain("The Institution of the Eucharist");
    expect(mysterySet("glorious").mysteries[0]).toBe("The Resurrection");
  });

  it("identifies the Rosary guide by its kind", () => {
    expect(isRosaryGuide({ kind: "rosary" })).toBe(true);
    expect(isRosaryGuide({ kind: "confession" })).toBe(false);
    expect(isRosaryGuide({})).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  fieldLabel,
  formatDurationMinutes,
  formatEnumValue,
  formatFeastDay,
  humanizeKey,
  isChipList,
  presentValue,
} from "@/lib/content-shared/field-presenters";

describe("fieldLabel", () => {
  it("uses the explicit label where the auto-humanised form is wrong", () => {
    // "Duration Minutes" / "04-19" were the two worst offenders on live pages.
    expect(fieldLabel("durationMinutes")).toBe("Duration");
    expect(fieldLabel("feastDay")).toBe("Feast day");
    expect(fieldLabel("whatYouNeed")).toBe("What you need");
  });

  it("humanises the long tail of camelCase keys", () => {
    expect(fieldLabel("keyThemes")).toBe("Key themes");
    expect(fieldLabel("theologicalOverview")).toBe("What the Church teaches");
    expect(fieldLabel("mysterySets")).toBe("Mystery sets");
  });

  it("never returns the raw key shape", () => {
    for (const key of ["practiceKind", "openingPrayers", "birth_place", "some-field"]) {
      expect(fieldLabel(key)).not.toMatch(/[_-]/);
    }
  });
});

describe("humanizeKey", () => {
  it("splits camelCase, snake_case and kebab-case into sentence case", () => {
    expect(humanizeKey("lent_preparation")).toBe("Lent preparation");
    expect(humanizeKey("anointing-of-the-sick")).toBe("Anointing of the sick");
    expect(humanizeKey("papacyStart")).toBe("Papacy start");
  });
});

describe("formatFeastDay", () => {
  it("turns the stored MM-DD into a readable date", () => {
    expect(formatFeastDay("04-19")).toBe("April 19");
    expect(formatFeastDay("12-25")).toBe("December 25");
  });

  it("handles a full ISO date", () => {
    expect(formatFeastDay("2026-04-19")).toBe("April 19, 2026");
  });

  it("leaves prose alone (returns null so the caller keeps the original)", () => {
    expect(formatFeastDay("The Tuesday after Pentecost")).toBeNull();
    expect(formatFeastDay("13-40")).toBeNull();
  });
});

describe("formatDurationMinutes", () => {
  it("reads as a sentence, not a bare number", () => {
    expect(formatDurationMinutes(20)).toBe("About 20 minutes");
    expect(formatDurationMinutes(1)).toBe("About 1 minute");
    expect(formatDurationMinutes(60)).toBe("About 1 hour");
    expect(formatDurationMinutes(90)).toBe("About 1 hour 30 minutes");
  });

  it("refuses nonsense rather than printing it", () => {
    expect(formatDurationMinutes(0)).toBeNull();
    expect(formatDurationMinutes(-5)).toBeNull();
    expect(formatDurationMinutes(Number.NaN)).toBeNull();
  });
});

describe("formatEnumValue", () => {
  it("uses the guide kind label map", () => {
    expect(formatEnumValue("kind", "lent_preparation")).toBe("Lent");
    expect(formatEnumValue("kind", "rosary")).toBe("Rosary");
  });

  it("humanises other machine tokens", () => {
    expect(formatEnumValue("sacramentKey", "anointing_of_the_sick")).toBe("Anointing of the sick");
  });

  it("leaves real prose untouched", () => {
    expect(formatEnumValue("category", "Marian devotion")).toBe("Marian devotion");
  });
});

describe("presentValue", () => {
  it("formats a feast day and a duration by key", () => {
    expect(presentValue("feastDay", "04-19")).toEqual({
      kind: "text",
      text: "April 19",
      multiline: false,
    });
    expect(presentValue("durationMinutes", 20)).toEqual({
      kind: "text",
      text: "About 20 minutes",
      multiline: false,
    });
  });

  it("drops empty and unpresentable values instead of printing them", () => {
    expect(presentValue("anything", null)).toBeNull();
    expect(presentValue("anything", "   ")).toBeNull();
    expect(presentValue("anything", [])).toBeNull();
    // A boolean flag as a page section says nothing to a reader.
    expect(presentValue("requiresHumanReview", false)).toBeNull();
    expect(presentValue("confidence", Number.NaN)).toBeNull();
  });

  it("renders an object as humanised label/value pairs, never [object Object]", () => {
    const presented = presentValue("hours", { openTime: "09:00", closeTime: "17:00" });
    expect(presented).toEqual({
      kind: "pairs",
      pairs: [
        { label: "Open time", value: { kind: "text", text: "09:00", multiline: false } },
        { label: "Close time", value: { kind: "text", text: "17:00", multiline: false } },
      ],
    });
  });

  it("hides an object nested too deep rather than dumping its structure", () => {
    // Depth 2 is the limit: a payload of payloads is structure, not content.
    const presented = presentValue("meta", { a: { b: { c: { d: "buried" } } } });
    expect(presented).toBeNull();
  });

  it("hides an object with no presentable leaves", () => {
    expect(presentValue("flags", { ok: true, errors: [] })).toBeNull();
  });

  it("keeps an array of objects as an ordered list of pairs", () => {
    const presented = presentValue("days", [
      { day: 1, intention: "For the Church" },
      { day: 2, intention: "For the Pope" },
    ]);
    expect(presented?.kind).toBe("list");
    if (presented?.kind !== "list") throw new Error("expected a list");
    expect(presented.ordered).toBe(true);
    expect(presented.items).toHaveLength(2);
  });
});

describe("isChipList", () => {
  it("treats short single-line strings as chips", () => {
    const presented = presentValue("patronages", ["Travellers", "Lost items"]);
    expect(presented).not.toBeNull();
    expect(isChipList(presented!)).toBe(true);
  });

  it("keeps long entries as a list so a paragraph is never squeezed into a chip", () => {
    const presented = presentValue("tips", [
      "Pray a single decade when you are short of time — a decade prayed well is worth more than five rushed.",
    ]);
    expect(presented).not.toBeNull();
    expect(isChipList(presented!)).toBe(false);
  });
});

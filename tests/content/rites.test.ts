import { describe, expect, it } from "vitest";
import {
  CATHOLIC_RITES,
  DEFAULT_RITE,
  filterByRite,
  getContentRite,
  isCatholicRite,
  matchesRite,
  normalizeRite,
} from "@/lib/content/rites";
import { RITE_HISTORY_ENTRIES } from "../../prisma/seeds/data/riteHistory";

describe("rite enum + helpers", () => {
  it("recognises every supported rite", () => {
    for (const r of CATHOLIC_RITES) {
      expect(isCatholicRite(r)).toBe(true);
    }
  });

  it("rejects unknown rites", () => {
    expect(isCatholicRite("zwinglian")).toBe(false);
    expect(isCatholicRite(null)).toBe(false);
    expect(isCatholicRite(undefined)).toBe(false);
    expect(isCatholicRite("")).toBe(false);
  });

  it("normalizes unknown values to the default rite (roman)", () => {
    expect(DEFAULT_RITE).toBe("roman");
    expect(normalizeRite("zwinglian")).toBe("roman");
    expect(normalizeRite(null)).toBe("roman");
  });

  it("derives the content rite from slug markers", () => {
    expect(getContentRite("liturgy-roman-mass")).toBe("roman");
    expect(getContentRite("liturgy-byzantine-divine-liturgy")).toBe("byzantine");
    expect(getContentRite("maronite-anaphora")).toBe("maronite");
    expect(getContentRite("syro-malabar-qurbana")).toBe("syroMalabar");
  });

  it("returns null when no rite marker is present", () => {
    expect(getContentRite("rosary-introductory")).toBeNull();
    expect(getContentRite("encyclical-rerum-novarum")).toBeNull();
    expect(getContentRite("")).toBeNull();
  });
});

describe("matchesRite", () => {
  it("always shows rite-neutral content", () => {
    for (const r of CATHOLIC_RITES) {
      expect(matchesRite("rosary-introductory", r)).toBe(true);
      expect(matchesRite(null, r)).toBe(true);
    }
  });

  it("shows rite-tagged content only to its matching rite", () => {
    expect(matchesRite("byzantine-liturgy", "byzantine")).toBe(true);
    expect(matchesRite("byzantine-liturgy", "roman")).toBe(false);
    expect(matchesRite("byzantine-liturgy", "maronite")).toBe(false);
  });
});

describe("filterByRite", () => {
  const rows = [
    { slug: "encyclical-rerum-novarum" }, // rite-neutral → always kept
    { slug: "byzantine-divine-liturgy" }, // byzantine-only
    { slug: "maronite-anaphora" }, // maronite-only
    { slug: "roman-order-of-mass" }, // roman-only
  ];

  it("keeps rite-neutral rows + only the matching rite's rows", () => {
    const roman = filterByRite(rows, "roman");
    expect(roman.map((r) => r.slug)).toEqual(["encyclical-rerum-novarum", "roman-order-of-mass"]);

    const byz = filterByRite(rows, "byzantine");
    expect(byz.map((r) => r.slug)).toEqual([
      "encyclical-rerum-novarum",
      "byzantine-divine-liturgy",
    ]);
  });

  it("returns rite-neutral content untouched on an empty list", () => {
    expect(filterByRite([], "roman")).toEqual([]);
  });
});

describe("RITE_HISTORY_ENTRIES", () => {
  it("has one entry per supported rite", () => {
    expect(RITE_HISTORY_ENTRIES.length).toBe(CATHOLIC_RITES.length);
  });

  it("uses church-history-rite- slug prefix so timeline picks them up", () => {
    for (const e of RITE_HISTORY_ENTRIES) {
      expect(e.slug).toMatch(/^church-history-rite-/);
      expect(e.kind).toBe("COUNCIL_TIMELINE");
      // Body must mention an actual year so users can place the event.
      expect(e.body).toMatch(/\b\d{3,4}\b/);
    }
  });

  it("titles every entry with the rite name and the word 'Establishment'", () => {
    for (const e of RITE_HISTORY_ENTRIES) {
      expect(e.title).toMatch(/Establishment/i);
    }
  });
});

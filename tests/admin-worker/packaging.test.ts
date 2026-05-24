/**
 * Per-content-type packaging validators — proves the worker can build
 * all required content types with the spec's section 7 structural
 * fields.
 */

import { describe, expect, it } from "vitest";

import {
  APPROVED_HISTORY_TYPES,
  validateConsecrationPackage,
  validateHistoryPackage,
  validateNovenaPackage,
  validateRosaryPackage,
  validateSacramentPackage,
  validatePackagingByType,
  validatePrayerPackage,
  validateApparitionPackage,
} from "@/lib/admin-worker/packaging";

const provenance = {
  sourceUrl: "https://www.vatican.va/x",
  sourceHost: "www.vatican.va",
  provenance: { fetchedAt: "now" },
  validationEvidence: [{ source: "vatican", match: "exact" }],
};

describe("validatePrayerPackage", () => {
  it("passes a complete prayer", () => {
    expect(
      validatePrayerPackage({
        prayerTitle: "Our Father",
        prayerType: "petition",
        prayerText: "Our Father, who art in heaven...",
        category: "core",
        formattingMetadata: { sections: 1 },
        ...provenance,
      }),
    ).toEqual([]);
  });

  it("flags missing prayer text", () => {
    expect(
      validatePrayerPackage({
        prayerTitle: "Our Father",
        prayerType: "petition",
        category: "core",
        ...provenance,
      }),
    ).toContain("prayerText");
  });
});

describe("validateNovenaPackage", () => {
  it("requires Day 1 through Day 9 each with title + prayer", () => {
    const partial = {
      novenaTitle: "Divine Mercy Novena",
      background: "Background",
      purpose: "Devotion",
      duration: "9 days",
      dropdownMetadata: { collapsedByDefault: true },
      days: { day1: { title: "Day 1", prayer: "Lord, have mercy." } },
      ...provenance,
    };
    const missing = validateNovenaPackage(partial);
    // Day 2..9 should all be flagged.
    for (let i = 2; i <= 9; i++) {
      expect(missing).toContain(`days.day${i}.title`);
      expect(missing).toContain(`days.day${i}.prayer`);
    }
  });
});

describe("validateRosaryPackage", () => {
  it("rejects a rosary with a mystery set that doesn't have exactly 5 mysteries", () => {
    const missing = validateRosaryPackage({
      title: "Holy Rosary",
      background: "...",
      howToPray: "...",
      openingPrayers: "Sign of the Cross",
      closingPrayers: "Hail Holy Queen",
      mysterySets: [
        {
          mysteries: [{ name: "First" }, { name: "Second" }],
          decadeStructure: "Our Father + 10 Hail Marys + Glory Be",
        },
      ],
      ...provenance,
    });
    expect(missing.some((m) => m.includes("mysteries(=5)"))).toBe(true);
  });

  it("accepts a complete rosary", () => {
    const missing = validateRosaryPackage({
      title: "Holy Rosary",
      background: "...",
      howToPray: "...",
      openingPrayers: "Sign of the Cross",
      closingPrayers: "Hail Holy Queen",
      mysterySets: [
        {
          mysteries: [{}, {}, {}, {}, {}],
          decadeStructure: "Our Father + 10 Hail Marys + Glory Be",
        },
      ],
      ...provenance,
    });
    expect(missing).toEqual([]);
  });
});

describe("validateConsecrationPackage", () => {
  it("requires each day to have a prayer", () => {
    const missing = validateConsecrationPackage({
      consecrationTitle: "33 Days to Morning Glory",
      background: "...",
      duration: "33 days",
      dailyStructure: [{ day: 1 }, { day: 2, prayer: "Day 2 prayer" }],
      finalConsecrationPrayer: "Final prayer",
      ...provenance,
    });
    expect(missing.some((m) => m.startsWith("dailyStructure[0]"))).toBe(true);
    expect(missing.some((m) => m.startsWith("dailyStructure[1]"))).toBe(false);
  });
});

describe("validateSacramentPackage", () => {
  it("requires badge, key, description, preparation, participation", () => {
    const missing = validateSacramentPackage({
      sacramentTitle: "Baptism",
      ...provenance,
    });
    expect(missing).toContain("sacramentBadge");
    expect(missing).toContain("sacramentKey");
    expect(missing).toContain("description");
    expect(missing).toContain("preparation");
    expect(missing).toContain("participation");
  });
});

describe("validateHistoryPackage", () => {
  it("rejects an unapproved historyType", () => {
    const missing = validateHistoryPackage({
      historyType: "celebrities",
      title: "Some entry",
      dateOrEra: "20th c.",
      summary: "...",
      body: "...",
      ...provenance,
    });
    expect(missing.some((m) => m.includes("historyType"))).toBe(true);
  });

  for (const type of APPROVED_HISTORY_TYPES) {
    it(`accepts an approved historyType: ${type}`, () => {
      expect(
        validateHistoryPackage({
          historyType: type,
          title: "Some entry",
          dateOrEra: "20th c.",
          summary: "...",
          body: "...",
          ...provenance,
        }),
      ).toEqual([]);
    });
  }
});

describe("validateApparitionPackage", () => {
  it("requires approvalStatus + location", () => {
    const missing = validateApparitionPackage({
      apparitionTitle: "Our Lady of Lourdes",
      background: "...",
      ...provenance,
    });
    expect(missing).toContain("apparitionLocation");
    expect(missing).toContain("apparitionDate");
    expect(missing).toContain("approvalStatus");
  });
});

describe("validatePackagingByType (dispatcher)", () => {
  it("routes PRAYER through validatePrayerPackage", () => {
    const out = validatePackagingByType("PRAYER", { prayerTitle: "x", ...provenance });
    expect(out.ok).toBe(false);
    expect(out.missingFields).toContain("prayerText");
  });
});

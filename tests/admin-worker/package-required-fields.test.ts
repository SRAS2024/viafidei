/**
 * Spec §10 enforcement — every content-type package must require the
 * fields the spec lists. Each test calls the validator with a
 * complete payload and confirms it passes; then strips a required
 * field and confirms it fails with the right reason.
 */

import { describe, expect, it } from "vitest";

import {
  validateApparitionPackage,
  validateConsecrationPackage,
  validateDevotionPackage,
  validateHistoryPackage,
  validateLiturgyPackage,
  validateNovenaPackage,
  validateParishPackage,
  validatePrayerPackage,
  validateRosaryPackage,
  validateSacramentPackage,
  validateSaintPackage,
} from "@/lib/admin-worker/packaging";

const PROVENANCE = {
  sourceUrl: "https://www.vatican.va/test",
  sourceHost: "www.vatican.va",
  provenance: { title: { sourceUrl: "https://www.vatican.va/test" } },
  validationEvidence: [{ sourceHost: "www.vatican.va", match: true }],
};

describe("spec §10 — Prayer package requires actual prayer text, not an article", () => {
  it("passes when the actual prayer text and required metadata are present", () => {
    const missing = validatePrayerPackage({
      prayerTitle: "Our Father",
      prayerType: "Lord's Prayer",
      prayerText: "Our Father, who art in heaven, hallowed be thy name. Amen.",
      category: "essential",
      formattingMetadata: { lineBreaks: ["after each phrase"] },
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when prayerText is missing", () => {
    const missing = validatePrayerPackage({
      prayerTitle: "Our Father",
      prayerType: "Lord's Prayer",
      category: "essential",
      formattingMetadata: {},
      ...PROVENANCE,
    });
    expect(missing).toContain("prayerText");
  });
});

describe("spec §10 — Saint package required fields", () => {
  it("passes with name, type, feast day, biography, source provenance", () => {
    const missing = validateSaintPackage({
      saintName: "Saint Thérèse",
      saintType: "Doctor of the Church",
      feastDay: "October 1",
      background: "Biography of Thérèse.",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when feastDay is missing", () => {
    const missing = validateSaintPackage({
      saintName: "Saint Thérèse",
      saintType: "Doctor",
      background: "Bio.",
      ...PROVENANCE,
    });
    expect(missing).toContain("feastDay");
  });
});

describe("spec §10 — Marian Apparition package required fields", () => {
  it("passes with title, location, date, approval status, background", () => {
    const missing = validateApparitionPackage({
      apparitionTitle: "Our Lady of Fátima",
      apparitionLocation: "Fátima, Portugal",
      apparitionDate: "1917-05-13",
      approvalStatus: "Approved",
      background: "Background of the apparition.",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when approvalStatus is missing", () => {
    const missing = validateApparitionPackage({
      apparitionTitle: "Our Lady of X",
      apparitionLocation: "Place",
      apparitionDate: "1900",
      background: "Background.",
      ...PROVENANCE,
    });
    expect(missing).toContain("approvalStatus");
  });
});

describe("spec §10 — Novena package requires exactly 9 day sections", () => {
  it("passes with all 9 days, each carrying title and prayer", () => {
    const days: Record<string, { title: string; prayer: string }> = {};
    for (let i = 1; i <= 9; i++) {
      days[`day${i}`] = { title: `Day ${i}`, prayer: `Day ${i} prayer text` };
    }
    const missing = validateNovenaPackage({
      novenaTitle: "Novena to St. Jude",
      background: "Background.",
      purpose: "Purpose.",
      duration: "9 days",
      dropdownMetadata: { categories: ["intercession"] },
      days,
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when day 9 is missing", () => {
    const days: Record<string, { title: string; prayer: string }> = {};
    for (let i = 1; i <= 8; i++) {
      days[`day${i}`] = { title: `Day ${i}`, prayer: `Day ${i} prayer` };
    }
    const missing = validateNovenaPackage({
      novenaTitle: "Novena",
      background: "x",
      purpose: "y",
      duration: "9 days",
      dropdownMetadata: {},
      days,
      ...PROVENANCE,
    });
    expect(missing.some((m) => m.includes("day9"))).toBe(true);
  });

  it("fails when a day section is missing its prayer", () => {
    const days: Record<string, { title: string; prayer?: string }> = {};
    for (let i = 1; i <= 9; i++) {
      days[`day${i}`] = { title: `Day ${i}` };
      if (i !== 5) (days[`day${i}`] as { prayer: string }).prayer = `Day ${i} prayer`;
    }
    const missing = validateNovenaPackage({
      novenaTitle: "Novena",
      background: "x",
      purpose: "y",
      duration: "9 days",
      dropdownMetadata: {},
      days,
      ...PROVENANCE,
    });
    expect(missing.some((m) => m.includes("day5"))).toBe(true);
  });
});

describe("spec §10 — Rosary package requires mystery sets with 5 mysteries each", () => {
  it("passes with proper mystery set structure", () => {
    const missing = validateRosaryPackage({
      title: "The Holy Rosary",
      background: "Background.",
      howToPray: "How to pray.",
      openingPrayers: ["Apostles' Creed"],
      closingPrayers: ["Hail Holy Queen"],
      mysterySets: [
        {
          decadeStructure: "Our Father, 10 Hail Marys, Glory Be",
          mysteries: [
            "The Annunciation",
            "The Visitation",
            "The Nativity",
            "The Presentation",
            "Finding in the Temple",
          ],
        },
      ],
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when a mystery set has fewer than 5 mysteries", () => {
    const missing = validateRosaryPackage({
      title: "Rosary",
      background: "x",
      howToPray: "y",
      openingPrayers: [],
      closingPrayers: [],
      mysterySets: [
        {
          decadeStructure: "OF + 10HM + GB",
          mysteries: ["A", "B", "C"], // only 3
        },
      ],
      ...PROVENANCE,
    });
    expect(missing.some((m) => m.includes("=5"))).toBe(true);
  });

  it("fails when mysterySets is missing entirely", () => {
    const missing = validateRosaryPackage({
      title: "Rosary",
      background: "x",
      howToPray: "y",
      openingPrayers: [],
      closingPrayers: [],
      ...PROVENANCE,
    });
    expect(missing).toContain("mysterySets");
  });
});

describe("spec §10 — Devotion package requires practice instructions", () => {
  it("passes with name, type, background, and practice instructions", () => {
    const missing = validateDevotionPackage({
      devotionTitle: "Devotion to the Sacred Heart",
      devotionType: "Marian",
      background: "Background.",
      howToPractice: "Step by step instructions.",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when howToPractice is missing", () => {
    const missing = validateDevotionPackage({
      devotionTitle: "Devotion",
      devotionType: "Other",
      background: "x",
      ...PROVENANCE,
    });
    expect(missing).toContain("howToPractice");
  });
});

describe("spec §10 — Consecration package requires daily structure + final consecration prayer", () => {
  it("passes with all required fields and per-day prayer", () => {
    const missing = validateConsecrationPackage({
      consecrationTitle: "33-day Consecration",
      background: "x",
      duration: "33 days",
      dailyStructure: Array.from({ length: 33 }, (_, i) => ({
        title: `Day ${i + 1}`,
        prayer: `Day ${i + 1} prayer`,
      })),
      finalConsecrationPrayer: "Final prayer.",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when finalConsecrationPrayer is missing", () => {
    const missing = validateConsecrationPackage({
      consecrationTitle: "Consecration",
      background: "x",
      duration: "33 days",
      dailyStructure: [{ title: "Day 1", prayer: "x" }],
      ...PROVENANCE,
    });
    expect(missing).toContain("finalConsecrationPrayer");
  });
});

describe("spec §10 — Sacrament package required fields", () => {
  it("passes with badge, title, key, description, preparation, participation", () => {
    const missing = validateSacramentPackage({
      sacramentBadge: "baptism",
      sacramentTitle: "Baptism",
      sacramentKey: "baptism",
      description: "Description.",
      preparation: "Preparation.",
      participation: "Participation.",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when sacramentKey is missing", () => {
    const missing = validateSacramentPackage({
      sacramentBadge: "baptism",
      sacramentTitle: "Baptism",
      description: "x",
      preparation: "y",
      participation: "z",
      ...PROVENANCE,
    });
    expect(missing).toContain("sacramentKey");
  });
});

describe("spec §10 — History package limited to approved categories", () => {
  it("passes with an approved historyType", () => {
    const missing = validateHistoryPackage({
      historyType: "councils",
      title: "Second Vatican Council",
      dateOrEra: "1962-1965",
      summary: "Summary.",
      body: "Body.",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when the historyType is not on the approved list", () => {
    const missing = validateHistoryPackage({
      historyType: "Gossip", // not approved
      title: "Something",
      dateOrEra: "2020",
      summary: "x",
      body: "y",
      ...PROVENANCE,
    });
    expect(missing.some((m) => m.includes("not one of approved"))).toBe(true);
  });
});

describe("spec §10 — Liturgy package required fields", () => {
  it("passes with title, type, summary, formation body", () => {
    const missing = validateLiturgyPackage({
      liturgyTitle: "Order of Mass",
      liturgyType: "Eucharistic Liturgy",
      summary: "Summary.",
      formationBody: "Formation body.",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when formationBody is missing", () => {
    const missing = validateLiturgyPackage({
      liturgyTitle: "Mass",
      liturgyType: "Eucharistic",
      summary: "x",
      ...PROVENANCE,
    });
    expect(missing).toContain("formationBody");
  });
});

describe("spec §10 — Parish package required fields", () => {
  it("passes with name, address, city, country", () => {
    const missing = validateParishPackage({
      parishName: "St. Mary's",
      address: "123 Main St",
      city: "Springfield",
      country: "USA",
      ...PROVENANCE,
    });
    expect(missing).toEqual([]);
  });

  it("fails when city is missing", () => {
    const missing = validateParishPackage({
      parishName: "St. Mary's",
      address: "123 Main St",
      country: "USA",
      ...PROVENANCE,
    });
    expect(missing).toContain("city");
  });
});

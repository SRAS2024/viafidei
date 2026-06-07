/**
 * Tests that each strict content schema accepts a valid payload and rejects
 * invalid ones. These schemas are the gate at the boundary between the
 * worker and the published store.
 */

import { describe, it, expect } from "vitest";

import { CONTENT_SCHEMAS, validatePayload } from "@/lib/checklist/schemas";

describe("content schemas", () => {
  it("registers a schema for every content type", () => {
    const types = [
      "PRAYER",
      "DEVOTION",
      "SAINT",
      "MARIAN_TITLE",
      "APPARITION",
      "NOVENA",
      "SACRAMENT",
      "GUIDE",
      "CHURCH_DOCUMENT",
      "LITURGICAL",
      "SPIRITUAL_PRACTICE",
    ] as const;
    for (const t of types) {
      expect(CONTENT_SCHEMAS[t]).toBeDefined();
      expect(CONTENT_SCHEMAS[t].instruction.requiredFields.length).toBeGreaterThan(0);
    }
  });

  it("accepts a valid PRAYER payload", () => {
    const result = validatePayload("PRAYER", {
      slug: "our-father",
      title: "Our Father",
      body: "Our Father, who art in heaven, hallowed be thy name.",
      prayerType: "general",
      category: "general",
      language: "en",
      citations: ["https://www.vatican.va/archive/ENG0015/__P9.HTM"],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects PRAYER payload missing the body", () => {
    const result = validatePayload("PRAYER", {
      slug: "our-father",
      title: "Our Father",
      prayerType: "general",
      category: "general",
      citations: ["https://www.vatican.va/"],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a SAINT with no biography", () => {
    const result = validatePayload("SAINT", {
      slug: "saint-test",
      canonicalName: "Saint Test",
      feastDay: "01-01",
      feastMonth: 1,
      feastDayOfMonth: 1,
      saintType: "other",
      canonizationStatus: "canonized",
      citations: ["https://www.vatican.va/"],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a NOVENA with fewer than 9 days", () => {
    const result = validatePayload("NOVENA", {
      slug: "test-novena",
      title: "Test Novena",
      summary: "A short summary of this novena, which is sufficiently long.",
      intentionTheme: "test",
      days: [
        {
          day: 1,
          title: "Day 1",
          meditation: "long enough meditation text",
          prayerText: "long enough prayer text",
        },
      ],
      citations: ["https://www.vatican.va/", "https://www.usccb.org/"],
    });
    expect(result.ok).toBe(false);
  });

  it("requires exactly 9 days for a NOVENA", () => {
    const days = Array.from({ length: 9 }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}`,
      meditation: "long enough meditation text " + i,
      prayerText: "long enough prayer text " + i,
    }));
    const result = validatePayload("NOVENA", {
      slug: "test-novena",
      title: "Test Novena",
      summary: "A short summary of this novena, which is sufficiently long.",
      intentionTheme: "test",
      days,
      citations: ["https://www.vatican.va/", "https://www.usccb.org/"],
    });
    expect(result.ok).toBe(true);
  });

  it("requires a recognized sacramentKey for SACRAMENT", () => {
    const result = validatePayload("SACRAMENT", {
      slug: "made-up-sacrament",
      sacramentKey: "made_up",
      title: "Made-up Sacrament",
      summary: "A summary long enough to satisfy the min length.",
      theologicalOverview:
        "A theological overview long enough to satisfy the min length, which is 100.",
      institution: "Some institution text long enough",
      matterAndForm: { matter: "matter text", form: "form text" },
      minister: "minister text",
      recipient: "recipient text",
      effects: ["effect"],
      citations: ["https://www.vatican.va/", "https://www.usccb.org/"],
    });
    expect(result.ok).toBe(false);
  });
});

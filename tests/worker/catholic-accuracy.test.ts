/**
 * Tests the worker's Catholic-accuracy guard rails (no invented doctrine,
 * feast days, indulgences, titles, apparitions, promises).
 */

import { describe, it, expect } from "vitest";

import { runQA } from "@/lib/worker/qa";
import { getContentSchema } from "@/lib/worker/schemas";
import { FORBIDDEN_INVENTIONS } from "@/lib/worker/types";

describe("Catholic accuracy guards", () => {
  it("defines all forbidden invention categories", () => {
    expect(FORBIDDEN_INVENTIONS).toContain("doctrine");
    expect(FORBIDDEN_INVENTIONS).toContain("feast_day");
    expect(FORBIDDEN_INVENTIONS).toContain("indulgence");
    expect(FORBIDDEN_INVENTIONS).toContain("title");
    expect(FORBIDDEN_INVENTIONS).toContain("apparition");
    expect(FORBIDDEN_INVENTIONS).toContain("promise");
  });

  it("attaches an accuracy rule mentioning invented content for every type", () => {
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
      const def = getContentSchema(t);
      const rules = def.instruction.accuracyRules.join(" ").toLowerCase();
      expect(rules.length).toBeGreaterThan(20);
    }
  });

  it("requires multiple citations for risk-bearing types", () => {
    expect(getContentSchema("APPARITION").instruction.minCitations).toBeGreaterThanOrEqual(2);
    expect(getContentSchema("SAINT").instruction.minCitations).toBeGreaterThanOrEqual(2);
    expect(getContentSchema("MARIAN_TITLE").instruction.minCitations).toBeGreaterThanOrEqual(2);
    expect(getContentSchema("NOVENA").instruction.minCitations).toBeGreaterThanOrEqual(2);
    expect(getContentSchema("SACRAMENT").instruction.minCitations).toBeGreaterThanOrEqual(2);
  });

  it("requires APPARITION to default to human review", () => {
    expect(getContentSchema("APPARITION").instruction.requiresHumanReview).toBe(true);
  });

  it("QA flags packages whose warnings mention 'invented' content", () => {
    const qa = runQA({
      contentType: "PRAYER",
      canonicalSlug: "test",
      title: "Test",
      fields: {},
      payload: {
        slug: "test",
        title: "Test",
        body: "Some body that is long enough to not get rejected on length.",
        prayerType: "general",
        category: "general",
        citations: ["https://www.vatican.va/"],
      },
      authorityLevel: "VATICAN",
      confidence: 0.9,
      warnings: ["invented promise about indulgence"],
      citations: ["https://www.vatican.va/"],
      needsHumanReview: false,
    });
    expect(qa.accuracyScore).toBeLessThan(1);
  });
});

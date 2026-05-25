/**
 * Field-level provenance (spec §10). Proves every required field
 * either has a provenance record or is a deterministic internal rule.
 */

import { describe, expect, it } from "vitest";

import {
  DETERMINISTIC_INTERNAL_FIELDS,
  hasFullProvenance,
  makeInternalRuleProvenance,
  makeProvenance,
  missingProvenance,
} from "@/lib/admin-worker/provenance";

describe("makeProvenance", () => {
  it("builds a FieldProvenance row with timestamp", () => {
    const p = makeProvenance({
      fieldName: "prayerText",
      sourceUrl: "https://example.org/prayer",
      sourceHost: "example.org",
      snippet: "Our Father, who art in heaven, hallowed be thy name.",
      method: "BODY_REGEX",
      confidence: 0.8,
      checksum: "abc123",
    });
    expect(p.fieldName).toBe("prayerText");
    expect(p.sourceUrl).toBe("https://example.org/prayer");
    expect(p.extractionMethod).toBe("BODY_REGEX");
    expect(p.confidence).toBe(0.8);
    expect(p.checksum).toBe("abc123");
    expect(new Date(p.timestamp).getTime()).not.toBeNaN();
  });

  it("clamps confidence into [0,1]", () => {
    expect(
      makeProvenance({
        fieldName: "x",
        sourceUrl: "u",
        sourceHost: "h",
        snippet: "s",
        method: "BODY_REGEX",
        confidence: 5,
      }).confidence,
    ).toBe(1);
    expect(
      makeProvenance({
        fieldName: "x",
        sourceUrl: "u",
        sourceHost: "h",
        snippet: "s",
        method: "BODY_REGEX",
        confidence: -1,
      }).confidence,
    ).toBe(0);
  });

  it("truncates snippets to 240 chars", () => {
    const long = "a".repeat(500);
    const p = makeProvenance({
      fieldName: "x",
      sourceUrl: "u",
      sourceHost: "h",
      snippet: long,
      method: "BODY_REGEX",
      confidence: 0.5,
    });
    expect(p.snippet.length).toBe(240);
  });
});

describe("makeInternalRuleProvenance", () => {
  it("marks the field as a deterministic internal rule", () => {
    const p = makeInternalRuleProvenance("rosary.decadeStructure");
    expect(p.isDeterministicInternalRule).toBe(true);
    expect(p.extractionMethod).toBe("INTERNAL_RULE");
    expect(p.confidence).toBe(1);
  });
});

describe("missingProvenance + hasFullProvenance", () => {
  const required = ["prayerTitle", "prayerText", "category"];

  it("reports every missing required field", () => {
    const provided = [
      makeProvenance({
        fieldName: "prayerTitle",
        sourceUrl: "u",
        sourceHost: "h",
        snippet: "s",
        method: "TITLE_REGEX",
        confidence: 0.9,
      }),
    ];
    expect(missingProvenance(required, provided)).toEqual(["prayerText", "category"]);
    expect(hasFullProvenance(required, provided)).toBe(false);
  });

  it("returns empty when every required field has provenance", () => {
    const provided = required.map((f) =>
      makeProvenance({
        fieldName: f,
        sourceUrl: "u",
        sourceHost: "h",
        snippet: "s",
        method: "BODY_REGEX",
        confidence: 0.7,
      }),
    );
    expect(missingProvenance(required, provided)).toEqual([]);
    expect(hasFullProvenance(required, provided)).toBe(true);
  });

  it("exempts deterministic internal-rule fields without provenance", () => {
    const internalField = [...DETERMINISTIC_INTERNAL_FIELDS][0];
    expect(missingProvenance([internalField], [])).toEqual([]);
    expect(hasFullProvenance([internalField], [])).toBe(true);
  });
});

describe("DETERMINISTIC_INTERNAL_FIELDS", () => {
  it("includes the Rosary mystery count rule", () => {
    expect(DETERMINISTIC_INTERNAL_FIELDS.has("rosary.mysteryCount")).toBe(true);
  });

  it("includes the seven sacraments list", () => {
    expect(DETERMINISTIC_INTERNAL_FIELDS.has("sacrament.sevenSacramentList")).toBe(true);
  });
});

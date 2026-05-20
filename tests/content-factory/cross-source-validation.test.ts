/**
 * Cross-source validation tests.
 *
 * The validator sits between the builder and strict QA. Required
 * fields per content type come from CROSS_SOURCE_RULES. A package
 * passes when every required field is either:
 *   - originated by a primary_content_source, OR
 *   - has at least one `pass` evidence row from an approved
 *     validation source.
 *
 * These tests pin the contract — they fail loudly the moment
 * someone drops a required field, lowers the confidence threshold,
 * or removes a content type from CROSS_SOURCE_RULES.
 */

import { describe, expect, it } from "vitest";
import {
  CROSS_SOURCE_RULES,
  EVIDENCE_TYPES,
  isEvidenceType,
  validateCrossSource,
  type EvidenceRecord,
} from "@/lib/content-factory/cross-source-validation";
import type { ContentPackage } from "@/lib/content-factory/types";

function makePackage(contentType: string, slug: string): ContentPackage {
  return {
    contentType: contentType as ContentPackage["contentType"],
    slug,
    title: `${contentType} ${slug}`,
    sourceUrl: `https://example.org/${slug}`,
    sourceHost: "example.org",
    payload: {},
    provenance: {},
  };
}

function evidence(
  fieldName: string,
  decision: "pass" | "fail" | "insufficient_evidence" = "pass",
): EvidenceRecord {
  return {
    fieldName,
    evidenceType: "exact_text_match",
    sourceUrl: "https://validator.org/x",
    sourceHost: "validator.org",
    validationDecision: decision,
    matchConfidence: 0.95,
  };
}

describe("cross-source validation evidence types", () => {
  it("includes every spec-listed evidence type", () => {
    const want = [
      "exact_text_match",
      "title_match",
      "feast_day_match",
      "patronage_match",
      "prayer_text_match",
      "sacrament_identity_match",
      "scripture_reference_match",
      "history_date_match",
      "apparition_approval_status_match",
      "parish_identity_match",
    ];
    for (const t of want) {
      expect(isEvidenceType(t)).toBe(true);
    }
    // Deterministic + enrichment fillers are also valid evidence
    // sources, per the cross-source-rules spec list.
    expect(EVIDENCE_TYPES).toContain("deterministic_rule");
    expect(EVIDENCE_TYPES).toContain("approved_enrichment");
  });
});

describe("cross-source rules per content type", () => {
  it("requires prayer name, prayer text, and prayer type for prayers", () => {
    expect(CROSS_SOURCE_RULES.Prayer).toContain("title");
    expect(CROSS_SOURCE_RULES.Prayer).toContain("prayerText");
    expect(CROSS_SOURCE_RULES.Prayer).toContain("prayerType");
  });

  it("requires saint name, feast day, biography identity for saints", () => {
    expect(CROSS_SOURCE_RULES.Saint).toContain("title");
    expect(CROSS_SOURCE_RULES.Saint).toContain("feastDay");
    expect(CROSS_SOURCE_RULES.Saint).toContain("biographyIdentity");
  });

  it("requires novena name, days, daily prayers for novenas", () => {
    expect(CROSS_SOURCE_RULES.Novena).toContain("title");
    expect(CROSS_SOURCE_RULES.Novena).toContain("days");
    expect(CROSS_SOURCE_RULES.Novena).toContain("dailyPrayers");
  });

  it("requires sacrament key, group, explanation for sacraments", () => {
    expect(CROSS_SOURCE_RULES.Sacrament).toContain("sacramentKey");
    expect(CROSS_SOURCE_RULES.Sacrament).toContain("sacramentGroup");
    expect(CROSS_SOURCE_RULES.Sacrament).toContain("explanation");
  });

  it("requires history category, date/era, authority, event identity for history", () => {
    expect(CROSS_SOURCE_RULES.History).toContain("historyCategory");
    expect(CROSS_SOURCE_RULES.History).toContain("dateOrEra");
    expect(CROSS_SOURCE_RULES.History).toContain("authority");
    expect(CROSS_SOURCE_RULES.History).toContain("eventIdentity");
  });

  it("requires apparition name, location, approval status for Marian apparitions", () => {
    expect(CROSS_SOURCE_RULES.MarianApparition).toContain("title");
    expect(CROSS_SOURCE_RULES.MarianApparition).toContain("location");
    expect(CROSS_SOURCE_RULES.MarianApparition).toContain("approvalStatus");
  });

  it("requires parish name, city, country for parishes", () => {
    expect(CROSS_SOURCE_RULES.Parish).toContain("title");
    expect(CROSS_SOURCE_RULES.Parish).toContain("city");
    expect(CROSS_SOURCE_RULES.Parish).toContain("country");
  });
});

describe("validateCrossSource()", () => {
  it("accepts a package when the primary source is a primary_content_source", () => {
    const result = validateCrossSource({
      pkg: makePackage("Prayer", "our-father"),
      primarySourceRole: "primary_content_source",
      collectedEvidence: [],
    });
    expect(result.decision).toBe("pass");
    expect(result.missingEvidenceFields).toEqual([]);
  });

  it("fails when a wider source has no validation evidence for required fields", () => {
    const result = validateCrossSource({
      pkg: makePackage("Prayer", "our-father"),
      primarySourceRole: "discovery_only_source",
      collectedEvidence: [],
    });
    expect(result.decision).toBe("fail");
    expect(result.missingEvidenceFields).toEqual(
      expect.arrayContaining(["title", "prayerText", "prayerType"]),
    );
    expect(result.reason).toMatch(/validation_evidence_missing/);
  });

  it("passes a discovery-only source when every required field has pass evidence", () => {
    const result = validateCrossSource({
      pkg: makePackage("Prayer", "our-father"),
      primarySourceRole: "discovery_only_source",
      collectedEvidence: [evidence("title"), evidence("prayerText"), evidence("prayerType")],
    });
    expect(result.decision).toBe("pass");
    expect(result.missingEvidenceFields).toEqual([]);
  });

  it("ignores low-confidence evidence (below 0.6 threshold)", () => {
    const lowConfidence: EvidenceRecord = {
      fieldName: "prayerText",
      evidenceType: "exact_text_match",
      sourceUrl: "https://validator.org/x",
      sourceHost: "validator.org",
      validationDecision: "pass",
      matchConfidence: 0.3,
    };
    const result = validateCrossSource({
      pkg: makePackage("Prayer", "our-father"),
      primarySourceRole: "discovery_only_source",
      collectedEvidence: [evidence("title"), lowConfidence, evidence("prayerType")],
    });
    expect(result.decision).toBe("fail");
    expect(result.missingEvidenceFields).toContain("prayerText");
  });

  it("rejects packages from a rejected_source outright", () => {
    const result = validateCrossSource({
      pkg: makePackage("Prayer", "our-father"),
      primarySourceRole: "rejected_source",
      collectedEvidence: [evidence("title"), evidence("prayerText"), evidence("prayerType")],
    });
    expect(result.decision).toBe("fail");
    expect(result.reason).toMatch(/rejected/);
  });

  it("treats a deterministic_rule evidence row as sufficient for that field", () => {
    const deterministic: EvidenceRecord = {
      fieldName: "sacramentGroup",
      evidenceType: "deterministic_rule",
      sourceUrl: "internal://sacrament-group-map",
      sourceHost: "internal",
      validationDecision: "pass",
      matchConfidence: 1.0,
    };
    const result = validateCrossSource({
      pkg: makePackage("Sacrament", "reconciliation"),
      primarySourceRole: "validation_source",
      collectedEvidence: [evidence("sacramentKey"), deterministic, evidence("explanation")],
    });
    expect(result.decision).toBe("pass");
  });

  it("treats an approved_enrichment evidence row as sufficient for that field", () => {
    const enrichment: EvidenceRecord = {
      fieldName: "patronage",
      evidenceType: "approved_enrichment",
      sourceUrl: "https://approved-enrichment.example.org/x",
      sourceHost: "approved-enrichment.example.org",
      validationDecision: "pass",
      matchConfidence: 1.0,
    };
    // Saint requires title + feastDay + biographyIdentity. patronage
    // is optional. Enrichment for patronage should not change the
    // required-field check, but should appear in the evidence trail.
    const result = validateCrossSource({
      pkg: makePackage("Saint", "anthony"),
      primarySourceRole: "validation_source",
      collectedEvidence: [
        evidence("title"),
        evidence("feastDay"),
        evidence("biographyIdentity"),
        enrichment,
      ],
    });
    expect(result.decision).toBe("pass");
    expect(result.evidence).toContain(enrichment);
  });
});

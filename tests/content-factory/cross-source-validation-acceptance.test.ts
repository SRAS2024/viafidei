/**
 * Cross-source validation acceptance tests (spec §23).
 *
 * Spec criteria pinned here:
 *   - "A prayer from one source can pass after validation from
 *      another approved source"
 *   - "Wider discovery sources cannot publish without validation
 *      evidence"
 *   - "Weak sources can suggest content but cannot approve it"
 *   - "Validation sources can validate fields without becoming
 *      primary content sources"
 *
 * Each test exercises the validateCrossSource() decision layer
 * directly so the contract is provable without spinning up the
 * worker + DB.
 */

import { describe, expect, it } from "vitest";
import { validateCrossSource } from "@/lib/content-factory/cross-source-validation";
import type { ContentPackage } from "@/lib/content-factory/types";

function prayerCandidate(): ContentPackage {
  return {
    contentType: "Prayer",
    slug: "our-father",
    title: "Our Father",
    sourceUrl: "https://discovery-only.example/our-father",
    sourceHost: "discovery-only.example",
    payload: {
      prayerText: "Our Father, who art in heaven, hallowed be thy name.",
      prayerType: "intercessory",
    },
    provenance: {},
  };
}

describe("Spec §23 acceptance — cross-source validation", () => {
  it("A prayer from a wider source PASSES when a second approved source validates it", () => {
    const result = validateCrossSource({
      pkg: prayerCandidate(),
      primarySourceRole: "discovery_only_source",
      collectedEvidence: [
        {
          fieldName: "title",
          evidenceType: "title_match",
          sourceUrl: "https://vatican.va/our-father",
          sourceHost: "vatican.va",
          validationDecision: "pass",
          matchConfidence: 0.98,
          matchedValue: "Our Father",
        },
        {
          fieldName: "prayerText",
          evidenceType: "prayer_text_match",
          sourceUrl: "https://vatican.va/our-father",
          sourceHost: "vatican.va",
          validationDecision: "pass",
          matchConfidence: 0.95,
          matchedValue: "Our Father, who art in heaven, hallowed be thy name.",
        },
        {
          fieldName: "prayerType",
          evidenceType: "exact_text_match",
          sourceUrl: "https://vatican.va/our-father",
          sourceHost: "vatican.va",
          validationDecision: "pass",
          matchConfidence: 0.85,
          matchedValue: "intercessory",
        },
      ],
    });
    expect(result.decision).toBe("pass");
    expect(result.missingEvidenceFields).toEqual([]);
  });

  it("A wider discovery source CANNOT publish without validation evidence", () => {
    const result = validateCrossSource({
      pkg: prayerCandidate(),
      primarySourceRole: "discovery_only_source",
      collectedEvidence: [],
    });
    expect(result.decision).toBe("fail");
    expect(result.reason).toMatch(/validation_evidence_missing/);
  });

  it("A weak (discovery-only) source can SUGGEST but cannot APPROVE", () => {
    // The wider source's own self-evidence does not count — we need
    // a different host's match.
    const result = validateCrossSource({
      pkg: prayerCandidate(),
      primarySourceRole: "discovery_only_source",
      collectedEvidence: [
        // No external validators agreed.
        {
          fieldName: "title",
          evidenceType: "title_match",
          sourceUrl: "https://discovery-only.example/our-father",
          sourceHost: "discovery-only.example",
          validationDecision: "insufficient_evidence",
          matchConfidence: 0,
          matchedValue: null,
        },
      ],
    });
    expect(result.decision).toBe("fail");
    expect(result.missingEvidenceFields.length).toBeGreaterThan(0);
  });

  it("A validation_source CAN validate fields without being the primary publisher", () => {
    // Package is produced by a validation_source — every required
    // field must therefore have pass evidence from another source.
    // When that's true, the package publishes.
    const result = validateCrossSource({
      pkg: prayerCandidate(),
      primarySourceRole: "validation_source",
      collectedEvidence: [
        {
          fieldName: "title",
          evidenceType: "title_match",
          sourceUrl: "https://vatican.va/our-father",
          sourceHost: "vatican.va",
          validationDecision: "pass",
          matchConfidence: 0.98,
        },
        {
          fieldName: "prayerText",
          evidenceType: "prayer_text_match",
          sourceUrl: "https://vatican.va/our-father",
          sourceHost: "vatican.va",
          validationDecision: "pass",
          matchConfidence: 0.95,
        },
        {
          fieldName: "prayerType",
          evidenceType: "exact_text_match",
          sourceUrl: "https://vatican.va/our-father",
          sourceHost: "vatican.va",
          validationDecision: "pass",
          matchConfidence: 0.9,
        },
      ],
    });
    expect(result.decision).toBe("pass");
  });

  it("A primary_content_source publishes WITHOUT needing external evidence", () => {
    const result = validateCrossSource({
      pkg: prayerCandidate(),
      primarySourceRole: "primary_content_source",
      collectedEvidence: [],
    });
    expect(result.decision).toBe("pass");
  });
});

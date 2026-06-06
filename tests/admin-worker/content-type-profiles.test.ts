/**
 * Content-type intelligence profiles — one unified source of truth across
 * all content types.
 */

import { describe, expect, it } from "vitest";

import {
  allContentTypeProfiles,
  getContentTypeProfile,
  isDoctrinallySensitive,
  requiredFieldsFor,
  validationRequirementsFor,
} from "@/lib/admin-worker/content-type-profiles";
import { thresholdFor } from "@/lib/admin-worker/quality";

describe("content-type profiles", () => {
  it("covers every known content type with a complete profile", () => {
    const profiles = allContentTypeProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(12);
    for (const p of profiles) {
      expect(p.requiredFields.length).toBeGreaterThan(0);
      expect(p.qualityThreshold).toBe(thresholdFor(p.contentType));
      expect(p.extractionStrategy).toContain("Extractor");
      expect(["auto_when_confident", "review_required"]).toContain(p.publishingRule);
    }
  });

  it("marks doctrinally-sensitive types and requires cross-source validation", () => {
    for (const t of ["APPARITION", "SACRAMENT", "CHURCH_DOCUMENT"]) {
      const p = getContentTypeProfile(t);
      expect(p.doctrinallySensitive).toBe(true);
      expect(p.requiresCrossSourceValidation).toBe(true);
      expect(p.publishingRule).toBe("review_required");
      expect(p.qualityThreshold).toBe(0.95);
      expect(isDoctrinallySensitive(t)).toBe(true);
    }
  });

  it("treats ordinary types as auto-publishable when confident", () => {
    const p = getContentTypeProfile("PRAYER");
    expect(p.doctrinallySensitive).toBe(false);
    expect(p.publishingRule).toBe("auto_when_confident");
    expect(isDoctrinallySensitive("PRAYER")).toBe(false);
  });

  it("exposes required fields + validation requirements per type", () => {
    expect(requiredFieldsFor("PRAYER")).toContain("prayerText");
    expect(validationRequirementsFor("APPARITION")).toContain("approvalStatus");
    expect(validationRequirementsFor("SAINT")).toContain("feastDay");
  });

  it("returns a safe default profile for an unknown type", () => {
    const p = getContentTypeProfile("MYSTERY_TYPE");
    expect(p.contentType).toBe("MYSTERY_TYPE");
    expect(p.doctrinallySensitive).toBe(false);
    expect(p.qualityThreshold).toBe(thresholdFor("MYSTERY_TYPE"));
  });
});

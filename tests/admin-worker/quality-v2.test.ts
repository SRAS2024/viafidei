/**
 * Spec §12 ten-dimension quality scorer. Verifies the new scoring,
 * the doctrinal threshold lookups, and missing-dimension reporting.
 */

import { describe, expect, it } from "vitest";

import {
  computeFinalScoreV2,
  missingDimensions,
  QUALITY_THRESHOLDS,
  thresholdFor,
} from "@/lib/admin-worker/quality";

describe("computeFinalScoreV2 — 10-dimension scoring (spec §12)", () => {
  it("returns ~1.0 when every dimension is perfect", () => {
    const score = computeFinalScoreV2({
      completenessScore: 1,
      correctnessScore: 1,
      formattingScore: 1,
      sourceAuthorityScore: 1,
      fieldProvenanceScore: 1,
      validationEvidenceScore: 1,
      duplicateSafetyScore: 1,
      publicRenderingScore: 1,
      doctrinalSensitivityScore: 1,
      packageConsistencyScore: 1,
    });
    expect(score).toBeCloseTo(1, 2);
  });

  it("returns 0 when any single dimension is 0 (any-zero gate)", () => {
    const score = computeFinalScoreV2({
      completenessScore: 1,
      correctnessScore: 1,
      formattingScore: 1,
      sourceAuthorityScore: 1,
      fieldProvenanceScore: 0,
      validationEvidenceScore: 1,
      duplicateSafetyScore: 1,
      publicRenderingScore: 1,
      doctrinalSensitivityScore: 1,
      packageConsistencyScore: 1,
    });
    expect(score).toBe(0);
  });

  it("optional dimensions default to 1 so legacy callers keep working", () => {
    const score = computeFinalScoreV2({
      completenessScore: 0.9,
      correctnessScore: 0.95,
      formattingScore: 0.9,
    });
    expect(score).toBeGreaterThan(0.85);
  });

  it("weighted geometric mean penalises a partial dimension", () => {
    const high = computeFinalScoreV2({
      completenessScore: 0.95,
      correctnessScore: 0.95,
      formattingScore: 0.95,
      sourceAuthorityScore: 0.95,
      fieldProvenanceScore: 0.95,
      validationEvidenceScore: 0.95,
      duplicateSafetyScore: 0.95,
      publicRenderingScore: 0.95,
      doctrinalSensitivityScore: 0.95,
      packageConsistencyScore: 0.95,
    });
    const partial = computeFinalScoreV2({
      completenessScore: 0.5,
      correctnessScore: 0.95,
      formattingScore: 0.95,
      sourceAuthorityScore: 0.95,
      fieldProvenanceScore: 0.95,
      validationEvidenceScore: 0.95,
      duplicateSafetyScore: 0.95,
      publicRenderingScore: 0.95,
      doctrinalSensitivityScore: 0.95,
      packageConsistencyScore: 0.95,
    });
    expect(partial).toBeLessThan(high);
  });
});

describe("thresholdFor — per-content-type thresholds (spec §12)", () => {
  it("uses the doctrinal threshold (0.95) for apparitions", () => {
    expect(thresholdFor("APPARITION")).toBe(0.95);
  });

  it("uses the doctrinal threshold for sacraments", () => {
    expect(thresholdFor("SACRAMENT")).toBe(0.95);
  });

  it("uses the doctrinal threshold for Church documents (history)", () => {
    expect(thresholdFor("CHURCH_DOCUMENT")).toBe(0.95);
  });

  it("uses 0.8 for prayer", () => {
    expect(thresholdFor("PRAYER")).toBe(0.8);
  });

  it("uses 0.75 for parish (least-sensitive)", () => {
    expect(thresholdFor("PARISH")).toBe(0.75);
  });

  it("falls back to DEFAULT for an unknown content type", () => {
    expect(thresholdFor("UNKNOWN_TYPE")).toBe(QUALITY_THRESHOLDS.DEFAULT);
  });
});

describe("missingDimensions — exact missing-quality reporting (spec §12)", () => {
  it("returns an empty list when every dimension is positive", () => {
    expect(
      missingDimensions({
        contentType: "PRAYER",
        contentId: "x",
        completenessScore: 1,
        correctnessScore: 1,
        formattingScore: 1,
        sourceAuthorityScore: 1,
        fieldProvenanceScore: 1,
        validationEvidenceScore: 1,
      }),
    ).toEqual([]);
  });

  it("lists exactly the zeroed dimensions", () => {
    const out = missingDimensions({
      contentType: "PRAYER",
      contentId: "x",
      completenessScore: 0,
      correctnessScore: 1,
      formattingScore: 1,
      fieldProvenanceScore: 0,
      validationEvidenceScore: 1,
    });
    expect(out).toContain("completeness");
    expect(out).toContain("fieldProvenance");
    expect(out).not.toContain("correctness");
  });
});

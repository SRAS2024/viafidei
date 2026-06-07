/**
 * Spec §12 ten-dimension quality scorer. Verifies the new scoring,
 * the doctrinal threshold lookups, and missing-dimension reporting.
 */

import { describe, expect, it, vi } from "vitest";

import {
  computeFinalScoreV2,
  failedDimensionsV2,
  missingDimensions,
  QUALITY_THRESHOLDS,
  recordQualityScoreV2,
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

describe("failedDimensionsV2 — which dimension failed", () => {
  const base = {
    contentType: "PRAYER",
    contentId: "c1",
    completenessScore: 1,
    correctnessScore: 1,
    formattingScore: 1,
  };

  it("returns [] when every dimension clears the floor", () => {
    expect(failedDimensionsV2({ ...base })).toEqual([]);
  });

  it("flags dimensions below the 0.5 floor (including the new ones)", () => {
    const out = failedDimensionsV2({
      ...base,
      sourceAuthorityScore: 0.2,
      duplicateSafetyScore: 0,
      doctrinalSensitivityScore: 0.4,
    });
    expect(out).toContain("sourceAuthority");
    expect(out).toContain("duplicateSafety");
    expect(out).toContain("doctrinalSensitivity");
    expect(out).not.toContain("completeness");
  });
});

describe("recordQualityScoreV2 — full model persistence", () => {
  function makePrisma() {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      contentQualityScore: {
        // A deliberately minimal mock that does NOT echo the data back,
        // proving the function returns its own computed verdict.
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "q1" };
        }),
      },
    } as unknown as Parameters<typeof recordQualityScoreV2>[0];
    return { prisma, created };
  }

  it("stores all dimensions + threshold + pass/fail + failed dimensions", async () => {
    const { prisma, created } = makePrisma();
    const res = await recordQualityScoreV2(prisma, {
      contentType: "PRAYER",
      contentId: "c1",
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
    expect(res.passed).toBe(true);
    expect(res.threshold).toBe(thresholdFor("PRAYER"));
    expect(res.finalScore).toBeGreaterThanOrEqual(res.threshold);
    expect(res.failedDimensions).toEqual([]);
    const row = created[0];
    expect(row.sourceAuthorityScore).toBe(1);
    expect(row.packageConsistencyScore).toBe(1);
    expect(row.passed).toBe(true);
    expect(Array.isArray(row.failedDimensions)).toBe(true);
  });

  it("fails the gate + names the failed dimension when one dimension is zero", async () => {
    const { prisma } = makePrisma();
    const res = await recordQualityScoreV2(prisma, {
      contentType: "APPARITION",
      contentId: "c2",
      completenessScore: 1,
      correctnessScore: 1,
      formattingScore: 1,
      doctrinalSensitivityScore: 0, // sensitive content without verifier
    });
    expect(res.finalScore).toBe(0);
    expect(res.passed).toBe(false);
    expect(res.failedDimensions).toContain("doctrinalSensitivity");
  });
});

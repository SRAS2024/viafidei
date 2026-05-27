/**
 * Strict QA (spec §5 + §6 follow-up). Confirms the scorer enforces
 * the any-zero gate, classifies status correctly, and persists
 * idempotently.
 */

import { describe, expect, it, vi } from "vitest";

import { recordStrictQA } from "@/lib/admin-worker/strict-qa";

function makePrisma() {
  return {
    adminWorkerStrictQAResult: {
      upsert: vi.fn(async () => ({ id: "qa-1" })),
    },
  } as unknown as Parameters<typeof recordStrictQA>[0];
}

const FULL = {
  packageArtifactId: "art-1",
  contentType: "PRAYER",
  completenessScore: 1,
  correctnessScore: 1,
  formattingScore: 1,
  provenanceScore: 1,
  validationScore: 1,
  duplicateSafetyScore: 1,
  publicReadinessScore: 1,
};

describe("recordStrictQA (spec §5 follow-up)", () => {
  it("PASSED with finalScore≈1 when every dimension is perfect", async () => {
    const out = await recordStrictQA(makePrisma(), FULL);
    expect(out.status).toBe("PASSED");
    expect(out.finalScore).toBeCloseTo(1, 2);
  });

  it("FAILED when any dimension is zero (any-zero gate)", async () => {
    const out = await recordStrictQA(makePrisma(), {
      ...FULL,
      validationScore: 0,
    });
    expect(out.status).toBe("FAILED");
    expect(out.finalScore).toBe(0);
    expect(out.blockingReasons.some((r) => r.includes("validation"))).toBe(true);
  });

  it("NEEDS_REPAIR when finalScore is between review_floor and threshold", async () => {
    const out = await recordStrictQA(makePrisma(), {
      ...FULL,
      completenessScore: 0.6,
      correctnessScore: 0.6,
      validationScore: 0.6,
    });
    expect(out.status).toBe("NEEDS_REPAIR");
  });

  it("uses the stricter doctrinal threshold for APPARITION", async () => {
    const aboveDefault = await recordStrictQA(makePrisma(), {
      ...FULL,
      contentType: "APPARITION",
      completenessScore: 0.85,
      correctnessScore: 0.85,
      validationScore: 0.85,
    });
    // 0.85 is below APPARITION's 0.95 threshold; should NEEDS_REPAIR.
    expect(aboveDefault.status).toBe("NEEDS_REPAIR");
  });

  it("persists via upsert so the result is idempotent", async () => {
    const prisma = makePrisma();
    await recordStrictQA(prisma, FULL);
    expect(
      vi.mocked(prisma.adminWorkerStrictQAResult.upsert as ReturnType<typeof vi.fn>),
    ).toHaveBeenCalledTimes(1);
  });

  it("blocking reason includes the threshold for borderline failures", async () => {
    const out = await recordStrictQA(makePrisma(), {
      ...FULL,
      completenessScore: 0.55,
      correctnessScore: 0.55,
      validationScore: 0.55,
    });
    if (out.status !== "PASSED") {
      expect(out.blockingReasons.some((r) => r.includes("threshold"))).toBe(true);
    }
  });
});

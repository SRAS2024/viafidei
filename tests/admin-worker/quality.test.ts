/**
 * Quality scoring math. The spec section 22 requires a deterministic
 * scoring system where content below threshold is repaired/rejected
 * and only ambiguous cases reach review. The "any-zero-fails-everything"
 * property is the key safety invariant.
 */

import { describe, expect, it } from "vitest";

import { computeFinalScore } from "@/lib/admin-worker/quality";

describe("computeFinalScore", () => {
  const perfect = {
    completenessScore: 1,
    correctnessScore: 1,
    formattingScore: 1,
    sourceEvidenceScore: 1,
    validationScore: 1,
    renderScore: 1,
  };

  it("returns ~1 for a perfect package", () => {
    expect(computeFinalScore(perfect)).toBeGreaterThan(0.99);
  });

  it("returns 0 (or near 0) when any single dimension is 0", () => {
    for (const key of Object.keys(perfect) as Array<keyof typeof perfect>) {
      const score = computeFinalScore({ ...perfect, [key]: 0 });
      expect(score).toBeLessThan(0.1);
    }
  });

  it("clamps to [0, 1]", () => {
    const score = computeFinalScore({
      ...perfect,
      completenessScore: 1.5,
      correctnessScore: 1.5,
    });
    expect(score).toBeLessThanOrEqual(1);
  });

  it("penalises a partial-completeness package", () => {
    const a = computeFinalScore({ ...perfect, completenessScore: 0.6 });
    const b = computeFinalScore({ ...perfect, completenessScore: 1 });
    expect(a).toBeLessThan(b);
  });
});

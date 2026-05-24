/**
 * Learning memory + confidence math. The learning loop NEVER invents
 * facts; the confidence formula is the only signal the planner gets,
 * so it has to be deterministic and bounded.
 */

import { describe, expect, it } from "vitest";

import { computeConfidence } from "@/lib/admin-worker/memory";

describe("computeConfidence", () => {
  it("starts at 0.5 for a brand-new row (no successes, no failures)", () => {
    expect(computeConfidence(0, 0)).toBeCloseTo(0.5, 5);
  });
  it("grows toward 1 as successes accumulate", () => {
    expect(computeConfidence(10, 0)).toBeGreaterThan(0.9);
    expect(computeConfidence(100, 0)).toBeGreaterThan(0.98);
  });
  it("shrinks toward 0 as failures accumulate", () => {
    expect(computeConfidence(0, 10)).toBeLessThan(0.1);
    expect(computeConfidence(0, 100)).toBeLessThan(0.02);
  });
  it("is symmetric: success_count ≈ failure_count -> ~0.5", () => {
    expect(computeConfidence(10, 10)).toBeCloseTo(0.5, 1);
  });
  it("is monotone in successes (more successes never decreases confidence)", () => {
    const a = computeConfidence(5, 5);
    const b = computeConfidence(6, 5);
    expect(b).toBeGreaterThanOrEqual(a);
  });
});

/**
 * Deletion gate — proves "Admin Worker deletes only clearly invalid
 * content" + "deletion below threshold requires human review" (spec
 * sections 9, 24).
 */

import { describe, expect, it } from "vitest";

import { evaluateDeletion, DELETION_REASONS } from "@/lib/admin-worker/deletion";
import { CONFIDENCE_THRESHOLDS } from "@/lib/admin-worker/decisions";

const base = {
  contentType: "PRAYER",
  contentTitle: "Spam",
  contentId: "p1",
  reason: "spam" as const,
  failedFields: ["text"],
  confidence: 0.95,
};

describe("evaluateDeletion", () => {
  it("deletes high-confidence clearly-invalid content", () => {
    expect(evaluateDeletion(base).kind).toBe("delete");
  });

  it("routes below-threshold confidence to human review", () => {
    expect(
      evaluateDeletion({ ...base, confidence: CONFIDENCE_THRESHOLDS.delete - 0.05 }).kind,
    ).toBe("review");
  });

  it("supports every spec-defined reason", () => {
    for (const reason of DELETION_REASONS) {
      const decision = evaluateDeletion({ ...base, reason });
      expect(decision.kind).toBe("delete");
    }
  });

  it("falls back to review for an unrecognised reason", () => {
    const decision = evaluateDeletion({
      ...base,
      // @ts-expect-error testing fallback path
      reason: "not_a_real_reason",
    });
    expect(decision.kind).toBe("review");
  });
});

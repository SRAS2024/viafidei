/**
 * Confidence thresholds + publish gate. These are deterministic rules
 * the spec explicitly calls out — section 8 (autonomous publishing) and
 * section 9 (rare and precise deletion).
 */

import { describe, expect, it } from "vitest";

import { CONFIDENCE_THRESHOLDS } from "@/lib/admin-worker/decisions";
import { evaluatePublishGate } from "@/lib/admin-worker/publisher";

describe("Confidence thresholds", () => {
  it("requires high confidence to delete", () => {
    expect(CONFIDENCE_THRESHOLDS.delete).toBeGreaterThanOrEqual(0.9);
  });
  it("requires stricter threshold for doctrinal content", () => {
    expect(CONFIDENCE_THRESHOLDS.publishDoctrinal).toBeGreaterThan(CONFIDENCE_THRESHOLDS.publish);
  });
  it("review threshold is below publish threshold", () => {
    expect(CONFIDENCE_THRESHOLDS.humanReview).toBeLessThan(CONFIDENCE_THRESHOLDS.publish);
  });
});

describe("Publish gate", () => {
  const base = {
    contentType: "PRAYER",
    contentTitle: "Our Father",
    contentId: "p1",
    finalScore: 0.85,
    qaPassed: true,
    hasSourceEvidence: true,
    isDoctrinallySensitive: false,
    confidence: 0.9,
  };

  it("publishes when every check passes", () => {
    expect(evaluatePublishGate(base).kind).toBe("publish");
  });

  it("rejects when QA failed", () => {
    expect(evaluatePublishGate({ ...base, qaPassed: false }).kind).toBe("reject");
  });

  it("rejects when there is no source evidence", () => {
    expect(evaluatePublishGate({ ...base, hasSourceEvidence: false }).kind).toBe("reject");
  });

  it("routes ambiguous scores to human review, not publish", () => {
    expect(evaluatePublishGate({ ...base, finalScore: 0.7, confidence: 0.7 }).kind).toBe("review");
  });

  it("uses the stricter threshold for doctrinally sensitive content", () => {
    const result = evaluatePublishGate({
      ...base,
      isDoctrinallySensitive: true,
      finalScore: 0.85,
      confidence: 0.85,
    });
    expect(result.kind).toBe("review");
  });
});

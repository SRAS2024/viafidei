/**
 * Homepage designer + draft decision policy.
 *
 * Spec section 10:
 *   - Admin Worker MAY auto-publish small high-confidence improvements.
 *   - Major redesigns go to review unless confidence is high AND the
 *     change stays within safe limits.
 *   - Worker NEVER deletes major homepage sections without either high
 *     confidence or review.
 */

import { describe, expect, it } from "vitest";

import { computeHomepageFinalScore, decideDraftStatus } from "@/lib/admin-worker/homepage-designer";

describe("computeHomepageFinalScore", () => {
  it("returns 1 for a perfect homepage", () => {
    const score = computeHomepageFinalScore({
      contentFreshnessScore: 1,
      sectionBalanceScore: 1,
      visualCompletenessScore: 1,
      linkHealthScore: 1,
      seasonalRelevanceScore: 1,
      emptyStateAvoidanceScore: 1,
      accessibilityScore: 1,
      mobileReadinessScore: 1,
    });
    expect(score).toBeCloseTo(1, 5);
  });

  it("returns ~0 for a dead homepage", () => {
    const score = computeHomepageFinalScore({
      contentFreshnessScore: 0,
      sectionBalanceScore: 0,
      visualCompletenessScore: 0,
      linkHealthScore: 0,
      seasonalRelevanceScore: 0,
      emptyStateAvoidanceScore: 0,
      accessibilityScore: 0,
      mobileReadinessScore: 0,
    });
    expect(score).toBe(0);
  });
});

describe("decideDraftStatus", () => {
  const inputs = {
    finalScore: 0.7,
    confidence: 0.9,
    sectionsChanged: ["updated:hero"],
  };

  it("auto-publishes small high-confidence improvements", () => {
    expect(decideDraftStatus({ ...inputs, mode: "AUTOMATIC_SMALL", confidence: 0.9 })).toBe(
      "AUTO_PUBLISHED",
    );
  });

  it("never auto-publishes full refreshes", () => {
    expect(decideDraftStatus({ ...inputs, mode: "FULL_REFRESH", confidence: 0.99 })).toBe(
      "AWAITING_REVIEW",
    );
  });

  it("admin-requested redesigns always go to review", () => {
    expect(decideDraftStatus({ ...inputs, mode: "ADMIN_REQUESTED", confidence: 0.99 })).toBe(
      "AWAITING_REVIEW",
    );
  });

  it("requires review when sections are deleted", () => {
    expect(
      decideDraftStatus({
        ...inputs,
        mode: "AUTOMATIC_SMALL",
        confidence: 0.99,
        sectionsChanged: ["deleted:featured-saints"],
      }),
    ).toBe("AWAITING_REVIEW");
  });

  it("defaults to PROPOSED when confidence is below auto-publish", () => {
    expect(
      decideDraftStatus({
        ...inputs,
        mode: "AUTOMATIC_SMALL",
        confidence: 0.5,
        sectionsChanged: ["updated:hero"],
      }),
    ).toBe("PROPOSED");
  });
});

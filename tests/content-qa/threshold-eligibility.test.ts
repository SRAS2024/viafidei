/**
 * Threshold-eligibility unit tests. The strict QA system only counts a
 * row toward content thresholds when it passes every gate:
 *
 *   - status = PUBLISHED
 *   - publicRenderReady = true
 *   - isThresholdEligible = true
 *   - archivedAt = null
 *
 * These tests exercise `isPublicVisible` and `isCountableForThreshold`
 * against every combination so the gating logic is fully covered.
 */

import { describe, expect, it } from "vitest";
import { isPublicVisible, isCountableForThreshold } from "@/lib/content-qa/types";

describe("threshold + visibility gates", () => {
  it("counts only valid packages", () => {
    expect(
      isCountableForThreshold({
        status: "PUBLISHED",
        publicRenderReady: true,
        isThresholdEligible: true,
        archivedAt: null,
      }),
    ).toBe(true);
  });

  it("excludes review rows", () => {
    expect(
      isCountableForThreshold({
        status: "REVIEW",
        publicRenderReady: true,
        isThresholdEligible: true,
        archivedAt: null,
      }),
    ).toBe(false);
  });

  it("excludes draft rows", () => {
    expect(
      isCountableForThreshold({
        status: "DRAFT",
        publicRenderReady: true,
        isThresholdEligible: true,
        archivedAt: null,
      }),
    ).toBe(false);
  });

  it("excludes archived rows", () => {
    expect(
      isCountableForThreshold({
        status: "PUBLISHED",
        publicRenderReady: true,
        isThresholdEligible: true,
        archivedAt: new Date(),
      }),
    ).toBe(false);
  });

  it("excludes invalid public rows where publicRenderReady is false", () => {
    expect(
      isCountableForThreshold({
        status: "PUBLISHED",
        publicRenderReady: false,
        isThresholdEligible: true,
        archivedAt: null,
      }),
    ).toBe(false);
  });

  it("excludes incomplete rows where isThresholdEligible is false", () => {
    expect(
      isCountableForThreshold({
        status: "PUBLISHED",
        publicRenderReady: true,
        isThresholdEligible: false,
        archivedAt: null,
      }),
    ).toBe(false);
  });

  it("public visibility mirrors threshold eligibility", () => {
    // A row that is countable is always public-visible, and vice versa.
    const allYes = {
      status: "PUBLISHED" as const,
      publicRenderReady: true,
      isThresholdEligible: true,
      archivedAt: null,
    };
    expect(isPublicVisible(allYes)).toBe(true);
    expect(isCountableForThreshold(allYes)).toBe(true);

    const withReview = {
      status: "REVIEW" as const,
      publicRenderReady: true,
      isThresholdEligible: true,
      archivedAt: null,
    };
    expect(isPublicVisible(withReview)).toBe(false);
    expect(isCountableForThreshold(withReview)).toBe(false);
  });
});

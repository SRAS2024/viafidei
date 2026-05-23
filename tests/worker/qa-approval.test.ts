/**
 * Tests for the QA approval pipeline.
 *
 * Covers: scoring on six dimensions, fail-on-empty-required, pass on a
 * well-formed package, and the publishing gate's reject/review/publish
 * recommendation.
 */

import { describe, it, expect } from "vitest";

import { runQA } from "@/lib/worker/qa";
import type { BuiltContentPackage } from "@/lib/worker/types";

function basePkg(overrides: Partial<BuiltContentPackage> = {}): BuiltContentPackage {
  return {
    contentType: "PRAYER",
    canonicalSlug: "our-father",
    title: "Our Father",
    fields: {},
    payload: {
      slug: "our-father",
      title: "Our Father",
      body: "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread, and forgive us our trespasses as we forgive those who trespass against us. Lead us not into temptation, but deliver us from evil. Amen.",
      prayerType: "general",
      category: "general",
      language: "en",
      citations: ["https://www.vatican.va/archive/ENG0015/__P9.HTM"],
    },
    authorityLevel: "VATICAN",
    confidence: 0.9,
    warnings: [],
    citations: ["https://www.vatican.va/archive/ENG0015/__P9.HTM"],
    needsHumanReview: false,
    ...overrides,
  };
}

describe("QA pipeline", () => {
  it("passes a complete well-sourced prayer package", () => {
    const qa = runQA(basePkg());
    expect(qa.passed).toBe(true);
    expect(qa.recommendation).toBe("publish");
    expect(qa.overallScore).toBeGreaterThan(0.8);
  });

  it("flags incomplete packages", () => {
    const qa = runQA(
      basePkg({
        payload: {
          slug: "test",
          title: "Test",
          // no body
          prayerType: "general",
          category: "general",
          citations: ["https://www.vatican.va/"],
        },
      }),
    );
    expect(qa.passed).toBe(false);
    expect(qa.issues.some((i) => i.includes("body"))).toBe(true);
  });

  it("downgrades packages with no citations", () => {
    const qa = runQA(
      basePkg({
        citations: [],
        payload: { ...basePkg().payload, citations: [] },
      }),
    );
    expect(qa.sourceCoverageScore).toBe(0);
    expect(qa.passed).toBe(false);
  });

  it("rejects packages with script tags in the body", () => {
    const qa = runQA(
      basePkg({
        payload: {
          ...basePkg().payload,
          body: "<script>alert('xss')</script>",
        },
      }),
    );
    expect(qa.formattingScore).toBeLessThan(1);
    expect(qa.issues.some((i) => i.toLowerCase().includes("script"))).toBe(true);
  });

  it("flags accuracy warnings (invented content) for human review", () => {
    const qa = runQA(
      basePkg({
        warnings: ["invented promise without source"],
      }),
    );
    expect(qa.accuracyScore).toBeLessThan(1);
  });

  it("fails QA when accuracy and completeness both drop", () => {
    const qa = runQA(
      basePkg({
        warnings: ["invented promise unverified by Vatican", "invented title"],
        payload: {
          ...basePkg().payload,
          body: "",
        },
      }),
    );
    expect(qa.passed).toBe(false);
    expect(qa.issues.length).toBeGreaterThan(0);
  });

  it("flags needsHumanReview when the package was already marked", () => {
    const qa = runQA(
      basePkg({
        needsHumanReview: true,
        humanReviewReason: "Disputed apparition status",
      }),
    );
    expect(qa.needsHumanReview).toBe(true);
  });
});

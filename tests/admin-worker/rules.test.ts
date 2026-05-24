/**
 * Rule engine — versioned, testable, visible.
 */

import { describe, expect, it } from "vitest";

import { listRules } from "@/lib/admin-worker/rules";

describe("Built-in rules", () => {
  it("registers at least one rule per spec-required category", () => {
    const categories = new Set(listRules().map((r) => r.category));
    expect(categories.has("publish")).toBe(true);
    expect(categories.has("deletion")).toBe(true);
    expect(categories.has("homepage_design")).toBe(true);
    expect(categories.has("security")).toBe(true);
    expect(categories.has("catholic_correctness")).toBe(true);
    expect(categories.has("source_selection")).toBe(true);
  });

  it("publish.require_source_evidence rejects when no citations attached", () => {
    const rule = listRules("publish").find((r) => r.id === "publish.require_source_evidence");
    expect(rule).toBeDefined();
    expect(rule!.evaluate({ citationCount: 0 }).pass).toBe(false);
    expect(rule!.evaluate({ citationCount: 1 }).pass).toBe(true);
  });

  it("publish.minimum_quality_score rejects below 0.8", () => {
    const rule = listRules("publish").find((r) => r.id === "publish.minimum_quality_score");
    expect(rule!.evaluate({ finalScore: 0.7 }).pass).toBe(false);
    expect(rule!.evaluate({ finalScore: 0.85 }).pass).toBe(true);
  });

  it("deletion.requires_high_confidence rejects below 0.9", () => {
    const rule = listRules("deletion").find((r) => r.id === "deletion.requires_high_confidence");
    expect(rule!.evaluate({ confidence: 0.8 }).pass).toBe(false);
    expect(rule!.evaluate({ confidence: 0.95 }).pass).toBe(true);
  });

  it("security.brute_force_ban only allows ban on Breach + high confidence", () => {
    const rule = listRules("security").find((r) => r.id === "security.brute_force_ban");
    expect(rule!.evaluate({ classification: "Suspicious", confidence: 0.99 }).pass).toBe(false);
    expect(rule!.evaluate({ classification: "Breach", confidence: 0.5 }).pass).toBe(false);
    expect(rule!.evaluate({ classification: "Breach", confidence: 0.95 }).pass).toBe(true);
  });
});

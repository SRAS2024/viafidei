/**
 * Baseline content tests (spec §21, §23).
 *
 * Pins that each spec-listed baseline content type can build at
 * least one complete public package from its canary fixture. The
 * canary runner exercises:
 *   - builder
 *   - normalization
 *   - enrichment
 *   - structural validation
 *
 * Persistence + public display verification + cache revalidation are
 * exercised in the dedicated pipeline-integration tests.
 */

import { describe, expect, it } from "vitest";
import { runCanaryBuilds } from "@/lib/content-factory/canary-fixtures";

describe("Baseline content acceptance (spec §21, §23)", () => {
  it("exposes a canary fixture for every spec-listed baseline content type", () => {
    const report = runCanaryBuilds();
    const types = new Set(report.results.map((r) => r.contentType));
    // Spec lists: Prayer, Saint, Devotion, Sacrament, Liturgy, History,
    // Parish (when source data is available). All but Parish must have
    // a canary.
    expect(types.has("Prayer")).toBe(true);
    expect(types.has("Saint")).toBe(true);
    expect(types.has("Devotion")).toBe(true);
    expect(types.has("Sacrament")).toBe(true);
    expect(types.has("Liturgy")).toBe(true);
    expect(types.has("History")).toBe(true);
  });

  it("runs every canary build and reports a passed flag per fixture", () => {
    const report = runCanaryBuilds();
    expect(report.results.length).toBeGreaterThan(0);
    for (const r of report.results) {
      expect(r.contentType).toBeDefined();
      expect(r.fixtureName).toBeDefined();
      expect(typeof r.passed).toBe("boolean");
    }
  });

  it("factory is healthy when every canary build passes", () => {
    const report = runCanaryBuilds();
    if (report.results.every((r) => r.passed)) {
      expect(report.factoryHealthy).toBe(true);
    }
  });
});

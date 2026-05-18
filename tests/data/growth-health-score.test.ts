/**
 * Growth health score — proves the score reflects the spec's
 * penalties / rewards and clamps to [0, 100].
 */

import { describe, expect, it } from "vitest";
import { computeGrowthHealthFromRow } from "@/lib/data/growth-health-score";
import type { ContentGrowthRow } from "@/lib/data/content-growth-dashboard";

function row(over: Partial<ContentGrowthRow> = {}): ContentGrowthRow {
  return {
    contentType: "Prayer",
    dataSources: ["SourceDocument"],
    lastUpdatedAt: new Date(),
    errors: {},
    sourceDocumentsFetched: 100,
    buildAttempts: 90,
    completePackagesBuilt: 80,
    buildFailureCount: 10,
    qaPassCount: 75,
    qaFailCount: 5,
    persistedPackageCount: 75,
    publicPackageCount: 75,
    thresholdEligibleCount: 75,
    deletedInvalidCount: 0,
    duplicateCount: 2,
    growthRate24h: 3,
    growthRate7d: 20,
    currentStallReason: "",
    ...over,
  };
}

describe("computeGrowthHealthFromRow", () => {
  it("returns a high score for a healthy content type", () => {
    const r = computeGrowthHealthFromRow(row());
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.penalties.length).toBe(0);
  });

  it("penalises a content type with no source documents", () => {
    const r = computeGrowthHealthFromRow(
      row({
        sourceDocumentsFetched: 0,
        buildAttempts: 0,
        completePackagesBuilt: 0,
        publicPackageCount: 0,
        growthRate24h: 0,
      }),
    );
    expect(r.penalties.some((p) => p.id === "no_source_documents")).toBe(true);
    expect(r.score).toBeLessThan(80);
  });

  it("penalises low build success rate", () => {
    const r = computeGrowthHealthFromRow(
      row({
        buildAttempts: 100,
        completePackagesBuilt: 10,
        qaPassCount: 5,
        persistedPackageCount: 5,
        publicPackageCount: 5,
      }),
    );
    expect(r.penalties.some((p) => p.id === "low_build_success_rate")).toBe(true);
  });

  it("penalises public-gate failures (persisted > public)", () => {
    const r = computeGrowthHealthFromRow(
      row({ persistedPackageCount: 100, publicPackageCount: 60 }),
    );
    expect(r.penalties.some((p) => p.id === "public_gate_failures")).toBe(true);
  });

  it("clamps the score to [0, 100]", () => {
    const r = computeGrowthHealthFromRow(
      row({
        sourceDocumentsFetched: 0,
        buildAttempts: 0,
        completePackagesBuilt: 0,
        qaPassCount: 0,
        persistedPackageCount: 0,
        publicPackageCount: 0,
        thresholdEligibleCount: 0,
        growthRate24h: 0,
        growthRate7d: 0,
        duplicateCount: 0,
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

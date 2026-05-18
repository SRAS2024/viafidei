/**
 * Content growth dashboard — one row per content type with the
 * spec-listed metrics. Proves:
 *   1. Every content type returns a row, even when every query
 *      returns zero (a real zero, not a false zero).
 *   2. Failed queries produce an `errors` entry, not a silent zero.
 *   3. Stall reasons are computed from the metric pattern, with the
 *      automatic-next-action map.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  automaticNextActionForReason,
  classifyStallReason,
  getContentGrowthRowForType,
} from "@/lib/data/content-growth-dashboard";

beforeEach(() => {
  resetPrismaMock();
});

describe("classifyStallReason", () => {
  it("returns no_source_documents_fetched when source docs are zero", () => {
    expect(
      classifyStallReason({
        sourceDocumentsFetched: 0,
        buildAttempts: 0,
        completePackagesBuilt: 0,
        qaPassCount: 0,
        persistedPackageCount: 0,
        publicPackageCount: 0,
        thresholdEligibleCount: 0,
        buildFailureCount: 0,
        growthRate24h: 0,
      }),
    ).toBe("no_source_documents_fetched");
  });

  it("returns source_docs_exist_but_no_builds when docs > 0 but builds = 0", () => {
    expect(
      classifyStallReason({
        sourceDocumentsFetched: 10,
        buildAttempts: 0,
        completePackagesBuilt: 0,
        qaPassCount: 0,
        persistedPackageCount: 0,
        publicPackageCount: 0,
        thresholdEligibleCount: 0,
        buildFailureCount: 0,
        growthRate24h: 0,
      }),
    ).toBe("source_docs_exist_but_no_builds");
  });

  it("returns builds_complete_but_qa_never_passed when builds complete but QA passes are zero", () => {
    expect(
      classifyStallReason({
        sourceDocumentsFetched: 10,
        buildAttempts: 10,
        completePackagesBuilt: 5,
        qaPassCount: 0,
        persistedPackageCount: 0,
        publicPackageCount: 0,
        thresholdEligibleCount: 0,
        buildFailureCount: 5,
        growthRate24h: 0,
      }),
    ).toBe("builds_complete_but_qa_never_passed");
  });

  it("returns empty string when growth is healthy", () => {
    expect(
      classifyStallReason({
        sourceDocumentsFetched: 100,
        buildAttempts: 90,
        completePackagesBuilt: 80,
        qaPassCount: 70,
        persistedPackageCount: 70,
        publicPackageCount: 70,
        thresholdEligibleCount: 70,
        buildFailureCount: 10,
        growthRate24h: 5,
      }),
    ).toBe("");
  });
});

describe("automaticNextActionForReason", () => {
  it("maps each stall reason to a concrete next action", () => {
    expect(automaticNextActionForReason("no_source_documents_fetched")).toBe(
      "enqueue_source_discovery",
    );
    expect(automaticNextActionForReason("source_docs_exist_but_no_builds")).toBe(
      "enqueue_content_build",
    );
    expect(automaticNextActionForReason("builds_complete_but_qa_never_passed")).toBe(
      "revalidate_package_contract",
    );
    expect(automaticNextActionForReason("persisted_but_public_gate_failed")).toBe(
      "run_strict_revalidation",
    );
  });

  it("returns empty string for an unknown reason", () => {
    expect(automaticNextActionForReason("not_a_reason")).toBe("");
  });
});

describe("getContentGrowthRowForType", () => {
  it("returns real zeros (not nulls) when every query succeeds with zero results", async () => {
    prismaMock.contentPackageBuildLog.count.mockResolvedValue(0);
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);
    prismaMock.rejectedContentLog.count.mockResolvedValue(0);
    prismaMock.prayer.count.mockResolvedValue(0);

    const row = await getContentGrowthRowForType("Prayer");

    expect(row.sourceDocumentsFetched).toBe(0);
    expect(row.buildAttempts).toBe(0);
    expect(row.completePackagesBuilt).toBe(0);
    expect(row.publicPackageCount).toBe(0);
    expect(row.currentStallReason).toBe("no_source_documents_fetched");
    expect(row.errors).toEqual({});
  });

  it("captures errors per-metric rather than displaying a silent zero", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockRejectedValue(new Error("boom"));
    prismaMock.contentPackageBuildLog.count.mockRejectedValue(new Error("boom"));
    prismaMock.rejectedContentLog.count.mockResolvedValue(0);
    prismaMock.prayer.count.mockResolvedValue(5);

    const row = await getContentGrowthRowForType("Prayer");

    expect(row.errors.buildAttempts).toMatch(/boom/);
    expect(row.buildAttempts).toBeNull();
  });
});

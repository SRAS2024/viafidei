/**
 * Extraction monitor — verifies the stats aggregator builds the
 * right shape from DataManagementLog (saves) and RejectedContentLog
 * (failures + deletes).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  getExtractionStats,
  overallSuccessRate,
  overallDeletionRate,
} from "@/lib/content-qa/extraction-monitor";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.dataManagementLog.groupBy.mockResolvedValue([]);
  prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getExtractionStats", () => {
  it("counts saved valid packages from DataManagementLog ADD rows", async () => {
    prismaMock.dataManagementLog.groupBy.mockResolvedValueOnce([
      { contentType: "Prayer", _count: { _all: 10 } },
      { contentType: "Saint", _count: { _all: 5 } },
    ] as unknown as never);
    const stats = await getExtractionStats();
    expect(stats.savedValid).toBe(15);
  });

  it("splits rejected rows into wrong_content vs failed_validation", async () => {
    prismaMock.rejectedContentLog.findMany.mockResolvedValueOnce([
      {
        contentType: "Prayer",
        sourceHost: "host.example",
        failureCategory: "wrong_content",
        decision: "delete",
      },
      {
        contentType: "Prayer",
        sourceHost: "host.example",
        failureCategory: "missing_required_field",
        decision: "delete",
      },
      {
        contentType: "Saint",
        sourceHost: "another.example",
        failureCategory: "source_purpose_mismatch",
        decision: "reject",
      },
    ] as unknown as never);
    const stats = await getExtractionStats();
    expect(stats.deletedWrongContent).toBe(1);
    expect(stats.failedValidation).toBe(2);
    expect(stats.failureCategoryCounts.wrong_content).toBe(1);
    expect(stats.failureCategoryCounts.missing_required_field).toBe(1);
    expect(stats.failureCategoryCounts.source_purpose_mismatch).toBe(1);
  });

  it("computes per-content-type success rate", async () => {
    prismaMock.dataManagementLog.groupBy.mockResolvedValueOnce([
      { contentType: "Prayer", _count: { _all: 9 } },
    ] as unknown as never);
    prismaMock.rejectedContentLog.findMany.mockResolvedValueOnce([
      {
        contentType: "Prayer",
        sourceHost: "x.example",
        failureCategory: "wrong_content",
        decision: "delete",
      },
    ] as unknown as never);
    const stats = await getExtractionStats();
    expect(stats.successRateByContentType.Prayer).toBeCloseTo(0.9, 2);
  });

  it("overallSuccessRate returns 1 when no activity", async () => {
    const stats = await getExtractionStats();
    expect(overallSuccessRate(stats)).toBe(1);
    expect(overallDeletionRate(stats)).toBe(0);
  });

  it("overallSuccessRate reflects saved vs rejected ratio", async () => {
    prismaMock.dataManagementLog.groupBy.mockResolvedValueOnce([
      { contentType: "Prayer", _count: { _all: 7 } },
    ] as unknown as never);
    prismaMock.rejectedContentLog.findMany.mockResolvedValueOnce([
      {
        contentType: "Prayer",
        sourceHost: null,
        failureCategory: "wrong_content",
        decision: "delete",
      },
      {
        contentType: "Prayer",
        sourceHost: null,
        failureCategory: "wrong_content",
        decision: "delete",
      },
      {
        contentType: "Prayer",
        sourceHost: null,
        failureCategory: "wrong_content",
        decision: "delete",
      },
    ] as unknown as never);
    const stats = await getExtractionStats();
    // 7 saved / 10 total = 0.7
    expect(overallSuccessRate(stats)).toBeCloseTo(0.7, 2);
    expect(overallDeletionRate(stats)).toBeCloseTo(0.3, 2);
  });
});

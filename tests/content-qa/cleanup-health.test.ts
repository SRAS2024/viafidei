/**
 * Cleanup health diagnostic — verifies the admin Data Management
 * Health panel reads the right tables and surfaces real query errors
 * instead of fake zeros.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getCleanupHealth } from "@/lib/content-qa/cleanup-health";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.spiritualLifeGuide,
    prismaMock.liturgyEntry,
    prismaMock.parish,
  ]) {
    m.count.mockResolvedValue(0);
  }
  prismaMock.dataManagementLog.findFirst.mockResolvedValue(null);
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
  prismaMock.rejectedContentLog.groupBy.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getCleanupHealth", () => {
  it("reports stale when no CLEANUP DataManagementLog row exists", async () => {
    prismaMock.dataManagementLog.findFirst.mockResolvedValue(null);
    const health = await getCleanupHealth();
    expect(health.lastRunAt).toBeNull();
    expect(health.isStale).toBe(true);
    expect(health.msSinceLastRun).toBeNull();
  });

  it("reports fresh when the CLEANUP row is recent", async () => {
    prismaMock.dataManagementLog.findFirst.mockResolvedValue({
      id: "log-1",
      action: "CLEANUP",
      contentType: "ContentQA",
      createdAt: new Date(),
    });
    const health = await getCleanupHealth();
    expect(health.lastRunAt).not.toBeNull();
    expect(health.isStale).toBe(false);
  });

  it("counts invalid public rows across every catalog table", async () => {
    prismaMock.prayer.count.mockResolvedValueOnce(2);
    prismaMock.saint.count.mockResolvedValueOnce(1);
    prismaMock.parish.count.mockResolvedValueOnce(3);
    const health = await getCleanupHealth();
    expect(health.invalidPublicRowCount).toBe(2 + 1 + 3);
    expect(health.invalidPublicByContentType.Prayer).toBe(2);
  });

  it("surfaces a query error in queryHealth instead of returning fake zero", async () => {
    prismaMock.prayer.count.mockRejectedValueOnce(new Error("connection refused"));
    const health = await getCleanupHealth();
    expect(health.queryHealth["invalid.Prayer"]).toEqual({
      ok: false,
      errorMessage: "connection refused",
    });
    // Prayer count fell back to zero (correctly) but the dashboard knows
    // it failed because queryHealth.invalid.Prayer.ok is false.
    expect(health.invalidPublicByContentType.Prayer).toBe(0);
  });

  it("includes the active policy in the summary", async () => {
    const health = await getCleanupHealth();
    expect(health.mode).toBeDefined();
    expect(typeof health.deleteAllInvalid).toBe("boolean");
    expect(health.packageContractVersion).toBeDefined();
  });

  it("aggregates deletes by failure category over the last 24h", async () => {
    prismaMock.rejectedContentLog.groupBy.mockResolvedValueOnce([
      { failureCategory: "wrong_content", _count: { _all: 7 } },
      { failureCategory: "missing_required_field", _count: { _all: 3 } },
      { failureCategory: null, _count: { _all: 1 } },
    ] as unknown as never);
    const health = await getCleanupHealth();
    expect(health.deletedByCategoryLast24h.wrong_content).toBe(7);
    expect(health.deletedByCategoryLast24h.missing_required_field).toBe(3);
    expect(health.deletedByCategoryLast24h["(unknown)"]).toBe(1);
  });
});

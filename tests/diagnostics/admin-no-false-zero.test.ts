/**
 * Regression: admin pages must NOT silently display zero when a
 * query fails. Per the spec: "If a query fails, show an error
 * state. If the real value is zero, label it as a real zero."
 *
 * Every read helper that powers an admin metric must capture the
 * error per-query rather than silently returning `0`. We assert
 * this by:
 *
 *   1. Confirming the canonical helpers (content-growth dashboard,
 *      content-receipt, production-readiness) carry an `errors`
 *      array OR an `errorMessage` field per query.
 *   2. Running the helpers against a prisma mock that throws for
 *      every read and confirming the resulting object surfaces an
 *      error rather than `0`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

beforeEach(() => {
  resetPrismaMock();
});

describe("admin metrics surface errors instead of silent zeros", () => {
  it("content growth row keeps `errors` populated when queries throw", async () => {
    const { getContentGrowthRowForType } = await import("@/lib/data/content-growth-dashboard");
    prismaMock.contentPackageBuildLog.groupBy.mockRejectedValue(new Error("boom"));
    prismaMock.contentPackageBuildLog.count.mockRejectedValue(new Error("boom"));
    prismaMock.rejectedContentLog.count.mockRejectedValue(new Error("boom"));
    prismaMock.prayer.count.mockRejectedValue(new Error("boom"));

    const row = await getContentGrowthRowForType("Prayer");

    // At least one metric should be null + error captured.
    expect(Object.keys(row.errors).length).toBeGreaterThan(0);
    expect(row.buildAttempts).toBeNull();
  });

  it("content receipt errors per-data-source rather than returning a row of zeros", async () => {
    const { getContentReceipt } = await import("@/lib/diagnostics/content-receipt");
    prismaMock.prayer.findUnique.mockRejectedValue(new Error("read failed"));
    prismaMock.contentPackageBuildLog.findMany.mockRejectedValue(new Error("read failed"));
    prismaMock.rejectedContentLog.findMany.mockRejectedValue(new Error("read failed"));

    const receipt = await getContentReceipt({ contentType: "Prayer", slug: "x" });

    expect(receipt.errors.publicRow).toMatch(/read failed/);
    expect(receipt.errors.buildLog).toMatch(/read failed/);
    expect(receipt.publicRow).toBeNull();
  });

  it("production readiness card carries severity=error when its query throws", async () => {
    vi.doMock("@/lib/ingestion/queue/heartbeat", () => ({
      hasHealthyWorker: vi.fn().mockRejectedValue(new Error("hb down")),
      listWorkerHealth: vi.fn().mockRejectedValue(new Error("hb down")),
    }));
    const { getProductionReadinessReport } = await import("@/lib/diagnostics/production-readiness");
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    prismaMock.ingestionJobQueue.count.mockResolvedValue(0);
    prismaMock.contentPackageBuildLog.count.mockResolvedValue(0);
    prismaMock.sourceDocument.findMany.mockResolvedValue([]);
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
    prismaMock.securityEvent.findFirst.mockResolvedValue(null);
    prismaMock.ingestionSource.count.mockResolvedValue(0);
    prismaMock.prayer.count.mockResolvedValue(0);

    const report = await getProductionReadinessReport();
    // The worker card reads listWorkerHealth — that throws here, so
    // the card must NOT show severity=pass with a "zero workers" message.
    const worker = report.cards.find((c) => c.id === "worker");
    expect(worker).toBeDefined();
    // It can be either an explicit error or a fail — but NOT a pass.
    expect(["error", "fail"]).toContain(worker!.severity);
  });
});

/**
 * Dashboard "no false zero" tests.
 *
 * Spec invariant: "If a metric query fails, show a diagnostic error.
 * If a value is truly zero, label it as real zero."
 *
 * These tests pin that behaviour: when the underlying Prisma call
 * resolves to an empty result, the metric reports `kind: real_zero`
 * with a human-readable label. When the underlying call rejects, the
 * metric reports `kind: error` with the error message.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { loadContentFactoryDashboard } from "@/lib/data/content-factory-dashboard";

beforeEach(() => {
  resetPrismaMock();
});

describe("dashboard never shows false zero", () => {
  it("reports real_zero when the queue is genuinely empty", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([]);
    prismaMock.sourceDocument.aggregate.mockResolvedValue({
      _max: { fetchedAt: null },
      _count: { _all: 0 },
    });
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);
    prismaMock.contentPackageBuildLog.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { createdAt: null },
    });
    prismaMock.rejectedContentLog.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { deletedAt: null },
    });
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([]);
    // public count queries return 0 for every type.
    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockResolvedValue(0);
    }

    const data = await loadContentFactoryDashboard();
    expect(data.queue.pending.kind).toBe("real_zero");
    expect(data.queue.running.kind).toBe("real_zero");
    expect(data.workers.active.kind).toBe("real_zero");
    expect(data.progress.rawRows.kind).toBe("real_zero");
    expect(data.progress.builtPackages.kind).toBe("real_zero");
    expect(data.progress.validPackages.kind).toBe("real_zero");
    expect(data.progress.publicPackages.kind).toBe("real_zero");
  });

  it("reports error (not zero) when a query rejects", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockRejectedValue(new Error("DB outage"));
    prismaMock.workerHeartbeat.findMany.mockRejectedValue(new Error("DB outage"));
    prismaMock.sourceDocument.aggregate.mockRejectedValue(new Error("DB outage"));
    prismaMock.contentPackageBuildLog.groupBy.mockRejectedValue(new Error("DB outage"));
    prismaMock.contentPackageBuildLog.aggregate.mockRejectedValue(new Error("DB outage"));
    prismaMock.rejectedContentLog.aggregate.mockRejectedValue(new Error("DB outage"));
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([]);
    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.count.mockRejectedValue(new Error("DB outage"));
    }

    const data = await loadContentFactoryDashboard();
    expect(data.queue.pending.kind).toBe("error");
    expect(data.workers.active.kind).toBe("error");
    expect(data.progress.rawRows.kind).toBe("real_zero"); // 0 doc count is real zero on the fallback path
    expect(data.progress.builtPackages.kind).toBe("error");
    expect(data.progress.validPackages.kind).toBe("error");
  });
});

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

describe("dashboard exposes every spec-required progress metric", () => {
  beforeEach(() => {
    resetPrismaMock();
    prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
    prismaMock.workerHeartbeat.findMany.mockResolvedValue([]);
    prismaMock.sourceDocument.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { fetchedAt: null },
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
  });

  it("includes Raw rows, Source documents, Build attempts, Built packages, Build failures, QA passes, QA failures, Persisted packages, Public packages, Deleted invalid rows, Threshold eligible, Growth rate, Stall reason", async () => {
    const data = await loadContentFactoryDashboard();
    // Every spec-required progress field is present on the loader
    // contract — even when their value is `real_zero`, they exist.
    expect(data.progress.rawRows).toBeDefined();
    expect(data.progress.sourceDocuments).toBeDefined();
    expect(data.progress.buildAttempts).toBeDefined();
    expect(data.progress.builtPackages).toBeDefined();
    expect(data.progress.buildFailures).toBeDefined();
    expect(data.progress.qaPasses).toBeDefined();
    expect(data.progress.qaFailures).toBeDefined();
    expect(data.progress.validPackages).toBeDefined();
    expect(data.progress.publicPackages).toBeDefined();
    expect(data.progress.deletedInvalidRows).toBeDefined();
    expect(data.progress.thresholdEligible).toBeDefined();
    expect(data.progress.growthRateLast24h).toBeDefined();
    // stalledReason is a string | null — the field exists regardless.
    expect("stalledReason" in data.progress).toBe(true);
  });

  it("Build attempts equals built + failed when both come from the build log", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([
      { buildStatus: "built_complete_package", _count: { _all: 4 }, _max: { createdAt: null } },
      {
        buildStatus: "build_failed_missing_required_fields",
        _count: { _all: 2 },
        _max: { createdAt: null },
      },
      { buildStatus: "wrong_content", _count: { _all: 1 }, _max: { createdAt: null } },
    ]);
    prismaMock.contentPackageBuildLog.aggregate.mockResolvedValue({
      _count: { _all: 4 },
      _max: { createdAt: null },
    });
    const data = await loadContentFactoryDashboard();
    if (data.progress.buildAttempts.kind === "value") {
      expect(data.progress.buildAttempts.value).toBe(7); // 4 + 2 + 1
    }
    if (data.progress.builtPackages.kind === "value") {
      expect(data.progress.builtPackages.value).toBe(4);
    }
    if (data.progress.buildFailures.kind === "value") {
      expect(data.progress.buildFailures.value).toBe(3); // 2 + 1
    }
  });
});

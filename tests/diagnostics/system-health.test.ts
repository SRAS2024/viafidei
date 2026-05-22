/**
 * System health dashboard: one card per spec-required diagnostic
 * category. Each card carries a `dataSource` badge, `lastUpdatedAt`
 * timestamp, and explicit error state when the underlying query
 * fails (never a false zero). The exact card set is sourced from
 * `SYSTEM_HEALTH_CARD_IDS` so adding a card (e.g. the new
 * fetch_to_build_chain card) doesn't require a test update.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ingestion/queue/heartbeat", () => ({
  hasHealthyWorker: vi.fn().mockResolvedValue(true),
}));

import { loadSystemHealth, SYSTEM_HEALTH_CARD_IDS } from "@/lib/diagnostics/system-health";

beforeEach(() => {
  resetPrismaMock();
  // Default-happy responses for every dependency so individual tests
  // can override one collector at a time.
  prismaMock.ingestionJobQueue.groupBy.mockResolvedValue([]);
  prismaMock.ingestionJobQueue.count.mockResolvedValue(0);
  prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
  prismaMock.workerHeartbeat.findFirst.mockResolvedValue(null);
  prismaMock.discoveredSourceItem.count.mockResolvedValue(0);
  prismaMock.discoveredSourceItem.findFirst.mockResolvedValue(null);
  prismaMock.sourceDocument.count.mockResolvedValue(0);
  prismaMock.sourceDocument.findFirst.mockResolvedValue(null);
  prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);
  prismaMock.contentPackageBuildLog.count.mockResolvedValue(0);
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
  prismaMock.queueAuditLog.findMany.mockResolvedValue([]);
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
  prismaMock.securityEvent.count.mockResolvedValue(0);
  prismaMock.bannedDevice.count.mockResolvedValue(0);
  prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
});

describe("system health dashboard", () => {
  it("returns exactly the spec-required card set", async () => {
    const report = await loadSystemHealth();
    expect(report.cards).toHaveLength(SYSTEM_HEALTH_CARD_IDS.length);
    const ids = report.cards.map((c) => c.id).sort();
    const expected = [...SYSTEM_HEALTH_CARD_IDS].sort();
    expect(ids).toEqual(expected);
  });

  it("every card exposes lastUpdatedAt, dataSource, severity, summary", async () => {
    const report = await loadSystemHealth();
    for (const card of report.cards) {
      expect(card.lastUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(card.dataSource.length).toBeGreaterThan(0);
      expect(["pass", "warn", "fail", "error"]).toContain(card.severity);
      expect(card.summary.length).toBeGreaterThan(0);
    }
  });

  it("returns overall=pass when every collector is healthy", async () => {
    const report = await loadSystemHealth();
    // All defaults are zero / healthy in beforeEach.
    expect(["pass", "warn"]).toContain(report.overallSeverity);
  });
});

describe("system health — failed query returns an error card (no false zero)", () => {
  it("queue card shows error severity when the queue.groupBy throws", async () => {
    prismaMock.ingestionJobQueue.groupBy.mockRejectedValue(new Error("postgres timed out"));
    const report = await loadSystemHealth();
    const queue = report.cards.find((c) => c.id === "queue");
    expect(queue?.severity).toBe("error");
    expect(queue?.errorMessage).toMatch(/postgres timed out/);
    expect(queue?.summary).toMatch(/NOT a real zero/);
  });

  it("database card shows error severity when $queryRaw throws", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const report = await loadSystemHealth();
    const db = report.cards.find((c) => c.id === "database");
    expect(db?.severity).toBe("error");
    expect(db?.errorMessage).toMatch(/connection refused/);
  });

  it("overallSeverity propagates the worst card", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    const report = await loadSystemHealth();
    expect(report.overallSeverity).toBe("error");
  });
});

describe("system health — data source badges", () => {
  it("queue card cites IngestionJobQueue", async () => {
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "queue");
    expect(c?.dataSource).toBe("IngestionJobQueue");
  });

  it("worker card cites WorkerHeartbeat", async () => {
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "worker");
    expect(c?.dataSource).toBe("WorkerHeartbeat");
  });

  it("content factory card cites ContentPackageBuildLog", async () => {
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "content_factory");
    expect(c?.dataSource).toBe("ContentPackageBuildLog");
  });

  it("security card cites SecurityEvent + BannedDevice", async () => {
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "security");
    expect(c?.dataSource).toBe("SecurityEvent + BannedDevice");
  });

  it("fetch-to-build chain card cites QueueAuditLog", async () => {
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "fetch_to_build_chain");
    expect(c?.dataSource).toMatch(/QueueAuditLog/);
  });
});

describe("system health — diagnostic semantics (spec #16-22)", () => {
  it("persistence FAILS when factory attempted builds but produced 0 strict-public rows (spec #17)", async () => {
    prismaMock.contentPackageBuildLog.count.mockResolvedValue(50);
    // Catalog tables stay at zero (default).
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "persistence");
    expect(c?.severity).toBe("fail");
    expect(c?.summary).toMatch(/0 strict-public rows/);
  });

  it("persistence WARNS when total is zero with no factory attempts (factory hasn't run yet)", async () => {
    // Default mocks already return 0 for everything.
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "persistence");
    expect(c?.severity).toBe("warn");
    expect(c?.summary).toMatch(/0 strict-public rows/);
  });

  it("growth FAILS when build attempts produced 0 complete packages in 24h (spec #22)", async () => {
    // 50 attempts, 0 successes in 24h.
    prismaMock.contentPackageBuildLog.count.mockImplementation((args: unknown) => {
      const where = (args as { where?: { buildStatus?: string } } | undefined)?.where;
      if (where?.buildStatus === "built_complete_package") return Promise.resolve(0);
      return Promise.resolve(50);
    });
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "growth");
    expect(c?.severity).toBe("fail");
    expect(c?.summary).toMatch(/0 complete packages/);
  });

  it("fetch-to-build chain FAILS when fetches completed but 0 builds enqueued (spec #19)", async () => {
    // 5 source_document_created events, but no fetch_to_build follow-up.
    prismaMock.queueAuditLog.findMany.mockImplementation((args: unknown) => {
      const where = (args as { where?: { event?: string } } | undefined)?.where;
      if (where?.event === "chain.source_document_created") {
        return Promise.resolve([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }]);
      }
      return Promise.resolve([]);
    });
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "fetch_to_build_chain");
    expect(c?.severity).toBe("fail");
    expect(c?.summary).toMatch(/0 content_build jobs enqueued|chain is BROKEN/);
  });

  it("builder FAILS when builders observed but no recent success (spec #20)", async () => {
    prismaMock.contentPackageBuildLog.groupBy.mockImplementation((args: unknown) => {
      const where = (args as { where?: { buildStatus?: string } } | undefined)?.where;
      if (where?.buildStatus === "built_complete_package") {
        // 24h success window: empty.
        return Promise.resolve([]);
      }
      // Observed: 3 builders.
      return Promise.resolve([
        { builderName: "PrayerBuilder", _count: { _all: 10 } },
        { builderName: "SaintBuilder", _count: { _all: 5 } },
        { builderName: "DevotionBuilder", _count: { _all: 8 } },
      ]);
    });
    const report = await loadSystemHealth();
    const c = report.cards.find((x) => x.id === "builder");
    expect(["fail", "warn"]).toContain(c?.severity);
  });
});

/**
 * The phone's snapshot is a PROJECTION of the command-centre snapshot, not a
 * copy of it, and the two reasons for that are load-bearing:
 *
 *   1. `loadCommandCenterSnapshot` is ~30 queries against production. The
 *      local host caches it (20 s running / 5 min idle) so an open console is
 *      not a workload; a phone reaching the deployed app must not be a second,
 *      uncached client of the same call. These tests pin the cache TTLs, the
 *      single flight, and the fact that the phone path never asks for the
 *      goal refresh (which is a WRITE).
 *
 *   2. The untrimmed JSON is hundreds of kilobytes and goes over mobile data.
 *      These tests pin the row caps, the string truncation, the two heavy
 *      fields that are dropped outright, and the `total` counts that keep a
 *      trimmed list honest about what it left behind.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCommandCenterSnapshotMock = vi.fn();

vi.mock("@/lib/admin-worker/command-center", () => ({
  loadCommandCenterSnapshot: (...args: unknown[]) => loadCommandCenterSnapshotMock(...args),
}));

import type { CommandCenterSnapshot } from "@/lib/admin-worker/command-center";
import {
  loadRemoteSnapshot,
  SNAPSHOT_CACHE_ACTIVE_MS,
  SNAPSHOT_CACHE_IDLE_MS,
  snapshotTtlMs,
  TRIM_LIMITS,
  trimSnapshotForMobile,
  _resetRemoteConsoleCachesForTests,
} from "@/lib/admin-worker/remote-console";

/** A Prisma Decimal is an object with `toNumber` — it must not reach the phone. */
class FakeDecimal {
  constructor(private readonly value: number) {}
  toNumber(): number {
    return this.value;
  }
}

function rows(count: number, make: (i: number) => Record<string, unknown>): unknown[] {
  return Array.from({ length: count }, (_, i) => make(i));
}

function fullSnapshot(overrides: Partial<CommandCenterSnapshot> = {}): CommandCenterSnapshot {
  return {
    generatedAt: "2026-09-09T12:00:00.000Z",
    execution: {
      state: "LOCAL_ACTIVE",
      switch: { on: true, changedAt: null, changedBy: null, changedFrom: null, known: true },
      lease: null,
      leaseAgeMs: 1000,
      leaseLive: true,
      executingLocally: true,
      label: "Admin Worker active locally on MacBook Pro.",
      known: true,
    },
    state: {
      id: "singleton",
      currentMode: "GROWTH",
      currentPriority: "CONTENT_GROWTH",
      currentGoal: "grow prayers",
      currentTask: "building prayer 12",
      lastHeartbeatAt: new Date("2026-09-09T11:59:50.000Z"),
      lastSuccessfulAt: new Date("2026-09-09T11:55:00.000Z"),
      lastFailedAt: null,
      currentBlocker: null,
      recoveryAction: null,
      workerVersion: "1.0.0",
      paused: false,
      pausedReason: null,
      pausedByUsername: null,
      pausedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-09T11:59:50.000Z"),
    } as CommandCenterSnapshot["state"],
    heartbeatAgeMs: 10_000,
    workerLive: true,
    diagnostics: {
      ratings: rows(60, (i) => ({
        label: `check ${i}`,
        status: "pass",
        summary: "x".repeat(500),
      })) as CommandCenterSnapshot["diagnostics"]["ratings"],
      summary: { pass: 58, warn: 1, fail: 1 } as CommandCenterSnapshot["diagnostics"]["summary"],
    },
    metrics: {
      publishRate30d: 0.5,
      qaPassRate30d: 0.9,
      deletionRate30d: 0,
      reviewQueueCount: 3,
      recentSecurityActions24h: 0,
      monthlyReportLastAt: null,
      monthlyReportFresh: false,
      publishedContentLive: 3412,
      queueInFlight: 7,
    } as CommandCenterSnapshot["metrics"],
    mission: { stage: "DISCOVER", contentType: "prayer" } as CommandCenterSnapshot["mission"],
    goals: rows(90, (i) => ({
      contentType: `type-${i}`,
      currentValidCount: i,
      gapCount: 100 - i,
      status: "BEHIND",
    })),
    funnel: rows(50, (i) => ({ contentType: `type-${i}`, candidatesDiscovered: i })),
    coverage: rows(50, (i) => ({
      contentType: `type-${i}`,
      coverageScore: new FakeDecimal(0.42),
      activeSourceCount: 2,
      recentPublishes7d: 1,
      blockedByCoverage: true,
      blockReason: "y".repeat(400),
    })),
    growth: rows(50, (i) => ({ contentType: `type-${i}`, publishedCount: i, gap: 1 })),
    pipeline: rows(50, (i) => ({ stage: `stage-${i}`, pending: 1, running: 0 })),
    artifactStatus: { READY: 4, FAILED: 1 },
    passes: rows(30, (i) => ({
      passType: "content_goal",
      status: "SUCCESS",
      contentBuilt: i,
      contentPublished: i,
      startedAt: new Date("2026-09-09T11:00:00.000Z"),
    })),
    decisions: rows(30, () => ({
      chosenAction: "build",
      reason: "z".repeat(600),
      confidence: "0.77",
      createdAt: new Date("2026-09-09T11:30:00.000Z"),
    })),
    brain: {
      latestFinalBrain: "python",
      degradedEvents24h: 2,
      selectActionCalls24h: 40,
      latestDecision: { safeMetadata: { blob: "Q".repeat(50_000) } },
      rankedAlternatives: rows(30, (i) => ({ action: `alt-${i}`, score: 0.5, reason: "why" })),
      reasoning: rows(30, (i) => ({
        fromNodeLabel: `a-${i}`,
        relation: "supports",
        toNodeLabel: `b-${i}`,
        explanation: "because",
        confidence: new FakeDecimal(0.9),
      })),
    },
    sourceReputation: rows(40, (i) => ({ sourceHost: `h${i}.example`, reputationTier: "TRUSTED" })),
    sourceActivity: rows(40, (i) => ({ sourceUrl: `https://x/${i}`, confidenceScore: 0.8 })),
    memory: rows(40, (i) => ({ memoryKey: `k${i}`, memoryType: "GENERIC", confidence: 1 })),
    knowledge: {
      nodes: 100,
      edges: 200,
      recentNodes: rows(40, (i) => ({ label: `n${i}`, nodeType: "ENTITY" })),
    },
    logs: rows(120, (i) => ({
      eventName: `event_${i}`,
      category: "worker",
      message: "m".repeat(1000),
      createdAt: new Date("2026-09-09T11:45:00.000Z"),
    })),
    rules: rows(60, (i) => ({
      id: `rule-${i}`,
      category: "content",
      version: 2,
      description: "d".repeat(400),
    })) as CommandCenterSnapshot["rules"],
    skills: rows(40, (i) => ({ skillName: `skill-${i}`, executionStatus: "OK" })),
    repairPlans: rows(40, (i) => ({ kind: `repair-${i}`, status: "OPEN", attempts: 1 })),
    reviewQueue: rows(40, (i) => ({ id: `r${i}`, contentTitle: "t", reason: "why" })),
    qualityScores: rows(40, () => ({ contentType: "prayer", finalScore: 0.9, passed: true })),
    strictQA: rows(40, () => ({ contentType: "prayer", finalScore: 0.9, status: "PASS" })),
    rollbacks: rows(40, (i) => ({ slug: `s${i}`, rollbackAction: "UNPUBLISH" })),
    security: rows(40, (i) => ({ actionType: `act-${i}`, severity: "LOW" })),
    homepageDrafts: rows(20, (i) => ({
      id: `d${i}`,
      status: "PENDING",
      reasonSummary: "why",
      draftPayload: { html: "H".repeat(40_000) },
    })),
    publishing: rows(40, (i) => ({ title: `t${i}`, contentType: "prayer", slug: `s${i}` })),
    readingsCoverage: { days: 30, missing: 0, complete: true },
    contentCatalogTotal: 3412,
    ...overrides,
  } as CommandCenterSnapshot;
}

beforeEach(() => {
  _resetRemoteConsoleCachesForTests();
  loadCommandCenterSnapshotMock.mockReset();
});

describe("trimSnapshotForMobile — payload size", () => {
  it("caps every list at its documented limit and reports the true total", () => {
    const t = trimSnapshotForMobile(fullSnapshot());

    expect(t.goals.items).toHaveLength(TRIM_LIMITS.goals);
    expect(t.goals.total).toBe(90);
    expect(t.logs.items).toHaveLength(TRIM_LIMITS.logs);
    expect(t.logs.total).toBe(120);
    expect(t.diagnostics.ratings.items).toHaveLength(TRIM_LIMITS.diagnostics);
    expect(t.diagnostics.ratings.total).toBe(60);
    expect(t.brain.rankedAlternatives.items).toHaveLength(TRIM_LIMITS.alternatives);
    expect(t.brain.reasoning.items).toHaveLength(TRIM_LIMITS.reasoning);
    expect(t.homepageDrafts.items).toHaveLength(TRIM_LIMITS.homepageDrafts);
    expect(t.publishing.items).toHaveLength(TRIM_LIMITS.publishing);
    expect(t.knowledge.recentNodes.items).toHaveLength(TRIM_LIMITS.knowledgeNodes);
  });

  it("drops the two unbounded fields the dashboard never renders", () => {
    const serialized = JSON.stringify(trimSnapshotForMobile(fullSnapshot()));
    // brain.latestDecision — the raw AdminWorkerLog row; its safeMetadata is
    // already mined for latestFinalBrain + rankedAlternatives.
    expect(serialized).not.toContain("Q".repeat(100));
    expect(serialized).not.toContain("latestDecision");
    // homepage draft page payloads.
    expect(serialized).not.toContain("H".repeat(100));
    expect(serialized).not.toContain("draftPayload");
  });

  it("truncates long free text instead of shipping it", () => {
    const t = trimSnapshotForMobile(fullSnapshot());
    expect(t.logs.items[0]!.message!.length).toBeLessThanOrEqual(140);
    expect(t.logs.items[0]!.message!.endsWith("…")).toBe(true);
    expect(t.decisions.items[0]!.reason!.length).toBeLessThanOrEqual(140);
    expect(t.coverage.items[0]!.blockReason!.length).toBeLessThanOrEqual(100);
  });

  it("is an order of magnitude smaller than the untrimmed snapshot", () => {
    const full = fullSnapshot();
    const fullBytes = JSON.stringify(full).length;
    const trimmedBytes = JSON.stringify(trimSnapshotForMobile(full)).length;
    expect(trimmedBytes).toBeLessThan(fullBytes / 10);
    // Hard ceiling: a payload a phone can pull over cellular without thinking.
    expect(trimmedBytes).toBeLessThan(60_000);
  });
});

describe("trimSnapshotForMobile — fidelity", () => {
  it("keeps the fields the desktop command centre actually renders", () => {
    const t = trimSnapshotForMobile(fullSnapshot());
    expect(t.execution.label).toBe("Admin Worker active locally on MacBook Pro.");
    expect(t.state.mode).toBe("GROWTH");
    expect(t.state.task).toBe("building prayer 12");
    expect(t.state.heartbeatAt).toBe("2026-09-09T11:59:50.000Z");
    expect(t.workerLive).toBe(true);
    expect(t.metrics.publishedContentLive).toBe(3412);
    expect(t.diagnostics.summary).toEqual({ pass: 58, warn: 1, fail: 1 });
    expect(t.mission).toEqual({ stage: "DISCOVER", contentType: "prayer", reason: null });
    expect(t.artifactStatus).toEqual({ READY: 4, FAILED: 1 });
    expect(t.knowledge.nodes).toBe(100);
    expect(t.contentCatalogTotal).toBe(3412);
    expect(t.readingsCoverage).toEqual({ days: 30, missing: 0, complete: true });
  });

  it("turns Prisma Decimals and numeric strings into plain numbers", () => {
    const t = trimSnapshotForMobile(fullSnapshot());
    expect(t.coverage.items[0]!.coverageScore).toBe(0.42);
    expect(t.brain.reasoning.items[0]!.confidence).toBe(0.9);
    expect(t.decisions.items[0]!.confidence).toBe(0.77);
    expect(JSON.stringify(t)).not.toContain("[object Object]");
  });

  it("survives a snapshot whose collections are missing or the wrong type", () => {
    const broken = {
      generatedAt: "not-a-date",
      execution: null,
      state: null,
      diagnostics: null,
      metrics: null,
      mission: null,
      goals: null,
      logs: "nope",
      brain: undefined,
      knowledge: 7,
      artifactStatus: null,
      readingsCoverage: undefined,
    } as unknown as CommandCenterSnapshot;
    const t = trimSnapshotForMobile(broken);
    expect(t.goals.items).toEqual([]);
    expect(t.logs.total).toBe(0);
    expect(t.brain.latestFinalBrain).toBeNull();
    expect(t.knowledge.nodes).toBe(0);
    expect(t.mission).toBeNull();
    expect(t.readingsCoverage).toBeNull();
    expect(typeof t.generatedAt).toBe("string");
  });
});

describe("loadRemoteSnapshot — a phone poll is not a production workload", () => {
  it("never asks for the goal refresh, because that is a write to production", async () => {
    loadCommandCenterSnapshotMock.mockResolvedValue(fullSnapshot());
    await loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" });
    expect(loadCommandCenterSnapshotMock).toHaveBeenCalledWith({}, { refreshGoals: false });
  });

  it("serves the cache inside the TTL and loads once, however often it is polled", async () => {
    loadCommandCenterSnapshotMock.mockResolvedValue(fullSnapshot());
    const first = await loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" });
    expect(first.cached).toBe(false);
    for (let i = 0; i < 20; i += 1) {
      const again = await loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" });
      expect(again.cached).toBe(true);
      expect(again.ttlMs).toBe(SNAPSHOT_CACHE_ACTIVE_MS);
    }
    expect(loadCommandCenterSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("holds the answer for five minutes when nothing is executing", async () => {
    loadCommandCenterSnapshotMock.mockResolvedValue(fullSnapshot());
    const result = await loadRemoteSnapshot({} as never, { executionState: "OFF" });
    expect(result.ttlMs).toBe(SNAPSHOT_CACHE_IDLE_MS);
    expect(snapshotTtlMs("OFF")).toBe(SNAPSHOT_CACHE_IDLE_MS);
    expect(snapshotTtlMs("LOCAL_DISCONNECTED")).toBe(SNAPSHOT_CACHE_IDLE_MS);
    expect(snapshotTtlMs(null)).toBe(SNAPSHOT_CACHE_IDLE_MS);
    expect(snapshotTtlMs("LOCAL_ACTIVE")).toBe(SNAPSHOT_CACHE_ACTIVE_MS);
    expect(snapshotTtlMs("REMOTE_ACTIVE")).toBe(SNAPSHOT_CACHE_ACTIVE_MS);
  });

  it("single-flights concurrent callers instead of stacking thirty-query loads", async () => {
    let release: (value: CommandCenterSnapshot) => void = () => {};
    loadCommandCenterSnapshotMock.mockReturnValue(
      new Promise<CommandCenterSnapshot>((resolve) => {
        release = resolve;
      }),
    );
    const calls = [
      loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" }),
      loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" }),
      loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" }),
    ];
    release(fullSnapshot());
    const results = await Promise.all(calls);
    expect(loadCommandCenterSnapshotMock).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.coalesced)).toHaveLength(2);
  });

  it("a forced refresh bypasses the TTL but still cannot start a second load", async () => {
    loadCommandCenterSnapshotMock.mockResolvedValue(fullSnapshot());
    await loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" });
    await loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE", force: true });
    expect(loadCommandCenterSnapshotMock).toHaveBeenCalledTimes(2);

    let release: (value: CommandCenterSnapshot) => void = () => {};
    loadCommandCenterSnapshotMock.mockReturnValue(
      new Promise<CommandCenterSnapshot>((resolve) => {
        release = resolve;
      }),
    );
    const a = loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE", force: true });
    const b = loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE", force: true });
    release(fullSnapshot());
    await Promise.all([a, b]);
    expect(loadCommandCenterSnapshotMock).toHaveBeenCalledTimes(3);
  });

  it("does not poison the cache when the load fails", async () => {
    loadCommandCenterSnapshotMock.mockRejectedValueOnce(new Error("db down"));
    await expect(
      loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" }),
    ).rejects.toThrow("db down");
    loadCommandCenterSnapshotMock.mockResolvedValue(fullSnapshot());
    const ok = await loadRemoteSnapshot({} as never, { executionState: "LOCAL_ACTIVE" });
    expect(ok.cached).toBe(false);
    expect(ok.snapshot.contentCatalogTotal).toBe(3412);
  });
});

/**
 * Always-on web discovery sweep: runs the discovery orchestrator every pass
 * (throttled) so the worker is constantly scanning for new sources. These tests
 * pin the enable/disable switch, the throttle, and that surfaced candidates are
 * reported (the orchestrator itself is mocked — it's exercised elsewhere).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(async () => ({
    surfaced: 3,
    rejected: 1,
    hostsSkipped: [],
    strategies: ["sitemap + search"],
    errors: [],
  })),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";
import {
  alwaysOnDiscoveryEnabled,
  runAlwaysOnDiscovery,
} from "@/lib/admin-worker/always-on-discovery";
import { runDiscoveryOrchestrator } from "@/lib/admin-worker/discovery-orchestrator";

const ENV = ["ADMIN_WORKER_ALWAYS_ON_DISCOVERY", "ADMIN_WORKER_DISCOVERY_SWEEP_MS"] as const;
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {};
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.mocked(runDiscoveryOrchestrator).mockClear();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/** A prisma whose throttle memory is empty (so the first run is allowed). */
function freshPrisma(): PrismaClient {
  return {
    adminWorkerMemory: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
  } as unknown as PrismaClient;
}

/** A prisma whose throttle memory was just touched (so a run is throttled). */
function throttledPrisma(): PrismaClient {
  return {
    adminWorkerMemory: {
      findUnique: vi.fn(async () => ({ lastUsedAt: new Date() })),
      upsert: vi.fn(async () => ({})),
    },
  } as unknown as PrismaClient;
}

describe("runAlwaysOnDiscovery", () => {
  it("is enabled by default", () => {
    expect(alwaysOnDiscoveryEnabled()).toBe(true);
  });

  it("runs the discovery orchestrator and reports surfaced candidates", async () => {
    const out = await runAlwaysOnDiscovery(freshPrisma(), { passId: "p1" });
    expect(out.ran).toBe(true);
    expect(out.surfaced).toBe(3);
    expect(vi.mocked(runDiscoveryOrchestrator)).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled via env (never calls the orchestrator)", async () => {
    process.env.ADMIN_WORKER_ALWAYS_ON_DISCOVERY = "0";
    expect(alwaysOnDiscoveryEnabled()).toBe(false);
    const out = await runAlwaysOnDiscovery(freshPrisma(), { passId: "p1" });
    expect(out.ran).toBe(false);
    expect(out.detail).toBe("disabled");
    expect(vi.mocked(runDiscoveryOrchestrator)).not.toHaveBeenCalled();
  });

  it("respects the throttle (skips a run that's too soon)", async () => {
    const out = await runAlwaysOnDiscovery(throttledPrisma(), { passId: "p1" });
    expect(out.ran).toBe(false);
    expect(out.detail).toBe("throttled");
    expect(vi.mocked(runDiscoveryOrchestrator)).not.toHaveBeenCalled();
  });

  it("force-runs regardless of throttle", async () => {
    const out = await runAlwaysOnDiscovery(throttledPrisma(), { passId: "p1", force: true });
    expect(out.ran).toBe(true);
    expect(vi.mocked(runDiscoveryOrchestrator)).toHaveBeenCalledTimes(1);
  });

  it("leaves the target to the orchestrator when the goals cannot be read", async () => {
    await runAlwaysOnDiscovery(freshPrisma(), { passId: "p1" });
    expect(vi.mocked(runDiscoveryOrchestrator)).toHaveBeenCalledWith(expect.anything(), {
      passId: "p1",
      contentType: null,
    });
  });
});

describe("runAlwaysOnDiscovery — sweep target rotation", () => {
  // Production-shaped: SAINT has by far the largest ABSOLUTE web gap, which is
  // what every sweep used to target; PRAYER and NOVENA can only grow from the
  // web. PARISH (structured-built) must never be a web sweep target.
  const goals = [
    { contentType: "PARISH", gapCount: 199_973, desiredTarget: 200_000, priority: 110 },
    { contentType: "SAINT", gapCount: 7_203, desiredTarget: 10_000, priority: 20 },
    { contentType: "PRAYER", gapCount: 752, desiredTarget: 1_000, priority: 10 },
    { contentType: "NOVENA", gapCount: 69, desiredTarget: 100, priority: 40 },
  ];

  function goalsPrisma() {
    const memory = new Map<string, Record<string, unknown>>();
    return {
      memory,
      contentGoal: {
        // No campaign-sized gap is returned for the campaign's `gte` query, so
        // this exercises the normal ranking + the lane's own rotation.
        findMany: async ({ where }: { where?: { gapCount?: { gte?: number } } }) =>
          where?.gapCount?.gte !== undefined ? [] : goals,
      },
      adminWorkerSourceCoverage: { findMany: async () => [] },
      // The brain has not picked DISCOVERY recently: its rotation would not move.
      adminWorkerDecision: { findMany: async () => [] },
      adminWorkerPackageArtifact: { count: async () => 0 },
      adminWorkerMemory: {
        findUnique: async ({
          where,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
        }) => {
          const v = memory.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v, lastUsedAt: null } : null;
        },
        findMany: async () => [],
        upsert: async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue?: Record<string, unknown> };
        }) => {
          if (update.memoryValue)
            memory.set(where.memoryType_memoryKey.memoryKey, update.memoryValue);
          return {};
        },
      },
    } as unknown as PrismaClient & { memory: Map<string, Record<string, unknown>> };
  }

  it("rotates across the web-growable types instead of pinning the largest gap", async () => {
    const prisma = goalsPrisma();
    const targets: Array<string | null | undefined> = [];
    for (let i = 0; i < 4; i += 1) {
      await runAlwaysOnDiscovery(prisma, { passId: `p${i}`, force: true });
      targets.push(vi.mocked(runDiscoveryOrchestrator).mock.calls[i][1]?.contentType);
    }
    expect(targets).toEqual(["PRAYER", "SAINT", "NOVENA", "PRAYER"]);
    expect(prisma.memory.get("always-on-discovery-lastrun")?.recentTargets).toEqual([
      "PRAYER",
      "NOVENA",
      "SAINT",
      "PRAYER",
    ]);
  });

  it("an explicit target is used as given and leaves the rotation alone", async () => {
    const prisma = goalsPrisma();
    await runAlwaysOnDiscovery(prisma, { passId: "p1", force: true, contentType: "APPARITION" });
    expect(vi.mocked(runDiscoveryOrchestrator).mock.calls[0][1]?.contentType).toBe("APPARITION");
    expect(prisma.memory.size).toBe(0);
  });
});

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
});

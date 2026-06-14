/**
 * The "why no content growth" diagnostic must FIRST report the worker-level
 * gates that turn off every publishing path (curated, structured, AND the
 * fetcher chain): the worker process not running, the worker paused, and the
 * Python final brain being in safe-degraded mode. These are the most common
 * reason a worker that was growing suddenly plateaus, and the pipeline walk
 * underneath can't see them — so the diagnostic would otherwise mislead.
 */
import { describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { diagnoseWhyNoGrowth } from "@/lib/admin-worker/why-no-growth";

function prismaWith(opts: {
  lastHeartbeatAt: Date | null;
  paused?: boolean;
  pausedReason?: string | null;
  finalBrain?: string | null;
}): PrismaClient {
  return {
    contentGoal: {
      findFirst: async () => ({ contentType: "SAINT", gapCount: 100 }),
      count: async () => 15,
    },
    adminWorkerState: {
      findFirst: async () => ({
        lastHeartbeatAt: opts.lastHeartbeatAt,
        paused: opts.paused ?? false,
        pausedReason: opts.pausedReason ?? null,
      }),
    },
    adminWorkerLog: {
      findFirst: async () =>
        opts.finalBrain === undefined ? null : { safeMetadata: { finalBrain: opts.finalBrain } },
    },
    // Lets the "active" scenario walk past the gates and land on the next
    // downstream blocker instead of throwing on an unmocked model.
    authoritySource: { count: async () => 0 },
    adminWorkerDecision: { findFirst: async () => null },
  } as unknown as PrismaClient;
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000);

describe("why-no-growth worker gates", () => {
  it("reports WORKER_NOT_RUNNING when the heartbeat is stale", async () => {
    const r = await diagnoseWhyNoGrowth(prismaWith({ lastHeartbeatAt: minsAgo(20) }));
    expect(r.blocker).toBe("WORKER_NOT_RUNNING");
    expect(r.exactTable).toContain("lastHeartbeatAt");
  });

  it("reports WORKER_NOT_RUNNING when there is no heartbeat at all", async () => {
    const r = await diagnoseWhyNoGrowth(prismaWith({ lastHeartbeatAt: null }));
    expect(r.blocker).toBe("WORKER_NOT_RUNNING");
  });

  it("reports WORKER_PAUSED when live but paused by an operator", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), paused: true, pausedReason: "maintenance" }),
    );
    expect(r.blocker).toBe("WORKER_PAUSED");
    expect(r.blockerExplanation).toContain("maintenance");
  });

  it("reports BRAIN_DEGRADED when live + unpaused but the brain is degraded", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), finalBrain: "degraded" }),
    );
    expect(r.blocker).toBe("BRAIN_DEGRADED");
    expect(r.blockerExplanation).toContain("safe-degraded");
  });

  it("passes all worker gates when live, unpaused, and brain active (python)", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), finalBrain: "python" }),
    );
    // Not one of the worker-level blockers — the walk proceeds past them.
    expect(["WORKER_NOT_RUNNING", "WORKER_PAUSED", "BRAIN_DEGRADED"]).not.toContain(r.blocker);
    const gates = r.checks.filter((c) =>
      ["WORKER_NOT_RUNNING", "WORKER_PAUSED", "BRAIN_DEGRADED"].includes(c.stage),
    );
    expect(gates.every((c) => c.ok)).toBe(true);
  });
});

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
  /** Master switch row; undefined → the memory model is absent (switch unreadable). */
  masterSwitchOn?: boolean;
}): PrismaClient {
  return {
    ...(opts.masterSwitchOn === undefined
      ? {}
      : {
          adminWorkerMemory: {
            findUnique: async ({
              where,
            }: {
              where: { memoryType_memoryKey: { memoryKey: string } };
            }) =>
              where.memoryType_memoryKey.memoryKey === "worker.execution.switch"
                ? { memoryValue: { on: opts.masterSwitchOn }, updatedAt: new Date() }
                : null,
          },
        }),
    // Downstream funnel models: 600 prioritized candidates and nothing fetched,
    // so a walk that wrongly continues past an OFF worker lands on
    // FETCH_NOT_RUNNING.
    candidateSourceUrl: { count: async () => 600 },
    adminWorkerFetchResult: { count: async () => 0 },
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
    authoritySource: { count: async () => 5 },
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

/**
 * OFF is an answer, not a symptom: with the master switch off the funnel
 * underneath legitimately shows no fetches, and the walk used to name
 * FETCH_NOT_RUNNING ("check the worker heartbeat") two lines under the OFF
 * check.
 */
describe("why-no-growth: intentionally OFF worker", () => {
  it("reports WORKER_OFF and stops the funnel walk when the switch is OFF and no heartbeat", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(2 * 24 * 60), masterSwitchOn: false }),
    );
    expect(r.blocker).toBe("WORKER_OFF");
    expect(r.blockerExplanation).toMatch(/intentionally inactive/);
    expect(r.exactTable).toBe("AdminWorkerMemory(worker.execution.switch)");
    expect(r.nextAutomaticRepair).toMatch(/switch the Admin Worker ON/);
    // The downstream stages are recorded but never promoted to the blocker.
    expect(r.checks.find((c) => c.stage === "WORKER_OFF")?.ok).toBe(false);
    expect(r.checks.some((c) => c.stage === "FETCH_NOT_RUNNING")).toBe(true);
  });

  it("walks the funnel normally when the switch is OFF but a live heartbeat exists (npm run worker:local)", async () => {
    const r = await diagnoseWhyNoGrowth(
      prismaWith({ lastHeartbeatAt: minsAgo(1), masterSwitchOn: false, finalBrain: "python" }),
    );
    expect(r.blocker).not.toBe("WORKER_OFF");
    expect(r.blocker).not.toBe("WORKER_NOT_RUNNING");
  });

  it("does not treat an unreadable switch as OFF (falls back to the heartbeat evidence)", async () => {
    const r = await diagnoseWhyNoGrowth(prismaWith({ lastHeartbeatAt: minsAgo(20) }));
    expect(r.blocker).toBe("WORKER_NOT_RUNNING");
  });
});

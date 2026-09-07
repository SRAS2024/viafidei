/**
 * The loop_paused bug, pinned.
 *
 * Production on 2026-08-29 wrote eight `loop_paused` INFO rows inside eight
 * seconds — 649,793 rows all-time, the third-noisiest event in a 21 GB ledger.
 * A paused loop neither backed off nor stopped logging.
 *
 * A pause is a STATE, not a per-tick event:
 *   - one row on the transition IN, one on the transition OUT;
 *   - at most one heartbeat row per minute in between;
 *   - the paused pass reports `idle` so the adaptive backoff applies, under the
 *     highest floor of the three (it can do no work at all until resumed).
 *
 * The per-pass INFO bookkeeping that produced the other ~2 M rows
 * (brain_decided, stage_dispatched) is routed through the self-maintenance
 * sampler here too, and a FAILED dispatch is never sampled.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PAUSED_HEARTBEAT_MS,
  backoffFloorMs,
  resetPauseTracking,
  runOnePass,
} from "@/lib/admin-worker/loop";

function makePausedPrisma(pausedReason = "operator request") {
  const logs: Array<Record<string, unknown>> = [];
  return {
    __logs: logs,
    adminWorkerState: {
      update: vi.fn(async () => ({})),
      upsert: vi.fn(async () => ({
        id: "singleton",
        currentMode: "SETUP",
        currentPriority: "WORKER_HEALTH",
        paused: true,
        pausedReason,
        lastHeartbeatAt: new Date(),
        lastSuccessfulAt: null,
        lastFailedAt: null,
        currentBlocker: null,
      })),
    },
    adminWorkerLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data);
        return { id: `l${logs.length}` };
      }),
    },
  } as unknown as Parameters<typeof runOnePass>[0] & { __logs: Array<Record<string, unknown>> };
}

beforeEach(() => {
  resetPauseTracking();
});

describe("a paused loop", () => {
  it("logs the transition INTO paused exactly once, not once per tick", async () => {
    const prisma = makePausedPrisma();
    for (let i = 0; i < 8; i += 1) await runOnePass(prisma, "w1");
    const paused = prisma.__logs.filter((l) => l.eventName === "loop_paused");
    // Eight ticks — the production shape was eight rows. Now: one.
    expect(paused).toHaveLength(1);
    expect(prisma.__logs.filter((l) => l.eventName === "loop_paused_heartbeat")).toHaveLength(0);
    expect(String(paused[0].message)).toContain("operator request");
  });

  it("reports the pass as idle AND paused so the loop backs off", async () => {
    const prisma = makePausedPrisma();
    const outcome = await runOnePass(prisma, "w1");
    expect(outcome.idle).toBe(true);
    expect(outcome.paused).toBe(true);
    expect(outcome.published).toBe(0);
  });

  it("writes a heartbeat at most once a minute while it stays paused", async () => {
    const prisma = makePausedPrisma();
    const realNow = Date.now;
    let t = Date.UTC(2026, 8, 7, 12, 0, 0);
    Date.now = () => t;
    try {
      await runOnePass(prisma, "w1"); // transition in
      for (let i = 0; i < 30; i += 1) {
        t += 1_000; // one tick per second, exactly as production ran
        await runOnePass(prisma, "w1");
      }
      expect(prisma.__logs.filter((l) => l.eventName === "loop_paused_heartbeat")).toHaveLength(0);
      t += PAUSED_HEARTBEAT_MS;
      await runOnePass(prisma, "w1");
      expect(prisma.__logs.filter((l) => l.eventName === "loop_paused_heartbeat")).toHaveLength(1);
      // 31 ticks inside the first minute + 1 after it = 2 rows total, not 32.
      expect(prisma.__logs).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  it("logs the transition OUT when the worker resumes", async () => {
    const paused = makePausedPrisma();
    await runOnePass(paused, "w1");
    // Same process, worker no longer paused: the next pass must close the pair.
    const resumedLogs: Array<Record<string, unknown>> = [];
    const resumed = {
      adminWorkerState: {
        update: vi.fn(async () => ({})),
        upsert: vi.fn(async () => ({
          id: "singleton",
          currentMode: "SETUP",
          currentPriority: "WORKER_HEALTH",
          paused: false,
          pausedReason: null,
          lastHeartbeatAt: new Date(),
          lastSuccessfulAt: null,
          lastFailedAt: null,
          currentBlocker: null,
        })),
      },
      adminWorkerLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          resumedLogs.push(data);
          return { id: "l" };
        }),
      },
      // Everything past the pause guard fails; the pass isolates it, and the
      // resume row must already have been written by then.
      contentGoal: { count: vi.fn(async () => -1) },
    } as unknown as Parameters<typeof runOnePass>[0];
    await runOnePass(resumed, "w1").catch(() => undefined);
    expect(resumedLogs.some((l) => l.eventName === "loop_resumed")).toBe(true);
  });
});

describe("backoff floors", () => {
  it("makes a paused loop wait longest — it can achieve nothing until resumed", () => {
    expect(backoffFloorMs("idle", 15_000, 120_000)).toBe(15_000);
    expect(backoffFloorMs("degraded", 15_000, 120_000)).toBe(30_000);
    expect(backoffFloorMs("paused", 15_000, 120_000)).toBe(60_000);
    // The configured ceiling still wins…
    expect(backoffFloorMs("paused", 5_000, 20_000)).toBe(20_000);
    // …and an explicit 0 (tests / manual runs) disables the floor entirely.
    expect(backoffFloorMs("paused", 0, 120_000)).toBe(0);
  });

  it("is what the loop actually applies to a paused pass", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/admin-worker/loop.ts"), "utf8");
    expect(src).toContain(`backoffFloorMs("paused", idleBackoffStartMs, idleBackoffMaxMs)`);
    expect(src).toContain("passOutcome.paused");
  });
});

describe("per-pass INFO bookkeeping is sampled", () => {
  it("routes brain_decided and stage_dispatched through the sampler", () => {
    // These two were 988,366 + 988,314 rows in production — pure per-tick
    // bookkeeping, and the largest single contributors to the 21 GB ledger.
    const src = readFileSync(join(process.cwd(), "src/lib/admin-worker/loop.ts"), "utf8");
    expect(src).toContain('sampleWorkerEvent("brain_decided")');
    expect(src).toContain('sampleWorkerEvent("stage_dispatched")');
    // A FAILED dispatch is an ERROR row and must never be sampled away.
    expect(src).toContain("dispatchFailed");
    expect(src).toMatch(/dispatchFailed\s*\n?\s*\?\s*\{ write: true/);
  });
});

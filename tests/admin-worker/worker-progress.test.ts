/**
 * A hung pass must be noticed and recovered.
 *
 * Measured gap: liveness was timer-based — the host writes the heartbeat
 * whenever a child process exists, the loop from a 20 s interval — so a pass
 * stuck on a query over a half-open connection, or on a promise that never
 * settles, kept every signal green and was never recovered.
 *
 * Pinned: the beacon format and the stall rule (worker-progress.ts), that the
 * loop and the lane runner actually emit beacons at their boundaries, that the
 * worker child only emits them under a host, and that the host turns a silent
 * worker into one stop plus the ordinary crash-restart path.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runWorkerLanes, type LaneDef } from "@/lib/admin-worker/lanes";
import { resetPauseTracking, runOnePass } from "@/lib/admin-worker/loop";
import {
  formatProgressLine,
  parseProgressLine,
  progressTimeoutMs,
  reportProgress,
  setProgressSink,
  WORKER_PROGRESS_TIMEOUT_FLOOR_MS,
  WORKER_PROGRESS_TIMEOUT_MS,
  workerStalledForMs,
  type WorkerProgress,
} from "@/lib/admin-worker/worker-progress";

const seen: WorkerProgress[] = [];

beforeEach(() => {
  seen.length = 0;
  setProgressSink((p) => seen.push(p));
  resetPauseTracking();
});

afterEach(() => {
  setProgressSink(null);
});

describe("progress beacons", () => {
  it("round-trip through one tagged stdout line", () => {
    const beacon = { phase: "lane_done", at: "2026-10-31T12:00:00.000Z", detail: "drain" };
    const line = formatProgressLine(beacon);
    expect(line.startsWith('{"viafideiWorkerProgress":')).toBe(true);
    expect(parseProgressLine(line)).toEqual(beacon);
    expect(parseProgressLine(`  ${line}  `)).toEqual(beacon);
  });

  it("leaves ordinary log lines alone, and rejects malformed beacons", () => {
    expect(parseProgressLine("[admin-worker:w] pass 3 threw; continuing")).toBeNull();
    expect(parseProgressLine('{"other":{"phase":"x","at":"y"}}')).toBeNull();
    expect(parseProgressLine('{"viafideiWorkerProgress":{"phase":1}}')).toBeNull();
    expect(parseProgressLine('{"viafideiWorkerProgress":')).toBeNull();
  });

  it("is a no-op without a sink, and a throwing sink never breaks the caller", () => {
    setProgressSink(null);
    expect(() => reportProgress("pass_start")).not.toThrow();
    setProgressSink(() => {
      throw new Error("stdout gone");
    });
    expect(() => reportProgress("pass_start")).not.toThrow();
  });
});

describe("the stall rule", () => {
  it("defaults to 25 min, honours the env, and never goes below the floor", () => {
    expect(progressTimeoutMs({})).toBe(WORKER_PROGRESS_TIMEOUT_MS);
    expect(progressTimeoutMs({ VIAFIDEI_WORKER_PROGRESS_TIMEOUT_MS: "" })).toBe(
      WORKER_PROGRESS_TIMEOUT_MS,
    );
    expect(progressTimeoutMs({ VIAFIDEI_WORKER_PROGRESS_TIMEOUT_MS: "junk" })).toBe(
      WORKER_PROGRESS_TIMEOUT_MS,
    );
    expect(progressTimeoutMs({ VIAFIDEI_WORKER_PROGRESS_TIMEOUT_MS: "3600000" })).toBe(3_600_000);
    // Shorter than the longest lane watchdog would restart healthy passes.
    expect(progressTimeoutMs({ VIAFIDEI_WORKER_PROGRESS_TIMEOUT_MS: "1000" })).toBe(
      WORKER_PROGRESS_TIMEOUT_FLOOR_MS,
    );
    expect(WORKER_PROGRESS_TIMEOUT_FLOOR_MS).toBeGreaterThan(10 * 60_000);
  });

  it("flags only a running worker that has been silent past the timeout", () => {
    const base = { now: 100 * 60_000, running: true, timeoutMs: 25 * 60_000 };
    expect(workerStalledForMs({ ...base, lastProgressAt: base.now - 5 * 60_000 })).toBeNull();
    expect(workerStalledForMs({ ...base, lastProgressAt: base.now - 26 * 60_000 })).toBe(
      26 * 60_000,
    );
    expect(
      workerStalledForMs({ ...base, running: false, lastProgressAt: base.now - 60 * 60_000 }),
    ).toBeNull();
    expect(workerStalledForMs({ ...base, lastProgressAt: null })).toBeNull();
  });
});

describe("the loop and the lanes emit beacons", () => {
  it("a pass reports its start, even one that returns early because the worker is paused", async () => {
    const prisma = {
      adminWorkerState: {
        update: vi.fn(async () => ({})),
        upsert: vi.fn(async () => ({
          id: "singleton",
          currentMode: "SETUP",
          currentPriority: "WORKER_HEALTH",
          paused: true,
          pausedReason: "operator request",
        })),
      },
      adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
    } as unknown as Parameters<typeof runOnePass>[0];
    await runOnePass(prisma, "w1");
    expect(seen.map((p) => p.phase)).toEqual(["pass_start"]);
  });

  it("every lane that settles reports it — finished, failed or not", async () => {
    const states = new Map<string, Record<string, unknown>>();
    const prisma = {
      adminWorkerLog: { create: async () => ({}) },
      adminWorkerLaneState: {
        findMany: async () => [...states.values()],
        upsert: async ({ where, update, create }: Record<string, Record<string, unknown>>) => {
          const lane = String(where.lane);
          states.set(lane, { ...(states.get(lane) ?? create), ...update, lane });
          return states.get(lane);
        },
      },
    } as unknown as Parameters<typeof runWorkerLanes>[0];
    const lanes: LaneDef[] = [
      { name: "ok", capacity: 1, run: async () => ({ published: 1 }) },
      {
        name: "boom",
        capacity: 1,
        run: async () => {
          throw new Error("lane exploded");
        },
      },
    ];
    await runWorkerLanes(prisma, lanes, { active: true });
    expect(
      seen
        .filter((p) => p.phase === "lane_done")
        .map((p) => p.detail)
        .sort(),
    ).toEqual(["boom", "ok"]);
  });

  it("the loop also reports dispatch done and pass complete", () => {
    const loop = readFileSync(join(process.cwd(), "src/lib/admin-worker/loop.ts"), "utf8");
    expect(loop).toContain('reportProgress("dispatch_done", dispatch.stage);');
    expect(loop).toMatch(/completed = true;\s*reportProgress\("pass_complete"\);/);
  });
});

describe("wiring", () => {
  const worker = readFileSync(join(process.cwd(), "scripts/run-worker.ts"), "utf8");
  const host = readFileSync(join(process.cwd(), "scripts/local-worker-host.ts"), "utf8");

  it("the worker child emits beacons only under a host, on stdout", () => {
    const underHost = worker.slice(
      worker.indexOf("if (Number.isInteger(hostPid) && hostPid > 1) {"),
    );
    expect(underHost).toMatch(/setProgressSink\(\(progress\) => \{\s*process\.stdout\.write\(/);
    expect(worker.indexOf("setProgressSink(")).toBeGreaterThan(
      worker.indexOf("if (Number.isInteger(hostPid) && hostPid > 1) {"),
    );
  });

  it("the host reads beacons as liveness, keeps them out of the log, and carries split lines", () => {
    expect(host).toMatch(
      /const progress = parseProgressLine\(trimmed\);\s*if \(progress\) \{\s*if \(host\.child === child\) noteWorkerProgress\(progress\);\s*return;/,
    );
    expect(host).toContain("partial = lines.pop()");
  });

  it("checks progress on its own local timer and restarts a silent worker through the crash path", () => {
    expect(host).toContain("setInterval(checkWorkerProgress, 30_000)");
    const check = host.slice(
      host.indexOf("function checkWorkerProgress()"),
      host.indexOf("async function withDbBudget("),
    );
    expect(check).toContain("workerStalledForMs({");
    expect(check).toContain('eventName: "worker_hung_restart"');
    expect(check).toMatch(
      /await stopWorkerChild\("no progress — hung-pass watchdog"\);\s*await restartAfterCrash\(/,
    );
    // One event per stall, not one per check.
    expect(check).toContain("if (shuttingDown || hungRestartInFlight) return;");
  });
});

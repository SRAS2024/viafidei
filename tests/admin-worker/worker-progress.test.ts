/**
 * A hung pass must be noticed and recovered.
 *
 * Measured gap: liveness was timer-based — the host writes the heartbeat
 * whenever a child process exists, the loop from a 20 s interval — so a pass
 * stuck on a query over a half-open connection, or on a promise that never
 * settles, kept every signal green and was never recovered.
 *
 * Pinned: the beacon format and the stall rule (worker-progress.ts), that time
 * the Mac spends asleep is not silence, that the loop and the lane runner
 * actually emit beacons at their boundaries, that the worker child only emits
 * them under a host, and that the host turns a silent worker into one stop
 * plus the ordinary crash-restart path.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runWorkerLanes, type LaneDef } from "@/lib/admin-worker/lanes";
import { resetPauseTracking, runOnePass } from "@/lib/admin-worker/loop";
import {
  announcedRestMs,
  formatProgressLine,
  judgeWorkerProgress,
  parseProgressLine,
  progressTimeoutMs,
  reportProgress,
  setProgressSink,
  SUSPEND_GAP_MS,
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

  it("allows for a rest the worker announced, so a long idle backoff is not a hang", () => {
    const base = { now: 100 * 60_000, running: true, timeoutMs: 25 * 60_000 };
    const idle = { phase: "idle", at: "t", detail: String(30 * 60_000) };
    expect(announcedRestMs(idle)).toBe(30 * 60_000);
    expect(announcedRestMs({ phase: "lane_done", at: "t", detail: "120000" })).toBe(0);
    expect(announcedRestMs({ phase: "idle", at: "t", detail: "soon" })).toBe(0);
    // 40 min silent after announcing a 30 min rest: inside 25 + 30.
    expect(
      workerStalledForMs({
        ...base,
        lastProgressAt: base.now - 40 * 60_000,
        announcedRestMs: announcedRestMs(idle),
      }),
    ).toBeNull();
    // ...but not forever.
    expect(
      workerStalledForMs({
        ...base,
        lastProgressAt: base.now - 56 * 60_000,
        announcedRestMs: announcedRestMs(idle),
      }),
    ).toBe(56 * 60_000);
  });
});

describe("time asleep is not silence", () => {
  const MIN = 60_000;
  const CHECK = 30_000;
  const TIMEOUT = WORKER_PROGRESS_TIMEOUT_MS;

  /**
   * The host's watchdog, step by step: a check every 30 s of AWAKE time, with
   * the resume baseline it keeps between checks (scripts/local-worker-host.ts).
   */
  function watchdog(lastProgressAt: number) {
    let previousCheckAt: number | null = null;
    let resumedAt: number | null = null;
    return (now: number) => {
      const verdict = judgeWorkerProgress({
        now,
        previousCheckAt,
        running: true,
        lastProgressAt,
        resumedAt,
        timeoutMs: TIMEOUT,
      });
      previousCheckAt = now;
      if (verdict.kind === "resumed") resumedAt = now;
      return verdict;
    };
  }

  it("does not stop a healthy worker seconds after an 8-hour sleep", () => {
    // The reported case: the last beacon 2 min before the lid closed, the Mac
    // asleep 8 h. The first check after wake used to see 8 h of "silence" and
    // SIGTERM the worker as hung before it could say anything.
    const lastBeacon = 0;
    const check = watchdog(lastBeacon);
    for (let t = CHECK; t <= 2 * MIN; t += CHECK) expect(check(t)).toEqual({ kind: "ok" });
    const wake = 2 * MIN + 8 * 60 * MIN;
    expect(check(wake + 5_000)).toMatchObject({ kind: "resumed" });
    // From wake on, silence counts from wake: ten more minutes of checks are
    // all well inside the timeout.
    for (let t = wake + 5_000 + CHECK; t <= wake + 10 * MIN; t += CHECK) {
      expect(check(t)).toEqual({ kind: "ok" });
    }
  });

  it("still catches a worker that stays silent after the wake, one timeout later", () => {
    const check = watchdog(0);
    check(CHECK);
    const wake = 8 * 60 * MIN;
    expect(check(wake)).toMatchObject({ kind: "resumed" });
    let verdict = check(wake + CHECK);
    for (let t = wake + 2 * CHECK; verdict.kind === "ok" && t < wake + 2 * TIMEOUT; t += CHECK) {
      verdict = check(t);
    }
    expect(verdict.kind).toBe("stalled");
    if (verdict.kind === "stalled") {
      expect(verdict.stalledMs).toBeGreaterThan(TIMEOUT);
      expect(verdict.stalledMs).toBeLessThanOrEqual(TIMEOUT + CHECK);
    }
  });

  it("catches a worker that was already hung before the sleep, one timeout after wake", () => {
    // Silent for 20 min, then asleep: the hang is not forgiven, only re-timed.
    const check = watchdog(0);
    for (let t = CHECK; t <= 20 * MIN; t += CHECK) check(t);
    const wake = 20 * MIN + 3 * 60 * MIN;
    expect(check(wake)).toMatchObject({ kind: "resumed" });
    let t = wake + CHECK;
    while (check(t).kind === "ok" && t < wake + 2 * TIMEOUT) t += CHECK;
    expect(t - wake).toBe(TIMEOUT + CHECK);
  });

  it("reads only a gap far longer than the check interval as a suspend", () => {
    expect(SUSPEND_GAP_MS).toBeGreaterThanOrEqual(4 * CHECK);
    expect(SUSPEND_GAP_MS).toBeLessThan(WORKER_PROGRESS_TIMEOUT_FLOOR_MS);
    // A busy minute between two checks is judged, not forgiven.
    const verdict = judgeWorkerProgress({
      now: 100 * MIN,
      previousCheckAt: 100 * MIN - 90_000,
      running: true,
      lastProgressAt: 60 * MIN,
      resumedAt: null,
      timeoutMs: TIMEOUT,
    });
    expect(verdict).toEqual({ kind: "stalled", stalledMs: 40 * MIN });
  });

  it("judges the first check normally, and never a worker that is not running", () => {
    const base = { now: 100 * MIN, resumedAt: null, timeoutMs: TIMEOUT };
    expect(
      judgeWorkerProgress({ ...base, previousCheckAt: null, running: true, lastProgressAt: 0 }),
    ).toEqual({ kind: "stalled", stalledMs: 100 * MIN });
    expect(
      judgeWorkerProgress({ ...base, previousCheckAt: null, running: false, lastProgressAt: 0 }),
    ).toEqual({ kind: "ok" });
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
    // Every rest between passes is announced before it starts.
    expect(loop.match(/reportProgress\("idle", String\(/g)).toHaveLength(2);
    expect(loop.match(/await sleep\(/g)).toHaveLength(2);
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
    expect(host).toContain("const PROGRESS_CHECK_INTERVAL_MS = 30_000;");
    expect(host).toContain("setInterval(checkWorkerProgress, PROGRESS_CHECK_INTERVAL_MS)");
    const check = host.slice(
      host.indexOf("function checkWorkerProgress()"),
      host.indexOf("async function withDbBudget("),
    );
    expect(check).toContain("judgeWorkerProgress({");
    expect(check).toContain('eventName: "worker_hung_restart"');
    expect(check).toMatch(
      /const stopping = stopWorkerChild\("no progress — hung-pass watchdog"\);\s*const ticket = autoRestart\.ticket\(\);\s*await stopping;\s*await autoRestart\.afterCrash\(\{ code: null, signal: "SIGTERM" \}, ticket\);/,
    );
    // One event per stall, not one per check.
    expect(check).toContain("if (shuttingDown || hungRestartInFlight) return;");
  });

  it("measures every gap between checks, and only re-baselines after a suspend", () => {
    const check = host.slice(
      host.indexOf("function checkWorkerProgress()"),
      host.indexOf("async function withDbBudget("),
    );
    // The previous check time is taken before any early return, so a gap is
    // never measured across a skipped check.
    expect(check.indexOf("lastProgressCheckAt = now;")).toBeLessThan(
      check.indexOf("if (shuttingDown || hungRestartInFlight) return;"),
    );
    expect(check).toMatch(
      /if \(verdict\.kind === "resumed"\) \{\s*[\s\S]*?resumedFromSuspendAt = now;/,
    );
    // The beacon time itself is left alone: the status shows the real last progress.
    expect(check).not.toContain("host.lastProgressAt =");
  });
});

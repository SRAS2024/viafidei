/**
 * Worker crash-resilience — the self-heal layer added after the 2026-07-12
 * audit, where the worker process died "cleanly between passes" and stayed dark
 * for ~28h. These drive the extracted primitives (worker-supervisor.ts) with
 * injected effects, so the exact survive-and-restart behaviour is proven
 * without a real process, real timers, or a real Prisma client.
 */
import { describe, expect, it, vi } from "vitest";

import {
  installProcessSafetyNet,
  runLoopSupervised,
  type ProcessSafetyEvent,
} from "@/lib/admin-worker/worker-supervisor";

describe("installProcessSafetyNet", () => {
  function harness(opts: { throttleMs?: number } = {}) {
    const handlers: Partial<Record<ProcessSafetyEvent, (arg: unknown) => void>> = {};
    const events: Array<[string, string]> = [];
    const alerts: Array<[string, string]> = [];
    let clock = 10_000_000; // start well past the throttle so the first alert fires
    installProcessSafetyNet({
      workerId: "w1",
      register: (event, handler) => {
        handlers[event] = handler;
      },
      onEvent: (kind, detail) => {
        events.push([kind, detail]);
      },
      onAlert: (kind, detail) => {
        alerts.push([kind, detail]);
      },
      errorLog: () => undefined,
      now: () => clock,
      alertThrottleMs: opts.throttleMs ?? 1000,
    });
    return {
      handlers,
      events,
      alerts,
      advance: (ms: number) => {
        clock += ms;
      },
    };
  }

  it("registers handlers for BOTH fatal process events", () => {
    const h = harness();
    expect(typeof h.handlers.unhandledRejection).toBe("function");
    expect(typeof h.handlers.uncaughtException).toBe("function");
  });

  it("an uncaught exception is audited + alerted and does NOT throw (process kept alive)", () => {
    const h = harness();
    // Invoking the handler must not throw — that is the whole point: a fatal,
    // silent exit becomes a survivable, logged event.
    expect(() => h.handlers.uncaughtException!(new Error("boom"))).not.toThrow();
    expect(h.events).toHaveLength(1);
    expect(h.events[0][0]).toBe("uncaught_exception");
    expect(h.events[0][1]).toContain("boom");
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0][0]).toBe("uncaught_exception");
  });

  it("an unhandled rejection carrying a non-Error is stringified, not dropped", () => {
    const h = harness();
    h.handlers.unhandledRejection!("plain string reason");
    expect(h.events).toHaveLength(1);
    expect(h.events[0][0]).toBe("unhandled_rejection");
    expect(h.events[0][1]).toContain("plain string reason");
  });

  it("throttles the alert EMAIL but never the audit trail", () => {
    const h = harness({ throttleMs: 1000 });
    h.handlers.uncaughtException!(new Error("first")); // t0 → alert fires
    h.advance(500);
    h.handlers.uncaughtException!(new Error("second")); // within window → no alert
    h.advance(600); // now 1100ms since first
    h.handlers.uncaughtException!(new Error("third")); // window elapsed → alert fires

    // Every event is audited …
    expect(h.events.map((e) => e[1])).toEqual([
      expect.stringContaining("first"),
      expect.stringContaining("second"),
      expect.stringContaining("third"),
    ]);
    // … but only the un-throttled ones email.
    expect(h.alerts.map((a) => a[1])).toEqual([
      expect.stringContaining("first"),
      expect.stringContaining("third"),
    ]);
  });

  it("swallows onEvent / onAlert rejections (a failing sink can't crash the net)", () => {
    let clock = 10_000_000;
    const handlers: Partial<Record<ProcessSafetyEvent, (arg: unknown) => void>> = {};
    installProcessSafetyNet({
      workerId: "w1",
      register: (event, handler) => {
        handlers[event] = handler;
      },
      onEvent: async () => {
        throw new Error("audit write failed");
      },
      onAlert: async () => {
        throw new Error("email failed");
      },
      errorLog: () => undefined,
      now: () => clock,
    });
    expect(() => handlers.uncaughtException!(new Error("boom"))).not.toThrow();
  });
});

describe("runLoopSupervised", () => {
  it("one-shot runs the loop exactly once and returns", async () => {
    let calls = 0;
    await runLoopSupervised({
      workerId: "w",
      oneShot: true,
      maxPasses: Infinity,
      runLoop: async () => {
        calls += 1;
        return { published: 1 };
      },
      isShuttingDown: () => false,
      log: () => undefined,
      errorLog: () => undefined,
    });
    expect(calls).toBe(1);
  });

  it("a bounded (--max-jobs) run executes once and propagates a throw (no restart)", async () => {
    let calls = 0;
    await expect(
      runLoopSupervised({
        workerId: "w",
        oneShot: false,
        maxPasses: 5, // finite → bounded, not continuous
        runLoop: async () => {
          calls += 1;
          throw new Error("bounded failure surfaces");
        },
        isShuttingDown: () => false,
        log: () => undefined,
        errorLog: () => undefined,
      }),
    ).rejects.toThrow(/bounded failure/);
    expect(calls).toBe(1);
  });

  it("continuous mode RESTARTS after the loop throws, with bounded backoff, until shutdown", async () => {
    let calls = 0;
    let shuttingDown = false;
    const sleeps: number[] = [];
    const restarts: string[] = [];
    await runLoopSupervised({
      workerId: "w",
      oneShot: false,
      maxPasses: Infinity,
      runLoop: async () => {
        calls += 1;
        if (calls >= 3) shuttingDown = true; // let it self-heal a couple times, then stop
        throw new Error(`crash ${calls}`);
      },
      isShuttingDown: () => shuttingDown,
      onLoopRestart: (detail) => {
        restarts.push(detail);
      },
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
      errorLog: () => undefined,
    });
    // The loop threw 3× and was re-entered each time until shutdown latched.
    expect(calls).toBe(3);
    expect(restarts).toHaveLength(3);
    // Backoff grows (2s, 4s) between the first two restarts; the third throw
    // coincides with shutdown so it breaks before sleeping again.
    expect(sleeps).toEqual([2000, 4000]);
  });

  it("continuous mode also restarts when the loop RETURNS unexpectedly", async () => {
    let calls = 0;
    let shuttingDown = false;
    await runLoopSupervised({
      workerId: "w",
      oneShot: false,
      maxPasses: Infinity,
      runLoop: async () => {
        calls += 1;
        if (calls >= 2) shuttingDown = true;
        // returns normally — a continuous loop should never return on its own
      },
      isShuttingDown: () => shuttingDown,
      sleepImpl: async () => undefined,
      errorLog: () => undefined,
    });
    expect(calls).toBe(2);
  });

  it("caps backoff at backoffCapMs so a hard-failing loop can't wait forever", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    await runLoopSupervised({
      workerId: "w",
      oneShot: false,
      maxPasses: Infinity,
      runLoop: async () => {
        calls += 1;
        throw new Error("always fails");
      },
      isShuttingDown: () => false,
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
      backoffCapMs: 5000,
      maxRestarts: 4, // safety valve so the test terminates (→ 5 backoff waits)
      errorLog: () => undefined,
      onLoopRestart: () => undefined,
    });
    // 2s, 4s, then capped at 5s thereafter.
    expect(sleeps).toEqual([2000, 4000, 5000, 5000, 5000]);
  });

  it("the maxRestarts safety valve stops a loop that never recovers and never shuts down", async () => {
    let calls = 0;
    await runLoopSupervised({
      workerId: "w",
      oneShot: false,
      maxPasses: Infinity,
      runLoop: async () => {
        calls += 1;
        throw new Error("x");
      },
      isShuttingDown: () => false, // never shuts down
      sleepImpl: async () => undefined,
      maxRestarts: 3,
      errorLog: () => undefined,
      onLoopRestart: () => undefined,
    });
    // restarts 0..3 inclusive run the loop → 4 executions, then the guard trips.
    expect(calls).toBe(4);
  });

  it("swallows an onLoopRestart rejection and keeps supervising", async () => {
    let calls = 0;
    let shuttingDown = false;
    await expect(
      runLoopSupervised({
        workerId: "w",
        oneShot: false,
        maxPasses: Infinity,
        runLoop: async () => {
          calls += 1;
          if (calls >= 2) shuttingDown = true;
          throw new Error("crash");
        },
        isShuttingDown: () => shuttingDown,
        onLoopRestart: async () => {
          throw new Error("audit write failed");
        },
        sleepImpl: async () => undefined,
        errorLog: () => undefined,
      }),
    ).resolves.toEqual({ stopReason: null });
    expect(calls).toBe(2);
  });

  it("does not run the loop at all if already shutting down", async () => {
    const runLoop = vi.fn(async () => undefined);
    await runLoopSupervised({
      workerId: "w",
      oneShot: false,
      maxPasses: Infinity,
      runLoop,
      isShuttingDown: () => true,
      sleepImpl: async () => undefined,
      errorLog: () => undefined,
    });
    expect(runLoop).not.toHaveBeenCalled();
  });
});

/**
 * Worker crash-resilience — the self-heal layer added after the 2026-07-12
 * audit, where the worker process died "cleanly between passes" and stayed dark
 * for ~28h. These drive the extracted primitives (worker-supervisor.ts) with
 * injected effects, so the exact survive-and-restart behaviour is proven
 * without a real process, real timers, or a real Prisma client.
 */
import { describe, expect, it, vi } from "vitest";

import {
  errorSignature,
  installProcessSafetyNet,
  runLoopSupervised,
  watchSupervisingHost,
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

  it("folds identical events inside the window into one row, carrying the count forward", () => {
    const folded: Array<{ repeats: number; overCap: number }> = [];
    let clock = 10_000_000;
    const handlers: Partial<Record<ProcessSafetyEvent, (arg: unknown) => void>> = {};
    installProcessSafetyNet({
      workerId: "w1",
      register: (event, handler) => {
        handlers[event] = handler;
      },
      onEvent: (_kind, _detail, repeats) => {
        folded.push(repeats);
      },
      onAlert: () => undefined,
      errorLog: () => undefined,
      now: () => clock,
    });
    // The same failure, differing only in a port number, 500 times in a second.
    for (let i = 0; i < 500; i += 1) {
      handlers.unhandledRejection!(new Error(`connect ECONNREFUSED 127.0.0.1:${5000 + i}`));
      clock += 2;
    }
    expect(folded).toEqual([{ repeats: 0, overCap: 0 }]);
    // A minute later the next occurrence is written, with the 499 it stood for.
    clock += 60_000;
    handlers.unhandledRejection!(new Error("connect ECONNREFUSED 127.0.0.1:6000"));
    expect(folded).toEqual([
      { repeats: 0, overCap: 0 },
      { repeats: 499, overCap: 0 },
    ]);
  });

  it("caps distinct events per window so a storm of unique messages is bounded too", () => {
    const rows: Array<{ repeats: number; overCap: number }> = [];
    let clock = 10_000_000;
    const handlers: Partial<Record<ProcessSafetyEvent, (arg: unknown) => void>> = {};
    installProcessSafetyNet({
      workerId: "w1",
      register: (event, handler) => {
        handlers[event] = handler;
      },
      onEvent: (_kind, _detail, repeats) => {
        rows.push(repeats);
      },
      onAlert: () => undefined,
      errorLog: () => undefined,
      now: () => clock,
      maxEventsPerWindow: 5,
    });
    for (const word of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      handlers.uncaughtException!(new Error(`failure ${word}`));
    }
    expect(rows).toHaveLength(5);
    clock += 60_000;
    handlers.uncaughtException!(new Error("failure z"));
    expect(rows).toHaveLength(6);
    expect(rows[5]).toEqual({ repeats: 0, overCap: 3 });
  });

  it("never logs a broken log pipe: it calls onBrokenPipe once and audits nothing", () => {
    const logged: string[] = [];
    const events: string[] = [];
    let brokenPipe = 0;
    const handlers: Partial<Record<ProcessSafetyEvent, (arg: unknown) => void>> = {};
    installProcessSafetyNet({
      workerId: "w1",
      register: (event, handler) => {
        handlers[event] = handler;
      },
      onEvent: (kind) => {
        events.push(kind);
      },
      onAlert: () => undefined,
      errorLog: (m) => logged.push(m),
      isBrokenPipe: (err) => (err as { code?: string }).code === "EPIPE",
      onBrokenPipe: () => {
        brokenPipe += 1;
      },
    });
    const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
    for (let i = 0; i < 1000; i += 1) handlers.uncaughtException!(epipe);
    expect(brokenPipe).toBe(1);
    expect(events).toEqual([]);
    expect(logged).toEqual([]);
    // Any other error is still audited as before.
    handlers.uncaughtException!(new Error("boom"));
    expect(events).toEqual(["uncaught_exception"]);
  });

  it("errorSignature ignores digits so counters and ports do not split a storm", () => {
    expect(errorSignature("uncaught_exception", new Error("timeout after 8000ms (call 41)"))).toBe(
      errorSignature("uncaught_exception", new Error("timeout after 9000ms (call 7)")),
    );
    expect(errorSignature("uncaught_exception", new Error("a"))).not.toBe(
      errorSignature("unhandled_rejection", new Error("a")),
    );
    const coded = Object.assign(new Error("x"), { code: "P2024" });
    expect(errorSignature("unhandled_rejection", coded)).toContain("P2024");
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

describe("watchSupervisingHost (the worker child's parent watchdog)", () => {
  function harness(state: { alive: boolean; ppid: number }) {
    let tick: (() => void) | null = null;
    const gone: string[] = [];
    const stop = watchSupervisingHost({
      hostPid: 4242,
      isAlive: (pid) => pid === 4242 && state.alive,
      parentPid: () => state.ppid,
      onGone: (reason) => gone.push(reason),
      setIntervalImpl: (fn) => {
        tick = fn;
        return setInterval(() => undefined, 1_000_000);
      },
    });
    return { tick: () => tick?.(), gone, stop };
  }

  it("does nothing while the host is alive and still our ancestor", () => {
    const h = harness({ alive: true, ppid: 777 });
    for (let i = 0; i < 5; i += 1) h.tick();
    expect(h.gone).toEqual([]);
    h.stop();
  });

  it("reports a vanished host pid exactly once", () => {
    const state = { alive: true, ppid: 777 };
    const h = harness(state);
    h.tick();
    state.alive = false;
    h.tick();
    h.tick();
    expect(h.gone).toHaveLength(1);
    expect(h.gone[0]).toMatch(/pid 4242\) is gone/);
    h.stop();
  });

  it("reports adoption by launchd even if the host pid was reused", () => {
    const h = harness({ alive: true, ppid: 1 });
    h.tick();
    expect(h.gone).toHaveLength(1);
    expect(h.gone[0]).toMatch(/launchd/);
    h.stop();
  });
});

/**
 * The local host's automatic restarts never undo an OFF.
 *
 * Measured gap: an app OFF that the database could not record was overridden
 * by a restart decision already in flight. A stop cancelled only a restart
 * TIMER armed at that instant, while restartAfterCrash and resumeIfSwitchOn
 * spend up to 20 s on their switch read — and armed a fresh timer after the
 * OFF had landed. When the database answered again the row still read ON
 * (the OFF was never written), so the worker started and ran against
 * production while the app said "Stopped locally — waiting for the database
 * to record OFF". restartAfterCrash also left runState "crashed", which
 * stopped the lease tick from retrying the durable OFF.
 *
 * Driven here step by step through the module the host runs
 * (restart-lifecycle.ts), with switch reads the test answers and fake timers.
 * The host's own stop path is reproduced as `stop` / `operatorOff` below.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESTART_DEGRADED_AFTER, restartBackoffFromEnv } from "@/lib/admin-worker/restart-backoff";
import {
  createRestartLifecycle,
  planAutoRestart,
  SWITCH_UNREADABLE_RETRY_MS,
  type RestartHostState,
} from "@/lib/admin-worker/restart-lifecycle";

type SwitchRead = { on: boolean; known: boolean };
const ON: SwitchRead = { on: true, known: true };
const OFF: SwitchRead = { on: false, known: true };
const UNREADABLE: SwitchRead = { on: false, known: false };
const HOUR = 60 * 60_000;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** A host shaped like scripts/local-worker-host.ts's, whose switch reads the test answers. */
function harness() {
  const host: RestartHostState & { child: unknown } = {
    runState: "off",
    child: null,
    restarts: 0,
    nextRestartAt: null,
    degraded: false,
    degradedLoggedAt: 0,
    failureReason: null,
    leaseHeldElsewhere: false,
    pendingStarts: 0,
    offNotRecorded: false,
  };
  const reads: Array<ReturnType<typeof deferred<SwitchRead>>> = [];
  const started: number[] = [];
  const audit = vi.fn(async (entry: { eventName: string; severity?: string }) => entry);
  let shuttingDown = false;
  const lifecycle = createRestartLifecycle({
    host,
    backoff: restartBackoffFromEnv({}),
    readSwitch: () => {
      const read = deferred<SwitchRead>();
      reads.push(read);
      return read.promise;
    },
    startWorker: () => {
      started.push(Date.now());
      host.child = { pid: 4242 };
      host.runState = "running";
    },
    shuttingDown: () => shuttingDown,
    log: () => undefined,
    statusChanged: () => undefined,
    audit,
    databaseHost: () => "db.example:5432/railway",
    runtimeId: "local-macbook-test",
    random: () => 0,
  });
  /** The host's stopWorkerChild with no child left: count the stop, state "off". */
  const stop = () => {
    lifecycle.noteStop();
    host.child = null;
    host.runState = "off";
  };
  /** POST /api/switch {on:false}: the OFF outranks the row from its first instant. */
  const operatorOff = () => {
    host.offNotRecorded = true;
    stop();
  };
  return {
    host,
    lifecycle,
    reads,
    started,
    audit,
    stop,
    operatorOff,
    shutDown: () => {
      shuttingDown = true;
    },
  };
}

/** Let a decision continue after the read it awaits was answered. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T09:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("planAutoRestart", () => {
  const base = {
    shuttingDown: false,
    childRunning: false,
    stoppedSinceDecisionBegan: false,
    offNotRecorded: false,
    switchKnown: true,
    switchOn: true,
  };

  it("starts only on a switch read ON with nothing newer in the way", () => {
    expect(planAutoRestart(base)).toBe("start");
    expect(planAutoRestart({ ...base, switchOn: false })).toBe("stay_off");
    expect(planAutoRestart({ ...base, switchKnown: false, switchOn: false })).toBe("wait");
  });

  it("stands down when a stop happened while the decision waited — whatever the read says", () => {
    for (const read of [ON, OFF, UNREADABLE]) {
      expect(
        planAutoRestart({
          ...base,
          stoppedSinceDecisionBegan: true,
          switchKnown: read.known,
          switchOn: read.on,
        }),
      ).toBe("stand_down");
    }
  });

  it("lets an OFF given here outrank a row that still reads ON, or cannot be read", () => {
    expect(planAutoRestart({ ...base, offNotRecorded: true })).toBe("stay_off");
    expect(
      planAutoRestart({ ...base, offNotRecorded: true, switchKnown: false, switchOn: false }),
    ).toBe("stay_off");
  });

  it("stands down for a worker that already exists, or a host on its way out", () => {
    expect(planAutoRestart({ ...base, childRunning: true })).toBe("stand_down");
    expect(planAutoRestart({ ...base, shuttingDown: true })).toBe("stand_down");
  });
});

describe("an OFF given while a restart decision reads the switch wins", () => {
  it("the reported sequence: a crash restart still reading the switch arms nothing after the OFF, and nothing starts when the database returns", async () => {
    const h = harness();
    // 1. The worker exited; the host set "crashed" and began the restart decision.
    h.host.runState = "crashed";
    const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
    // 2. Its switch read hangs on the database. 3. The operator presses OFF:
    // nothing is armed yet, so there is no timer to cancel; the durable OFF
    // write fails, so the switch row keeps saying ON.
    h.operatorOff();
    // 4. The read gives up as unknown.
    h.reads[0].resolve(UNREADABLE);
    await decision;
    expect(h.lifecycle.armed).toBe(false);
    expect(h.host.runState).toBe("off");
    expect(h.host.pendingStarts).toBe(0);
    // 5. The database recovers. Nothing reads the stale ON row, nothing starts.
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(h.reads).toHaveLength(1);
    expect(h.started).toEqual([]);
  });

  it("stands down the same way when the read comes back ON — the row never heard of the OFF", async () => {
    const h = harness();
    h.host.runState = "crashed";
    const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
    h.operatorOff();
    h.reads[0].resolve(ON);
    await decision;
    expect(h.host.restarts).toBe(0);
    expect(h.lifecycle.armed).toBe(false);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(h.started).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("covers an armed restart that already fired and is reading the switch (resumeIfSwitchOn's unknown branch)", async () => {
    const h = harness();
    h.host.runState = "crashed";
    h.lifecycle.schedule(SWITCH_UNREADABLE_RETRY_MS);
    await vi.advanceTimersByTimeAsync(SWITCH_UNREADABLE_RETRY_MS);
    // The timer fired: no timer is armed while its read is in flight.
    expect(h.reads).toHaveLength(1);
    expect(h.lifecycle.armed).toBe(false);
    expect(h.host.pendingStarts).toBe(1);
    h.operatorOff();
    h.reads[0].resolve(UNREADABLE);
    await settle();
    expect(h.lifecycle.armed).toBe(false);
    expect(h.host.pendingStarts).toBe(0);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(h.reads).toHaveLength(1);
    expect(h.started).toEqual([]);
  });

  it("…and when that read comes back ON", async () => {
    const h = harness();
    h.lifecycle.schedule(2_000);
    await vi.advanceTimersByTimeAsync(2_000);
    h.operatorOff();
    h.reads[0].resolve(ON);
    await settle();
    expect(h.started).toEqual([]);
    expect(h.host.runState).toBe("off");
  });

  it("a decision that begins after the OFF reads it as OFF, and nothing can be armed against it", async () => {
    const h = harness();
    h.host.offNotRecorded = true;
    const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
    h.reads[0].resolve(ON);
    await decision;
    expect(h.host.runState).toBe("off");
    expect(h.lifecycle.armed).toBe(false);
    expect(h.lifecycle.schedule(2_000)).toBe(false);
    expect(h.lifecycle.armed).toBe(false);
    // An outage exit (4) arms nothing either.
    h.lifecycle.afterOutage();
    expect(h.lifecycle.armed).toBe(false);
    expect(h.host.runState).toBe("off");
  });

  it("a stop also turns away the host's own start paths that took a ticket before their awaits", () => {
    const h = harness();
    const ticket = h.lifecycle.ticket();
    expect(h.lifecycle.mayStart(ticket)).toBe(true);
    h.stop();
    expect(h.lifecycle.mayStart(ticket)).toBe(false);
    // A fresh decision may start again — unless an OFF given here is unrecorded.
    expect(h.lifecycle.mayStart(h.lifecycle.ticket())).toBe(true);
    h.host.offNotRecorded = true;
    expect(h.lifecycle.mayStart(h.lifecycle.ticket())).toBe(false);
    h.host.offNotRecorded = false; // the database recorded it
    expect(h.lifecycle.mayStart(h.lifecycle.ticket())).toBe(true);
  });

  it("a stop cancels a restart that is armed, before it can read anything", async () => {
    const h = harness();
    h.lifecycle.schedule(4_000);
    expect(h.host.pendingStarts).toBe(1);
    h.stop();
    expect(h.lifecycle.armed).toBe(false);
    expect(h.host.pendingStarts).toBe(0);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(h.reads).toHaveLength(0);
  });
});

describe("without an OFF, a crashing worker is restarted for as long as the switch is ON", () => {
  it("arms the capped backoff, and the timer re-reads the switch before starting", async () => {
    const h = harness();
    const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
    h.reads[0].resolve(ON);
    await decision;
    expect(h.host.restarts).toBe(1);
    expect(h.host.runState).toBe("crashed");
    expect(h.lifecycle.armed).toBe(true);
    expect(h.host.nextRestartAt).toBe(Date.now() + 2_000);
    expect(h.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "local_worker_restart", severity: "WARN" }),
    );
    await vi.advanceTimersByTimeAsync(2_000);
    // Never a blind start: it reads the switch first.
    expect(h.reads).toHaveLength(2);
    expect(h.started).toEqual([]);
    h.reads[1].resolve(ON);
    await settle();
    expect(h.started).toHaveLength(1);
    expect(h.host.pendingStarts).toBe(0);
  });

  it("stands the restart down when the switch was turned OFF elsewhere meanwhile", async () => {
    const h = harness();
    const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
    h.reads[0].resolve(ON);
    await decision;
    await vi.advanceTimersByTimeAsync(2_000);
    h.reads[1].resolve(OFF);
    await settle();
    expect(h.started).toEqual([]);
    expect(h.host.runState).toBe("off");
  });

  it("waits for a database that cannot be read instead of counting a crash", async () => {
    const h = harness();
    const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
    h.reads[0].resolve(UNREADABLE);
    await decision;
    expect(h.host.restarts).toBe(0);
    expect(h.host.runState).toBe("crashed");
    expect(h.host.nextRestartAt).toBe(Date.now() + SWITCH_UNREADABLE_RETRY_MS);
  });

  it("turns degraded past the old give-up point, and keeps retrying", async () => {
    const h = harness();
    for (let i = 0; i <= RESTART_DEGRADED_AFTER; i += 1) {
      const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
      h.reads[h.reads.length - 1].resolve(ON);
      await decision;
    }
    expect(h.host.restarts).toBe(RESTART_DEGRADED_AFTER + 1);
    expect(h.host.degraded).toBe(true);
    expect(h.host.failureReason).toMatch(/keeps retrying while the switch is ON/);
    expect(h.lifecycle.armed).toBe(true);
    const degradedRows = h.audit.mock.calls.filter(
      ([entry]) => entry.eventName === "local_worker_degraded",
    );
    expect(degradedRows).toHaveLength(1);
    expect(degradedRows[0][0].severity).toBe("ERROR");
  });

  it("treats an outage exit (4) as a wait for the database, not a crash", () => {
    const h = harness();
    h.lifecycle.afterOutage();
    expect(h.lifecycle.armed).toBe(true);
    expect(h.host.restarts).toBe(0);
  });

  it("does nothing once the host is shutting down", async () => {
    const h = harness();
    const decision = h.lifecycle.afterCrash({ code: 1, signal: null });
    h.shutDown();
    h.reads[0].resolve(ON);
    await decision;
    expect(h.lifecycle.armed).toBe(false);
    expect(h.host.restarts).toBe(0);
  });
});

describe("a refused exit (3)", () => {
  it("is a lease held elsewhere when the switch reads ON", async () => {
    const h = harness();
    const decision = h.lifecycle.afterRefusal();
    h.reads[0].resolve(ON);
    await decision;
    expect(h.host).toMatchObject({ runState: "failed", leaseHeldElsewhere: true });
    expect(h.lifecycle.armed).toBe(false);
  });

  it("is retried when the switch cannot be read", async () => {
    const h = harness();
    const decision = h.lifecycle.afterRefusal();
    h.reads[0].resolve(UNREADABLE);
    await decision;
    expect(h.host).toMatchObject({ runState: "crashed", leaseHeldElsewhere: false });
    expect(h.lifecycle.armed).toBe(true);
  });

  it("is the operator's own stop when an OFF given here is not recorded yet — not a lease elsewhere", async () => {
    const h = harness();
    h.host.offNotRecorded = true;
    const decision = h.lifecycle.afterRefusal();
    h.reads[0].resolve(ON);
    await decision;
    expect(h.host).toMatchObject({ runState: "off", leaseHeldElsewhere: false });
    expect(h.lifecycle.armed).toBe(false);
  });

  it("leaves the state to a stop that happened while it read the switch", async () => {
    const h = harness();
    const decision = h.lifecycle.afterRefusal();
    h.operatorOff();
    h.reads[0].resolve(UNREADABLE);
    await decision;
    expect(h.host.runState).toBe("off");
    expect(h.lifecycle.armed).toBe(false);
  });
});

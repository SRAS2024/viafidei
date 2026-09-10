/**
 * The local host polls the durable master switch, so the switch is
 * authoritative no matter who set it.
 *
 * The gap this closes, measured by hand: scripts/local-worker-host.ts read the
 * switch only at startup and on child-exit paths. Setting the row ON in the
 * database did NOT start the worker until the app was relaunched — which makes
 * a remote toggle (the operator's iPhone writes that row and runs nothing
 * itself) completely inert.
 *
 * Pinned here:
 *   - the decision rules, as a pure function: idempotent when the world is
 *     already correct, never fighting the crash/restart handling, and NEVER
 *     reading an unreachable database as OFF;
 *   - the durable liveness signal the phone displays (host presence), incl.
 *     its freshness semantics and the outage-is-not-"off" distinction;
 *   - that the host actually wires the poll up — reusing its existing start
 *     and stop paths, on an unref'd timer that is cleared on shutdown.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHostPresence,
  clearHostPresence,
  describeHostPresence,
  readHostPresence,
  writeHostPresence,
  HOST_PRESENCE_KEY,
  HOST_PRESENCE_STALE_MS,
} from "@/lib/admin-worker/host-presence";
import {
  isSwitchPollActionable,
  planSwitchPoll,
  SWITCH_POLL_INTERVAL_MS,
  SWITCH_POLL_START_COOLDOWN_MS,
  type SwitchPollInput,
} from "@/lib/admin-worker/switch-poll";

const NOW = 1_700_000_000_000;

/** Steady state: switch ON, worker running here, nothing pending. */
const RUNNING: SwitchPollInput = {
  now: NOW,
  shuttingDown: false,
  switchKnown: true,
  switchOn: true,
  previousSwitchOn: true,
  switchChangedAt: "2026-09-09T12:00:00.000Z",
  previousSwitchChangedAt: "2026-09-09T12:00:00.000Z",
  childRunning: true,
  runState: "running",
  pendingStarts: 0,
  pendingDurableOff: false,
  startBlockedUntil: null,
};

/** Steady state: switch OFF, nothing running here. */
const STOPPED: SwitchPollInput = {
  ...RUNNING,
  switchOn: false,
  previousSwitchOn: false,
  childRunning: false,
  runState: "off",
};

describe("planSwitchPoll — cadence", () => {
  it("polls inside the operator's few-seconds expectation without hammering the link", () => {
    expect(SWITCH_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(5_000);
    expect(SWITCH_POLL_INTERVAL_MS).toBeLessThanOrEqual(10_000);
  });
});

describe("planSwitchPoll — idempotence", () => {
  it("does nothing when the switch is ON and the worker is already running", () => {
    const plan = planSwitchPoll(RUNNING);
    expect(plan).toEqual({ action: "none", reason: "already_running", clearFailure: false });
    expect(isSwitchPollActionable(plan)).toBe(false);
  });

  it("does nothing when the switch is OFF and nothing is running", () => {
    expect(planSwitchPoll(STOPPED)).toMatchObject({
      action: "none",
      reason: "already_stopped",
    });
  });

  it("does nothing at all while the host is shutting down", () => {
    expect(planSwitchPoll({ ...RUNNING, shuttingDown: true, switchOn: false })).toMatchObject({
      action: "none",
      reason: "shutting_down",
    });
  });
});

describe("planSwitchPoll — an unreadable database is not OFF", () => {
  it("keeps a healthy worker running when the switch cannot be read", () => {
    const plan = planSwitchPoll({ ...RUNNING, switchKnown: false, switchOn: false });
    expect(plan).toMatchObject({ action: "none", reason: "switch_unknown" });
  });

  it("does not start anything either, on an unreadable switch", () => {
    expect(
      planSwitchPoll({ ...STOPPED, switchKnown: false, switchOn: false, previousSwitchOn: false }),
    ).toMatchObject({ action: "none", reason: "switch_unknown" });
  });
});

describe("planSwitchPoll — acting on the durable switch", () => {
  it("starts the worker when the switch is ON and nothing is running here", () => {
    const plan = planSwitchPoll({ ...STOPPED, switchOn: true, previousSwitchOn: false });
    expect(plan).toMatchObject({
      action: "start",
      reason: "switch_turned_on",
      clearFailure: true,
    });
  });

  it("starts it even without an observed edge — a row already ON is enough", () => {
    const plan = planSwitchPoll({ ...STOPPED, switchOn: true, previousSwitchOn: null });
    expect(plan).toMatchObject({
      action: "start",
      reason: "switch_on_not_running",
      clearFailure: false,
    });
  });

  it("stops the worker when the switch is turned OFF somewhere else", () => {
    const plan = planSwitchPoll({ ...RUNNING, switchOn: false, previousSwitchOn: true });
    expect(plan).toMatchObject({ action: "stop", reason: "switch_turned_off" });
    expect(isSwitchPollActionable(plan)).toBe(true);
  });

  it("stops a worker the supervisor still believes is running after the child vanished", () => {
    expect(planSwitchPoll({ ...RUNNING, switchOn: false, childRunning: false })).toMatchObject({
      action: "stop",
    });
  });
});

describe("planSwitchPoll — never fights the existing lifecycle", () => {
  it("stands aside while a crash backoff or deferred resume is pending", () => {
    expect(
      planSwitchPoll({
        ...STOPPED,
        switchOn: true,
        previousSwitchOn: true,
        runState: "crashed",
        pendingStarts: 1,
      }),
    ).toMatchObject({ action: "none", reason: "start_pending" });
  });

  it("stands aside mid-start and mid-stop", () => {
    for (const runState of ["starting", "stopping"] as const) {
      expect(planSwitchPoll({ ...STOPPED, switchOn: true, runState })).toMatchObject({
        action: "none",
        reason: "transitioning",
      });
    }
  });

  it("restarts a crashed worker only once the crash path has finished with it", () => {
    expect(
      planSwitchPoll({ ...STOPPED, switchOn: true, runState: "crashed", pendingStarts: 0 }),
    ).toMatchObject({ action: "start" });
  });

  it("leaves a pending durable OFF to the lease tick", () => {
    expect(planSwitchPoll({ ...STOPPED, switchOn: true, pendingDurableOff: true })).toMatchObject({
      action: "none",
      reason: "pending_durable_off",
    });
  });
});

describe("planSwitchPoll — a runtime that gave up is not relaunched on a beat", () => {
  it("refuses to restart a failed runtime while the switch is merely still ON", () => {
    expect(
      planSwitchPoll({ ...STOPPED, switchOn: true, previousSwitchOn: true, runState: "failed" }),
    ).toMatchObject({ action: "none", reason: "failed_needs_operator" });
  });

  it("restarts it on a deliberate OFF→ON, clearing the failure and the crash streak", () => {
    expect(
      planSwitchPoll({ ...STOPPED, switchOn: true, previousSwitchOn: false, runState: "failed" }),
    ).toMatchObject({ action: "start", reason: "switch_turned_on", clearFailure: true });
  });

  // The poll SAMPLES the switch every seven seconds, so an operator who taps
  // OFF and straight back ON produces two writes and only one observation —
  // the value never appears to change. Since OFF→ON is the ONLY documented
  // recovery from "failed", and nothing else clears that state, missing this
  // edge leaves the worker dead with the phone showing the switch ON and no
  // path back short of relaunching the Mac app.
  it("restarts a failed runtime when OFF→ON happened entirely between two ticks", () => {
    expect(
      planSwitchPoll({
        ...STOPPED,
        switchOn: true,
        previousSwitchOn: true,
        previousSwitchChangedAt: "2026-09-09T12:00:00.000Z",
        switchChangedAt: "2026-09-09T12:00:04.000Z",
        runState: "failed",
      }),
    ).toMatchObject({ action: "start", reason: "switch_turned_on", clearFailure: true });
  });

  it("does not treat an unchanged row as a re-arm however many ticks pass", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(
        planSwitchPoll({
          ...STOPPED,
          switchOn: true,
          previousSwitchOn: true,
          runState: "failed",
          now: NOW + i * SWITCH_POLL_INTERVAL_MS,
        }),
      ).toMatchObject({ action: "none", reason: "failed_needs_operator" });
    }
  });

  it("does not mistake the first read after launch for a re-arm", () => {
    // Launching beside an already-ON switch: no previous observation at all.
    expect(
      planSwitchPoll({
        ...STOPPED,
        switchOn: true,
        previousSwitchOn: null,
        previousSwitchChangedAt: null,
        switchChangedAt: "2026-09-09T12:00:00.000Z",
        runState: "failed",
      }),
    ).toMatchObject({ action: "none", reason: "failed_needs_operator" });
  });
});

describe("planSwitchPoll — refusals cool down instead of repeating", () => {
  it("waits out the cooldown after a refused start", () => {
    expect(
      planSwitchPoll({
        ...STOPPED,
        switchOn: true,
        previousSwitchOn: true,
        startBlockedUntil: NOW + SWITCH_POLL_START_COOLDOWN_MS,
      }),
    ).toMatchObject({ action: "none", reason: "start_cooldown" });
  });

  it("tries again once the cooldown has passed", () => {
    expect(
      planSwitchPoll({
        ...STOPPED,
        switchOn: true,
        previousSwitchOn: true,
        startBlockedUntil: NOW - 1,
      }),
    ).toMatchObject({ action: "start" });
  });

  it("lets a deliberate OFF→ON jump the cooldown", () => {
    expect(
      planSwitchPoll({
        ...STOPPED,
        switchOn: true,
        previousSwitchOn: false,
        startBlockedUntil: NOW + SWITCH_POLL_START_COOLDOWN_MS,
      }),
    ).toMatchObject({ action: "start", reason: "switch_turned_on" });
  });

  it("lets a re-arm that landed between two ticks jump the cooldown too", () => {
    expect(
      planSwitchPoll({
        ...STOPPED,
        switchOn: true,
        previousSwitchOn: true,
        previousSwitchChangedAt: "2026-09-09T12:00:00.000Z",
        switchChangedAt: "2026-09-09T12:00:03.000Z",
        startBlockedUntil: NOW + SWITCH_POLL_START_COOLDOWN_MS,
      }),
    ).toMatchObject({ action: "start", reason: "switch_turned_on" });
  });
});

/* ------------------------------------------------------------------ */
/* durable liveness signal                                             */
/* ------------------------------------------------------------------ */

/** Minimal in-memory stand-in for the AdminWorkerMemory table. */
function fakePrisma() {
  const rows = new Map<string, { memoryValue: unknown; updatedAt: Date }>();
  const prisma = {
    rows,
    adminWorkerMemory: {
      findUnique: async ({
        where,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
      }) => rows.get(where.memoryType_memoryKey.memoryKey) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
        create: { memoryValue: unknown };
        update: { memoryValue?: unknown };
      }) => {
        const key = where.memoryType_memoryKey.memoryKey;
        const existing = rows.get(key);
        const value = existing ? (update.memoryValue ?? existing.memoryValue) : create.memoryValue;
        rows.set(key, { memoryValue: value, updatedAt: new Date() });
        return { memoryValue: value };
      },
      delete: async ({
        where,
      }: {
        where: { memoryType_memoryKey: { memoryType: string; memoryKey: string } };
      }) => {
        rows.delete(where.memoryType_memoryKey.memoryKey);
        return {};
      },
    },
  };
  return prisma as unknown as Parameters<typeof writeHostPresence>[0] & { rows: typeof rows };
}

const PRESENCE = {
  runtimeId: "local-macbook-123-abc",
  hostLabel: "MacBook Pro · darwin arm64",
  pid: 4242,
  origin: "LOCAL_MACBOOK" as const,
  runState: "running" as const,
  workerRunning: true,
  workerStartedAt: new Date(NOW).toISOString(),
  switchOn: true,
  failureReason: null,
  leaseHeldElsewhere: false,
  intervalMs: SWITCH_POLL_INTERVAL_MS,
};

describe("host presence — is the MAC runtime alive", () => {
  it("lives in the existing worker.execution.* memory namespace (no new table)", () => {
    expect(HOST_PRESENCE_KEY).toBe("worker.execution.host");
  });

  it("survives a few missed ticks before it reads as gone", () => {
    expect(HOST_PRESENCE_STALE_MS).toBeGreaterThan(SWITCH_POLL_INTERVAL_MS * 3);
  });

  it("round-trips a fresh row as alive, with the freshness contract inside it", async () => {
    const prisma = fakePrisma();
    await writeHostPresence(prisma, PRESENCE);
    const status = await readHostPresence(prisma);
    expect(status.known).toBe(true);
    expect(status.alive).toBe(true);
    expect(status.ageMs ?? 0).toBeLessThan(5_000);
    expect(status.presence).toMatchObject({
      runtimeId: PRESENCE.runtimeId,
      hostLabel: PRESENCE.hostLabel,
      workerRunning: true,
      switchOn: true,
      intervalMs: SWITCH_POLL_INTERVAL_MS,
      staleAfterMs: HOST_PRESENCE_STALE_MS,
    });
    expect(describeHostPresence(status)).toMatch(/alive.*worker running/i);
  });

  it("reports the Mac as not answering once the row ages past staleAfterMs", async () => {
    const prisma = fakePrisma();
    await writeHostPresence(prisma, PRESENCE);
    const row = prisma.rows.get(HOST_PRESENCE_KEY)!;
    (row.memoryValue as Record<string, unknown>).at = new Date(
      Date.now() - HOST_PRESENCE_STALE_MS - 5_000,
    ).toISOString();
    const status = await readHostPresence(prisma);
    expect(status.known).toBe(true);
    expect(status.alive).toBe(false);
    expect(describeHostPresence(status)).toMatch(/not answering/i);
  });

  it("distinguishes 'no host has checked in' from 'the database could not be read'", async () => {
    const empty = await readHostPresence(fakePrisma());
    expect(empty).toMatchObject({ presence: null, alive: false, known: true });
    expect(describeHostPresence(empty)).toMatch(/not running/i);

    const broken = {
      adminWorkerMemory: {
        findUnique: async () => {
          throw new Error("Can't reach database server at `proxy.rlwy.net`:12345");
        },
      },
    } as unknown as Parameters<typeof readHostPresence>[0];
    const status = await readHostPresence(broken);
    // known:false — an outage must never render as "the Mac is switched off".
    expect(status).toMatchObject({ known: false, alive: false });
    expect(status.error).toMatch(/reach database server/i);
    expect(describeHostPresence(status)).toMatch(/unknown/i);
  });

  it("only the owning runtime clears its presence row", async () => {
    const prisma = fakePrisma();
    await writeHostPresence(prisma, PRESENCE);
    await clearHostPresence(prisma, "some-other-runtime");
    expect((await readHostPresence(prisma)).presence).not.toBeNull();
    await clearHostPresence(prisma, PRESENCE.runtimeId);
    expect((await readHostPresence(prisma)).presence).toBeNull();
  });

  it("never carries a stack trace or a connection string into the row", () => {
    const built = buildHostPresence({
      ...PRESENCE,
      failureReason: "x".repeat(5_000),
    });
    expect(built.failureReason?.length).toBeLessThanOrEqual(400);
  });
});

/* ------------------------------------------------------------------ */
/* the host actually wires it up                                       */
/* ------------------------------------------------------------------ */

const HOST_SOURCE = readFileSync(join(process.cwd(), "scripts/local-worker-host.ts"), "utf8");

describe("scripts/local-worker-host.ts applies the poll", () => {
  it("schedules a reconcile tick on the poll interval, unref'd", () => {
    expect(HOST_SOURCE).toMatch(/reconcileSwitchTick\(\)/);
    expect(HOST_SOURCE).toMatch(/leaseRenewDelayMs\(SWITCH_POLL_INTERVAL_MS\)/);
    expect(HOST_SOURCE).toMatch(/reconcileTimer\.unref\(\)/);
  });

  it("stops the timer on shutdown", () => {
    expect(HOST_SOURCE).toMatch(/if \(reconcileTimer\) clearTimeout\(reconcileTimer\)/);
  });

  it("reuses the existing start path — lease claim then startWorkerChild", () => {
    const start = HOST_SOURCE.slice(
      HOST_SOURCE.indexOf("async function startFromSwitchPoll"),
      HOST_SOURCE.indexOf("async function stopFromSwitchPoll"),
    );
    expect(start).toMatch(/acquireExecutionLease\(/);
    expect(start).toMatch(/startWorkerChild\(\)/);
    // The switch row is already ON: rewriting it would erase who set it (the
    // phone), and would make the host the author of a decision it only obeyed.
    expect(start).not.toMatch(/setMasterSwitch\(/);
  });

  it("reuses the existing stop path — child, brain, lease", () => {
    const stop = HOST_SOURCE.slice(
      HOST_SOURCE.indexOf("async function stopFromSwitchPoll"),
      HOST_SOURCE.indexOf("async function refreshLivenessSignals"),
    );
    expect(stop).toMatch(/stopWorkerChild\(/);
    expect(stop).toMatch(/shutdownLocalBrain\(\)/);
    expect(stop).toMatch(/releaseExecutionLease\(/);
    expect(stop).not.toMatch(/setMasterSwitch\(/);
  });

  it("keeps exactly one master-switch reader driving the lifecycle", () => {
    const leaseTick = HOST_SOURCE.slice(
      HOST_SOURCE.indexOf("const leaseTick = async"),
      HOST_SOURCE.indexOf("scheduleLeaseTick();"),
    );
    expect(leaseTick).not.toMatch(/readMasterSwitch\(/);
    expect(leaseTick).toMatch(/renewExecutionLease\(/);
  });

  it("writes both liveness signals from the tick, and clears presence on quit", () => {
    const liveness = HOST_SOURCE.slice(
      HOST_SOURCE.indexOf("async function refreshLivenessSignals"),
      HOST_SOURCE.indexOf("let reconcileInFlight"),
    );
    expect(liveness).toMatch(/writeHeartbeat\(prisma\)/);
    expect(liveness).toMatch(/writeHostPresence\(prisma/);
    expect(HOST_SOURCE).toMatch(/clearHostPresence\(prisma, RUNTIME_ID\)/);
  });

  it("never treats an unreadable switch as OFF", () => {
    expect(HOST_SOURCE).toMatch(/const switchKnown = status\?\.switch\.known === true;/);
  });
});

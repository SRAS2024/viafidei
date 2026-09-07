/**
 * What a worker child's exit code means to the local host.
 *
 * scripts/run-worker.ts exits with a distinct code for every non-crash, and the
 * host used to treat 0 and 3 as crashes: a clean operator stop rendered as
 * "crashed", and a lease held by another Mac burned the five-restart budget in
 * ~30 s and ended in a misleading "gave up" (audit LH-09). Only a genuine crash
 * — or a database outage, deferred — may restart.
 *
 * Pins the pure decision AND that scripts/local-worker-host.ts applies it, so a
 * future edit cannot quietly reintroduce a restart loop or a silent "off" for a
 * lease that another runtime holds.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  describeWorkerExitKind,
  interpretWorkerExit,
  LEASE_HELD_ELSEWHERE_MESSAGE,
} from "@/lib/admin-worker/worker-exit";

const base = { signal: null, wasStopping: false, switchOn: null as boolean | null };

describe("interpretWorkerExit", () => {
  it("host-initiated stop: off, no restart, nothing to report", () => {
    const plan = interpretWorkerExit({ ...base, code: null, signal: "SIGTERM", wasStopping: true });
    expect(plan).toMatchObject({
      kind: "stopped",
      restart: false,
      runState: "off",
      failureReason: null,
      leaseHeldElsewhere: false,
    });
  });

  it("exit 0: clean operator stop — never a restart, never 'crashed'", () => {
    const plan = interpretWorkerExit({ ...base, code: 0 });
    expect(plan).toMatchObject({ kind: "clean_stop", restart: false, runState: "off" });
    expect(plan.failureReason).toBeNull();
  });

  it("exit 3 with the switch read OFF: the operator's own stop, no restart", () => {
    const plan = interpretWorkerExit({ ...base, code: 3, switchOn: false });
    expect(plan).toMatchObject({
      kind: "refused",
      restart: false,
      runState: "off",
      leaseHeldElsewhere: false,
    });
    expect(plan.failureReason).toBeNull();
  });

  it("exit 3 with the switch ON (or unreadable): the lease is held elsewhere", () => {
    for (const switchOn of [true, null]) {
      const plan = interpretWorkerExit({ ...base, code: 3, switchOn });
      expect(plan).toMatchObject({
        kind: "refused",
        restart: false,
        runState: "failed",
        leaseHeldElsewhere: true,
      });
      expect(plan.failureReason).toContain("another runtime holds the execution lease");
    }
  });

  it("exit 4: a database outage is restartable and names the database", () => {
    const plan = interpretWorkerExit({
      ...base,
      code: 4,
      databaseHost: "db.example:5432/viafidei",
    });
    expect(plan).toMatchObject({
      kind: "db_unreachable",
      restart: true,
      runState: "crashed",
      leaseHeldElsewhere: false,
    });
    expect(plan.failureReason).toContain("db.example:5432/viafidei");
  });

  it("exit 5: the lease was taken mid-run — surface it, never restart", () => {
    const plan = interpretWorkerExit({ ...base, code: 5 });
    expect(plan).toMatchObject({
      kind: "lease_taken",
      restart: false,
      runState: "failed",
      leaseHeldElsewhere: true,
    });
    expect(plan.failureReason).toContain("another runtime holds the execution lease");
  });

  it("any other non-zero code is a genuine crash and may restart", () => {
    for (const code of [1, 2, 7, 137]) {
      expect(interpretWorkerExit({ ...base, code })).toMatchObject({
        kind: "crashed",
        restart: true,
        runState: "crashed",
      });
    }
  });

  it("every kind has an operator-facing phrase", () => {
    for (const kind of [
      "stopped",
      "clean_stop",
      "refused",
      "db_unreachable",
      "lease_taken",
      "crashed",
    ] as const) {
      expect(describeWorkerExitKind(kind).length).toBeGreaterThan(0);
    }
  });

  it("the lease message tells the operator what to do and promises no change", () => {
    expect(LEASE_HELD_ELSEWHERE_MESSAGE).toContain("Switch the Admin Worker OFF");
    expect(LEASE_HELD_ELSEWHERE_MESSAGE).toContain("nothing was changed here");
  });
});

describe("scripts/local-worker-host.ts applies the plan", () => {
  const src = readFileSync(join(process.cwd(), "scripts/local-worker-host.ts"), "utf8");

  it("decides the exit from worker-exit.ts, not an ad-hoc code check", () => {
    expect(src).toContain("interpretWorkerExit(");
    // The old classifier only knew stopped/db_unreachable/refused/crashed.
    expect(src).not.toContain("classifyWorkerExit(");
  });

  it("only restarts when the plan allows it", () => {
    expect(src).toContain("if (!plan.restart) return;");
  });

  it("carries leaseHeldElsewhere into the dashboard status payload", () => {
    expect(src).toMatch(/leaseHeldElsewhere: host\.leaseHeldElsewhere/);
  });

  it("a host-detected lease hand-off is reported, not shown as a plain 'off'", () => {
    // stopWorkerChild leaves runState "off" with no reason; the lease-tick path
    // must overwrite that with the same message the exit-5 path uses.
    const tick = src.slice(src.indexOf('if (renewed === "lost")'));
    expect(tick).toContain("host.leaseHeldElsewhere = true");
    expect(tick).toContain("LEASE_HELD_ELSEWHERE_MESSAGE");
  });
});

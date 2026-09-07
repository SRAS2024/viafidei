/**
 * What a worker child's exit code means to the local host, as one pure
 * decision (scripts/local-worker-host.ts applies it).
 *
 * scripts/run-worker.ts exits with a distinct code for every non-crash:
 *   0 — the loop stopped on purpose (the master switch read OFF);
 *   3 — refused at boot: the switch was OFF, or another runtime already held
 *       the execution lease;
 *   4 — the database could not be read at boot (outage, not a crash);
 *   5 — the execution lease was taken by another runtime mid-run.
 * Anything else is a crash. The host used to treat 0 and 3 as crashes (a
 * clean OFF rendered as "crashed", and a lease held by another Mac burned
 * the five-restart budget in ~30 s and ended in "gave up"), and 5 as a plain
 * crash. Only a genuine crash — or a DB outage, deferred — may restart.
 */

export type WorkerExitKind =
  | "stopped"
  | "clean_stop"
  | "refused"
  | "db_unreachable"
  | "lease_taken"
  | "crashed";

export type WorkerExitRunState = "off" | "crashed" | "failed";

export interface WorkerExitPlan {
  kind: WorkerExitKind;
  /** May the host restart the child (crash: subject to the switch; outage: deferred)? */
  restart: boolean;
  runState: WorkerExitRunState;
  failureReason: string | null;
  /** True when the reason the worker is not running is that another runtime executes. */
  leaseHeldElsewhere: boolean;
}

export const LEASE_HELD_ELSEWHERE_MESSAGE =
  "another runtime holds the execution lease — this computer is not executing the Admin Worker. " +
  "Switch the Admin Worker OFF on the computer that is running it first; nothing was changed here.";

export function interpretWorkerExit(input: {
  code: number | null;
  signal: string | null;
  /** The host itself asked the child to stop. */
  wasStopping: boolean;
  /** The master switch as read after the exit: null when it could not be read. */
  switchOn: boolean | null;
  /** Host[:port]/db of the configured database, for the outage message. */
  databaseHost?: string | null;
}): WorkerExitPlan {
  const { code, wasStopping, switchOn } = input;
  if (wasStopping) {
    return {
      kind: "stopped",
      restart: false,
      runState: "off",
      failureReason: null,
      leaseHeldElsewhere: false,
    };
  }
  if (code === 0) {
    // The loop saw OFF and left cleanly (or a bounded --max-jobs run ended).
    return {
      kind: "clean_stop",
      restart: false,
      runState: "off",
      failureReason: null,
      leaseHeldElsewhere: false,
    };
  }
  if (code === 4) {
    return {
      kind: "db_unreachable",
      restart: true,
      runState: "crashed",
      failureReason:
        `The worker could not reach the database at ${input.databaseHost ?? "?"} and exited — ` +
        `it will be restarted automatically when the database answers again.`,
      leaseHeldElsewhere: false,
    };
  }
  if (code === 5) {
    return {
      kind: "lease_taken",
      restart: false,
      runState: "failed",
      failureReason: `The local worker stopped: ${LEASE_HELD_ELSEWHERE_MESSAGE}`,
      leaseHeldElsewhere: true,
    };
  }
  if (code === 3) {
    // Refused at boot. With the switch OFF that is the operator's own stop
    // (nothing to report); with it ON (or unreadable) the only other refusal
    // is a live lease on another runtime.
    if (switchOn === false) {
      return {
        kind: "refused",
        restart: false,
        runState: "off",
        failureReason: null,
        leaseHeldElsewhere: false,
      };
    }
    return {
      kind: "refused",
      restart: false,
      runState: "failed",
      failureReason: `The worker refused to start: ${LEASE_HELD_ELSEWHERE_MESSAGE}`,
      leaseHeldElsewhere: true,
    };
  }
  return {
    kind: "crashed",
    restart: true,
    runState: "crashed",
    failureReason: null,
    leaseHeldElsewhere: false,
  };
}

/** Short operator-facing phrase for the host log line. */
export function describeWorkerExitKind(kind: WorkerExitKind): string {
  switch (kind) {
    case "stopped":
      return "stopped by this host";
    case "clean_stop":
      return "clean stop (the worker read the master switch OFF)";
    case "refused":
      return "refused to start (switch OFF or lease held by another runtime)";
    case "db_unreachable":
      return "database unreachable";
    case "lease_taken":
      return "execution lease taken by another runtime";
    case "crashed":
      return "crashed";
  }
}

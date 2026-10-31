/**
 * What a worker child's exit code means to the local host, as one pure
 * decision (scripts/local-worker-host.ts applies it).
 *
 * scripts/run-worker.ts exits with a distinct code for every non-crash:
 *   0 — the loop stopped on purpose (the master switch read OFF);
 *   3 — refused at boot: the switch was OFF, or another runtime already held
 *       the execution lease;
 *   4 — the database failed at boot, reading the switch or reading/writing
 *       the lease (an outage, not a crash);
 *   5 — the execution lease was taken by another runtime mid-run;
 *   6 — the worker lost its supervisor: its log pipe closed or the host pid
 *       vanished, so it stopped rather than run on as an orphan.
 * Anything else is a crash. The host used to treat 0 and 3 as crashes (a
 * clean OFF rendered as "crashed", and a lease held by another Mac burned
 * the five-restart budget in ~30 s and ended in "gave up"), and 5 as a plain
 * crash. Only a genuine crash, a lost supervisor — or a DB outage, deferred —
 * may restart.
 */

/** Exit code the worker uses when its log pipe or its host went away. */
export const WORKER_EXIT_SUPERVISOR_LOST = 6;

export type WorkerExitKind =
  | "stopped"
  | "clean_stop"
  | "refused"
  | "db_unreachable"
  | "lease_taken"
  | "supervisor_lost"
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
  if (code === WORKER_EXIT_SUPERVISOR_LOST) {
    // The worker saw its log pipe close (or the host pid vanish). If this host
    // is reading the exit, it is alive after all — a restart gives the worker
    // fresh pipes, under the same backoff as a crash.
    return {
      kind: "supervisor_lost",
      restart: true,
      runState: "crashed",
      failureReason: null,
      leaseHeldElsewhere: false,
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

/**
 * Why scripts/run-worker.ts declined to run, as a value. The exit code is
 * derived from it (refusalExitCode), never from the wording of a message.
 */
export type WorkerRefusal =
  /** Started without `--origin local` (and without the remote override). */
  | "not_local"
  /** The master switch reads OFF. */
  | "switch_off"
  /** Another runtime holds a live execution lease. */
  | "lease_held_elsewhere"
  /** The switch or the lease could not be read or written: an outage. */
  | "db_unreachable";

/**
 * 4 for an outage — the host waits for the database and restarts the worker —
 * and 3 for every refusal that is an answer (switch OFF, lease elsewhere).
 * A database error while claiming the lease used to exit 3, which the host
 * reads as "another computer is executing" and never retries.
 */
export function refusalExitCode(refusal: WorkerRefusal): 3 | 4 {
  return refusal === "db_unreachable" ? 4 : 3;
}

/**
 * Exit 3 again, once the host has tried to read the switch. Read OFF: the
 * operator's own stop. Read ON: another runtime holds the lease. NOT read: the
 * database is failing right now, so nothing is known about the lease either —
 * wait for it and retry, exactly as for exit 4, instead of parking the runtime
 * as "lease held elsewhere" until an operator re-arms it.
 */
export function refineRefusedExit(input: {
  switchKnown: boolean;
  switchOn: boolean;
  databaseHost?: string | null;
}): WorkerExitPlan {
  if (!input.switchKnown) {
    return {
      kind: "db_unreachable",
      restart: true,
      runState: "crashed",
      failureReason:
        `The worker declined to start and the database at ${input.databaseHost ?? "?"} cannot be ` +
        `read to say why — it will be retried when the database answers again.`,
      leaseHeldElsewhere: false,
    };
  }
  return interpretWorkerExit({
    code: 3,
    signal: null,
    wasStopping: false,
    switchOn: input.switchOn,
  });
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
    case "supervisor_lost":
      return "it lost its log pipe or its host and stopped";
    case "crashed":
      return "crashed";
  }
}

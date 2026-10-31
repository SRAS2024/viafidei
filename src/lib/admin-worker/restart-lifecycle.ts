/**
 * The local host's automatic (re)starts of its worker child: the one armed
 * restart (a crash backoff, or a wait for the database), the decisions that
 * arm it, and the guard that keeps any of them from undoing an OFF.
 *
 * scripts/local-worker-host.ts owns the processes (spawn, kill), the switch
 * poll and the control API, and drives this module; the tests run it with a
 * fake host state and fake timers.
 *
 * OFF means OFF (spec §4). Every automatic restart reads the durable switch
 * before it acts, and on a hung database that read takes up to 20 s. An OFF
 * can land inside that window, and when the database cannot record it the
 * switch row still says ON. A stop used to cancel only a restart TIMER armed
 * at that instant, so a decision still waiting on its read armed one
 * afterwards, the row read ON once the database answered, and the worker ran
 * against production after an explicit OFF while the app said "Stopped
 * locally". Two facts close that:
 *
 *   - every stop bumps a counter, and a decision that began before the stop
 *     stands down when its read comes back (`ticket` / `mayStart`);
 *   - an OFF given on this host that the database has not recorded yet
 *     (`offNotRecorded`) outranks whatever the row says, for every decision
 *     that begins after it, and nothing is armed against it.
 */

import type { AdminWorkerLogInput } from "./logs";
import {
  degradedReason,
  formatDelay,
  restartDegraded,
  restartDelayMs,
  type RestartBackoff,
} from "./restart-backoff";
import type { HostRunState } from "./switch-poll";
import { refineRefusedExit } from "./worker-exit";

/** How long an automatic restart waits before reading an unreadable switch again. */
export const SWITCH_UNREADABLE_RETRY_MS = 30_000;
/** At most one WARN row an hour while a degraded runtime keeps retrying. */
export const DEGRADED_LOG_INTERVAL_MS = 60 * 60 * 1000;

/** What an automatic (re)start does once its switch read has come back. */
export type AutoRestartStep =
  /**
   * Something newer owns the lifecycle — a worker child exists, the host is
   * shutting down, or the host stopped the worker (an OFF, a lost lease)
   * while this decision waited. Do nothing; the stop path set the state.
   */
  | "stand_down"
  /** The switch reads OFF, or the operator switched OFF here and the database has not recorded it. */
  | "stay_off"
  /** The switch could not be read: look again later (an outage is not OFF). */
  | "wait"
  /** The switch is ON and nothing has stopped the worker since: (re)start it. */
  | "start";

/** Pure: no clock, no database, no process. */
export function planAutoRestart(input: {
  shuttingDown: boolean;
  childRunning: boolean;
  /** A stop happened after this decision began (its ticket is stale). */
  stoppedSinceDecisionBegan: boolean;
  /** An OFF given on this host that the database has not recorded yet. */
  offNotRecorded: boolean;
  switchKnown: boolean;
  switchOn: boolean;
}): AutoRestartStep {
  if (input.shuttingDown || input.childRunning || input.stoppedSinceDecisionBegan) {
    return "stand_down";
  }
  // The local OFF is the operator's latest word; a row that has not caught up
  // with it — or cannot be read at all — does not overrule it.
  if (input.offNotRecorded) return "stay_off";
  if (!input.switchKnown) return "wait";
  return input.switchOn ? "start" : "stay_off";
}

/** The supervisor state this module reads and writes (the host's HostState). */
export interface RestartHostState {
  runState: HostRunState;
  /** The supervised worker child, or null when none exists. */
  readonly child: unknown;
  /** Consecutive restarts in the current crash streak. */
  restarts: number;
  /** When the armed restart fires (epoch ms), or null when none is armed. */
  nextRestartAt: number | null;
  degraded: boolean;
  degradedLoggedAt: number;
  failureReason: string | null;
  leaseHeldElsewhere: boolean;
  /** Paths between "the child exited" and "restarted, or stays off"; the switch poll stands aside while > 0. */
  pendingStarts: number;
  /** The operator switched OFF here and the database has not recorded it yet. */
  offNotRecorded: boolean;
}

export interface RestartLifecycleDeps {
  host: RestartHostState;
  backoff: RestartBackoff;
  /** The durable switch, bounded: an unreadable or hung database reads as unknown, never as OFF. */
  readSwitch: () => Promise<{ on: boolean; known: boolean }>;
  /** Spawn the worker child. */
  startWorker: () => void;
  shuttingDown: () => boolean;
  /** One line for the host log. */
  log: (line: string) => void;
  /** The state changed: push it to every surface. */
  statusChanged: () => void;
  /** One audit row; its failure is swallowed here. */
  audit: (entry: AdminWorkerLogInput) => Promise<unknown>;
  /** Host[:port]/db of the configured database, for operator messages. */
  databaseHost: () => string | null;
  runtimeId: string;
  /** Where the runtime log is, for the degraded message (null when off). */
  logHint?: string | null;
  now?: () => number;
  random?: () => number;
}

export interface RestartLifecycle {
  /** A (re)start is armed right now. */
  readonly armed: boolean;
  /**
   * Arm the one deferred (re)start, replacing any other. When it fires it
   * re-reads the switch (resumeIfSwitchOn) instead of starting blindly.
   * Refused (false) while an OFF given here is not recorded.
   */
  schedule(delayMs: number): boolean;
  /** Disarm the pending restart; true when one was armed. */
  cancel(): boolean;
  /**
   * Every stop calls this first: it cancels the armed restart (true when one
   * was) and makes every decision still waiting on a switch read stand down.
   */
  noteStop(): boolean;
  /** Taken by any path that may start the worker, before its first await. */
  ticket(): number;
  /** May the start holding `ticket` go ahead now: no stop since, no unrecorded OFF, no child, not shutting down? */
  mayStart(ticket: number): boolean;
  /** Run a lifecycle decision while holding it, so the switch poll stands aside. */
  hold(work: () => Promise<void>): void;
  /**
   * The worker exited on its own (a crash, a lost log pipe, a spawn failure,
   * a hung-worker stop): restart it with capped backoff for as long as the
   * switch is ON. `ticket` defaults to now; the hung-worker path passes the
   * one it took as its own stop began.
   */
  afterCrash(exit: { code: number | null; signal: string | null }, ticket?: number): Promise<void>;
  /** Exit 3, refused at boot: the switch tells an operator OFF from a lease held elsewhere. */
  afterRefusal(): Promise<void>;
  /** Exit 4, the database failed at boot: an outage, not a crash — wait and resume. */
  afterOutage(): void;
  /** An armed restart fired: start the worker if the switch is still ON. */
  resumeIfSwitchOn(): Promise<void>;
}

export function createRestartLifecycle(deps: RestartLifecycleDeps): RestartLifecycle {
  const { host } = deps;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stops = 0;

  const releaseHold = () => {
    host.pendingStarts = Math.max(0, host.pendingStarts - 1);
  };

  function cancel(): boolean {
    if (!timer) return false;
    clearTimeout(timer);
    timer = null;
    host.nextRestartAt = null;
    releaseHold();
    return true;
  }

  function schedule(delayMs: number): boolean {
    cancel();
    if (host.offNotRecorded) return false;
    host.pendingStarts += 1;
    host.nextRestartAt = now() + delayMs;
    const armed = setTimeout(() => {
      timer = null;
      host.nextRestartAt = null;
      releaseHold();
      if (deps.shuttingDown() || host.child != null) return;
      void resumeIfSwitchOn();
    }, delayMs);
    (armed as { unref?: () => void }).unref?.();
    timer = armed;
    return true;
  }

  function stepFor(ticket: number, master: { on: boolean; known: boolean }): AutoRestartStep {
    return planAutoRestart({
      shuttingDown: deps.shuttingDown(),
      childRunning: host.child != null,
      stoppedSinceDecisionBegan: stops !== ticket,
      offNotRecorded: host.offNotRecorded,
      switchKnown: master.known,
      switchOn: master.on,
    });
  }

  function stayOff(line: string | null): void {
    host.runState = "off";
    host.failureReason = null;
    host.degraded = false;
    if (line) deps.log(line);
    deps.statusChanged();
  }

  async function resumeIfSwitchOn(): Promise<void> {
    // Held while this decides, so the switch poll does not start the same
    // worker from the other side of the await.
    host.pendingStarts += 1;
    try {
      const ticket = stops;
      const master = await deps.readSwitch();
      switch (stepFor(ticket, master)) {
        case "stand_down":
          return;
        case "wait":
          schedule(SWITCH_UNREADABLE_RETRY_MS);
          return;
        case "stay_off":
          stayOff(
            host.offNotRecorded
              ? "switched OFF here (not yet recorded in the database) — the pending restart stands down"
              : "the master switch is OFF — the pending restart stands down",
          );
          return;
        case "start":
          // A degraded runtime keeps saying so until it has stayed up.
          if (!host.degraded) host.failureReason = null;
          host.leaseHeldElsewhere = false;
          deps.log("the master switch is still ON — restarting the worker");
          deps.startWorker();
          return;
      }
    } finally {
      releaseHold();
    }
  }

  async function afterCrash(
    exit: { code: number | null; signal: string | null },
    ticket = stops,
  ): Promise<void> {
    // Never hand the work back to Railway (spec §5: no cloud failover).
    const master = await deps.readSwitch();
    switch (stepFor(ticket, master)) {
      case "stand_down":
        return;
      case "stay_off":
        stayOff(null);
        return;
      case "wait":
        // The database is unreachable: that is an outage, not a crash streak.
        // Wait for it to come back and re-check.
        host.runState = "crashed";
        host.failureReason =
          "The worker stopped and the database cannot be reached right now — it will be restarted when the database answers again.";
        deps.log(host.failureReason);
        deps.statusChanged();
        schedule(SWITCH_UNREADABLE_RETRY_MS);
        return;
      case "start":
        break;
    }

    host.restarts += 1;
    const delayMs = restartDelayMs(host.restarts, deps.backoff);
    const degraded = restartDegraded(host.restarts);
    const enteringDegraded = degraded && !host.degraded;
    host.runState = "crashed";
    host.degraded = degraded;
    host.failureReason = degraded
      ? degradedReason({
          consecutive: host.restarts,
          code: exit.code,
          signal: exit.signal,
          nextDelayMs: delayMs,
          logHint: deps.logHint ?? null,
        })
      : null;
    deps.log(
      `master switch is still ON — restarting the local worker in ${formatDelay(delayMs)} ` +
        `(restart #${host.restarts}${degraded ? ", degraded: it keeps retrying" : ""})`,
    );
    schedule(delayMs);
    deps.statusChanged();

    // Every restart of a young streak, one ERROR row when it turns degraded,
    // then at most one WARN an hour.
    const at = now();
    if (degraded && !enteringDegraded && at - host.degradedLoggedAt < DEGRADED_LOG_INTERVAL_MS) {
      return;
    }
    if (degraded) host.degradedLoggedAt = at;
    await deps
      .audit({
        category: "ERROR",
        severity: enteringDegraded ? "ERROR" : "WARN",
        eventName: degraded ? "local_worker_degraded" : "local_worker_restart",
        message: degraded
          ? `${host.failureReason} Execution was NOT moved to the cloud.`
          : `Local Admin Worker runtime exited (code=${exit.code ?? "null"}, signal=${exit.signal ?? "none"}) and is being restarted on the operator MacBook in ${formatDelay(delayMs)}. Execution was NOT moved to the cloud.`,
        safeMetadata: {
          restarts: host.restarts,
          nextDelayMs: delayMs,
          degraded,
          runtimeId: deps.runtimeId,
        },
      })
      .catch(() => undefined);
  }

  async function afterRefusal(): Promise<void> {
    const ticket = stops;
    const master = await deps.readSwitch();
    const step = stepFor(ticket, master);
    if (step === "stand_down") return; // a newer child, a shutdown or a stop owns the state
    // Only the durable switch tells an operator OFF (nothing to report) from a
    // live lease on another computer (surface it, never restart). An
    // unreadable switch is neither: wait for the database and retry. An OFF
    // given here counts as a switch read OFF.
    const refined = refineRefusedExit({
      switchKnown: step !== "wait",
      switchOn: step === "start",
      databaseHost: deps.databaseHost(),
    });
    host.runState = refined.runState;
    host.failureReason = refined.failureReason;
    host.leaseHeldElsewhere = refined.leaseHeldElsewhere;
    if (refined.runState === "off") {
      deps.log("the master switch is OFF — the worker declined to start (operator stop)");
    }
    if (refined.kind === "db_unreachable" && refined.failureReason) {
      deps.log(refined.failureReason);
      schedule(SWITCH_UNREADABLE_RETRY_MS + Math.round(random() * SWITCH_UNREADABLE_RETRY_MS));
    }
    deps.statusChanged();
  }

  function afterOutage(): void {
    // It could not read the switch or claim the lease: it does not lengthen the
    // crash streak; wait for the database and resume (the switch is durable,
    // so ON survives).
    if (schedule(SWITCH_UNREADABLE_RETRY_MS + Math.round(random() * SWITCH_UNREADABLE_RETRY_MS))) {
      return;
    }
    stayOff(null); // an OFF given here, not recorded yet: nothing is armed against it
  }

  return {
    get armed() {
      return timer !== null;
    },
    schedule,
    cancel,
    noteStop() {
      stops += 1;
      return cancel();
    },
    ticket: () => stops,
    mayStart: (ticket) =>
      !deps.shuttingDown() && host.child == null && stops === ticket && !host.offNotRecorded,
    hold(work) {
      // Incremented synchronously, before the first await, or the poll could slip in.
      host.pendingStarts += 1;
      void work()
        .catch((err: unknown) =>
          deps.log(`restart decision failed: ${err instanceof Error ? err.message : String(err)}`),
        )
        // Whatever the decision was, this path no longer holds the lifecycle:
        // a restart is armed (counted separately) or nothing more happens here.
        .finally(releaseHold);
    },
    afterCrash,
    afterRefusal,
    afterOutage,
    resumeIfSwitchOn,
  };
}

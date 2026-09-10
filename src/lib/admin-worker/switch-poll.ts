/**
 * Reconciling the durable master switch with what this Mac is actually doing.
 *
 * The master switch is a durable row in Postgres (execution-host.ts), and it
 * can be flipped by something that is not this process: the operator's iPhone
 * writing the row directly, another copy of the app, or `npm run worker:local`.
 * Until this module existed the local host read that row only at startup and on
 * child-exit paths, so setting the switch ON from anywhere else changed nothing
 * until the app was relaunched — the remote toggle was inert.
 *
 * `planSwitchPoll` is the whole decision, as a pure function, so the rules can
 * be pinned by tests without a database or a process tree. The host feeds it
 * the switch it just read plus its own supervisor state, and gets back exactly
 * one of: start the worker, stop it, or do nothing.
 *
 * The rules that matter, in the order they bite:
 *
 *   1. An UNREADABLE switch is not OFF. `known: false` means the database did
 *      not answer; reading that as OFF would stop a healthy worker over one bad
 *      round-trip (the same fail-open rule lease renewal follows).
 *   2. Nothing is done when the world is already correct — no start when a
 *      child is running, no stop when nothing is running, and no log line
 *      either. A quiet tick is the normal case, several times a minute.
 *   3. The poll never competes with the exit/restart handling. While any
 *      existing path intends to (re)start the child — a crash backoff, a
 *      deferred resume after a database outage — the poll stands aside.
 *   4. A runtime that GAVE UP (five crashes in a row, a spawn error, a lease
 *      held by another computer) is not restarted by a switch that is merely
 *      still ON. It takes a fresh OFF→ON edge — the operator deliberately
 *      re-arming, which is what the give-up message asks for — and that edge
 *      can only happen once per operator action, so it can never become a
 *      crash loop at poll cadence. The edge is recognised either by watching
 *      the value cross, or by `changedAt` moving, so a thumb that flips OFF
 *      and back ON faster than one poll interval still re-arms the runtime.
 *   5. A refused start (lease held elsewhere, misconfigured database) puts the
 *      poll on a cooldown instead of retrying every few seconds.
 */

/** Supervisor states scripts/local-worker-host.ts moves through. */
export type HostRunState = "off" | "starting" | "running" | "stopping" | "crashed" | "failed";

/**
 * How often the durable switch is reconciled with reality.
 *
 * Chosen at 7 s: the operator flips the switch on a phone and watches this Mac
 * react, so anything slower than ~10 s reads as broken, while anything faster
 * buys nothing — the worker takes seconds to boot anyway. It is deliberately
 * not a multiple of the 2 s dashboard tick or the 20 s lease renewal, so the
 * three never convoy onto the same instant of the proxy link. The cost is one
 * cached status read (switch + lease) per tick: ~9 round-trips a minute on a
 * link that already carries lease renewals and a per-pass ledger.
 */
export const SWITCH_POLL_INTERVAL_MS = 7_000;

/**
 * A status read from within this window is reused instead of re-read, so a
 * poll landing just after the dashboard's own refresh costs nothing. Worst-case
 * actuation latency is therefore SWITCH_POLL_INTERVAL_MS + this ≈ 9 s.
 */
export const SWITCH_POLL_CACHE_MS = 2_000;

/**
 * After a start is refused (another runtime holds the execution lease, or the
 * database this host is pointed at is not the one it may work against), wait
 * this long before trying again. Without it a permanently-refusing condition
 * would produce a claim attempt and a log line every tick.
 */
export const SWITCH_POLL_START_COOLDOWN_MS = 60_000;

export type SwitchPollAction = "none" | "start" | "stop";

export type SwitchPollReason =
  /** The host is shutting down; nothing may be started or stopped from here. */
  | "shutting_down"
  /** The database did not answer — NOT the same thing as OFF (fail open). */
  | "switch_unknown"
  /** An operator OFF is still waiting to be recorded durably; the lease tick owns it. */
  | "pending_durable_off"
  /** Some existing path (crash backoff, deferred resume) is already starting the child. */
  | "start_pending"
  /** A start was refused recently; waiting out the cooldown. */
  | "start_cooldown"
  /** The child is mid-start or mid-stop; the transition owns the outcome. */
  | "transitioning"
  /** Switch ON and the worker is already running — the world is correct. */
  | "already_running"
  /** Switch OFF and nothing is running — the world is correct. */
  | "already_stopped"
  /** Gave up here; only a deliberate OFF→ON re-arms it. */
  | "failed_needs_operator"
  /** The switch was observed turning OFF→ON: an operator re-arm. */
  | "switch_turned_on"
  /** The switch is ON and no worker is running here. */
  | "switch_on_not_running"
  /** The switch is OFF and a worker is running here. */
  | "switch_turned_off";

export interface SwitchPollInput {
  /** Wall clock, injected so the cooldown is testable. */
  now: number;
  shuttingDown: boolean;
  /** False when the switch row could not be read (MasterSwitch.known). */
  switchKnown: boolean;
  switchOn: boolean;
  /**
   * The switch as the PREVIOUS poll read it, or null when it has never been
   * read successfully. Only used to recognise an OFF→ON edge.
   */
  previousSwitchOn: boolean | null;
  /**
   * `MasterSwitch.changedAt` as it reads right now, or null when the row has
   * never been written.
   *
   * The poll SAMPLES the switch, so it sees values and not events: an operator
   * who taps OFF and then ON inside one poll interval produces two writes but
   * only one observation, and the OFF→ON edge is invisible in the value alone.
   * That matters because the documented recovery for a runtime that gave up is
   * exactly that pair of taps, done as fast as a thumb moves. `setMasterSwitch`
   * stamps a fresh `changedAt` on every write, and nothing writes the row on a
   * timer — only the operator's console, the phone route and the CLI — so a
   * moved timestamp is a reliable "somebody deliberately set this" signal even
   * when the value it landed on is the one we already had.
   */
  switchChangedAt: string | null;
  /** `changedAt` as the PREVIOUS poll read it. */
  previousSwitchChangedAt: string | null;
  /** A supervised worker child process exists right now. */
  childRunning: boolean;
  runState: HostRunState;
  /** How many existing paths are between "child exited" and "started or gave up". */
  pendingStarts: number;
  /** An operator OFF that still has to be written to the database. */
  pendingDurableOff: boolean;
  /** Epoch ms until which starts are suppressed after a refusal, or null. */
  startBlockedUntil: number | null;
}

export interface SwitchPollDecision {
  action: SwitchPollAction;
  reason: SwitchPollReason;
  /**
   * True only on a deliberate OFF→ON edge: clear the previous failure text and
   * the crash-restart counter, exactly as the app's own switch endpoint does.
   */
  clearFailure: boolean;
}

function decision(
  action: SwitchPollAction,
  reason: SwitchPollReason,
  clearFailure = false,
): SwitchPollDecision {
  return { action, reason, clearFailure };
}

/**
 * What this tick should do. Pure: no clock, no database, no process.
 */
export function planSwitchPoll(input: SwitchPollInput): SwitchPollDecision {
  if (input.shuttingDown) return decision("none", "shutting_down");
  // Rule 1: an unreachable database is not an OFF switch.
  if (!input.switchKnown) return decision("none", "switch_unknown");
  // The OFF the operator asked for is already in flight locally; the lease tick
  // is retrying the durable half. Acting here would fight it.
  if (input.pendingDurableOff) return decision("none", "pending_durable_off");

  // A deliberate operator action that left the switch ON. Either we watched it
  // cross OFF→ON, or the row was rewritten since we last looked — which is the
  // same intent expressed faster than the poll can sample. Never true on the
  // first successful read, so launching next to an already-ON switch is not
  // mistaken for a re-arm.
  const rewrittenSinceLastPoll =
    input.previousSwitchChangedAt !== null &&
    input.switchChangedAt !== null &&
    input.switchChangedAt !== input.previousSwitchChangedAt;
  const turnedOn =
    input.switchOn &&
    input.previousSwitchOn !== null &&
    (input.previousSwitchOn === false || rewrittenSinceLastPoll);

  if (input.switchOn) {
    if (input.childRunning) return decision("none", "already_running");
    if (input.runState === "starting" || input.runState === "stopping") {
      return decision("none", "transitioning");
    }
    if (input.pendingStarts > 0) return decision("none", "start_pending");
    if (input.runState === "failed" && !turnedOn) {
      return decision("none", "failed_needs_operator");
    }
    if (input.startBlockedUntil !== null && input.now < input.startBlockedUntil && !turnedOn) {
      // A deliberate re-arm always gets a fresh attempt; a merely-still-ON
      // switch waits out the cooldown.
      return decision("none", "start_cooldown");
    }
    return decision("start", turnedOn ? "switch_turned_on" : "switch_on_not_running", turnedOn);
  }

  // Switch OFF, and definitively so.
  if (input.childRunning || input.runState === "running" || input.runState === "starting") {
    return decision("stop", "switch_turned_off");
  }
  return decision("none", "already_stopped");
}

/** True for the two decisions that change the world (and may log one line). */
export function isSwitchPollActionable(decisionValue: SwitchPollDecision): boolean {
  return decisionValue.action !== "none";
}

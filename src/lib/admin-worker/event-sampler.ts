/**
 * PER-EVENT LOG SAMPLER.
 *
 * Lives in its own module — not in self-maintenance.ts — because
 * `writeAdminWorkerLog` (logs.ts) now consults it on EVERY INFO write, and
 * self-maintenance.ts imports the logger. A shared leaf module is what keeps
 * that from being an import cycle.
 *
 * WHY IT MOVED. The LOG_EVENT_SPAM repair used to call `suppressWorkerEvent`,
 * which mutates this map — but only nine call sites ever ASKED the map before
 * writing, so suppressing any other event changed nothing at all. Meanwhile
 * `worker_lanes` (twice per pass) and `build_ready_drain` (once per pass) wrote
 * unsampled INFO rows at the idle cadence: ~720 rows/hour against a budget of
 * 120. Enforcing the budget inside the writer makes the repair real for every
 * event name, including ones added later.
 *
 * WARN/ERROR rows are never sampled: they are the audit trail.
 */

const HOUR = 60 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** A single eventName may write this many rows per hour before it is sampled. */
export function eventBudgetPerHour(): number {
  return envInt("ADMIN_WORKER_EVENT_BUDGET_PER_HOUR", 120);
}

/** How long a sampled event stays suppressed once it blows its budget. */
export function eventCooldownMs(): number {
  return envInt("ADMIN_WORKER_EVENT_COOLDOWN_MS", 10 * 60_000);
}

interface SamplerState {
  windowStartedAt: number;
  written: number;
  /** Dropped since the last row that was actually written. */
  suppressed: number;
  suppressedUntil: number;
}

const _sampler = new Map<string, SamplerState>();

export interface SampleDecision {
  /** Write the row? */
  write: boolean;
  /** How many identical events were dropped since the last written row. */
  suppressed: number;
  /** True on the FIRST drop of a cool-down: log the suppression once, here. */
  suppressionStarted: boolean;
}

/**
 * Per-eventName budget for INFO telemetry. A caller asks before writing; once
 * an eventName exceeds its hourly budget the sampler drops it for a cool-down
 * window and reports the drop ONCE (`suppressionStarted`), which is the whole
 * point: the ledger records "this event is being sampled", not the event, until
 * the loop calms down.
 *
 * In-process and allocation-free per call — it must be cheaper than the write
 * it is replacing. WARN/ERROR rows must never be routed through it.
 */
export function sampleWorkerEvent(
  eventName: string,
  opts: { now?: number; budgetPerHour?: number; cooldownMs?: number } = {},
): SampleDecision {
  const now = opts.now ?? Date.now();
  const budget = opts.budgetPerHour ?? eventBudgetPerHour();
  const cooldown = opts.cooldownMs ?? eventCooldownMs();
  let s = _sampler.get(eventName);
  if (!s) {
    s = { windowStartedAt: now, written: 0, suppressed: 0, suppressedUntil: 0 };
    _sampler.set(eventName, s);
  }
  if (now < s.suppressedUntil) {
    s.suppressed += 1;
    return { write: false, suppressed: s.suppressed, suppressionStarted: false };
  }
  if (s.suppressedUntil > 0 || now - s.windowStartedAt >= HOUR) {
    // Roll the budget window — either the hour is up, or a cool-down has just
    // expired and the event has earned a fresh allowance. `suppressed`
    // deliberately survives the roll so the next row that IS written can say
    // how many it stands for.
    s.suppressedUntil = 0;
    s.windowStartedAt = now;
    s.written = 0;
  }
  if (s.written >= budget) {
    s.suppressedUntil = now + cooldown;
    s.suppressed += 1;
    return { write: false, suppressed: s.suppressed, suppressionStarted: true };
  }
  s.written += 1;
  const suppressed = s.suppressed;
  s.suppressed = 0;
  return { write: true, suppressed, suppressionStarted: false };
}

/**
 * Force an eventName into the sampler's cool-down. This is how the
 * LOG_EVENT_SPAM repair acts on an event it has never seen in code: SENSE names
 * the offender from the ledger, this silences it for a window. Because
 * `writeAdminWorkerLog` now asks the sampler for every INFO row, this is
 * effective for EVERY call site, not only the ones that opted in.
 */
export function suppressWorkerEvent(
  eventName: string,
  opts: { now?: number; cooldownMs?: number } = {},
): { suppressedUntil: number } {
  const now = opts.now ?? Date.now();
  const until = now + (opts.cooldownMs ?? eventCooldownMs());
  const s = _sampler.get(eventName);
  if (s) s.suppressedUntil = Math.max(s.suppressedUntil, until);
  else
    _sampler.set(eventName, {
      windowStartedAt: now,
      written: 0,
      suppressed: 0,
      suppressedUntil: until,
    });
  return { suppressedUntil: until };
}

/** Test/diagnostic hook: forget every sampler window. */
export function resetEventSampler(): void {
  _sampler.clear();
}

/** What the sampler currently holds — surfaced in the maintenance log rows. */
export function eventSamplerSnapshot(): Array<{
  eventName: string;
  written: number;
  suppressed: number;
  suppressedUntil: number;
}> {
  return [..._sampler.entries()].map(([eventName, s]) => ({
    eventName,
    written: s.written,
    suppressed: s.suppressed,
    suppressedUntil: s.suppressedUntil,
  }));
}

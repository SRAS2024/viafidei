/**
 * SELF-MAINTENANCE — the worker's own doctor.
 *
 * WHY THIS EXISTS (measured, not hypothetical). On 2026-09-07 the production
 * database was 21 GB, of which PublishedContent was 12 MB. The rest was the
 * worker's own telemetry: AdminWorkerLog 5,091,970 rows / 3.3 GB,
 * AdminWorkerDecision 993,364 / 5.7 GB, AdminWorkerPass 993,406 / 440 MB,
 * AdminWorkerRepairPlan 49,534 / 27 MB. Between 2026-05-25 and 2026-08-29 the
 * worker wrote ~7 million ledger rows and published NOTHING. `worker_stuck`
 * fired 207,830 times and nothing acted on it; `loop_paused` was written ONCE
 * PER SECOND while the loop was paused.
 *
 * Every one of those is a signal the worker could have read about ITSELF. It
 * had no organ that did. This module is that organ:
 *
 *   SENSE     cheap aggregate queries (pg_class estimates, grouped counts) →
 *             typed `Signal`s. Exact counts only once an estimate crosses a
 *             threshold, so a healthy sweep is a handful of index reads.
 *   DIAGNOSE  signals → named `Condition`s, each carrying its evidence and ONE
 *             explicit remedy.
 *   REPAIR    bounded, reversible, least-destructive-first, individually
 *             disable-able by env. Every action taken writes exactly ONE
 *             AdminWorkerLog row — never one per tick, which is the very bug
 *             this module exists to stop.
 *   VERIFY    re-read the signal that was acted on. A repair that does not move
 *             its signal is recorded as ineffective; N consecutive ineffective
 *             attempts escalate the condition and back it off, instead of
 *             retrying forever (the `worker_stuck` × 207,830 failure mode).
 *
 * SAFETY RULES, enforced here rather than by convention:
 *   - The telemetry tables are an allow-list in cleanup.ts; nothing here builds
 *     a statement from a table name it did not declare.
 *   - Published content is NEVER deleted. Re-publishing a row that a gate
 *     unpublished, and which now passes that gate again, is the ONLY
 *     content-mutating action in this file, it snapshots first (reversible),
 *     and it logs its reason.
 *   - Everything is fail-open: a failing probe or repair degrades to "did
 *     nothing" and the next sweep retries. It must never be able to stop a pass.
 *   - It runs from the `maint-self-heal` OPS lane, which runs only while the
 *     loop runs, which runs only while the master switch is ON. That is the
 *     resource guarantee: switch OFF, this consumes nothing.
 */

import type { PrismaClient } from "@prisma/client";

import {
  LEDGER_PRUNE_BATCH,
  LEDGER_PRUNE_MAX_BATCHES,
  LEDGER_PRUNE_MAX_BATCHES_BACKLOG,
  pruneLedgerRows,
  totalLedgerRowsPruned,
  ROLLBACK_REVIEW_ACTIONS,
  type LedgerPruneOutcome,
} from "./cleanup";
import { snapshotPublishedContent } from "./content-protection";
import { eventBudgetPerHour, eventCooldownMs, suppressWorkerEvent } from "./event-sampler";
import { fileHumanReview } from "./human-review";
import { writeAdminWorkerLog } from "./logs";
import { evaluatePublishSafety } from "./publish-safety";

/**
 * The event sampler moved to ./event-sampler so `writeAdminWorkerLog` can
 * enforce the budget on EVERY INFO write without an import cycle. Re-exported
 * here because this is the module the rest of the worker (and the package
 * index) imports it from.
 */
export {
  eventBudgetPerHour,
  eventCooldownMs,
  eventSamplerSnapshot,
  resetEventSampler,
  sampleWorkerEvent,
  suppressWorkerEvent,
  type SampleDecision,
} from "./event-sampler";

/* ------------------------------------------------------------------ */
/* public types                                                        */
/* ------------------------------------------------------------------ */

export type SignalSeverity = "ok" | "warn" | "critical";

/**
 * One measured fact about the worker's own health. The report renders these
 * verbatim and the tests assert on them, so both read the same structure.
 */
export interface Signal {
  key: string;
  severity: SignalSeverity;
  value: number;
  threshold: number;
  detail: string;
}

export type ConditionName =
  | "LEDGER_BLOAT"
  | "LEDGER_DEAD_SPACE"
  | "LOG_EVENT_SPAM"
  | "PUBLISH_FUTILITY"
  | "LANE_WEDGED"
  | "CURSOR_OUT_OF_RANGE"
  | "ORPHANED_UNPUBLISHED_CONTENT"
  | "PAUSED_LOOP_HOT_LOOP"
  | "ARTIFACT_PARKED";

export type RepairName =
  | "trim_telemetry"
  | "sample_noisy_event"
  | "reset_wedged_lane"
  | "reset_cursor"
  | "requeue_artifact"
  | "restore_unpublished_content"
  | "escalate";

/** A named diagnosis: what is wrong, what raised it, and the ONE remedy for it. */
export interface Condition {
  name: ConditionName;
  severity: "warn" | "critical";
  remedy: RepairName;
  /** The signal key the VERIFY step re-reads to decide whether the repair worked. */
  signalKey: string;
  /** The signals that raised this condition. */
  evidence: Signal[];
  detail: string;
}

/** What one repair actually did. One of these == one AdminWorkerLog row. */
export interface RepairAction {
  condition: ConditionName;
  repair: RepairName;
  attempted: boolean;
  succeeded: boolean;
  /** Machine-readable counts so the report renders numbers, not prose. */
  counts: Record<string, number>;
  detail: string;
  /** Set when the repair was skipped: the env switch that disabled it. */
  disabledBy?: string;
  /** Set when the condition is in verify-backoff and was deliberately skipped. */
  backedOff?: boolean;
}

/** Did the repair actually move the signal it acted on? */
export interface VerifyResult {
  condition: ConditionName;
  signalKey: string;
  before: number;
  after: number;
  improved: boolean;
  /** Consecutive sweeps where this condition's repair did not improve it. */
  consecutiveFailures: number;
  escalated: boolean;
  /** ISO time this condition is backed off until, when it is. */
  backoffUntil: string | null;
}

export interface SelfMaintenanceResult {
  /** False when the capability is disabled or the sweep was throttled. */
  ran: boolean;
  /** "disabled" | "throttled" when `ran` is false. */
  skippedReason?: string;
  startedAt: string;
  durationMs: number;
  signals: Signal[];
  conditions: Condition[];
  repairs: RepairAction[];
  verifications: VerifyResult[];
  /** Repairs actually attempted — and therefore AdminWorkerLog rows written. */
  actionsTaken: number;
  /** Conditions handed to the escalation / HumanReviewQueue path this sweep. */
  escalations: number;
}

export interface SelfMaintenanceOptions {
  passId?: string;
  /** Per-repair row cap (artifacts requeued, content restored, …). Default 25. */
  limit?: number;
  /** Injected clock (tests). */
  now?: number;
  /** Bypass the ~15-minute throttle (tests, operator maintenance). */
  force?: boolean;
}

/* ------------------------------------------------------------------ */
/* env knobs                                                           */
/* ------------------------------------------------------------------ */

function envOn(name: string): boolean {
  return (process.env[name] ?? "").trim() !== "0";
}

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Master gate for the whole capability (`ADMIN_WORKER_SELF_MAINT=0` disables). */
export function selfMaintenanceEnabled(): boolean {
  return envOn("ADMIN_WORKER_SELF_MAINT");
}

/** The env switch that individually disables each repair. */
export const REPAIR_ENV_SWITCH: Readonly<Record<RepairName, string>> = {
  trim_telemetry: "ADMIN_WORKER_SELF_MAINT_TRIM",
  sample_noisy_event: "ADMIN_WORKER_SELF_MAINT_SAMPLE",
  reset_wedged_lane: "ADMIN_WORKER_SELF_MAINT_LANE",
  reset_cursor: "ADMIN_WORKER_SELF_MAINT_CURSOR",
  requeue_artifact: "ADMIN_WORKER_SELF_MAINT_ARTIFACT",
  restore_unpublished_content: "ADMIN_WORKER_SELF_MAINT_RESTORE",
  escalate: "ADMIN_WORKER_SELF_MAINT_ESCALATE",
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Sweep cadence. The lane calls every pass; this is what makes that cheap. */
export function selfMaintenanceIntervalMs(): number {
  return envInt("ADMIN_WORKER_SELF_MAINT_INTERVAL_MS", 15 * MINUTE);
}

/** Consecutive ineffective repairs before a condition escalates and backs off. */
export const VERIFY_FAILURE_LIMIT = 3;
/** How long an escalated condition is left alone. */
export const CONDITION_BACKOFF_MS = 6 * HOUR;

/* ------------------------------------------------------------------ */
/* thresholds                                                          */
/* ------------------------------------------------------------------ */

/** Row counts above which a telemetry table is worth trimming / alarming. */
export const LEDGER_ROWS_WARN = 250_000;
export const LEDGER_ROWS_CRITICAL = 1_000_000;
/**
 * SIZE thresholds per relation, from pg_total_relation_size.
 *
 * NEVER trust the row estimate alone. In production `pg_class.reltuples` said
 * 4,932 for AdminWorkerActionScore while the table held 16,909,035 rows in
 * 5.7 GB, because autovacuum had never run on it — and a never-analyzed table
 * on PG14+ reports -1, which floors to 0. The bytes come back in the SAME
 * pg_class query and are maintained by the storage layer, not by ANALYZE, so
 * they are the trustworthy half. A table over the byte threshold raises its
 * own signal AND is what triggers paying for an exact count.
 */
export const LEDGER_BYTES_WARN = 256 * 1024 ** 2;
export const LEDGER_BYTES_CRITICAL = 1024 ** 3;
/** pg_database_size ceiling before the database itself is called critical. */
export const DATABASE_BYTES_WARN = 2 * 1024 ** 3;
export const DATABASE_BYTES_CRITICAL = 8 * 1024 ** 3;
/**
 * Dead-tuple ratio past which a plain VACUUM can no longer help and only an
 * operator's VACUUM FULL returns the disk. Only meaningful on a relation that
 * is already large, so the signal is gated on LEDGER_BYTES_WARN too.
 *
 * The counts come from pg_stat_all_tables, which the post-mortem showed can be
 * wrong by orders of magnitude when autovacuum has never run — so the ratio is
 * additionally gated on an ABSOLUTE dead-tuple floor. A stale sample of a few
 * hundred tuples must not be able to report "90% dead" on a 5 GB table and
 * page an operator over nothing.
 */
export const DEAD_RATIO_WARN = 0.4;
export const DEAD_RATIO_CRITICAL = 0.6;
export const DEAD_TUPLES_FLOOR = 100_000;
/** Passes in 24 h with ZERO publishes before the loop is called futile. */
export const FUTILITY_PASS_THRESHOLD = 200;
/** worker_stuck / watchdog events in one hour before the lanes are suspect. */
export const STUCK_EVENTS_THRESHOLD = 20;
/** A lane still "running" this long after it started never finished. */
export const LANE_WEDGE_MS = 30 * MINUTE;
/** Identical lane outcomes across this many sweeps with no progress = wedged. */
export const LANE_IDENTICAL_OUTCOME_LIMIT = 3;
/** A structured cursor that has swept this many times finding nothing has wrapped. */
export const CURSOR_ZERO_STREAK_LIMIT = 3;
/** An artifact parked in a non-terminal state longer than this is stuck. */
export const ARTIFACT_PARKED_MS = 7 * DAY;

/**
 * The telemetry tables SENSE measures. Same allow-list, same order and same
 * rationale as scripts/maintenance/prune-worker-ledger.ts: children first,
 * AdminWorkerPass (the parent, five inbound ON DELETE SET NULL keys) last.
 *
 * It must match what cleanup.ts's `pruneLedgerRows` actually deletes, or SENSE
 * measures a table the repair cannot move (and, worse, cannot see the one it
 * can). AdminWorkerBrainCall, AdminWorkerReasoningGraph,
 * AdminWorkerCalibrationHistory, AdminWorkerStucknessRecord and
 * PostPublishVerification were all pruned-but-unmeasured or
 * unmeasured-and-unpruned; between them they were most of the 21 GB.
 */
export const TELEMETRY_TABLES: ReadonlyArray<{ table: string; model: string }> = [
  { table: "AdminWorkerLog", model: "adminWorkerLog" },
  { table: "AdminWorkerActionScore", model: "adminWorkerActionScore" },
  { table: "AdminWorkerBrainCall", model: "adminWorkerBrainCall" },
  { table: "AdminWorkerStageOutcome", model: "adminWorkerStageOutcome" },
  { table: "AdminWorkerRepairPlan", model: "adminWorkerRepairPlan" },
  { table: "AdminWorkerReasoningGraph", model: "adminWorkerReasoningGraph" },
  { table: "AdminWorkerCalibrationHistory", model: "adminWorkerCalibrationHistory" },
  { table: "AdminWorkerStucknessRecord", model: "adminWorkerStucknessRecord" },
  { table: "PostPublishVerification", model: "postPublishVerification" },
  { table: "AdminWorkerDecision", model: "adminWorkerDecision" },
  { table: "AdminWorkerPass", model: "adminWorkerPass" },
];

/** Events written once per loop tick — the ones that produced ~3 M rows. */
export const PER_TICK_EVENTS: readonly string[] = [
  "brain_decided",
  "stage_dispatched",
  "loop_paused",
  "intelligence_advisory",
  "intelligence_pass",
  "mission_control",
  "replay_simulation",
];

/* ------------------------------------------------------------------ */
/* small prisma helpers (every one fail-open + mock-tolerant)          */
/* ------------------------------------------------------------------ */

type Delegate = Record<string, unknown>;

function delegate(prisma: PrismaClient, model: string): Delegate | null {
  const d = (prisma as unknown as Record<string, Delegate | undefined>)[model];
  return d && typeof d === "object" ? d : null;
}

async function call<T>(
  prisma: PrismaClient,
  model: string,
  method: string,
  arg: unknown,
  fallback: T,
): Promise<T> {
  const d = delegate(prisma, model);
  const fn = d?.[method];
  if (typeof fn !== "function") return fallback;
  try {
    const out = await (fn as (a?: unknown) => Promise<T>).call(d, arg);
    return (out ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------------ */
/* durable state (AdminWorkerMemory — no migration)                    */
/* ------------------------------------------------------------------ */

const MEMORY_PREFIX = "self-maintenance:";
const LAST_RUN_KEY = `${MEMORY_PREFIX}last-run`;
const conditionKey = (name: ConditionName) => `${MEMORY_PREFIX}condition:${name}`;
const laneKey = (lane: string) => `${MEMORY_PREFIX}lane:${lane}`;
/** Structured-ingest cursors live under this prefix (structured/ingest.ts). */
const STRUCTURED_CURSOR_PREFIX = "structured-cursor:";

interface ConditionMemory {
  failures: number;
  backoffUntil: number | null;
  lastValue: number | null;
}

async function readMemory(prisma: PrismaClient, key: string): Promise<Record<string, unknown>> {
  const row = await call<{ memoryValue?: unknown } | null>(
    prisma,
    "adminWorkerMemory",
    "findUnique",
    { where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } } },
    null,
  );
  const v = row?.memoryValue;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

async function writeMemory(
  prisma: PrismaClient,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  await call(
    prisma,
    "adminWorkerMemory",
    "upsert",
    {
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue: value, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: key,
        memoryValue: value,
        lastUsedAt: new Date(),
      },
    },
    null,
  );
}

async function readConditionMemory(
  prisma: PrismaClient,
  name: ConditionName,
): Promise<ConditionMemory> {
  const v = await readMemory(prisma, conditionKey(name));
  return {
    failures: Math.max(0, num(v.failures)),
    backoffUntil: typeof v.backoffUntil === "number" ? v.backoffUntil : null,
    lastValue: typeof v.lastValue === "number" ? v.lastValue : null,
  };
}

/* ------------------------------------------------------------------ */
/* 1. SENSE                                                            */
/* ------------------------------------------------------------------ */

function signal(
  key: string,
  value: number,
  warn: number,
  critical: number,
  detail: string,
): Signal {
  return {
    key,
    value,
    threshold: warn,
    severity: value >= critical ? "critical" : value >= warn ? "warn" : "ok",
    detail,
  };
}

interface RelationStat {
  relname: string;
  estRows: number;
  bytes: number;
  liveTuples: number;
  deadTuples: number;
}

/**
 * Row-count + size ESTIMATES for every worker telemetry relation in ONE query
 * off pg_class — no table scan, no per-table round trip. An exact count is only
 * paid for when the SIZE (or, where it is trustworthy, the row estimate)
 * crosses the warn threshold.
 *
 * `reltuples` is deliberately NOT the primary measure: it is maintained by
 * VACUUM/ANALYZE, autovacuum reported "never" on the tables that mattered, and
 * a never-analyzed table on PG14+ reports -1. The byte figure from
 * pg_total_relation_size is maintained by the storage layer and was correct
 * even when the row estimate was wrong by 3,400x.
 */
async function readRelationStats(prisma: PrismaClient): Promise<RelationStat[]> {
  const raw = (prisma as unknown as { $queryRaw?: unknown }).$queryRaw;
  if (typeof raw !== "function") return [];
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT c.relname AS relname,
             c.reltuples::bigint AS est_rows,
             pg_total_relation_size(c.oid)::bigint AS bytes,
             coalesce(s.n_live_tup, 0)::bigint AS live_tup,
             coalesce(s.n_dead_tup, 0)::bigint AS dead_tup
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_all_tables s ON s.relid = c.oid
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND (c.relname LIKE 'AdminWorker%' OR c.relname = 'PostPublishVerification')`;
    return (rows ?? []).map((r) => ({
      relname: String(r.relname ?? ""),
      estRows: Math.max(0, num(r.est_rows)),
      bytes: Math.max(0, num(r.bytes)),
      liveTuples: Math.max(0, num(r.live_tup)),
      deadTuples: Math.max(0, num(r.dead_tup)),
    }));
  } catch {
    return [];
  }
}

/**
 * The fraction of a relation's tuples that are dead. A plain VACUUM makes that
 * space reusable; past DEAD_RATIO_CRITICAL only a VACUUM FULL (an operator
 * action — it takes ACCESS EXCLUSIVE) actually returns the disk.
 */
function deadRatio(stat: RelationStat): number {
  const total = stat.liveTuples + stat.deadTuples;
  return total > 0 ? stat.deadTuples / total : 0;
}

async function readDatabaseBytes(prisma: PrismaClient): Promise<number> {
  const raw = (prisma as unknown as { $queryRaw?: unknown }).$queryRaw;
  if (typeof raw !== "function") return 0;
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pg_database_size(current_database())::bigint AS bytes`;
    return Math.max(0, num(rows?.[0]?.bytes));
  } catch {
    return 0;
  }
}

/**
 * Is this lane WEDGED — and what marker should the next sweep compare against?
 *
 * Pure, so SENSE and VERIFY can use the SAME predicate. They used to disagree:
 * SENSE called a lane wedged after N identical `lastOutcome` strings, VERIFY
 * re-sensed only "status === running past the watchdog", so a repair that
 * changed nothing always verified as "improved" and the false diagnosis
 * repeated forever.
 *
 * Why the outcome string alone is NOT evidence of a wedge: most lanes return a
 * CONSTANT detail by design — "readings refreshed", "schema awareness ran",
 * "UI awareness ran", "review auto-resolve ran", "intelligence ran", and
 * `ingest-curated` returns "curated ingest +0" whenever it publishes nothing.
 * Three sweeps of a perfectly healthy idle worker were enough to declare those
 * lanes wedged. A wedge needs evidence of NO FORWARD MOVEMENT:
 *
 *   (a) the lane is still "running" long after its watchdog should have fired
 *       — it never finished; or
 *   (b) the lane is stuck on the SAME `currentItem` across N sweeps and is not
 *       idle — it keeps picking up the identical piece of work and never
 *       finishing it.
 *
 * A lane that finishes and goes idle is never wedged, whatever it reports.
 */
export function laneWedgeState(
  row: Record<string, unknown>,
  memory: Record<string, unknown>,
  now: number,
): { wedged: boolean; marker: string; repeats: number } {
  const status = String(row.status ?? "");
  const startedAt = row.lastStartedAt ? new Date(row.lastStartedAt as string).getTime() : 0;
  const neverFinished = status === "running" && startedAt > 0 && now - startedAt > LANE_WEDGE_MS;

  const currentItem = row.currentItem == null ? "" : String(row.currentItem);
  // The marker is the item under work, not the outcome text: an unchanged
  // marker means the lane is chewing the same thing again, which a constant
  // "readings refreshed" does not.
  const marker = status === "idle" || currentItem === "" ? "" : `${status}:${currentItem}`;
  const repeats =
    marker !== "" && memory.lastOutcome === marker ? Math.max(0, num(memory.repeats)) + 1 : 1;
  const stuckOnItem = marker !== "" && repeats >= LANE_IDENTICAL_OUTCOME_LIMIT;

  return { wedged: neverFinished || stuckOnItem, marker, repeats };
}

/**
 * A structured-ingest cursor that has walked past the end of its corpus:
 * sweeping from a non-zero offset and finding nothing, N times running.
 *
 * A cursor the INGEST MODULE has already parked is NOT stale. structured/
 * ingest.ts owns the end-of-corpus case itself: on `endOfCorpus` it wraps the
 * offset to 0 and sets `exhaustedUntil = now + RESWEEP_INTERVAL_MS` so the
 * ingestor rests. Rewinding one of those from outside would throw away real
 * page progress and re-walk entities that were just processed.
 */
function isStaleCursor(state: Record<string, unknown>, now: number): boolean {
  const exhaustedUntil = num(state.exhaustedUntil);
  if (exhaustedUntil > now) return false;
  return num(state.offset) > 0 && num(state.zeroStreak) >= CURSOR_ZERO_STREAK_LIMIT;
}

/** Everything SENSE gathered, kept so DIAGNOSE and the repairs can reuse it. */
export interface SenseReading {
  signals: Signal[];
  /** eventName → rows written in the last hour, for the events over budget. */
  noisyEvents: Array<{ eventName: string; perHour: number }>;
  wedgedLanes: string[];
  staleCursorKeys: string[];
  orphanCount: number;
  parkedArtifacts: number;
}

/**
 * Gather every self-health signal. Cheap by construction: one pg_class query,
 * one pg_database_size, one groupBy over an indexed createdAt window, and a
 * handful of counts. Exact row counts are paid for only where an estimate is
 * already over the warn line.
 */
export async function senseSelfHealth(
  prisma: PrismaClient,
  opts: { now?: number } = {},
): Promise<SenseReading> {
  const now = opts.now ?? Date.now();
  const signals: Signal[] = [];

  // ── ledger pressure ────────────────────────────────────────────────
  const stats = await readRelationStats(prisma);
  const byName = new Map(stats.map((s) => [s.relname, s]));
  let worstDead: { table: string; ratio: number; bytes: number } | null = null;
  for (const { table, model } of TELEMETRY_TABLES) {
    const stat = byName.get(table);
    const bytes = stat?.bytes ?? 0;
    let rows = stat?.estRows ?? 0;
    let exact = false;
    // The EXACT count is triggered off the byte estimate as well as the row
    // estimate: reltuples said 4,932 for a 5.7 GB table, so a row-only trigger
    // never fired for the very table that mattered most.
    if (rows >= LEDGER_ROWS_WARN || bytes >= LEDGER_BYTES_WARN) {
      const counted = await call<number>(prisma, model, "count", undefined, -1);
      if (counted >= 0) {
        rows = counted;
        exact = true;
      }
    }
    const rowSignal = signal(
      `ledger_rows:${table}`,
      rows,
      LEDGER_ROWS_WARN,
      LEDGER_ROWS_CRITICAL,
      `${table}: ${rows} rows (${exact ? "exact" : "estimated"}), ${Math.round(bytes / 1024 / 1024)} MB`,
    );
    // Severity is the worse of "too many rows" and "too many bytes" — a table
    // can be enormous on disk while its row estimate is stale nonsense.
    const bySize = signal(
      `ledger_bytes:${table}`,
      bytes,
      LEDGER_BYTES_WARN,
      LEDGER_BYTES_CRITICAL,
      "",
    );
    if (
      bySize.severity === "critical" ||
      (bySize.severity === "warn" && rowSignal.severity === "ok")
    ) {
      rowSignal.severity = bySize.severity;
    }
    signals.push(rowSignal);
    if (stat && bytes >= LEDGER_BYTES_WARN && stat.deadTuples >= DEAD_TUPLES_FLOOR) {
      const ratio = deadRatio(stat);
      if (!worstDead || ratio > worstDead.ratio) worstDead = { table, ratio, bytes };
    }
  }
  // Dead space. A DELETE never returns disk; a plain VACUUM makes it reusable
  // (cleanup.ts issues one after a large trim) and past the critical ratio only
  // an operator's VACUUM FULL rewrites the files. Measured, not assumed.
  signals.push(
    signal(
      "dead_tuple_ratio",
      worstDead ? Number(worstDead.ratio.toFixed(3)) : 0,
      DEAD_RATIO_WARN,
      DEAD_RATIO_CRITICAL,
      worstDead
        ? `${worstDead.table} is ${Math.round(worstDead.ratio * 100)}% dead tuples at ${Math.round(worstDead.bytes / 1024 / 1024)} MB`
        : "no large relation with significant dead space",
    ),
  );
  const dbBytes = await readDatabaseBytes(prisma);
  signals.push(
    signal(
      "database_bytes",
      dbBytes,
      DATABASE_BYTES_WARN,
      DATABASE_BYTES_CRITICAL,
      `database is ${Math.round(dbBytes / 1024 / 1024)} MB`,
    ),
  );

  // ── futility: many passes, zero publishes ──────────────────────────
  const since24h = new Date(now - DAY);
  const passes24h = await call<number>(
    prisma,
    "adminWorkerPass",
    "count",
    { where: { startedAt: { gte: since24h } } },
    0,
  );
  const published24h = await call<number>(
    prisma,
    "publishedContent",
    "count",
    { where: { isPublished: true, publishedAt: { gte: since24h } } },
    0,
  );
  signals.push({
    key: "publish_futility",
    // Only the ZERO-publish case is futility; any publishing at all is progress.
    value: published24h === 0 ? passes24h : 0,
    threshold: FUTILITY_PASS_THRESHOLD,
    severity:
      published24h === 0 && passes24h >= FUTILITY_PASS_THRESHOLD
        ? "critical"
        : published24h === 0 && passes24h >= FUTILITY_PASS_THRESHOLD / 4
          ? "warn"
          : "ok",
    detail: `${passes24h} pass(es) and ${published24h} publish(es) in the last 24 h`,
  });

  // ── stuck: watchdog / worker_stuck events in the last hour ─────────
  const since1h = new Date(now - HOUR);
  const stuckEvents = await call<number>(
    prisma,
    "adminWorkerLog",
    "count",
    {
      where: {
        createdAt: { gte: since1h },
        eventName: { in: ["worker_stuck", "lane_watchdog_expired", "loop_pass_failed"] },
      },
    },
    0,
  );
  signals.push(
    signal(
      "stuck_events_1h",
      stuckEvents,
      STUCK_EVENTS_THRESHOLD,
      STUCK_EVENTS_THRESHOLD * 5,
      `${stuckEvents} stuck/watchdog event(s) in the last hour`,
    ),
  );

  // ── noise: events per hour, by name, so the offender is named ──────
  const grouped = await call<Array<Record<string, unknown>>>(
    prisma,
    "adminWorkerLog",
    "groupBy",
    {
      by: ["eventName"],
      where: { createdAt: { gte: since1h }, severity: "INFO" },
      _count: { _all: true },
    },
    [],
  );
  const budget = eventBudgetPerHour();
  const noisyEvents: Array<{ eventName: string; perHour: number }> = [];
  for (const g of grouped) {
    const eventName = String(g.eventName ?? "");
    const perHour = num((g._count as Record<string, unknown> | undefined)?._all);
    if (!eventName || perHour < budget) continue;
    noisyEvents.push({ eventName, perHour });
    signals.push(
      signal(
        `event_rate:${eventName}`,
        perHour,
        budget,
        budget * 5,
        `${eventName} wrote ${perHour} INFO row(s) in the last hour (budget ${budget})`,
      ),
    );
  }
  noisyEvents.sort((a, b) => b.perHour - a.perHour);
  // The paused loop is called out by name because it is the measured bug: 8
  // rows in 8 seconds on 2026-08-29, 649,793 rows all-time.
  const pausedPerHour = noisyEvents.find((e) => e.eventName === "loop_paused")?.perHour ?? 0;
  signals.push(
    signal(
      "paused_log_rate",
      pausedPerHour,
      Math.max(60, budget),
      Math.max(300, budget * 5),
      `loop_paused wrote ${pausedPerHour} row(s) in the last hour`,
    ),
  );

  // ── wedged lanes ───────────────────────────────────────────────────
  const laneRows = await call<Array<Record<string, unknown>>>(
    prisma,
    "adminWorkerLaneState",
    "findMany",
    {},
    [],
  );
  const wedgedLanes: string[] = [];
  for (const row of laneRows) {
    const lane = String(row.lane ?? "");
    if (!lane) continue;
    const mem = await readMemory(prisma, laneKey(lane));
    const { wedged, marker, repeats } = laneWedgeState(row, mem, now);
    await writeMemory(prisma, laneKey(lane), { lastOutcome: marker, repeats });
    if (wedged) wedgedLanes.push(lane);
  }
  signals.push(
    signal(
      "wedged_lanes",
      wedgedLanes.length,
      1,
      3,
      wedgedLanes.length ? `wedged: ${wedgedLanes.join(", ")}` : "no wedged lanes",
    ),
  );

  // ── cursors pointing past the end of their corpus ──────────────────
  const cursorRows = await call<Array<Record<string, unknown>>>(
    prisma,
    "adminWorkerMemory",
    "findMany",
    {
      where: { memoryType: "GENERIC", memoryKey: { startsWith: STRUCTURED_CURSOR_PREFIX } },
      take: 200,
    },
    [],
  );
  const staleCursorKeys: string[] = [];
  for (const row of cursorRows) {
    const key = String(row.memoryKey ?? "");
    const v = row.memoryValue;
    if (!key || !v || typeof v !== "object" || Array.isArray(v)) continue;
    const state = v as Record<string, unknown>;
    if (isStaleCursor(state, now)) staleCursorKeys.push(key);
  }
  signals.push(
    signal(
      "stale_cursors",
      staleCursorKeys.length,
      1,
      5,
      staleCursorKeys.length ? `wrapped: ${staleCursorKeys.join(", ")}` : "no wrapped cursors",
    ),
  );

  // ── orphans: content a rollback unpublished whose review has expired ─
  const orphanCount = await call<number>(
    prisma,
    "adminWorkerRollbackLedger",
    "count",
    { where: { restorable: true, rollbackResult: { in: ["UNPUBLISHED", "HUMAN_REVIEW"] } } },
    0,
  );
  signals.push(
    signal(
      "orphaned_unpublished",
      orphanCount,
      1,
      10,
      `${orphanCount} restorable unpublished row(s) in the rollback ledger`,
    ),
  );

  // ── orphans: artifacts parked in a non-terminal state ──────────────
  const parkedArtifacts = await call<number>(
    prisma,
    "adminWorkerPackageArtifact",
    "count",
    {
      where: {
        status: { in: ["NEEDS_REVIEW", "NEEDS_REPAIR"] },
        updatedAt: { lt: new Date(now - ARTIFACT_PARKED_MS) },
      },
    },
    0,
  );
  signals.push(
    signal(
      "parked_artifacts",
      parkedArtifacts,
      1,
      25,
      `${parkedArtifacts} artifact(s) parked in a non-terminal state for over ${Math.round(ARTIFACT_PARKED_MS / DAY)} d`,
    ),
  );

  return { signals, noisyEvents, wedgedLanes, staleCursorKeys, orphanCount, parkedArtifacts };
}

/* ------------------------------------------------------------------ */
/* 2. DIAGNOSE                                                         */
/* ------------------------------------------------------------------ */

function bySeverity(sev: SignalSeverity): "warn" | "critical" {
  return sev === "critical" ? "critical" : "warn";
}

/**
 * Signals → named conditions, each with its evidence and exactly ONE remedy.
 * Pure (no IO) so the mapping is directly testable.
 */
export function diagnoseConditions(reading: SenseReading): Condition[] {
  const get = (key: string) => reading.signals.find((s) => s.key === key);
  const out: Condition[] = [];

  const bloated = reading.signals
    .filter((s) => s.key.startsWith("ledger_rows:") && s.severity !== "ok")
    .sort((a, b) => b.value - a.value);
  const dbSignal = get("database_bytes");
  if (bloated.length > 0 || (dbSignal && dbSignal.severity !== "ok")) {
    const evidence = [...bloated, ...(dbSignal && dbSignal.severity !== "ok" ? [dbSignal] : [])];
    out.push({
      name: "LEDGER_BLOAT",
      severity: evidence.some((s) => s.severity === "critical") ? "critical" : "warn",
      remedy: "trim_telemetry",
      // VERIFY against what the trim can actually MOVE: the row count of the
      // largest offending table. It used to verify against `database_bytes`,
      // comparing a row count (`evidence[0].value`) to pg_database_size — units
      // that can never converge — and, worse, a DELETE does not shrink
      // pg_database_size at all (the measured production lesson). So a working
      // trim was judged ineffective three sweeps running, escalated, and
      // disabled itself for six hours exactly when the ledger was worst.
      // `database_bytes` keeps its own condition below, with the remedy that
      // can actually move it: an operator VACUUM FULL.
      signalKey: bloated[0]?.key ?? "database_bytes",
      evidence,
      detail: `telemetry over retention: ${evidence.map((s) => s.detail).join("; ")}`,
    });
  }

  // Dead space is a DIFFERENT problem from row count with a DIFFERENT remedy.
  // Trimming rows cannot fix it, and a plain VACUUM (cleanup.ts issues one
  // after a large trim) only makes the space reusable. Past the threshold the
  // only thing that returns the disk is an operator-run VACUUM FULL, so this
  // escalates by name instead of pretending a repair exists.
  const dead = get("dead_tuple_ratio");
  if (dead && dead.severity !== "ok") {
    out.push({
      name: "LEDGER_DEAD_SPACE",
      severity: bySeverity(dead.severity),
      remedy: "escalate",
      signalKey: "dead_tuple_ratio",
      evidence: [dead, ...(dbSignal ? [dbSignal] : [])],
      detail: `${dead.detail} — a plain VACUUM keeps the space reusable, but reclaiming it needs an operator: npx tsx scripts/maintenance/prune-worker-ledger.ts --railway --confirm --vacuum`,
    });
  }

  const paused = get("paused_log_rate");
  if (paused && paused.severity !== "ok") {
    out.push({
      name: "PAUSED_LOOP_HOT_LOOP",
      severity: bySeverity(paused.severity),
      remedy: "sample_noisy_event",
      signalKey: "paused_log_rate",
      evidence: [paused],
      detail: `${paused.detail} — a paused loop must back off, not log every tick`,
    });
  }

  const spam = reading.signals.filter(
    (s) => s.key.startsWith("event_rate:") && s.key !== "event_rate:loop_paused",
  );
  if (spam.length > 0) {
    out.push({
      name: "LOG_EVENT_SPAM",
      severity: spam.some((s) => s.severity === "critical") ? "critical" : "warn",
      remedy: "sample_noisy_event",
      signalKey: `event_rate:${reading.noisyEvents[0]?.eventName ?? "unknown"}`,
      evidence: spam,
      detail: `over-budget event(s): ${spam.map((s) => s.detail).join("; ")}`,
    });
  }

  const wedged = get("wedged_lanes");
  const stuck = get("stuck_events_1h");
  if ((wedged && wedged.severity !== "ok") || (stuck && stuck.severity !== "ok")) {
    const evidence = [wedged, stuck].filter((s): s is Signal => Boolean(s && s.severity !== "ok"));
    out.push({
      name: "LANE_WEDGED",
      severity: evidence.some((s) => s.severity === "critical") ? "critical" : "warn",
      remedy: "reset_wedged_lane",
      signalKey: "wedged_lanes",
      evidence,
      detail: evidence.map((s) => s.detail).join("; "),
    });
  }

  const cursors = get("stale_cursors");
  if (cursors && cursors.severity !== "ok") {
    out.push({
      name: "CURSOR_OUT_OF_RANGE",
      severity: bySeverity(cursors.severity),
      remedy: "reset_cursor",
      signalKey: "stale_cursors",
      evidence: [cursors],
      detail: cursors.detail,
    });
  }

  const parked = get("parked_artifacts");
  if (parked && parked.severity !== "ok") {
    out.push({
      name: "ARTIFACT_PARKED",
      severity: bySeverity(parked.severity),
      remedy: "requeue_artifact",
      signalKey: "parked_artifacts",
      evidence: [parked],
      detail: parked.detail,
    });
  }

  const orphans = get("orphaned_unpublished");
  if (orphans && orphans.severity !== "ok") {
    out.push({
      name: "ORPHANED_UNPUBLISHED_CONTENT",
      severity: bySeverity(orphans.severity),
      remedy: "restore_unpublished_content",
      signalKey: "orphaned_unpublished",
      evidence: [orphans],
      detail: orphans.detail,
    });
  }

  const futility = get("publish_futility");
  if (futility && futility.severity !== "ok") {
    // Nothing here can MAKE the worker publish; the honest remedy is to tell a
    // human, once, instead of spinning another 200,000 passes.
    out.push({
      name: "PUBLISH_FUTILITY",
      severity: bySeverity(futility.severity),
      remedy: "escalate",
      signalKey: "publish_futility",
      evidence: [futility],
      detail: futility.detail,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* 3. REPAIR — each bounded, reversible, individually disable-able     */
/* ------------------------------------------------------------------ */

interface RepairContext {
  prisma: PrismaClient;
  reading: SenseReading;
  now: number;
  limit: number;
  passId?: string;
}

/**
 * How many batches this trim is allowed, given the backlog SENSE just measured.
 *
 * The default cap is 20 × 5,000 = 100,000 rows per table per call. Against the
 * measured production backlog (AdminWorkerActionScore at 16,909,035 rows) that
 * is 169 productive calls for ONE table — it nibbles forever. When the sensed
 * backlog is far larger than one call's capacity, raise the cap (bounded) so
 * the prune actually drains it across a handful of passes.
 */
export function trimBatchesForBacklog(signals: Signal[]): number {
  const worst = signals
    .filter((s) => s.key.startsWith("ledger_rows:"))
    .reduce((max, s) => Math.max(max, s.value), 0);
  const defaultCapacity = LEDGER_PRUNE_BATCH * LEDGER_PRUNE_MAX_BATCHES;
  if (worst <= defaultCapacity * 2) return LEDGER_PRUNE_MAX_BATCHES;
  const needed = Math.ceil(worst / LEDGER_PRUNE_BATCH);
  return Math.min(LEDGER_PRUNE_MAX_BATCHES_BACKLOG, Math.max(LEDGER_PRUNE_MAX_BATCHES, needed));
}

async function repairTrimTelemetry(ctx: RepairContext): Promise<Omit<RepairAction, "condition">> {
  let ledger: LedgerPruneOutcome | null = null;
  const maxBatches = trimBatchesForBacklog(ctx.reading.signals);
  try {
    ledger = await pruneLedgerRows(ctx.prisma, { now: ctx.now, force: true, maxBatches });
  } catch {
    ledger = null;
  }
  if (!ledger || !ledger.ran) {
    return {
      repair: "trim_telemetry",
      attempted: true,
      succeeded: false,
      counts: { rowsPruned: 0 },
      detail: "retention prune unavailable on this client (no raw SQL)",
    };
  }
  const total = totalLedgerRowsPruned(ledger);
  return {
    repair: "trim_telemetry",
    attempted: true,
    succeeded: total > 0,
    counts: {
      rowsPruned: total,
      maxBatches,
      logRows: ledger.logRows,
      auditLogRows: ledger.auditLogRows,
      actionScores: ledger.actionScores,
      brainCalls: ledger.brainCalls,
      stageOutcomes: ledger.stageOutcomes,
      repairPlans: ledger.repairPlans,
      reasoningGraph: ledger.reasoningGraph,
      calibrationHistory: ledger.calibrationHistory,
      stucknessRecords: ledger.stucknessRecords,
      postPublishVerifications: ledger.postPublishVerifications,
      decisions: ledger.decisions,
      passes: ledger.passes,
      vacuumed: ledger.vacuumed.length,
    },
    detail: `pruned ${total} telemetry row(s) on the rolling retention window${
      ledger.vacuumed.length ? `; vacuumed ${ledger.vacuumed.join(", ")}` : ""
    }`,
  };
}

function repairSampleNoisyEvents(
  ctx: RepairContext,
  condition: ConditionName,
): Omit<RepairAction, "condition"> {
  const targets =
    condition === "PAUSED_LOOP_HOT_LOOP"
      ? ctx.reading.noisyEvents.filter((e) => e.eventName === "loop_paused")
      : ctx.reading.noisyEvents.filter((e) => e.eventName !== "loop_paused");
  const cooldownMs = eventCooldownMs();
  for (const t of targets) suppressWorkerEvent(t.eventName, { now: ctx.now, cooldownMs });
  return {
    repair: "sample_noisy_event",
    attempted: true,
    succeeded: targets.length > 0,
    counts: { eventsSampled: targets.length, cooldownMs },
    detail: targets.length
      ? `sampling ${targets.map((t) => `${t.eventName} (${t.perHour}/h)`).join(", ")} for ${Math.round(cooldownMs / MINUTE)} min`
      : "no over-budget event to sample",
  };
}

/**
 * Least-destructive lane repair: mark the wedged lane idle so the next pass may
 * re-run it, and release artifact leases whose TTL has already expired. It never
 * kills work in flight — an expired lease by definition belongs to nobody.
 *
 * It must NOT write `lastError`. `runWorkerLanes` (lanes.ts) skips any lane
 * where `lastError` is set and `lastFinishedAt` is within the lane's cooldown —
 * so stamping an error here, without touching `lastFinishedAt`, SUPPRESSED the
 * lane for the next ~5 minutes after every sweep. The reset is recorded in
 * `lastOutcome`, which no scheduler decision reads.
 */
export const LANE_RESET_OUTCOME = "reset by self-maintenance (lane wedged)";

async function repairWedgedLanes(ctx: RepairContext): Promise<Omit<RepairAction, "condition">> {
  let lanesReset = 0;
  for (const lane of ctx.reading.wedgedLanes) {
    const res = await call<{ count?: number } | null>(
      ctx.prisma,
      "adminWorkerLaneState",
      "updateMany",
      {
        where: { lane },
        data: {
          status: "idle",
          currentItem: null,
          lastError: null,
          lastOutcome: LANE_RESET_OUTCOME,
        },
      },
      null,
    );
    if (res) lanesReset += 1;
    // Forget the identical-outcome streak so the next sweep starts clean.
    await writeMemory(ctx.prisma, laneKey(lane), { lastOutcome: "", repeats: 0 });
  }
  const leases = await call<{ count?: number } | null>(
    ctx.prisma,
    "adminWorkerPackageArtifact",
    "updateMany",
    {
      where: { leasedBy: { not: null }, leaseExpiresAt: { lt: new Date(ctx.now) } },
      data: { leasedBy: null, leaseExpiresAt: null },
    },
    null,
  );
  const leasesCleared = num(leases?.count);
  return {
    repair: "reset_wedged_lane",
    attempted: true,
    succeeded: lanesReset > 0 || leasesCleared > 0,
    counts: { lanesReset, leasesCleared },
    detail: `reset ${lanesReset} wedged lane(s) and cleared ${leasesCleared} expired artifact lease(s)`,
  };
}

/**
 * A cursor that has swept from a non-zero offset and found nothing N times has
 * walked past the end of its corpus. Resetting the offset to 0 is safe: the
 * ingestors are idempotent and dedupe against live content.
 *
 * `zeroStreak` is deliberately PRESERVED. structured/ingest.ts's `pickIngestor`
 * scores candidates as `gap / (1 + zeroStreak)`, so the streak is the dampener
 * that stops a barren ingestor from monopolising the lane; zeroing it from
 * outside the module removed exactly that protection. It is also unnecessary
 * for this repair: `isStaleCursor` requires `offset > 0`, so rewinding the
 * offset alone clears the condition.
 */
async function repairStaleCursors(ctx: RepairContext): Promise<Omit<RepairAction, "condition">> {
  let reset = 0;
  for (const key of ctx.reading.staleCursorKeys.slice(0, ctx.limit)) {
    const current = await readMemory(ctx.prisma, key);
    if (num(current.exhaustedUntil) > ctx.now) continue; // ingest.ts already parked it
    await writeMemory(ctx.prisma, key, {
      ...current,
      offset: 0,
      lastFullSweepAt: ctx.now,
    });
    reset += 1;
  }
  return {
    repair: "reset_cursor",
    attempted: true,
    succeeded: reset > 0,
    counts: { cursorsReset: reset },
    detail: `rewound ${reset} cursor(s) that had walked past the end of their corpus`,
  };
}

/**
 * Requeue artifacts parked in a NON-TERMINAL state so the drain re-triages them.
 * Bounded by `limit` and marked with a gateDiagnosis so a requeued artifact is
 * never picked up twice — the requeue can't become its own hot loop.
 */
const REQUEUE_MARKER = "requeued_by_self_maintenance";

async function repairParkedArtifacts(ctx: RepairContext): Promise<Omit<RepairAction, "condition">> {
  const stale = await call<Array<Record<string, unknown>>>(
    ctx.prisma,
    "adminWorkerPackageArtifact",
    "findMany",
    {
      where: {
        status: { in: ["NEEDS_REVIEW", "NEEDS_REPAIR"] },
        updatedAt: { lt: new Date(ctx.now - ARTIFACT_PARKED_MS) },
        NOT: { gateDiagnosis: REQUEUE_MARKER },
      },
      select: { id: true },
      take: ctx.limit,
    },
    [],
  );
  const ids = stale.map((r) => String(r.id ?? "")).filter(Boolean);
  let requeued = 0;
  if (ids.length > 0) {
    const res = await call<{ count?: number } | null>(
      ctx.prisma,
      "adminWorkerPackageArtifact",
      "updateMany",
      {
        where: { id: { in: ids } },
        data: {
          status: "BUILD_READY",
          rejectionReason: null,
          gateDiagnosis: REQUEUE_MARKER,
          gateCheckedAt: new Date(ctx.now),
        },
      },
      null,
    );
    requeued = num(res?.count) || ids.length;
  }
  return {
    repair: "requeue_artifact",
    attempted: true,
    succeeded: requeued > 0,
    counts: { artifactsRequeued: requeued },
    detail: `requeued ${requeued} parked artifact(s) to BUILD_READY for re-triage`,
  };
}

/** Does the deterministic publish-safety gate pass for this row today? */
function gatePasses(row: {
  contentType: unknown;
  title: unknown;
  slug: unknown;
  payload: unknown;
}): { ok: boolean; reason: string } {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  const sources = payload.sources ?? payload.citations ?? payload.sourceUrl;
  const hasSourceEvidence = Array.isArray(sources) ? sources.length > 0 : Boolean(sources);
  // The per-type rules (e.g. the PRAYER completeness check) need the body, and
  // different builders park it under different keys.
  const bodyRaw = payload.body ?? payload.text ?? payload.fullText ?? payload.content;
  const decision = evaluatePublishSafety({
    contentType: String(row.contentType ?? ""),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    bodyText: typeof bodyRaw === "string" ? bodyRaw : undefined,
    hasSourceEvidence,
  });
  return {
    ok: !decision.blocked,
    reason: decision.blocked ? decision.reasons.join(", ") : "publish-safety clear",
  };
}

/**
 * RESTORE. The ONLY content-mutating action in this file, and the only one that
 * can ever be: content unpublished by a gate that now passes is put back.
 *
 *   - Candidates come from the rollback ledger (restorable rows only), so this
 *     can only ever restore something the worker itself took down.
 *   - A row whose human review is still PENDING is left alone: a person is
 *     mid-decision on it. Only an EXPIRED / RESOLVED / absent review qualifies.
 *   - The deterministic publish-safety gate must pass NOW.
 *   - The current state is snapshotted first (content-protection.ts), so the
 *     restore is itself reversible, and the reason is logged.
 *   - Nothing here ever deletes or unpublishes.
 */
async function repairRestoreContent(ctx: RepairContext): Promise<Omit<RepairAction, "condition">> {
  const ledgerRows = await call<Array<Record<string, unknown>>>(
    ctx.prisma,
    "adminWorkerRollbackLedger",
    "findMany",
    {
      where: { restorable: true, rollbackResult: { in: ["UNPUBLISHED", "HUMAN_REVIEW"] } },
      orderBy: { createdAt: "desc" },
      take: ctx.limit,
    },
    [],
  );

  let examined = 0;
  let restored = 0;
  let blocked = 0;
  let awaitingReview = 0;
  const restoredSlugs: string[] = [];

  for (const entry of ledgerRows) {
    const contentId = String(entry.contentId ?? "");
    if (!contentId) continue;
    const row = await call<Record<string, unknown> | null>(
      ctx.prisma,
      "publishedContent",
      "findUnique",
      { where: { id: contentId } },
      null,
    );
    if (!row) continue;
    // Already live again — nothing to do (idempotent re-runs).
    if (row.isPublished === true) continue;
    examined += 1;

    // A PENDING rollback review means a person still owns this decision.
    const pending = await call<number>(
      ctx.prisma,
      "humanReviewQueue",
      "count",
      {
        where: {
          status: "PENDING",
          proposedAction: { in: [...ROLLBACK_REVIEW_ACTIONS] },
          contentTitle: String(row.title ?? ""),
        },
      },
      0,
    );
    if (pending > 0) {
      awaitingReview += 1;
      continue;
    }

    const gate = gatePasses({
      contentType: row.contentType,
      title: row.title,
      slug: row.slug,
      payload: row.payload,
    });
    if (!gate.ok) {
      blocked += 1;
      continue;
    }

    // Reversible: snapshot the current (unpublished) state before flipping it.
    await snapshotPublishedContent(ctx.prisma, contentId, {
      changeSummary: "pre-restore of content unpublished by a gate that now passes",
      reason: "self-maintenance restore",
      changeKind: "restore",
    }).catch(() => null);
    const updated = await call<Record<string, unknown> | null>(
      ctx.prisma,
      "publishedContent",
      "update",
      {
        where: { id: contentId },
        data: { isPublished: true, publishedAt: new Date(ctx.now), unpublishedAt: null },
      },
      null,
    );
    if (!updated) continue;
    restored += 1;
    restoredSlugs.push(String(row.slug ?? contentId));
    await writeAdminWorkerLog(ctx.prisma, {
      passId: ctx.passId,
      category: "PUBLISHING",
      severity: "WARN",
      eventName: "self_maintenance_content_restored",
      contentType: String(row.contentType ?? ""),
      relatedEntityId: contentId,
      message: `Self-maintenance re-published ${String(row.contentType ?? "content")} "${String(row.slug ?? contentId)}": it was unpublished by a gate that now passes (${gate.reason}). Snapshotted first; nothing was deleted.`,
      safeMetadata: { contentId, slug: row.slug ?? null, gate: gate.reason },
    }).catch(() => undefined);
  }

  return {
    repair: "restore_unpublished_content",
    attempted: true,
    succeeded: restored > 0,
    counts: { examined, restored, blocked, awaitingReview },
    detail: `examined ${examined} unpublished row(s): restored ${restored}, ${blocked} still blocked by the gate, ${awaitingReview} awaiting a human decision`,
  };
}

/**
 * Escalate what this module cannot fix, ONCE, instead of retrying forever.
 * Routed through the existing fileHumanReview path with `alwaysQueue` so it
 * survives full-autonomy mode — an operator needs a row for these.
 */
async function repairEscalate(
  ctx: RepairContext,
  condition: Condition,
  why: string,
): Promise<Omit<RepairAction, "condition">> {
  const filed = await fileHumanReview(ctx.prisma, {
    proposedAction: `self_maintenance_${condition.name.toLowerCase()}`,
    reason: `${condition.detail} — ${why}`,
    confidence: 0.9,
    blockingGate: condition.name,
    neededAction: "operator investigation: the worker cannot repair this on its own",
    repairSuggestion: condition.remedy,
    nextAutomatedAction: `backing off ${Math.round(CONDITION_BACKOFF_MS / HOUR)} h before re-checking`,
    alwaysQueue: true,
    sourceEvidence: { signals: condition.evidence.map((s) => ({ ...s })) },
  }).catch(() => null);
  return {
    repair: "escalate",
    attempted: true,
    succeeded: Boolean(filed),
    counts: { escalated: filed ? 1 : 0 },
    detail: `escalated ${condition.name}: ${why}`,
  };
}

/* ------------------------------------------------------------------ */
/* 4. VERIFY                                                           */
/* ------------------------------------------------------------------ */

/**
 * Re-read ONLY the signal the repair acted on. Cheap by design — a repair that
 * changes nothing has to be visible, but verification must not cost another
 * full sweep.
 */
async function reSense(
  prisma: PrismaClient,
  signalKey: string,
  now: number,
): Promise<number | null> {
  if (signalKey === "database_bytes") return readDatabaseBytes(prisma);
  if (signalKey.startsWith("ledger_rows:")) {
    const table = signalKey.slice("ledger_rows:".length);
    const model = TELEMETRY_TABLES.find((t) => t.table === table)?.model;
    if (!model) return null;
    return call<number>(prisma, model, "count", undefined, 0);
  }
  if (signalKey.startsWith("event_rate:") || signalKey === "paused_log_rate") {
    const eventName =
      signalKey === "paused_log_rate" ? "loop_paused" : signalKey.slice("event_rate:".length);
    // Ask the LEDGER, not the sampler. Asking the sampler whether the sampler
    // is suppressing the event it was just told to suppress is unconditionally
    // "yes", so an ineffective suppression was recorded as effective forever.
    // Counting the rows actually written over a recent window, normalised to
    // the same per-hour units as the signal, is a fact rather than an echo.
    const windowMs = Math.min(HOUR, Math.max(MINUTE, selfMaintenanceIntervalMs()));
    const written = await call<number>(
      prisma,
      "adminWorkerLog",
      "count",
      { where: { eventName, severity: "INFO", createdAt: { gte: new Date(now - windowMs) } } },
      0,
    );
    return Math.round((written * HOUR) / windowMs);
  }
  if (signalKey === "wedged_lanes") {
    // The SAME predicate SENSE used. It used to re-sense a narrower definition
    // (only "running past the watchdog"), so a repair that changed nothing
    // still verified as improved and the false diagnosis repeated forever.
    // Read-only: unlike SENSE this never writes the streak memory back.
    const rows = await call<Array<Record<string, unknown>>>(
      prisma,
      "adminWorkerLaneState",
      "findMany",
      {},
      [],
    );
    let wedged = 0;
    for (const row of rows) {
      const lane = String(row.lane ?? "");
      if (!lane) continue;
      const mem = await readMemory(prisma, laneKey(lane));
      if (laneWedgeState(row, mem, now).wedged) wedged += 1;
    }
    return wedged;
  }
  if (signalKey === "stale_cursors") {
    const rows = await call<Array<Record<string, unknown>>>(
      prisma,
      "adminWorkerMemory",
      "findMany",
      {
        where: { memoryType: "GENERIC", memoryKey: { startsWith: STRUCTURED_CURSOR_PREFIX } },
        take: 200,
      },
      [],
    );
    return rows.filter((r) => {
      const v = r.memoryValue;
      if (!v || typeof v !== "object" || Array.isArray(v)) return false;
      return isStaleCursor(v as Record<string, unknown>, now);
    }).length;
  }
  if (signalKey === "parked_artifacts") {
    return call<number>(
      prisma,
      "adminWorkerPackageArtifact",
      "count",
      {
        where: {
          status: { in: ["NEEDS_REVIEW", "NEEDS_REPAIR"] },
          updatedAt: { lt: new Date(now - ARTIFACT_PARKED_MS) },
          NOT: { gateDiagnosis: REQUEUE_MARKER },
        },
      },
      0,
    );
  }
  if (signalKey === "orphaned_unpublished") {
    // The SAME population SENSE counted. It used to count every unpublished
    // row for any reason (gate rejections, parish communion take-downs) — a
    // superset, so `before` and `after` were not comparable and a restore that
    // worked usually read as ineffective, escalated, and backed off for 6 h.
    return call<number>(
      prisma,
      "adminWorkerRollbackLedger",
      "count",
      { where: { restorable: true, rollbackResult: { in: ["UNPUBLISHED", "HUMAN_REVIEW"] } } },
      0,
    );
  }
  if (signalKey === "dead_tuple_ratio") {
    // Only an operator VACUUM FULL moves this; re-reading it is still honest.
    const stats = await readRelationStats(prisma);
    const worst = stats
      .filter((st) => st.bytes >= LEDGER_BYTES_WARN && st.deadTuples >= DEAD_TUPLES_FLOOR)
      .reduce((max, st) => Math.max(max, deadRatio(st)), 0);
    return Number(worst.toFixed(3));
  }
  // publish_futility can only be answered by the next 24 h of work.
  return null;
}

/* ------------------------------------------------------------------ */
/* the sweep                                                           */
/* ------------------------------------------------------------------ */

// In-process throttle. The durable copy lives in AdminWorkerMemory so a restart
// does not re-sweep immediately; this one avoids a memory read every pass.
let _lastRunAt = 0;

/** Test hook: forget the in-process throttle. */
export function resetSelfMaintenanceThrottle(): void {
  _lastRunAt = 0;
}

/**
 * Run one bounded, idempotent, fail-open self-maintenance sweep.
 *
 * Throttled to `ADMIN_WORKER_SELF_MAINT_INTERVAL_MS` (default 15 min) so the
 * `maint-self-heal` lane can call it every pass for free. Writes ONE
 * AdminWorkerLog row per action actually taken and NONE when there is nothing
 * to do — that is the difference between this module and the bug it repairs.
 */
export async function runSelfMaintenance(
  prisma: PrismaClient,
  opts: SelfMaintenanceOptions = {},
): Promise<SelfMaintenanceResult> {
  const now = opts.now ?? Date.now();
  const startedAt = new Date(now).toISOString();
  const empty = (skippedReason: string): SelfMaintenanceResult => ({
    ran: false,
    skippedReason,
    startedAt,
    durationMs: 0,
    signals: [],
    conditions: [],
    repairs: [],
    verifications: [],
    actionsTaken: 0,
    escalations: 0,
  });

  if (!selfMaintenanceEnabled()) return empty("disabled");

  const intervalMs = selfMaintenanceIntervalMs();
  if (!opts.force) {
    if (_lastRunAt > 0 && now - _lastRunAt < intervalMs) return empty("throttled");
    const durable = await readMemory(prisma, LAST_RUN_KEY);
    const lastAt = num(durable.at);
    if (lastAt > 0 && now - lastAt < intervalMs) {
      _lastRunAt = lastAt;
      return empty("throttled");
    }
  }
  _lastRunAt = now;
  await writeMemory(prisma, LAST_RUN_KEY, { at: now });

  const limit = Math.max(1, Math.min(500, opts.limit ?? 25));
  const started = Date.now();

  let reading: SenseReading;
  try {
    reading = await senseSelfHealth(prisma, { now });
  } catch {
    // A failing SENSE must never stop a pass: report an empty sweep.
    return { ...empty("sense_failed"), ran: true, durationMs: Date.now() - started };
  }

  const conditions = diagnoseConditions(reading);
  const ctx: RepairContext = { prisma, reading, now, limit, passId: opts.passId };
  const repairs: RepairAction[] = [];
  const verifications: VerifyResult[] = [];
  let escalations = 0;

  for (const condition of conditions) {
    const memory = await readConditionMemory(prisma, condition.name);
    if (memory.backoffUntil != null && memory.backoffUntil > now) {
      // Already escalated and backing off — do NOT retry, and do NOT log.
      repairs.push({
        condition: condition.name,
        repair: condition.remedy,
        attempted: false,
        succeeded: false,
        backedOff: true,
        counts: {},
        detail: `backing off until ${new Date(memory.backoffUntil).toISOString()}`,
      });
      continue;
    }

    const envSwitch = REPAIR_ENV_SWITCH[condition.remedy];
    if (!envOn(envSwitch)) {
      repairs.push({
        condition: condition.name,
        repair: condition.remedy,
        attempted: false,
        succeeded: false,
        disabledBy: envSwitch,
        counts: {},
        detail: `repair disabled by ${envSwitch}=0`,
      });
      continue;
    }

    // `before` MUST be the signal VERIFY will re-read, not merely the first
    // piece of evidence. For LEDGER_BLOAT those were different things in
    // different units — evidence[0] was a ROW COUNT and the re-read was
    // pg_database_size in BYTES — so `after < before` could never hold and a
    // working trim disabled itself for six hours.
    const verifySignal =
      condition.evidence.find((s) => s.key === condition.signalKey) ?? condition.evidence[0];
    const before = verifySignal?.value ?? 0;
    let result: Omit<RepairAction, "condition">;
    try {
      switch (condition.remedy) {
        case "trim_telemetry":
          result = await repairTrimTelemetry(ctx);
          break;
        case "sample_noisy_event":
          result = repairSampleNoisyEvents(ctx, condition.name);
          break;
        case "reset_wedged_lane":
          result = await repairWedgedLanes(ctx);
          break;
        case "reset_cursor":
          result = await repairStaleCursors(ctx);
          break;
        case "requeue_artifact":
          result = await repairParkedArtifacts(ctx);
          break;
        case "restore_unpublished_content":
          result = await repairRestoreContent(ctx);
          break;
        case "escalate":
        default:
          result = await repairEscalate(ctx, condition, "no automated remedy exists");
          escalations += result.succeeded ? 1 : 0;
          break;
      }
    } catch (err) {
      result = {
        repair: condition.remedy,
        attempted: true,
        succeeded: false,
        counts: {},
        detail: `repair threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const action: RepairAction = { condition: condition.name, ...result };
    repairs.push(action);

    // ── VERIFY ────────────────────────────────────────────────────────
    const after = await reSense(prisma, condition.signalKey, now).catch(() => null);
    // A trim is verified by what it MOVED, not only by the count afterwards.
    // Deleting rows is real progress against a multi-million-row backlog even
    // though the table is still over the threshold this sweep — judging it on
    // "is the signal below the line yet" is what made a productive prune look
    // ineffective and switch itself off.
    const movedRows = condition.remedy === "trim_telemetry" && num(action.counts.rowsPruned) > 0;
    // "Improved" otherwise means the signal it acted on actually moved down.
    // When the signal can't be re-read (publish futility needs another 24 h),
    // fall back to whether the repair itself reported success.
    const improved =
      movedRows || (after == null ? action.succeeded : after < before || after === 0);
    const consecutiveFailures = improved ? 0 : memory.failures + 1;
    const shouldEscalate =
      !improved && consecutiveFailures >= VERIFY_FAILURE_LIMIT && condition.remedy !== "escalate";
    let backoffUntil: number | null = null;
    if (!improved && consecutiveFailures >= VERIFY_FAILURE_LIMIT) {
      backoffUntil = now + CONDITION_BACKOFF_MS;
      if (shouldEscalate && envOn(REPAIR_ENV_SWITCH.escalate)) {
        const esc = await repairEscalate(
          ctx,
          condition,
          `${consecutiveFailures} consecutive repairs did not move ${condition.signalKey}`,
        );
        if (esc.succeeded) escalations += 1;
      }
    } else if (condition.remedy === "escalate" && action.succeeded) {
      // A condition whose ONLY remedy is "tell a human" has now told them.
      // Without this it re-files a HumanReviewQueue row every 15 minutes for
      // as long as the condition holds — the same "log it again" reflex this
      // module exists to stop. Back it off for the standard window instead.
      backoffUntil = now + CONDITION_BACKOFF_MS;
    }
    await writeMemory(prisma, conditionKey(condition.name), {
      failures: consecutiveFailures,
      backoffUntil,
      lastValue: after ?? before,
    });
    verifications.push({
      condition: condition.name,
      signalKey: condition.signalKey,
      before,
      after: after ?? before,
      improved,
      consecutiveFailures,
      escalated: shouldEscalate,
      backoffUntil: backoffUntil == null ? null : new Date(backoffUntil).toISOString(),
    });

    // ONE ledger row per ACTION TAKEN. Never per tick, never for a clean sweep.
    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "REPAIR",
      severity: action.succeeded ? "INFO" : "WARN",
      eventName: "self_maintenance_action",
      message: `Self-maintenance ${condition.name} → ${action.repair}: ${action.detail}. Verified: ${condition.signalKey} ${before} → ${after ?? "n/a"} (${improved ? "improved" : "no change"}).`,
      safeMetadata: {
        condition: condition.name,
        severity: condition.severity,
        repair: action.repair,
        succeeded: action.succeeded,
        counts: action.counts,
        evidence: condition.evidence.map((s) => ({ ...s })),
        verify: { signalKey: condition.signalKey, before, after, improved, consecutiveFailures },
      },
    }).catch(() => undefined);
  }

  const result: SelfMaintenanceResult = {
    ran: true,
    startedAt,
    durationMs: Date.now() - started,
    signals: reading.signals,
    conditions,
    repairs,
    verifications,
    actionsTaken: repairs.filter((r) => r.attempted).length,
    escalations,
  };

  // Persist the sweep's own snapshot so the admin report can READ it rather
  // than re-sense on a page request (readSelfMaintenanceSummary in
  // operational-summary.ts). Without this the report cannot show (a) the
  // conditions skipped because they are backed off or disabled by env, which
  // write no ledger row by design, or (b) the database/ledger size on a
  // HEALTHY sweep, which also writes no row — i.e. a 21 GB database with a
  // working trim would be invisible. One upsert per ~15-minute sweep; it is a
  // snapshot, not a ledger row, so it cannot grow. Deliberately NOT written on
  // the disabled / throttled / sense_failed early returns: leaving the last
  // good snapshot in place is what makes the page correct between sweeps.
  await writeMemory(prisma, `${MEMORY_PREFIX}last-result`, {
    at: now,
    durationMs: result.durationMs,
    actionsTaken: result.actionsTaken,
    escalations,
    signals: result.signals.map((s) => ({ ...s })),
    conditions: conditions.map((c) => ({
      name: c.name,
      severity: c.severity,
      remedy: c.remedy,
      signalKey: c.signalKey,
      detail: c.detail,
    })),
    repairs: repairs.map((r) => ({ ...r, counts: { ...r.counts } })),
  });

  return result;
}

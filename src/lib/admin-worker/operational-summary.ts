/**
 * Operational self-awareness summary (adaptive-worker Phase A/F capstone).
 *
 * Composes the signals the worker already records into ONE answer to the
 * operator's real questions:
 *   - What am I doing right now?         → active lanes + current action
 *   - Am I actually working?             → heartbeat freshness + last pass
 *   - Which strategy am I using?         → best method per dimension
 *   - Why isn't more publishing?         → the BUILD_READY per-gate backlog
 *   - What changed after a code update?  → latest recorded code version
 *   - What should I try next?            → derived next-best-action
 *
 * Pure composition over existing reads — no new writes, fail-open on every
 * query so a missing table degrades a field instead of breaking the summary.
 */

import type { PrismaClient } from "@prisma/client";

import { getLaneStates } from "./lanes";

export interface OperationalSummary {
  /** Heartbeat fresh AND not paused AND last pass not failed. */
  working: boolean;
  heartbeatAgeSeconds: number | null;
  paused: boolean;
  /** Lanes that ran/are running this cycle, with last outcome. */
  lanes: Array<{ lane: string; status: string; lastOutcome: string | null }>;
  activeLaneCount: number;
  erroredLaneCount: number;
  /** The action the brain most recently selected. */
  currentAction: { missionStage: string | null; reason: string | null; at: Date | null } | null;
  /** Best-performing method per learned dimension. */
  bestStrategies: Array<{ dimension: string; method: string; ewma: number }>;
  /** Per-gate BUILD_READY/VERIFICATION_READY backlog — why items aren't published. */
  buildReadyGates: Array<{ gate: string; count: number }>;
  buildReadyBacklog: number;
  /** Latest running code version (what changed after a deploy). */
  codeVersion: { versionLabel: string; sha: string | null; changedSummary: string | null } | null;
  openEscalations: number;
  /**
   * Content the worker unpublished after a post-publish failure whose
   * restore-vs-delete review has EXPIRED without a decision: hidden from the
   * public site with no open signal anywhere else, so it is surfaced here.
   */
  unpublishedAwaitingDecision: number;
  /**
   * The worker's account of the maintenance it performs ON ITSELF: what its
   * last sweep found, what it repaired, what it escalated, and how big its own
   * ledger has grown. Read from persisted rows only — see
   * `readSelfMaintenanceSummary`.
   */
  selfMaintenance: SelfMaintenanceSummary;
  /** One-line derived recommendation of the highest-value next action. */
  nextBestAction: string;
}

/** Review actions the post-publish rollback files after unpublishing (post-publish-rollback.ts). */
const ROLLBACK_REVIEW_ACTIONS = [
  "restore_or_delete_unpublished_content",
  "investigate_post_publish_failure",
];

export async function buildOperationalSummary(prisma: PrismaClient): Promise<OperationalSummary> {
  const now = Date.now();

  const [
    state,
    lanes,
    lastDecision,
    strategyStats,
    gateRows,
    codeVersion,
    openEscalations,
    unpublishedAwaitingDecision,
    selfMaintenance,
  ] = await Promise.all([
    prisma.adminWorkerState.findUnique({ where: { id: "singleton" } }).catch(() => null),
    getLaneStates(prisma),
    prisma.adminWorkerActionScore
      .findFirst({
        where: { selected: true },
        orderBy: { createdAt: "desc" },
        select: { missionStage: true, reason: true, createdAt: true },
      })
      .catch(() => null),
    prisma.adminWorkerStrategyStat
      .findMany({
        orderBy: [{ dimension: "asc" }, { ewma: "desc" }],
        select: { dimension: true, method: true, ewma: true },
        take: 60,
      })
      .catch(() => [] as Array<{ dimension: string; method: string; ewma: number }>),
    prisma.adminWorkerPackageArtifact
      .groupBy({
        by: ["gateDiagnosis"],
        where: { status: { in: ["BUILD_READY", "VERIFICATION_READY"] } },
        _count: { _all: true },
      })
      .catch(() => [] as Array<{ gateDiagnosis: string | null; _count: { _all: number } }>),
    prisma.adminWorkerCodeVersion
      .findFirst({
        orderBy: { capturedAt: "desc" },
        select: { versionLabel: true, sha: true, changedSummary: true },
      })
      .catch(() => null),
    prisma.adminWorkerEscalation.count({ where: { resolvedAt: null } }).catch(() => 0),
    prisma.humanReviewQueue
      .count({ where: { status: "EXPIRED", proposedAction: { in: ROLLBACK_REVIEW_ACTIONS } } })
      .catch(() => 0),
    // Reads the sweep's persisted snapshot; never re-senses (see the module
    // note above) so this page request stays cheap.
    readSelfMaintenanceSummary(prisma, { now }).catch(() => emptySelfMaintenanceSummary()),
  ]);

  const heartbeatAgeSeconds = state?.lastHeartbeatAt
    ? Math.round((now - new Date(state.lastHeartbeatAt).getTime()) / 1000)
    : null;
  const paused = Boolean(state?.paused);
  const working =
    !paused &&
    heartbeatAgeSeconds !== null &&
    heartbeatAgeSeconds < 5 * 60 &&
    !state?.currentBlocker;

  const laneRows = lanes.map((l) => ({
    lane: l.lane,
    status: l.status,
    lastOutcome: l.lastError ?? l.lastOutcome ?? null,
  }));

  // Best method per dimension (stats pre-sorted ewma desc within dimension).
  const bestByDim = new Map<string, { dimension: string; method: string; ewma: number }>();
  for (const s of strategyStats) {
    if (!bestByDim.has(s.dimension)) {
      bestByDim.set(s.dimension, { dimension: s.dimension, method: s.method, ewma: s.ewma });
    }
  }

  const buildReadyGates = gateRows
    .map((r) => ({ gate: r.gateDiagnosis ?? "UNDIAGNOSED", count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const buildReadyBacklog = buildReadyGates.reduce((sum, g) => sum + g.count, 0);

  const erroredLaneCount = laneRows.filter((l) => l.status === "error").length;
  const activeLaneCount = laneRows.filter((l) => l.status === "running").length;

  return {
    working,
    heartbeatAgeSeconds,
    paused,
    lanes: laneRows,
    activeLaneCount,
    erroredLaneCount,
    currentAction: lastDecision
      ? {
          missionStage: lastDecision.missionStage,
          reason: lastDecision.reason,
          at: lastDecision.createdAt,
        }
      : null,
    bestStrategies: [...bestByDim.values()],
    buildReadyGates,
    buildReadyBacklog,
    codeVersion,
    openEscalations,
    unpublishedAwaitingDecision,
    selfMaintenance,
    nextBestAction: deriveNextBestAction({
      paused,
      working,
      buildReadyGates,
      buildReadyBacklog,
      openEscalations,
      erroredLaneCount,
      currentAction: lastDecision?.missionStage ?? null,
      unpublishedAwaitingDecision,
      selfMaintenance,
    }),
  };
}

/**
 * Derive the single highest-value next action from the composed state,
 * mission-aware: optimise for meaningful progress (drain toward publish, clear
 * blockers) over raw activity.
 */
export function deriveNextBestAction(input: {
  paused: boolean;
  working: boolean;
  buildReadyGates: Array<{ gate: string; count: number }>;
  buildReadyBacklog: number;
  openEscalations: number;
  erroredLaneCount: number;
  currentAction: string | null;
  unpublishedAwaitingDecision?: number;
  /** Optional: absent for callers that only derive the pipeline recommendation. */
  selfMaintenance?: Pick<SelfMaintenanceSummary, "conditions" | "backedOff"> | null;
}): string {
  if (input.paused) return "Worker is paused — resume it to continue autonomous work.";
  if (input.openEscalations > 0) {
    return `Address ${input.openEscalations} open escalation(s) — a condition needs attention before it blocks progress.`;
  }
  // Content a person still has to restore or delete outranks pipeline work: it
  // is already vetted content missing from the public site.
  if ((input.unpublishedAwaitingDecision ?? 0) > 0) {
    return `Decide restore-vs-delete for ${input.unpublishedAwaitingDecision} unpublished item(s) whose review expired — they stay hidden until a person decides.`;
  }
  if (input.erroredLaneCount > 0) {
    return `${input.erroredLaneCount} lane(s) are in error-backoff — inspect the failing lane; it auto-retries after cooldown.`;
  }
  // A self-maintenance condition the worker could NOT repair (it repaired,
  // re-read the signal, saw no movement, and backed off) outranks pipeline
  // work: it is the shape of the failure that ran for 30 days unattended.
  const stuckMaintenance = input.selfMaintenance?.backedOff?.[0];
  if (stuckMaintenance) {
    return `Self-maintenance gave up on ${stuckMaintenance.condition} after ${stuckMaintenance.failures} ineffective repair(s) — it needs a person before the next retry.`;
  }
  const criticalMaintenance = input.selfMaintenance?.conditions?.find(
    (c) => c.severity === "critical",
  );
  if (criticalMaintenance) {
    return `Self-maintenance raised ${criticalMaintenance.name} (critical) — its remedy ${criticalMaintenance.remedy} runs on the next sweep; check it clears.`;
  }
  if (input.buildReadyBacklog > 0) {
    // Name the dominant blocking gate so the recommendation is concrete.
    const top = input.buildReadyGates[0];
    const gateHint: Record<string, string> = {
      AWAITING_QA: "run strict QA on the built backlog",
      AWAITING_VERIFICATION: "run cross-source verification on the built backlog",
      VERIFICATION_INCOMPLETE: "gather the remaining validation evidence",
      MISSING_REQUIRED_FIELDS: "repair artifacts missing required fields",
      MISSING_CITATIONS: "attach citations/provenance to built artifacts",
      LOW_CONFIDENCE: "re-extract low-confidence artifacts from a stronger source",
      DUPLICATE: "resolve duplicate artifacts",
    };
    const hint = top
      ? (gateHint[top.gate] ?? "drain the built backlog toward publish")
      : "drain the built backlog toward publish";
    return `Drain the BUILD_READY backlog (${input.buildReadyBacklog} item(s)); dominant gate ${top?.gate ?? "?"} → ${hint}.`;
  }
  if (!input.working) return "Worker is not heartbeating fresh — check the process is running.";
  return input.currentAction
    ? `Continue the current mission stage (${input.currentAction}); no backlog or blockers detected.`
    : "Generate new work — no backlog or blockers detected.";
}

/* ------------------------------------------------------------------ */
/* self-maintenance                                                    */
/* ------------------------------------------------------------------ */

/*
 * The worker's self-maintenance sweep (src/lib/admin-worker/self-maintenance.ts)
 * senses its own health, repairs what it can and verifies the repair. It must
 * account for that work in the operator-facing report exactly like publishing
 * does — otherwise the sweep is as invisible as the failure it exists to catch
 * (production wrote ~7 M ledger rows and published nothing for 30 days while
 * `worker_stuck` fired 207,830 times and nobody saw it).
 *
 * This reader is DELIBERATELY a reader. It re-senses nothing: sensing means
 * pg_class + pg_database_size + exact counts, which is a worker-lane cost, not
 * an admin-page-request cost. Everything below comes from rows the sweep has
 * already persisted — the AdminWorkerMemory snapshot and the ledger rows it
 * writes — so this stays two indexed queries no matter how sick the worker is.
 *
 * It also imports NOTHING from self-maintenance.ts (not even for constants):
 * that module pulls in publish-safety, content-protection and human-review,
 * which is exactly the "barrel drags the worker tree into the web server"
 * problem the diagnostics page's import comment warns about. The thresholds
 * are carried on the persisted signals themselves.
 */

/** Memory keys `self-maintenance.ts` persists under memoryType GENERIC. */
const SELF_MAINT_PREFIX = "self-maintenance:";
const SELF_MAINT_LAST_RUN_KEY = `${SELF_MAINT_PREFIX}last-run`;
const SELF_MAINT_LAST_RESULT_KEY = `${SELF_MAINT_PREFIX}last-result`;
const SELF_MAINT_CONDITION_PREFIX = `${SELF_MAINT_PREFIX}condition:`;
/** The ledger events one sweep writes — one row per action actually taken. */
const SELF_MAINT_ACTION_EVENT = "self_maintenance_action";
const SELF_MAINT_RESTORE_EVENT = "self_maintenance_content_restored";
const SELF_MAINT_EVENTS = [SELF_MAINT_ACTION_EVENT, SELF_MAINT_RESTORE_EVENT];
const LEDGER_ROWS_SIGNAL_PREFIX = "ledger_rows:";
const DAY_MS = 24 * 60 * 60 * 1000;

export type SelfMaintenanceSeverity = "ok" | "warn" | "critical";

/** One measured fact about the worker's own health, as the sweep recorded it. */
export interface SelfMaintenanceSignal {
  key: string;
  severity: SelfMaintenanceSeverity;
  value: number;
  threshold: number;
  detail: string;
}

/** A named diagnosis the last sweep raised. */
export interface SelfMaintenanceCondition {
  name: string;
  severity: "warn" | "critical";
  remedy: string;
  detail: string;
}

/** Repairs of one kind, aggregated over the reporting window. */
export interface SelfMaintenanceRepair {
  condition: string;
  repair: string;
  attempts: number;
  succeeded: number;
  /** Summed per count key, e.g. { rowsPruned: 12000, decisions: 4000 }. */
  counts: Record<string, number>;
  /** True when at least one attempt actually moved the signal it acted on. */
  verified: boolean;
  lastAt: Date;
  detail: string;
}

export interface SelfMaintenanceEscalation {
  condition: string;
  detail: string;
  at: Date;
}

/** A condition whose repair kept failing: escalated, then left alone. */
export interface SelfMaintenanceBackoff {
  condition: string;
  failures: number;
  until: Date;
}

/** Persisted size measurement — never recomputed on an admin page request. */
export interface SelfMaintenanceSize {
  databaseBytes: number;
  databaseThresholdBytes: number;
  largestTable: string | null;
  largestTableRows: number;
  rowThreshold: number;
  measuredAt: Date | null;
}

export interface SelfMaintenanceSummary {
  /** False until the sweep has run once — an absence, not a fault. */
  everRan: boolean;
  lastSweepAt: Date | null;
  lastSweepAgeSeconds: number | null;
  /** Conditions the most recent sweep raised, worst first. */
  conditions: SelfMaintenanceCondition[];
  /** Repairs recorded in the last 24 h, most recent first. */
  repairs: SelfMaintenanceRepair[];
  repairsApplied24h: number;
  /** Content rows the sweep re-published after a gate that had blocked them passed. */
  contentRestored24h: number;
  escalations: SelfMaintenanceEscalation[];
  backedOff: SelfMaintenanceBackoff[];
  size: SelfMaintenanceSize | null;
  /** Swept recently, nothing raised, nothing escalated, nothing backed off. */
  healthy: boolean;
  /** One plain-language line, safe to render verbatim. */
  headline: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asConditionSeverity(value: unknown): "warn" | "critical" {
  return value === "critical" ? "critical" : "warn";
}

function parseSignals(value: unknown): SelfMaintenanceSignal[] {
  if (!Array.isArray(value)) return [];
  const out: SelfMaintenanceSignal[] = [];
  for (const raw of value) {
    const r = asRecord(raw);
    const key = typeof r.key === "string" ? r.key : "";
    if (!key) continue;
    out.push({
      key,
      severity:
        r.severity === "critical" ? "critical" : r.severity === "warn" ? "warn" : ("ok" as const),
      value: asFiniteNumber(r.value),
      threshold: asFiniteNumber(r.threshold),
      detail: typeof r.detail === "string" ? r.detail : "",
    });
  }
  return out;
}

/**
 * Fold the persisted `database_bytes` / `ledger_rows:*` signals into the one
 * size line the report shows. Each signal carries its own threshold, so the
 * page never has to know (or import) the sweep's constants.
 */
function sizeFromSignals(
  signals: SelfMaintenanceSignal[],
  measuredAt: Date | null,
): SelfMaintenanceSize | null {
  const db = signals.find((s) => s.key === "database_bytes");
  const tables = signals.filter((s) => s.key.startsWith(LEDGER_ROWS_SIGNAL_PREFIX));
  if (!db && tables.length === 0) return null;
  let largestTable: string | null = null;
  let largestTableRows = 0;
  let rowThreshold = 0;
  for (const t of tables) {
    if (largestTable === null || t.value > largestTableRows) {
      largestTable = t.key.slice(LEDGER_ROWS_SIGNAL_PREFIX.length);
      largestTableRows = t.value;
      rowThreshold = t.threshold;
    }
  }
  return {
    databaseBytes: db?.value ?? 0,
    databaseThresholdBytes: db?.threshold ?? 0,
    largestTable,
    largestTableRows,
    rowThreshold,
    measuredAt,
  };
}

interface SelfMaintLogRow {
  createdAt: Date;
  severity: string;
  eventName: string;
  message: string;
  safeMetadata: unknown;
}

interface SelfMaintMemoryRow {
  memoryKey: string;
  memoryValue: unknown;
  lastUsedAt: Date | null;
}

function emptySelfMaintenanceSummary(): SelfMaintenanceSummary {
  return {
    everRan: false,
    lastSweepAt: null,
    lastSweepAgeSeconds: null,
    conditions: [],
    repairs: [],
    repairsApplied24h: 0,
    contentRestored24h: 0,
    escalations: [],
    backedOff: [],
    size: null,
    // Not yet swept is not "unhealthy" — it is simply unmeasured. The headline
    // says so instead of showing an alarming empty state.
    healthy: false,
    headline:
      "Self-maintenance has not swept yet — it sweeps automatically while the Admin Worker is on.",
  };
}

/**
 * Read the worker's own maintenance state from what the sweep already wrote.
 *
 * TWO indexed queries, both fail-open:
 *   1. the `self-maintenance:*` AdminWorkerMemory rows (last sweep time, the
 *      last sweep's snapshot, per-condition verify/backoff state);
 *   2. the `self_maintenance_*` ledger rows from the last 24 h (what was
 *      repaired, with counts and whether the repair verified).
 */
export async function readSelfMaintenanceSummary(
  prisma: PrismaClient,
  opts: { now?: number } = {},
): Promise<SelfMaintenanceSummary> {
  const now = opts.now ?? Date.now();
  const since = new Date(now - DAY_MS);

  // Fail-open on a client that does not expose these delegates at all (a test
  // double, a partially-generated client): report "not swept", never throw.
  // This renders on an admin page, so it must not be able to take the page
  // down.
  if (
    typeof prisma?.adminWorkerMemory?.findMany !== "function" ||
    typeof prisma?.adminWorkerLog?.findMany !== "function"
  ) {
    return emptySelfMaintenanceSummary();
  }

  const [memoryRows, logRows] = await Promise.all([
    prisma.adminWorkerMemory
      .findMany({
        where: { memoryType: "GENERIC", memoryKey: { startsWith: SELF_MAINT_PREFIX } },
        select: { memoryKey: true, memoryValue: true, lastUsedAt: true },
        take: 100,
      })
      .catch(() => [] as SelfMaintMemoryRow[]),
    prisma.adminWorkerLog
      .findMany({
        where: { eventName: { in: SELF_MAINT_EVENTS }, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          createdAt: true,
          severity: true,
          eventName: true,
          message: true,
          safeMetadata: true,
        },
      })
      .catch(() => [] as SelfMaintLogRow[]),
  ]);

  const memory = new Map<string, SelfMaintMemoryRow>();
  for (const row of (memoryRows ?? []) as SelfMaintMemoryRow[]) {
    if (typeof row?.memoryKey === "string") memory.set(row.memoryKey, row);
  }

  const summary = emptySelfMaintenanceSummary();

  // ── when did the sweep last run ────────────────────────────────────
  const lastRun = asRecord(memory.get(SELF_MAINT_LAST_RUN_KEY)?.memoryValue);
  const lastResultRow = memory.get(SELF_MAINT_LAST_RESULT_KEY);
  const lastResult = asRecord(lastResultRow?.memoryValue);
  const lastRunAt = asFiniteNumber(lastRun.at) || asFiniteNumber(lastResult.at);
  if (lastRunAt > 0) {
    summary.everRan = true;
    summary.lastSweepAt = new Date(lastRunAt);
    summary.lastSweepAgeSeconds = Math.max(0, Math.round((now - lastRunAt) / 1000));
  }

  // ── per-condition verify state (only the sweep persists this) ──────
  for (const [key, row] of memory) {
    if (!key.startsWith(SELF_MAINT_CONDITION_PREFIX)) continue;
    const value = asRecord(row.memoryValue);
    const until = asFiniteNumber(value.backoffUntil);
    if (until > now) {
      summary.backedOff.push({
        condition: key.slice(SELF_MAINT_CONDITION_PREFIX.length),
        failures: Math.max(0, asFiniteNumber(value.failures)),
        until: new Date(until),
      });
    }
  }
  summary.backedOff.sort((a, b) => b.until.getTime() - a.until.getTime());

  // ── what the last sweep did, from the ledger rows it wrote ─────────
  const rows = ((logRows ?? []) as SelfMaintLogRow[]).map((r) => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
  }));

  summary.contentRestored24h = rows.filter((r) => r.eventName === SELF_MAINT_RESTORE_EVENT).length;

  const actions = rows.filter((r) => r.eventName === SELF_MAINT_ACTION_EVENT);
  const byRepair = new Map<string, SelfMaintenanceRepair>();
  // Rows written at or after the sweep's start marker belong to the LAST sweep,
  // so they are what is raised "now" rather than what was raised today.
  const lastSweepCutoff = lastRunAt > 0 ? lastRunAt - 1000 : Number.POSITIVE_INFINITY;
  const currentConditions = new Map<string, SelfMaintenanceCondition>();

  for (const row of actions) {
    const meta = asRecord(row.safeMetadata);
    const condition = typeof meta.condition === "string" ? meta.condition : "UNKNOWN";
    const repair = typeof meta.repair === "string" ? meta.repair : "unknown";
    const succeeded = meta.succeeded === true;
    const verify = asRecord(meta.verify);
    const improved = verify.improved === true;

    const key = `${condition}|${repair}`;
    const existing = byRepair.get(key);
    const counts = asRecord(meta.counts);
    const target: SelfMaintenanceRepair = existing ?? {
      condition,
      repair,
      attempts: 0,
      succeeded: 0,
      counts: {},
      verified: false,
      // `actions` is newest-first, so the first row of a key is its latest.
      lastAt: row.createdAt,
      detail: row.message,
    };
    target.attempts += 1;
    target.succeeded += succeeded ? 1 : 0;
    target.verified = target.verified || improved;
    for (const [countKey, countValue] of Object.entries(counts)) {
      const n = asFiniteNumber(countValue);
      if (n === 0) continue;
      target.counts[countKey] = (target.counts[countKey] ?? 0) + n;
    }
    byRepair.set(key, target);

    if (repair === "escalate" && summary.escalations.length < 20) {
      summary.escalations.push({ condition, detail: row.message, at: row.createdAt });
    }

    if (row.createdAt.getTime() >= lastSweepCutoff && !currentConditions.has(condition)) {
      currentConditions.set(condition, {
        name: condition,
        severity: asConditionSeverity(meta.severity),
        remedy: repair,
        detail:
          parseSignals(meta.evidence)
            .map((s) => s.detail)
            .filter(Boolean)
            .join("; ") || row.message,
      });
    }
  }

  summary.repairs = [...byRepair.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  summary.repairsApplied24h = actions.length;

  // ── conditions + sizes: the sweep's own snapshot wins when present ──
  const snapshotConditions = Array.isArray(lastResult.conditions) ? lastResult.conditions : null;
  if (snapshotConditions) {
    summary.conditions = snapshotConditions
      .map((raw) => asRecord(raw))
      .filter((c) => typeof c.name === "string" && c.name.length > 0)
      .map((c) => ({
        name: String(c.name),
        severity: asConditionSeverity(c.severity),
        remedy: typeof c.remedy === "string" ? c.remedy : "escalate",
        detail: typeof c.detail === "string" ? c.detail : "",
      }));
  } else {
    summary.conditions = [...currentConditions.values()];
  }
  summary.conditions.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1,
  );

  const snapshotSignals = parseSignals(lastResult.signals);
  summary.size = snapshotSignals.length
    ? sizeFromSignals(snapshotSignals, summary.lastSweepAt)
    : // Fall back to the evidence the ledger-pressure repair carried with it.
      sizeFromSignals(
        actions
          .map((r) => parseSignals(asRecord(r.safeMetadata).evidence))
          .find((s) =>
            s.some(
              (x) => x.key === "database_bytes" || x.key.startsWith(LEDGER_ROWS_SIGNAL_PREFIX),
            ),
          ) ?? [],
        actions[0]?.createdAt ?? summary.lastSweepAt,
      );

  summary.healthy =
    summary.everRan &&
    summary.conditions.length === 0 &&
    summary.backedOff.length === 0 &&
    summary.escalations.length === 0;

  summary.headline = selfMaintenanceHeadline(summary);
  return summary;
}

/** The plain-language line the operator reads first. */
export function selfMaintenanceHeadline(s: SelfMaintenanceSummary): string {
  if (!s.everRan) {
    return "Self-maintenance has not swept yet — it sweeps automatically while the Admin Worker is on.";
  }
  const when = describeAge(s.lastSweepAgeSeconds);
  if (s.healthy) {
    return s.repairsApplied24h > 0
      ? `Healthy — last swept ${when}; ${s.repairsApplied24h} repair(s) applied in the last 24 h and nothing is raised now.`
      : `Healthy — last swept ${when}; nothing to repair.`;
  }
  const parts: string[] = [];
  if (s.conditions.length > 0) {
    parts.push(
      `${s.conditions.length} condition(s) raised: ${s.conditions.map((c) => c.name).join(", ")}`,
    );
  }
  if (s.escalations.length > 0) parts.push(`${s.escalations.length} escalated to a person`);
  if (s.backedOff.length > 0) {
    parts.push(`${s.backedOff.length} condition(s) backed off after repeated ineffective repairs`);
  }
  return `Last swept ${when}: ${parts.join("; ")}.`;
}

function describeAge(seconds: number | null): string {
  if (seconds == null) return "never";
  if (seconds < 90) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 48 * 3600) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / (24 * 3600))}d ago`;
}

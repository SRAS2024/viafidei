/**
 * Remote command centre — the server half of the iPhone remote control.
 *
 * The macOS app talks to the local worker host over loopback and gets
 * `GET /api/status` (the supervisor's own process view) and `GET /api/snapshot`
 * (the ~30-query command-centre snapshot). A phone cannot reach that loopback
 * surface, so it reads the deployed app over HTTPS instead. This module builds
 * the two payloads that stand in for those, from the durable rows the Mac host
 * already writes:
 *
 *   - the master switch          (execution-host.ts)
 *   - the execution lease        (execution-host.ts)
 *   - the Mac host presence row  (host-presence.ts — "is the Mac app up?")
 *   - AdminWorkerState           (state.ts — "is the WORKER working?")
 *
 * The phone never runs the worker. It writes the switch row; the Mac host's
 * reconcile poll (switch-poll.ts, 7 s) makes reality match it. Everything here
 * is therefore read-only except the deliberate switch mutation in the route.
 *
 * TWO THINGS THIS FILE EXISTS TO PREVENT
 *
 *  1. A phone poll becoming a production workload. `loadCommandCenterSnapshot`
 *     is roughly thirty queries against the production database. The local host
 *     already caches it (20 s running / 5 min idle) for exactly that reason; a
 *     phone on mobile data must not be a second, uncached client of it. So the
 *     snapshot here is single-flighted (never two concurrent loads) and cached
 *     per server instance, and the cheap status payload has its own 2 s cache so
 *     a fast poll cannot multiply the three small reads either.
 *
 *  2. A 300 KB JSON over cellular. The desktop dashboard renders the whole
 *     snapshot in a wide grid; the phone renders the same cards on a 390 pt
 *     screen. `trimSnapshotForMobile` projects every collection down to the
 *     fields the dashboard actually reads, caps the row counts to what fits a
 *     phone, truncates long free text, and drops the two heavy items outright
 *     (the raw `brain.latestDecision` log row and the homepage drafts' page
 *     payloads). See TRIM_LIMITS for the numbers.
 *
 * The caches are per server instance and in-memory: correctness never depends
 * on them (every value is re-derivable from Postgres), so an instance restart
 * or a second instance simply means one more refresh.
 */

import type { PrismaClient } from "@prisma/client";

import { loadCommandCenterSnapshot, type CommandCenterSnapshot } from "./command-center";
import {
  readExecutionStatus,
  type ExecutionState,
  type ExecutionStatus,
  type MasterSwitch,
} from "./execution-host";
import {
  describeHostPresence,
  readHostPresence,
  type HostPresence,
  type HostPresenceStatus,
} from "./host-presence";
import { SWITCH_POLL_CACHE_MS, SWITCH_POLL_INTERVAL_MS } from "./switch-poll";

/* ------------------------------------------------------------------ */
/* cadence + cache constants                                           */
/* ------------------------------------------------------------------ */

/**
 * How long the cheap status payload is reused. Matches the local host's own
 * execution-status reuse window, so a phone polling every 3-5 s costs at most
 * one set of three small reads every two seconds no matter how many phones (or
 * how twitchy a retry loop) are asking.
 */
export const STATUS_CACHE_MS = 2_000;

/**
 * Snapshot cache while the worker is actually executing. Deliberately LONGER
 * than the desktop console's 20 s: the desktop is on the same Wi-Fi as the
 * database proxy and is the operator's working surface, while the phone is an
 * observation window on mobile data. 30 s caps the phone at two snapshot loads
 * a minute (~60 queries) in the worst case, and only while a worker is running
 * and someone is looking.
 */
export const SNAPSHOT_CACHE_ACTIVE_MS = 30_000;

/**
 * Snapshot cache while nothing is executing. Same five minutes the local host
 * uses when idle: with the worker OFF the numbers do not move, and thirty
 * production queries for a screen that reads "OFF" is the exact cost this
 * exists to avoid.
 */
export const SNAPSHOT_CACHE_IDLE_MS = 300_000;

/**
 * What the phone should show as "pending" after flipping the switch before it
 * is entitled to call the change failed: the Mac's reconcile interval plus its
 * own switch-read cache plus the seconds a worker child takes to come up.
 */
export const SWITCH_ACTUATION_WINDOW_MS = 15_000;

/** A heartbeat older than this is not a live worker (same rule as the console). */
const WORKER_HEARTBEAT_LIVE_MS = 10 * 60 * 1000;

/** Where a switch write is attributed when the caller does not say. */
export const DEFAULT_SWITCH_CLIENT = "remote-api";

/* ------------------------------------------------------------------ */
/* small safe coercions                                                */
/* ------------------------------------------------------------------ */

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Truncate free text so one pathological row cannot dominate the payload. */
function str(value: unknown, max: number): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Numbers arrive as `number`, as a Prisma `Decimal` (an object with
 * `toNumber`), or as the string a Decimal serialises to. All three have to
 * reach the phone as a plain number or the client formats "[object Object]".
 */
function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  ) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function int(value: unknown): number {
  const parsed = num(value);
  return parsed === null ? 0 : Math.trunc(parsed);
}

/** Dates cross the wire as ISO strings; Prisma hands us `Date` objects. */
function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  return null;
}

function ageMsOf(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Date.now() - parsed : null;
}

/* ------------------------------------------------------------------ */
/* status payload                                                      */
/* ------------------------------------------------------------------ */

export interface RemoteLeaseView {
  runtimeId: string;
  hostLabel: string;
  origin: string;
  pid: number;
  acquiredAt: string;
  renewedAt: string;
  ageMs: number | null;
  live: boolean;
}

export interface RemoteHostView {
  /** The Mac supervisor is up and reconciling right now. */
  alive: boolean;
  /** False when the DATABASE could not be read — `alive` is unknown, not false. */
  known: boolean;
  ageMs: number | null;
  /** Ready-to-render one-liner covering all four presence cases. */
  label: string;
  runtimeId: string | null;
  hostLabel: string | null;
  runState: string | null;
  workerRunning: boolean;
  workerStartedAt: string | null;
  /** The durable switch as the Mac last read it; null when it could not. */
  switchOn: boolean | null;
  failureReason: string | null;
  leaseHeldElsewhere: boolean;
  error?: string;
}

export interface RemoteWorkerView {
  /** A worker child is executing on the Mac right now. */
  live: boolean;
  heartbeatAt: string | null;
  heartbeatAgeMs: number | null;
  mode: string | null;
  priority: string | null;
  goal: string | null;
  task: string | null;
  blocker: string | null;
  lastSuccessfulAt: string | null;
  lastFailedAt: string | null;
  workerVersion: string | null;
  paused: boolean;
  pausedReason: string | null;
  /** False when the state row could not be read. */
  known: boolean;
}

export interface RemoteWorkerStatus {
  at: string;
  switch: MasterSwitch;
  execution: {
    state: ExecutionState;
    label: string;
    known: boolean;
    leaseLive: boolean;
    leaseAgeMs: number | null;
    executingLocally: boolean;
    lease: RemoteLeaseView | null;
    error?: string;
  };
  host: RemoteHostView;
  worker: RemoteWorkerView;
  /** Cadence facts, so the phone need not hard-code any of them. */
  actuation: {
    hostPollIntervalMs: number;
    hostSwitchCacheMs: number;
    expectedLatencyMs: number;
    pendingWindowMs: number;
  };
  /**
   * True when any of the three reads came back unknown. The phone renders
   * "unknown", never "off", when this is set — an unreadable database is a
   * fact about the network, not about the switch.
   */
  degraded: boolean;
  /** Server-side cache age of this payload in ms (0 = freshly read). */
  cacheAgeMs: number;
  /** Earliest the phone should ask again to get a new value. */
  nextPollAfterMs: number;
}

function leaseView(status: ExecutionStatus): RemoteLeaseView | null {
  const lease = status.lease;
  if (!lease) return null;
  return {
    runtimeId: lease.runtimeId,
    hostLabel: lease.host.label,
    origin: lease.origin,
    pid: lease.pid,
    acquiredAt: lease.acquiredAt,
    renewedAt: lease.renewedAt,
    ageMs: status.leaseAgeMs,
    live: status.leaseLive,
  };
}

function hostView(presence: HostPresenceStatus): RemoteHostView {
  const p: HostPresence | null = presence.presence;
  return {
    alive: presence.alive,
    known: presence.known,
    ageMs: presence.ageMs,
    label: describeHostPresence(presence),
    runtimeId: p?.runtimeId ?? null,
    hostLabel: p?.hostLabel ?? null,
    runState: p?.runState ?? null,
    workerRunning: p?.workerRunning === true,
    workerStartedAt: p?.workerStartedAt ?? null,
    switchOn: p?.switchOn ?? null,
    failureReason: p?.failureReason ?? null,
    leaseHeldElsewhere: p?.leaseHeldElsewhere === true,
    ...(presence.error !== undefined ? { error: presence.error } : {}),
  };
}

/**
 * The singleton AdminWorkerState row, READ ONLY.
 *
 * Deliberately not `getAdminWorkerState`: that helper upserts, and a phone
 * polling a status endpoint must never write a row (nor bump `updatedAt`) just
 * by looking. A missing row is reported as `known: false` rather than invented.
 */
async function readWorkerView(prisma: PrismaClient): Promise<RemoteWorkerView> {
  const empty: RemoteWorkerView = {
    live: false,
    heartbeatAt: null,
    heartbeatAgeMs: null,
    mode: null,
    priority: null,
    goal: null,
    task: null,
    blocker: null,
    lastSuccessfulAt: null,
    lastFailedAt: null,
    workerVersion: null,
    paused: false,
    pausedReason: null,
    known: false,
  };
  let row: Record<string, unknown> | null;
  try {
    row = (await prisma.adminWorkerState.findFirst({
      select: {
        currentMode: true,
        currentPriority: true,
        currentGoal: true,
        currentTask: true,
        currentBlocker: true,
        lastHeartbeatAt: true,
        lastSuccessfulAt: true,
        lastFailedAt: true,
        workerVersion: true,
        paused: true,
        pausedReason: true,
      },
    })) as Record<string, unknown> | null;
  } catch {
    return empty;
  }
  if (!row) return { ...empty, known: true };
  const heartbeatAt = iso(row.lastHeartbeatAt);
  return {
    live: false, // decided below, once the lease is known
    heartbeatAt,
    heartbeatAgeMs: ageMsOf(heartbeatAt),
    mode: str(row.currentMode, 40),
    priority: str(row.currentPriority, 40),
    goal: str(row.currentGoal, 160),
    task: str(row.currentTask, 200),
    blocker: str(row.currentBlocker, 200),
    lastSuccessfulAt: iso(row.lastSuccessfulAt),
    lastFailedAt: iso(row.lastFailedAt),
    workerVersion: str(row.workerVersion, 40),
    paused: row.paused === true,
    pausedReason: str(row.pausedReason, 200),
    known: true,
  };
}

let statusCache: { at: number; value: RemoteWorkerStatus } | null = null;
let statusInFlight: Promise<RemoteWorkerStatus> | null = null;

async function buildStatus(prisma: PrismaClient): Promise<RemoteWorkerStatus> {
  const [execution, presence, workerRow] = await Promise.all([
    readExecutionStatus(prisma),
    readHostPresence(prisma),
    readWorkerView(prisma),
  ]);

  // Liveness means "the LOCAL runtime is alive AND its heartbeat is fresh" —
  // the same rule the command centre uses. A fresh heartbeat with a dead lease
  // is a stale row, not a working worker.
  const worker: RemoteWorkerView = {
    ...workerRow,
    live:
      execution.executingLocally &&
      workerRow.heartbeatAgeMs !== null &&
      workerRow.heartbeatAgeMs <= WORKER_HEARTBEAT_LIVE_MS,
  };

  return {
    at: new Date().toISOString(),
    switch: execution.switch,
    execution: {
      state: execution.state,
      label: execution.label,
      known: execution.known,
      leaseLive: execution.leaseLive,
      leaseAgeMs: execution.leaseAgeMs,
      executingLocally: execution.executingLocally,
      lease: leaseView(execution),
      ...(execution.error !== undefined ? { error: execution.error } : {}),
    },
    host: hostView(presence),
    worker,
    actuation: {
      hostPollIntervalMs: SWITCH_POLL_INTERVAL_MS,
      hostSwitchCacheMs: SWITCH_POLL_CACHE_MS,
      expectedLatencyMs: SWITCH_POLL_INTERVAL_MS + SWITCH_POLL_CACHE_MS,
      pendingWindowMs: SWITCH_ACTUATION_WINDOW_MS,
    },
    degraded: !execution.known || !presence.known || !worker.known,
    cacheAgeMs: 0,
    nextPollAfterMs: STATUS_CACHE_MS,
  };
}

/**
 * The cheap status payload, cached for {@link STATUS_CACHE_MS} and
 * single-flighted. `force` skips the cache (used right after a switch write so
 * the response cannot echo a stale `switch.on`).
 */
export async function readRemoteWorkerStatus(
  prisma: PrismaClient,
  opts: { force?: boolean } = {},
): Promise<RemoteWorkerStatus> {
  const now = Date.now();
  if (!opts.force && statusCache && now - statusCache.at < STATUS_CACHE_MS) {
    const ageMs = now - statusCache.at;
    return {
      ...statusCache.value,
      cacheAgeMs: ageMs,
      nextPollAfterMs: Math.max(0, STATUS_CACHE_MS - ageMs),
    };
  }
  if (!opts.force && statusInFlight) return statusInFlight;
  const pending = buildStatus(prisma)
    .then((value) => {
      statusCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      if (statusInFlight === pending) statusInFlight = null;
    });
  if (!opts.force) statusInFlight = pending;
  return pending;
}

/** Drop the cached status so the next read is fresh (called after a write). */
export function invalidateRemoteWorkerStatus(): void {
  statusCache = null;
}

/* ------------------------------------------------------------------ */
/* trimmed command-centre snapshot                                     */
/* ------------------------------------------------------------------ */

/**
 * Row caps. Every one is "what a phone can plausibly scroll", not "what the
 * database holds" — the desktop grid shows more of several of these, and the
 * `*Total` counts alongside each list say how much was left behind so the
 * phone can render "12 of 47" rather than silently lying.
 */
export const TRIM_LIMITS = {
  diagnostics: 25,
  goals: 30,
  funnel: 20,
  coverage: 20,
  growth: 20,
  pipeline: 25,
  passes: 10,
  decisions: 10,
  alternatives: 8,
  reasoning: 10,
  sourceReputation: 15,
  sourceActivity: 12,
  memory: 15,
  knowledgeNodes: 10,
  logs: 40,
  rules: 40,
  skills: 12,
  repairPlans: 10,
  reviewQueue: 15,
  qualityScores: 10,
  strictQA: 10,
  rollbacks: 8,
  security: 12,
  homepageDrafts: 6,
  publishing: 12,
} as const;

export interface TrimmedList<T> {
  items: T[];
  /** How many rows the untrimmed snapshot carried. */
  total: number;
}

function take<T>(
  source: unknown,
  limit: number,
  project: (row: Record<string, unknown>) => T,
): TrimmedList<T> {
  const rows = arr(source);
  return { items: rows.slice(0, limit).map((row) => project(rec(row))), total: rows.length };
}

export interface MobileSnapshot {
  generatedAt: string;
  /** Payload provenance so the phone can say "trimmed for mobile". */
  trimmed: { version: number; limits: typeof TRIM_LIMITS };
  execution: { state: string; label: string; leaseLive: boolean; executingLocally: boolean };
  workerLive: boolean;
  heartbeatAgeMs: number | null;
  state: {
    mode: string | null;
    priority: string | null;
    goal: string | null;
    task: string | null;
    blocker: string | null;
    heartbeatAt: string | null;
    lastSuccessfulAt: string | null;
    paused: boolean;
  };
  diagnostics: {
    summary: { pass: number; warn: number; fail: number };
    ratings: TrimmedList<{ label: string | null; status: string | null; summary: string | null }>;
  };
  metrics: Record<string, number | string | null>;
  mission: { stage: string | null; contentType: string | null; reason: string | null } | null;
  goals: TrimmedList<{
    contentType: string | null;
    currentValidCount: number;
    gapCount: number;
    status: string | null;
  }>;
  funnel: TrimmedList<{
    contentType: string | null;
    candidatesDiscovered: number;
    sourceReadsCreated: number;
    packageArtifactsCreated: number;
    strictQAPasses: number;
    publishedItems: number;
  }>;
  coverage: TrimmedList<{
    contentType: string | null;
    coverageScore: number | null;
    activeSourceCount: number;
    recentPublishes7d: number;
    blockedByCoverage: boolean;
    blockReason: string | null;
  }>;
  growth: TrimmedList<{
    contentType: string | null;
    publishedCount: number;
    gap: number;
    growth24h: number;
    growth7d: number;
    status: string | null;
  }>;
  pipeline: TrimmedList<{
    stage: string | null;
    pending: number;
    running: number;
    succeeded: number;
    failed: number;
    blocked: number;
  }>;
  artifactStatus: Record<string, number>;
  passes: TrimmedList<{
    passType: string | null;
    status: string | null;
    contentBuilt: number;
    contentPublished: number;
    startedAt: string | null;
  }>;
  decisions: TrimmedList<{
    chosenAction: string | null;
    reason: string | null;
    confidence: number | null;
    createdAt: string | null;
  }>;
  brain: {
    latestFinalBrain: string | null;
    degradedEvents24h: number;
    selectActionCalls24h: number;
    rankedAlternatives: TrimmedList<{
      action: string | null;
      score: number | null;
      reason: string | null;
    }>;
    reasoning: TrimmedList<{
      from: string | null;
      relation: string | null;
      to: string | null;
      explanation: string | null;
      confidence: number | null;
    }>;
  };
  sourceReputation: TrimmedList<{
    sourceHost: string | null;
    reputationTier: string | null;
    qaPassRate: number | null;
    publicPublishRate: number | null;
  }>;
  sourceActivity: TrimmedList<{
    sourceUrl: string | null;
    detectedContentType: string | null;
    confidenceScore: number | null;
    createdAt: string | null;
  }>;
  memory: TrimmedList<{
    memoryKey: string | null;
    memoryType: string | null;
    confidence: number | null;
    lastUsedAt: string | null;
  }>;
  knowledge: {
    nodes: number;
    edges: number;
    recentNodes: TrimmedList<{
      label: string | null;
      nodeType: string | null;
      entityType: string | null;
      updatedAt: string | null;
    }>;
  };
  logs: TrimmedList<{
    eventName: string | null;
    category: string | null;
    message: string | null;
    createdAt: string | null;
  }>;
  rules: TrimmedList<{ id: string | null; category: string | null; version: number }>;
  skills: TrimmedList<{
    skillName: string | null;
    executionStatus: string | null;
    verificationStatus: string | null;
    riskLevel: string | null;
    createdAt: string | null;
  }>;
  repairPlans: TrimmedList<{
    kind: string | null;
    status: string | null;
    attempts: number;
    maxAttempts: number | null;
    updatedAt: string | null;
  }>;
  reviewQueue: TrimmedList<{
    id: string | null;
    contentTitle: string | null;
    proposedAction: string | null;
    reason: string | null;
    confidence: number | null;
  }>;
  qualityScores: TrimmedList<{
    contentType: string | null;
    finalScore: number | null;
    threshold: number | null;
    passed: boolean;
  }>;
  strictQA: TrimmedList<{
    contentType: string | null;
    finalScore: number | null;
    status: string | null;
    createdAt: string | null;
  }>;
  rollbacks: TrimmedList<{
    slug: string | null;
    rollbackAction: string | null;
    rollbackResult: string | null;
    createdAt: string | null;
  }>;
  security: TrimmedList<{
    actionType: string | null;
    severity: string | null;
    createdAt: string | null;
  }>;
  homepageDrafts: TrimmedList<{
    id: string | null;
    status: string | null;
    reasonSummary: string | null;
    createdAt: string | null;
  }>;
  publishing: TrimmedList<{
    title: string | null;
    contentType: string | null;
    slug: string | null;
    updatedAt: string | null;
  }>;
  readingsCoverage: Record<string, number | string | boolean | null> | null;
  contentCatalogTotal: number;
}

/** Metrics are a flat bag of scalars; copy the scalars and drop anything else. */
function scalarBag(value: unknown): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {};
  for (const [key, raw] of Object.entries(rec(value))) {
    if (typeof raw === "number") out[key] = Number.isFinite(raw) ? raw : null;
    else if (typeof raw === "boolean") out[key] = raw ? 1 : 0;
    else if (raw instanceof Date) out[key] = raw.toISOString();
    else if (typeof raw === "string") out[key] = str(raw, 80);
    else if (raw === null) out[key] = null;
  }
  return out;
}

function readingsBag(value: unknown): Record<string, number | string | boolean | null> | null {
  if (value === null || value === undefined) return null;
  const out: Record<string, number | string | boolean | null> = {};
  for (const [key, raw] of Object.entries(rec(value))) {
    if (typeof raw === "number") out[key] = Number.isFinite(raw) ? raw : null;
    else if (typeof raw === "boolean") out[key] = raw;
    else if (raw instanceof Date) out[key] = raw.toISOString();
    else if (typeof raw === "string") out[key] = str(raw, 120);
    else if (raw === null) out[key] = null;
  }
  return out;
}

/**
 * Project the full command-centre snapshot onto the phone payload.
 *
 * Pure and defensive: every field is coerced, so a schema drift or a Prisma
 * Decimal can never produce `[object Object]` on the phone or throw here and
 * blank the whole console. Two things are dropped rather than trimmed —
 * `brain.latestDecision` (the raw AdminWorkerLog row, whose `safeMetadata` the
 * ranked alternatives are already extracted from) and the homepage drafts'
 * generated page payloads — because both are unbounded and neither is rendered.
 */
export function trimSnapshotForMobile(snapshot: CommandCenterSnapshot): MobileSnapshot {
  const execution = rec(snapshot.execution);
  const state = rec(snapshot.state);
  const diagnostics = rec(snapshot.diagnostics);
  const summary = rec(diagnostics.summary);
  const brain = rec(snapshot.brain);
  const knowledge = rec(snapshot.knowledge);
  const mission =
    snapshot.mission === null || snapshot.mission === undefined ? null : rec(snapshot.mission);

  return {
    generatedAt: iso(snapshot.generatedAt) ?? new Date().toISOString(),
    trimmed: { version: 1, limits: TRIM_LIMITS },
    execution: {
      state: str(execution.state, 32) ?? "OFF",
      label: str(execution.label, 200) ?? "",
      leaseLive: execution.leaseLive === true,
      executingLocally: execution.executingLocally === true,
    },
    workerLive: snapshot.workerLive === true,
    heartbeatAgeMs: typeof snapshot.heartbeatAgeMs === "number" ? snapshot.heartbeatAgeMs : null,
    state: {
      mode: str(state.currentMode, 40),
      priority: str(state.currentPriority, 40),
      goal: str(state.currentGoal, 160),
      task: str(state.currentTask, 200),
      blocker: str(state.currentBlocker, 200),
      heartbeatAt: iso(state.lastHeartbeatAt),
      lastSuccessfulAt: iso(state.lastSuccessfulAt),
      paused: state.paused === true,
    },
    diagnostics: {
      summary: { pass: int(summary.pass), warn: int(summary.warn), fail: int(summary.fail) },
      ratings: take(diagnostics.ratings, TRIM_LIMITS.diagnostics, (r) => ({
        label: str(r.label, 60),
        status: str(r.status, 24),
        summary: str(r.summary, 140),
      })),
    },
    metrics: scalarBag(snapshot.metrics),
    mission: mission
      ? {
          stage: str(mission.stage ?? mission.missionStage, 40),
          contentType: str(mission.contentType, 40),
          reason: str(mission.reason ?? mission.rationale, 160),
        }
      : null,
    goals: take(snapshot.goals, TRIM_LIMITS.goals, (g) => ({
      contentType: str(g.contentType, 40),
      currentValidCount: int(g.currentValidCount),
      gapCount: int(g.gapCount),
      status: str(g.status, 24),
    })),
    funnel: take(snapshot.funnel, TRIM_LIMITS.funnel, (f) => ({
      contentType: str(f.contentType, 40),
      candidatesDiscovered: int(f.candidatesDiscovered),
      sourceReadsCreated: int(f.sourceReadsCreated),
      packageArtifactsCreated: int(f.packageArtifactsCreated),
      strictQAPasses: int(f.strictQAPasses),
      publishedItems: int(f.publishedItems),
    })),
    coverage: take(snapshot.coverage, TRIM_LIMITS.coverage, (c) => ({
      contentType: str(c.contentType, 40),
      coverageScore: num(c.coverageScore),
      activeSourceCount: int(c.activeSourceCount),
      recentPublishes7d: int(c.recentPublishes7d),
      blockedByCoverage: c.blockedByCoverage === true,
      blockReason: str(c.blockReason, 100),
    })),
    growth: take(snapshot.growth, TRIM_LIMITS.growth, (g) => ({
      contentType: str(g.contentType, 40),
      publishedCount: int(g.publishedCount),
      gap: int(g.gap),
      growth24h: int(g.growth24h),
      growth7d: int(g.growth7d),
      status: str(g.status, 24),
    })),
    pipeline: take(snapshot.pipeline, TRIM_LIMITS.pipeline, (p) => ({
      stage: str(p.stage ?? p.stageName, 40),
      pending: int(p.pending),
      running: int(p.running),
      succeeded: int(p.succeeded),
      failed: int(p.failed),
      blocked: int(p.blocked),
    })),
    artifactStatus: Object.fromEntries(
      Object.entries(rec(snapshot.artifactStatus)).map(([k, v]) => [k, int(v)]),
    ),
    passes: take(snapshot.passes, TRIM_LIMITS.passes, (p) => ({
      passType: str(p.passType, 40),
      status: str(p.status, 24),
      contentBuilt: int(p.contentBuilt),
      contentPublished: int(p.contentPublished),
      startedAt: iso(p.startedAt),
    })),
    decisions: take(snapshot.decisions, TRIM_LIMITS.decisions, (d) => ({
      chosenAction: str(d.chosenAction ?? d.decisionType, 60),
      reason: str(d.reason ?? d.brainExplanation, 140),
      confidence: num(d.confidence),
      createdAt: iso(d.createdAt),
    })),
    brain: {
      latestFinalBrain: str(brain.latestFinalBrain, 40),
      degradedEvents24h: int(brain.degradedEvents24h),
      selectActionCalls24h: int(brain.selectActionCalls24h),
      rankedAlternatives: take(brain.rankedAlternatives, TRIM_LIMITS.alternatives, (a) => ({
        action: str(a.action ?? a.missionStage ?? a.name, 48),
        score: num(a.score ?? a.value),
        reason: str(a.reason ?? a.rationale, 110),
      })),
      reasoning: take(brain.reasoning, TRIM_LIMITS.reasoning, (r) => ({
        from: str(r.fromNodeLabel ?? r.fromNodeType, 40),
        relation: str(r.relation, 24),
        to: str(r.toNodeLabel ?? r.toNodeType, 40),
        explanation: str(r.explanation, 110),
        confidence: num(r.confidence),
      })),
    },
    sourceReputation: take(snapshot.sourceReputation, TRIM_LIMITS.sourceReputation, (r) => ({
      sourceHost: str(r.sourceHost, 60),
      reputationTier: str(r.reputationTier, 24),
      qaPassRate: num(r.qaPassRate),
      publicPublishRate: num(r.publicPublishRate),
    })),
    sourceActivity: take(snapshot.sourceActivity, TRIM_LIMITS.sourceActivity, (r) => ({
      sourceUrl: str(r.sourceUrl, 120),
      detectedContentType: str(r.detectedContentType, 40),
      confidenceScore: num(r.confidenceScore),
      createdAt: iso(r.createdAt),
    })),
    memory: take(snapshot.memory, TRIM_LIMITS.memory, (m) => ({
      memoryKey: str(m.memoryKey, 60),
      memoryType: str(m.memoryType, 32),
      confidence: num(m.confidence),
      lastUsedAt: iso(m.lastUsedAt),
    })),
    knowledge: {
      nodes: int(knowledge.nodes),
      edges: int(knowledge.edges),
      recentNodes: take(knowledge.recentNodes, TRIM_LIMITS.knowledgeNodes, (n) => ({
        label: str(n.label ?? n.entityId ?? n.id, 48),
        nodeType: str(n.nodeType, 24),
        entityType: str(n.entityType, 24),
        updatedAt: iso(n.updatedAt),
      })),
    },
    logs: take(snapshot.logs, TRIM_LIMITS.logs, (l) => ({
      eventName: str(l.eventName, 48),
      category: str(l.category, 24),
      message: str(l.message, 140),
      createdAt: iso(l.createdAt),
    })),
    rules: take(snapshot.rules, TRIM_LIMITS.rules, (r) => ({
      id: str(r.id, 48),
      category: str(r.category, 32),
      version: int(r.version),
    })),
    skills: take(snapshot.skills, TRIM_LIMITS.skills, (k) => ({
      skillName: str(k.skillName, 48),
      executionStatus: str(k.executionStatus, 24),
      verificationStatus: str(k.verificationStatus, 24),
      riskLevel: str(k.riskLevel, 16),
      createdAt: iso(k.createdAt),
    })),
    repairPlans: take(snapshot.repairPlans, TRIM_LIMITS.repairPlans, (r) => ({
      kind: str(r.kind, 40),
      status: str(r.status, 24),
      attempts: int(r.attempts),
      maxAttempts: num(r.maxAttempts),
      updatedAt: iso(r.updatedAt),
    })),
    reviewQueue: take(snapshot.reviewQueue, TRIM_LIMITS.reviewQueue, (r) => ({
      id: str(r.id, 40),
      contentTitle: str(r.contentTitle, 80),
      proposedAction: str(r.proposedAction, 48),
      reason: str(r.reason, 140),
      confidence: num(r.confidence),
    })),
    qualityScores: take(snapshot.qualityScores, TRIM_LIMITS.qualityScores, (q) => ({
      contentType: str(q.contentType, 40),
      finalScore: num(q.finalScore),
      threshold: num(q.threshold),
      passed: q.passed === true,
    })),
    strictQA: take(snapshot.strictQA, TRIM_LIMITS.strictQA, (q) => ({
      contentType: str(q.contentType, 40),
      finalScore: num(q.finalScore),
      status: str(q.status, 24),
      createdAt: iso(q.createdAt),
    })),
    rollbacks: take(snapshot.rollbacks, TRIM_LIMITS.rollbacks, (r) => ({
      slug: str(r.slug, 60),
      rollbackAction: str(r.rollbackAction, 32),
      rollbackResult: str(r.rollbackResult, 32),
      createdAt: iso(r.createdAt),
    })),
    security: take(snapshot.security, TRIM_LIMITS.security, (a) => ({
      actionType: str(a.actionType ?? a.action, 48),
      severity: str(a.severity, 24),
      createdAt: iso(a.createdAt),
    })),
    homepageDrafts: take(snapshot.homepageDrafts, TRIM_LIMITS.homepageDrafts, (d) => ({
      id: str(d.id, 40),
      status: str(d.status, 24),
      reasonSummary: str(d.reasonSummary, 140),
      createdAt: iso(d.createdAt),
    })),
    publishing: take(snapshot.publishing, TRIM_LIMITS.publishing, (p) => ({
      title: str(p.title, 80),
      contentType: str(p.contentType, 40),
      slug: str(p.slug, 80),
      updatedAt: iso(p.updatedAt),
    })),
    readingsCoverage: readingsBag(snapshot.readingsCoverage),
    contentCatalogTotal: int(snapshot.contentCatalogTotal),
  };
}

/* ------------------------------------------------------------------ */
/* snapshot cache                                                      */
/* ------------------------------------------------------------------ */

export interface RemoteSnapshotResult {
  snapshot: MobileSnapshot;
  /** True when this was served from the instance cache without a database hit. */
  cached: boolean;
  /** Age of the cached copy in ms (0 when freshly loaded). */
  ageMs: number;
  /** The TTL in force for this answer, so the phone can time its next poll. */
  ttlMs: number;
  nextPollAfterMs: number;
  /** True when a concurrent load was reused instead of starting a second one. */
  coalesced: boolean;
}

let snapshotCache: { at: number; value: MobileSnapshot } | null = null;
let snapshotInFlight: Promise<MobileSnapshot> | null = null;

/**
 * Cache lifetime for the current world state: short while a worker is actually
 * executing (the numbers move), five minutes otherwise (they do not).
 */
export function snapshotTtlMs(state: ExecutionState | null): number {
  return state === "LOCAL_ACTIVE" || state === "REMOTE_ACTIVE"
    ? SNAPSHOT_CACHE_ACTIVE_MS
    : SNAPSHOT_CACHE_IDLE_MS;
}

/**
 * Load the trimmed command-centre snapshot.
 *
 * Three guards, matching the local host's, because this one is reachable from
 * the public internet rather than loopback:
 *   1. single flight — a slow production round-trip must never let concurrent
 *      pollers stack up thirty-query loads;
 *   2. TTL by state — 30 s running, 5 min idle;
 *   3. `refreshGoals: false`, always. The desktop console passes `true` on an
 *      explicit Refresh, but that path WRITES content goals, and an observation
 *      window on a phone has no business writing to production. The Mac console
 *      remains the surface that refreshes goals.
 *
 * `force` skips the TTL (never the single flight). Callers rate-limit it.
 */
export async function loadRemoteSnapshot(
  prisma: PrismaClient,
  opts: { force?: boolean; executionState?: ExecutionState | null } = {},
): Promise<RemoteSnapshotResult> {
  const ttlMs = snapshotTtlMs(opts.executionState ?? null);
  const now = Date.now();

  if (!opts.force && snapshotCache && now - snapshotCache.at < ttlMs) {
    const ageMs = now - snapshotCache.at;
    return {
      snapshot: snapshotCache.value,
      cached: true,
      ageMs,
      ttlMs,
      nextPollAfterMs: Math.max(0, ttlMs - ageMs),
      coalesced: false,
    };
  }

  if (snapshotInFlight) {
    const snapshot = await snapshotInFlight;
    return { snapshot, cached: false, ageMs: 0, ttlMs, nextPollAfterMs: ttlMs, coalesced: true };
  }

  const pending = loadCommandCenterSnapshot(prisma, { refreshGoals: false })
    .then((full) => {
      const trimmedSnapshot = trimSnapshotForMobile(full);
      snapshotCache = { at: Date.now(), value: trimmedSnapshot };
      return trimmedSnapshot;
    })
    .finally(() => {
      if (snapshotInFlight === pending) snapshotInFlight = null;
    });
  snapshotInFlight = pending;

  const snapshot = await pending;
  return { snapshot, cached: false, ageMs: 0, ttlMs, nextPollAfterMs: ttlMs, coalesced: false };
}

/** Test seam — drop both caches and any in-flight load. */
export function _resetRemoteConsoleCachesForTests(): void {
  statusCache = null;
  statusInFlight = null;
  snapshotCache = null;
  snapshotInFlight = null;
}

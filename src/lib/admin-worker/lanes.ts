/**
 * Internal worker lanes + concurrency controls (adaptive-worker Phase B).
 *
 * The worker used to run its per-pass supplementary workstreams strictly
 * serially — one `await` after another. This module lets them run as PARALLEL
 * LANES inside the SAME worker process (no extra deployed service), so the
 * worker processes multiple task types at once where safe: ingestion,
 * discovery, enrichment, the BUILD_READY drain, readings, maintenance,
 * reporting, diagnostics/intelligence, and escalation each get their own lane.
 *
 * Concurrency is made SAFE by construction, not by luck:
 *   - Lanes touch DISJOINT work domains (curated vs structured vs OSM vs
 *     liturgical ingest publish different content sets; the drain owns
 *     artifacts; discovery owns candidates), so they don't fight over rows.
 *   - `PublishedContent @@unique([contentType, slug])` makes double-publishing
 *     impossible at the DB level even under a race — idempotency by constraint.
 *   - Artifact LEASES (`claimArtifact`) give explicit task ownership: a lane
 *     claims an artifact via an atomic conditional update before mutating it, so
 *     two lanes (or two worker processes) never double-work the same item; a
 *     crashed lane's lease expires and is reclaimed.
 *   - A global CONCURRENCY CAP (semaphore) bounds resource usage.
 *   - Every lane is ISOLATED (its own try/catch) — a failing lane never kills
 *     the others (self-repair) — and enters a BACKOFF cooldown after an error.
 *   - Brain-calling work shares ONE lane so it never issues concurrent calls to
 *     the single Python brain subprocess.
 *
 * Each lane records its live state (`AdminWorkerLaneState`) — status, current
 * item/gate/strategy, capacity, concurrent tasks, last outcome — which is the
 * practical operational-self-awareness surface the dashboard/diagnostics show.
 */

import type { PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export interface LaneOutcome {
  published?: number;
  advanced?: number;
  detail?: string;
}

export interface LaneRunContext {
  prisma: PrismaClient;
  passId?: string;
  workerId?: string;
  active: boolean;
  /** True when every content goal's gap is closed (all targets met). */
  contentGoalsMet?: boolean;
}

export interface LaneDef {
  name: string;
  /** Max concurrent items this lane handles (informational + surfaced). */
  capacity: number;
  /** Only run when the Python final brain is active (publishing lanes). */
  activeOnly?: boolean;
  /**
   * A GROWTH lane — it adds NEW content (ingest/discovery). Once every content
   * goal is met the worker's first priority is done, so growth lanes drop to a
   * slow maintenance sweep (see ADMIN_WORKER_GROWTH_SWEEP_MS) and the worker
   * focuses on management + security instead of building past target at full
   * pace. Non-growth lanes (enrichment, drain, readings, maintenance, security,
   * reporting) keep running every pass.
   */
  growth?: boolean;
  /** Cooldown after an error before this lane retries (ms). */
  cooldownMs?: number;
  run: (ctx: LaneRunContext) => Promise<LaneOutcome | void>;
}

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

// When all content goals are met, growth lanes (ingest/discovery) run at most
// this often — a slow sweep that still catches newly-added feasts/saints/etc.
// without building past target at full pace, so the worker shifts focus to
// management + security. Overridable via ADMIN_WORKER_GROWTH_SWEEP_MS.
const GROWTH_MAINTENANCE_SWEEP_MS = 30 * 60 * 1000;

// Per-lane watchdog: a lane whose run() never settles must NOT wedge the pass
// (content lanes run inside the pass before completePass, so a hung lane would
// otherwise orphan the RUNNING row — the exact failure the loop was hardened
// against). Every lane is raced against this timeout; on expiry the lane is
// recorded as errored (→ cooldown) and the others proceed. Generous by default
// so only a genuine hang trips it; overridable via ADMIN_WORKER_LANE_TIMEOUT_MS.
const LANE_WATCHDOG_MS = 120_000;

/**
 * Race a lane's run() against the watchdog. Rejects if it exceeds `ms`; the
 * timer is always cleared when the run settles so no dangling timer leaks. The
 * underlying work may still complete in the background (JS promises can't be
 * cancelled), but its network/DB calls are themselves timeout-bounded, so this
 * only guarantees the PASS never blocks on a stuck lane.
 */
function withWatchdog<T>(p: Promise<T>, ms: number, lane: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`lane watchdog: '${lane}' exceeded ${ms}ms`)), ms);
  });
  return Promise.race([
    p.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    watchdog,
  ]);
}

// ── Artifact lease (task ownership) ──────────────────────────────────────────

/**
 * Atomically claim an artifact for a lane. Uses a conditional `updateMany` —
 * the WHERE only matches when the row is unleased or its lease has expired — so
 * exactly one caller can win the claim even under concurrency. Returns true if
 * this caller now owns the artifact.
 */
export async function claimArtifact(
  prisma: PrismaClient,
  artifactId: string,
  laneId: string,
  ttlMs = 60_000,
): Promise<boolean> {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMs);
  try {
    const res = await prisma.adminWorkerPackageArtifact.updateMany({
      where: {
        id: artifactId,
        OR: [{ leasedBy: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: { leasedBy: laneId, leaseExpiresAt: expires },
    });
    return res.count === 1;
  } catch {
    return false;
  }
}

/** Release an artifact lease (best-effort). */
export async function releaseArtifact(prisma: PrismaClient, artifactId: string): Promise<void> {
  await prisma.adminWorkerPackageArtifact
    .updateMany({ where: { id: artifactId }, data: { leasedBy: null, leaseExpiresAt: null } })
    .catch(() => undefined);
}

/** Clear expired leases so a crashed lane's items become claimable again. */
export async function reapArtifactLeases(prisma: PrismaClient): Promise<number> {
  try {
    const res = await prisma.adminWorkerPackageArtifact.updateMany({
      where: { leasedBy: { not: null }, leaseExpiresAt: { lt: new Date() } },
      data: { leasedBy: null, leaseExpiresAt: null },
    });
    return res.count;
  } catch {
    return 0;
  }
}

// ── Lane state (operational self-awareness) ──────────────────────────────────

export async function recordLaneState(
  prisma: PrismaClient,
  lane: string,
  patch: {
    status?: string;
    currentItem?: string | null;
    currentStrategy?: string | null;
    currentGate?: string | null;
    capacity?: number;
    concurrentTasks?: number;
    lastOutcome?: string | null;
    lastError?: string | null;
    lastDurationMs?: number | null;
    lastStartedAt?: Date | null;
    lastFinishedAt?: Date | null;
  },
): Promise<void> {
  try {
    await prisma.adminWorkerLaneState.upsert({
      where: { lane },
      update: patch,
      create: { lane, capacity: patch.capacity ?? 1, ...patch },
    });
  } catch {
    // lane-state is observability only — never let it break a lane
  }
}

export async function getLaneStates(prisma: PrismaClient) {
  // Wrapped in try/catch (not just .catch): a mock/older client without the
  // adminWorkerLaneState delegate would throw synchronously on the property
  // access before a promise .catch could apply. Observability only — degrade
  // to an empty list rather than break the whole lane run.
  try {
    return await prisma.adminWorkerLaneState.findMany({ orderBy: { lane: "asc" } });
  } catch {
    return [];
  }
}

/**
 * Delete lane-state rows whose lane name is no longer part of the active lane
 * set — e.g. after lanes are split/renamed, so the dashboard never shows stale
 * "ghost" lanes that will never update again. Observability only, fail-open.
 */
export async function pruneUnknownLaneStates(
  prisma: PrismaClient,
  knownLanes: readonly string[],
): Promise<number> {
  try {
    const res = await prisma.adminWorkerLaneState.deleteMany({
      where: { lane: { notIn: [...knownLanes] } },
    });
    return res.count;
  } catch {
    return 0;
  }
}

// ── Concurrency-capped runner ────────────────────────────────────────────────

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface LanesResult {
  ran: string[];
  skipped: string[];
  errored: string[];
  published: number;
  advanced: number;
}

/**
 * Run the enabled worker lanes concurrently (bounded by a global cap). Each
 * lane is isolated + records its live state; a lane in error-cooldown or an
 * active-only lane while degraded is skipped. Aggregates published/advanced.
 * Fail-open: the whole call never throws.
 */
export async function runWorkerLanes(
  prisma: PrismaClient,
  lanes: LaneDef[],
  ctx: { passId?: string; workerId?: string; active: boolean; contentGoalsMet?: boolean },
): Promise<LanesResult> {
  const out: LanesResult = { ran: [], skipped: [], errored: [], published: 0, advanced: 0 };
  // Default cap of 8 lets the fine-grained lane set (9 content + 11 ops lanes)
  // run many workstreams truly at once. Keep it at/below the Prisma pool
  // (PRISMA_CONNECTION_LIMIT, default 10) so concurrent lanes never starve the
  // connection pool (P2037); raise BOTH together for bigger deployments.
  const maxConcurrent = envInt("ADMIN_WORKER_LANE_CONCURRENCY", 8);
  const growthSweepMs = envInt("ADMIN_WORKER_GROWTH_SWEEP_MS", GROWTH_MAINTENANCE_SWEEP_MS);
  const watchdogMs = envInt("ADMIN_WORKER_LANE_TIMEOUT_MS", LANE_WATCHDOG_MS);

  // Read current lane states to honour per-lane error cooldown (backoff).
  const states = await getLaneStates(prisma);
  const stateByLane = new Map(states.map((s) => [s.lane, s]));
  const now = Date.now();

  const runnable = lanes.filter((lane) => {
    if (lane.activeOnly && !ctx.active) {
      out.skipped.push(lane.name);
      return false;
    }
    const st = stateByLane.get(lane.name);
    // Content goals are the first priority. Once they are ALL met, growth lanes
    // (ingest/discovery) drop to a slow maintenance sweep so the worker focuses
    // on management + security instead of building past target every pass.
    if (lane.growth && ctx.contentGoalsMet) {
      const lastRun = st?.lastFinishedAt ? new Date(st.lastFinishedAt).getTime() : 0;
      if (now - lastRun < growthSweepMs) {
        out.skipped.push(lane.name);
        return false;
      }
    }
    const cooldown = lane.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    if (
      st?.lastError &&
      st.lastFinishedAt &&
      now - new Date(st.lastFinishedAt).getTime() < cooldown
    ) {
      out.skipped.push(lane.name);
      return false;
    }
    return true;
  });

  await mapWithConcurrency(runnable, maxConcurrent, async (lane) => {
    const started = new Date();
    await recordLaneState(prisma, lane.name, {
      status: "running",
      capacity: lane.capacity,
      concurrentTasks: 1,
      lastStartedAt: started,
      lastError: null,
    });
    try {
      const result =
        (await withWatchdog(
          Promise.resolve(
            lane.run({
              prisma,
              passId: ctx.passId,
              workerId: ctx.workerId,
              active: ctx.active,
              contentGoalsMet: ctx.contentGoalsMet,
            }),
          ),
          watchdogMs,
          lane.name,
        )) || {};
      out.ran.push(lane.name);
      out.published += result.published ?? 0;
      out.advanced += result.advanced ?? 0;
      await recordLaneState(prisma, lane.name, {
        status: "idle",
        concurrentTasks: 0,
        currentItem: null,
        currentGate: null,
        lastOutcome:
          result.detail ?? `+${result.published ?? 0} published, +${result.advanced ?? 0} advanced`,
        lastDurationMs: Date.now() - started.getTime(),
        lastFinishedAt: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      out.errored.push(lane.name);
      await recordLaneState(prisma, lane.name, {
        status: "error",
        concurrentTasks: 0,
        lastError: message.slice(0, 300),
        lastOutcome: "error",
        lastDurationMs: Date.now() - started.getTime(),
        lastFinishedAt: new Date(),
      });
    }
  });

  await writeAdminWorkerLog(prisma, {
    passId: ctx.passId,
    category: "WORKER_PASS",
    severity: out.errored.length > 0 ? "WARN" : "INFO",
    eventName: "worker_lanes",
    message: `Lanes: ${out.ran.length} ran, ${out.skipped.length} skipped, ${out.errored.length} errored (max ${maxConcurrent} concurrent). +${out.published} published, +${out.advanced} advanced.`,
    safeMetadata: {
      ran: out.ran,
      skipped: out.skipped,
      errored: out.errored,
      maxConcurrent,
      published: out.published,
      advanced: out.advanced,
    },
  }).catch(() => undefined);

  return out;
}

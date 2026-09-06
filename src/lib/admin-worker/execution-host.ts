/**
 * Admin Worker execution host — the durable half of the local-execution
 * boundary (spec §4, §5, §23, §25).
 *
 * The Admin Worker's *body and brain* now run on the operator's MacBook, under
 * the native Swift application. Postgres remains the worker's long-term memory
 * and the single source of truth, so the two facts every part of the system
 * needs to agree on live there too:
 *
 *   1. the master switch  — is the Admin Worker supposed to be running at all?
 *   2. the execution lease — which runtime currently holds the sole right to
 *                            execute worker computation?
 *
 * Both are stored as `AdminWorkerMemory` rows (memoryType GENERIC). That table
 * already exists as the worker's durable key/value memory, so this adds no
 * schema change, no migration, and no new environment variable.
 *
 * Rules encoded here:
 *
 *   - OFF means OFF everywhere. When the switch is off no runtime may execute
 *     the loop, a pass, discovery, rendering, security passes, reports, or
 *     worker email — including Railway.
 *   - There is exactly one active executor. The lease is held by one runtime
 *     id, renewed while it works, and released on shutdown. A second runtime
 *     cannot claim it while it is live, so the server and the MacBook can never
 *     both drain the same queue.
 *   - There is no automatic cloud failover. A lost local lease expires; nothing
 *     takes over. The website keeps serving; the worker is simply unavailable.
 */

import type { PrismaClient } from "@prisma/client";

import type { WorkerExecutionOrigin } from "./execution-context";

const MEMORY_TYPE = "GENERIC" as const;
const SWITCH_KEY = "worker.execution.switch";
const LEASE_KEY = "worker.execution.lease";

/** A lease older than this is considered abandoned (crash / sleep / quit). */
export const LEASE_TTL_MS = 90_000;
/** How often a healthy local runtime should renew its lease. */
export const LEASE_RENEW_INTERVAL_MS = 20_000;

export interface ExecutionHostInfo {
  /** Short non-sensitive label, e.g. "MacBook Pro · darwin arm64". */
  label: string;
  platform: string;
  arch: string;
  cpuCount: number;
  /** App/runtime that launched the worker, e.g. "swift-app" or "cli". */
  launchedBy: string;
}

export interface ExecutionLease {
  runtimeId: string;
  origin: WorkerExecutionOrigin;
  host: ExecutionHostInfo;
  pid: number;
  acquiredAt: string;
  renewedAt: string;
  workerVersion?: string | null;
}

export interface MasterSwitch {
  on: boolean;
  changedAt: string | null;
  changedBy: string | null;
  /** Where the switch was flipped from, e.g. "swift-app". */
  changedFrom: string | null;
  /**
   * False when the database could not be read: `on` is then only a default
   * (false), NOT a durable fact. Callers that stop work on "OFF" must treat
   * `known: false` as "keep doing what you were doing" and surface the error.
   */
  known: boolean;
  /** The database error when `known` is false. */
  error?: string;
}

export type ExecutionState =
  /** Master switch off — the autonomous administrator does not exist as a workload. */
  | "OFF"
  /** Local MacBook runtime holds a live lease and is executing. */
  | "LOCAL_ACTIVE"
  /** Switch is on but the local runtime's lease went stale (quit, sleep, crash). */
  | "LOCAL_DISCONNECTED"
  /** A deliberately-overridden remote runtime holds the lease (not the normal state). */
  | "REMOTE_ACTIVE";

export interface ExecutionStatus {
  state: ExecutionState;
  switch: MasterSwitch;
  lease: ExecutionLease | null;
  leaseAgeMs: number | null;
  leaseLive: boolean;
  /** True when the active executor is the operator's MacBook. */
  executingLocally: boolean;
  /** Human-readable one-liner for dashboards and diagnostics. */
  label: string;
  /** False when the database could not be read — `state` is then unknown, not OFF. */
  known: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* raw row helpers                                                     */
/* ------------------------------------------------------------------ */

interface RawRow {
  memoryValue: unknown;
  updatedAt: Date;
}

/**
 * Read a memory row. A database error is NOT the same thing as "no row": the
 * former is a transient fact about the network, the latter a durable fact about
 * the switch or lease. Swallowing the error as null made every caller read an
 * unreachable database as "switch OFF" / "lease lost" and stop a healthy worker
 * (or refuse to start one) over a single bad round-trip. Errors propagate;
 * every caller decides — and says — how it fails.
 */
async function readRow(prisma: PrismaClient, key: string): Promise<RawRow | null> {
  return prisma.adminWorkerMemory.findUnique({
    where: { memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: key } },
    select: { memoryValue: true, updatedAt: true },
  });
}

/** True for a Prisma/network failure (as opposed to a normal null row). */
function describeDbError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message
      .split("\n")
      .find((l) => l.trim())
      ?.trim()
      .slice(0, 240) ?? "database error"
  );
}

async function writeRow(prisma: PrismaClient, key: string, value: object): Promise<void> {
  await prisma.adminWorkerMemory.upsert({
    where: { memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: key } },
    create: {
      memoryType: MEMORY_TYPE,
      memoryKey: key,
      memoryValue: value as never,
      confidence: 1,
      lastUsedAt: new Date(),
    },
    update: { memoryValue: value as never, lastUsedAt: new Date() },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseLease(value: unknown): ExecutionLease | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const runtimeId = typeof rec.runtimeId === "string" ? rec.runtimeId : null;
  if (!runtimeId) return null;
  const host = asRecord(rec.host) ?? {};
  return {
    runtimeId,
    origin: (typeof rec.origin === "string"
      ? rec.origin
      : "LOCAL_MACBOOK") as WorkerExecutionOrigin,
    host: {
      label: typeof host.label === "string" ? host.label : "unknown host",
      platform: typeof host.platform === "string" ? host.platform : "unknown",
      arch: typeof host.arch === "string" ? host.arch : "unknown",
      cpuCount: typeof host.cpuCount === "number" ? host.cpuCount : 0,
      launchedBy: typeof host.launchedBy === "string" ? host.launchedBy : "unknown",
    },
    pid: typeof rec.pid === "number" ? rec.pid : 0,
    acquiredAt: typeof rec.acquiredAt === "string" ? rec.acquiredAt : new Date(0).toISOString(),
    renewedAt: typeof rec.renewedAt === "string" ? rec.renewedAt : new Date(0).toISOString(),
    workerVersion: typeof rec.workerVersion === "string" ? rec.workerVersion : null,
  };
}

function leaseAge(lease: ExecutionLease | null): number | null {
  if (!lease) return null;
  const t = Date.parse(lease.renewedAt);
  return Number.isFinite(t) ? Date.now() - t : null;
}

/* ------------------------------------------------------------------ */
/* master switch                                                       */
/* ------------------------------------------------------------------ */

/**
 * Read the master switch. Never throws: when the database cannot be read the
 * result carries `known: false` (and the error) so that an unreachable
 * database is never mistaken for a deliberate OFF.
 */
export async function readMasterSwitch(prisma: PrismaClient): Promise<MasterSwitch> {
  let row: RawRow | null;
  try {
    row = await readRow(prisma, SWITCH_KEY);
  } catch (err) {
    return {
      on: false,
      changedAt: null,
      changedBy: null,
      changedFrom: null,
      known: false,
      error: describeDbError(err),
    };
  }
  const rec = asRecord(row?.memoryValue);
  if (!rec) return { on: false, changedAt: null, changedBy: null, changedFrom: null, known: true };
  return {
    on: rec.on === true,
    changedAt: typeof rec.changedAt === "string" ? rec.changedAt : null,
    changedBy: typeof rec.changedBy === "string" ? rec.changedBy : null,
    changedFrom: typeof rec.changedFrom === "string" ? rec.changedFrom : null,
    known: true,
  };
}

export async function setMasterSwitch(
  prisma: PrismaClient,
  opts: { on: boolean; actor?: string; from?: string },
): Promise<MasterSwitch> {
  const stored = {
    on: opts.on,
    changedAt: new Date().toISOString(),
    changedBy: opts.actor ?? "operator",
    changedFrom: opts.from ?? "swift-app",
  };
  await writeRow(prisma, SWITCH_KEY, stored);
  return { ...stored, known: true };
}

/* ------------------------------------------------------------------ */
/* execution lease                                                     */
/* ------------------------------------------------------------------ */

export interface LeaseClaim {
  acquired: boolean;
  lease: ExecutionLease | null;
  /** Set when the claim was refused because someone else holds a live lease. */
  refusedBecause?: string;
}

/**
 * Claim sole execution authority. Uses optimistic concurrency on the memory
 * row's `updatedAt` so two runtimes racing for the lease cannot both win.
 */
export async function acquireExecutionLease(
  prisma: PrismaClient,
  input: {
    runtimeId: string;
    origin: WorkerExecutionOrigin;
    host: ExecutionHostInfo;
    workerVersion?: string | null;
  },
): Promise<LeaseClaim> {
  let existingRow: RawRow | null;
  try {
    existingRow = await readRow(prisma, LEASE_KEY);
  } catch (err) {
    return {
      acquired: false,
      lease: null,
      refusedBecause: `The database could not be reached to claim the execution lease: ${describeDbError(err)}`,
    };
  }
  const existing = parseLease(existingRow?.memoryValue);
  const age = leaseAge(existing);

  if (existing && existing.runtimeId !== input.runtimeId && age !== null && age < LEASE_TTL_MS) {
    return {
      acquired: false,
      lease: existing,
      refusedBecause:
        `Another Admin Worker runtime holds the execution lease ` +
        `(${existing.runtimeId} on ${existing.host.label}, renewed ${Math.round(age / 1000)}s ago).`,
    };
  }

  const now = new Date().toISOString();
  const lease: ExecutionLease = {
    runtimeId: input.runtimeId,
    origin: input.origin,
    host: input.host,
    pid: process.pid,
    acquiredAt: existing?.runtimeId === input.runtimeId ? existing.acquiredAt : now,
    renewedAt: now,
    workerVersion: input.workerVersion ?? null,
  };

  if (existingRow) {
    // Optimistic take-over: only succeed if nobody else wrote the row since we
    // read it. Prevents two simultaneous claims from both "winning".
    const updated = await prisma.adminWorkerMemory.updateMany({
      where: {
        memoryType: MEMORY_TYPE,
        memoryKey: LEASE_KEY,
        updatedAt: existingRow.updatedAt,
      },
      data: { memoryValue: lease as never, lastUsedAt: new Date() },
    });
    if (updated.count === 0) {
      const nowRow = await readRow(prisma, LEASE_KEY).catch(() => null);
      const holder = parseLease(nowRow?.memoryValue);
      if (holder && holder.runtimeId !== input.runtimeId) {
        return {
          acquired: false,
          lease: holder,
          refusedBecause: `Execution lease was claimed concurrently by ${holder.runtimeId}.`,
        };
      }
    }
    return { acquired: true, lease };
  }

  await writeRow(prisma, LEASE_KEY, lease);
  return { acquired: true, lease };
}

export type LeaseRenewal = "renewed" | "lost" | "unknown";

/**
 * Renew a lease this runtime already owns. "lost" is a definitive answer (the
 * row now names another runtime, or is gone); "unknown" means the database
 * could not be reached — the caller must keep running and retry, never treat
 * it as a takeover.
 */
export async function renewExecutionLease(
  prisma: PrismaClient,
  runtimeId: string,
): Promise<LeaseRenewal> {
  let row: RawRow | null;
  try {
    row = await readRow(prisma, LEASE_KEY);
  } catch {
    return "unknown";
  }
  const lease = parseLease(row?.memoryValue);
  if (!lease || lease.runtimeId !== runtimeId) return "lost";
  try {
    await writeRow(prisma, LEASE_KEY, { ...lease, renewedAt: new Date().toISOString() });
  } catch {
    return "unknown";
  }
  return "renewed";
}

/** Release the lease if this runtime holds it (idempotent, fail-open). */
export async function releaseExecutionLease(
  prisma: PrismaClient,
  runtimeId: string,
): Promise<void> {
  const row = await readRow(prisma, LEASE_KEY).catch(() => null);
  const lease = parseLease(row?.memoryValue);
  if (!lease || lease.runtimeId !== runtimeId) return;
  await prisma.adminWorkerMemory
    .delete({
      where: { memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: LEASE_KEY } },
    })
    .catch(() => undefined);
}

/** True when `runtimeId` currently holds a live lease. */
export async function holdsExecutionLease(
  prisma: PrismaClient,
  runtimeId: string,
): Promise<boolean> {
  const row = await readRow(prisma, LEASE_KEY).catch(() => null);
  const lease = parseLease(row?.memoryValue);
  if (!lease || lease.runtimeId !== runtimeId) return false;
  const age = leaseAge(lease);
  return age === null || age < LEASE_TTL_MS;
}

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

export async function readExecutionStatus(prisma: PrismaClient): Promise<ExecutionStatus> {
  const master = await readMasterSwitch(prisma);
  let row: RawRow | null = null;
  let error = master.error;
  if (master.known) {
    try {
      row = await readRow(prisma, LEASE_KEY);
    } catch (err) {
      error = describeDbError(err);
    }
  }
  const known = master.known && error === undefined;
  const lease = parseLease(row?.memoryValue);
  const age = leaseAge(lease);
  const live = lease !== null && age !== null && age < LEASE_TTL_MS;

  let state: ExecutionState;
  if (!master.on) state = "OFF";
  else if (live && lease?.origin === "LOCAL_MACBOOK") state = "LOCAL_ACTIVE";
  else if (live) state = "REMOTE_ACTIVE";
  else state = "LOCAL_DISCONNECTED";

  return {
    state,
    switch: master,
    lease,
    leaseAgeMs: age,
    leaseLive: live,
    executingLocally: state === "LOCAL_ACTIVE",
    label: known
      ? describeExecutionState(state, lease)
      : `Admin Worker state unknown — the database could not be read (${error ?? "error"}).`,
    known,
    ...(error !== undefined ? { error } : {}),
  };
}

export function describeExecutionState(
  state: ExecutionState,
  lease: ExecutionLease | null,
): string {
  switch (state) {
    case "OFF":
      return "Admin Worker OFF — intentionally inactive (no local runtime, no cloud worker).";
    case "LOCAL_ACTIVE":
      return `Admin Worker active locally on ${lease?.host.label ?? "the operator MacBook"}.`;
    case "LOCAL_DISCONNECTED":
      return "Admin Worker switched ON but the local runtime is disconnected — no cloud failover.";
    case "REMOTE_ACTIVE":
      return `Admin Worker running on a deliberately-overridden remote runtime (${lease?.host.label ?? "remote"}).`;
  }
}

/**
 * Gate used by every worker entry point before it does real work. Combines the
 * durable rules (switch + lease) with the process-level rule in
 * `execution-context.ts`.
 */
export async function assertExecutionAuthority(
  prisma: PrismaClient,
  input: { runtimeId: string; operation: string },
): Promise<void> {
  const master = await readMasterSwitch(prisma);
  if (!master.known) {
    throw new Error(
      `The database could not be read to check the Admin Worker master switch — refusing to ${input.operation}: ${master.error ?? "database error"}`,
    );
  }
  if (!master.on) {
    throw new Error(
      `Admin Worker master switch is OFF — refusing to ${input.operation}. ` +
        `Turn the worker on from the Via Fidei application on the operator MacBook.`,
    );
  }
  const holds = await holdsExecutionLease(prisma, input.runtimeId);
  if (!holds) {
    throw new Error(
      `This runtime does not hold the Admin Worker execution lease — refusing to ${input.operation}. ` +
        `Exactly one runtime executes the worker at a time.`,
    );
  }
}

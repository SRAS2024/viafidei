/**
 * "Is the Mac runtime alive?" — as a durable fact, for surfaces that are not
 * on this Mac.
 *
 * The iPhone remote control cannot see the local host's loopback control
 * surface; it reads Postgres. Two liveness questions have to stay distinct
 * there, and conflating them is the whole reason this file exists:
 *
 *   - Is the WORKER alive? → AdminWorkerState.lastHeartbeatAt (state.ts,
 *     spec §18). Written only while a worker child is actually running.
 *   - Is the MAC HOST PROCESS alive? → this row. Written on every reconcile
 *     tick whether the worker is on or off, because "the app is running with
 *     the worker switched off" and "the Mac is asleep" look identical
 *     otherwise, and only the first one can honour a remote switch-ON.
 *
 * No new table: this is one more `AdminWorkerMemory` GENERIC row in the
 * `worker.execution.*` namespace the master switch and the execution lease
 * already live in (execution-host.ts).
 *
 * Display only. The iPhone toggle is disabled by the PHONE's own connectivity
 * and by nothing else — a stale presence row means the Mac cannot be seen, not
 * that the operator may not flip the switch. The switch is durable precisely so
 * it can be written while the Mac is away and honoured when it comes back.
 */

import type { PrismaClient } from "@prisma/client";

import type { WorkerExecutionOrigin } from "./execution-context";
import { summarizeDatabaseError } from "./local-config";
import type { HostRunState } from "./switch-poll";

const MEMORY_TYPE = "GENERIC" as const;

/** Same namespace as worker.execution.switch / worker.execution.lease. */
export const HOST_PRESENCE_KEY = "worker.execution.host";

/**
 * A presence row older than this means the Mac runtime is not answering:
 * asleep, quit uncleanly, or off the network. Three missed ticks plus slack at
 * the 7 s reconcile cadence — long enough that one slow round-trip never
 * flickers "offline", short enough that the phone notices a closed lid.
 */
export const HOST_PRESENCE_STALE_MS = 30_000;

export interface HostPresence {
  /** The local host runtime that wrote this row (matches the lease runtimeId). */
  runtimeId: string;
  /** Short non-sensitive machine label, e.g. "MacBook Pro · darwin arm64". */
  hostLabel: string;
  /** Supervisor process id on the Mac. */
  pid: number;
  origin: WorkerExecutionOrigin;
  /** ISO timestamp written by the tick. Freshness is measured against this. */
  at: string;
  /** Nominal refresh cadence in ms, so a reader need not hard-code it. */
  intervalMs: number;
  /** Treat the runtime as gone when (now - at) exceeds this. */
  staleAfterMs: number;
  /** Supervisor state at that instant. */
  runState: HostRunState;
  /** True when a supervised worker child process exists. */
  workerRunning: boolean;
  /** When the current worker child started, ISO, or null. */
  workerStartedAt: string | null;
  /** The durable switch as this runtime last read it; null when unreadable. */
  switchOn: boolean | null;
  /** One-line reason the worker is not running here, or null. */
  failureReason: string | null;
  /** True when another runtime holds the execution lease. */
  leaseHeldElsewhere: boolean;
}

export interface HostPresenceStatus {
  /** The row as written by the Mac, or null when there is none. */
  presence: HostPresence | null;
  /** Age of `presence.at` in ms, or null when there is no row. */
  ageMs: number | null;
  /**
   * The Mac runtime is up and reconciling right now. False for both "no row"
   * (clean quit) and "stale row" (asleep / crashed / offline).
   */
  alive: boolean;
  /** False when the database could not be read — `alive` is then unknown, not false. */
  known: boolean;
  error?: string;
}

export interface HostPresenceInput {
  runtimeId: string;
  hostLabel: string;
  pid: number;
  origin: WorkerExecutionOrigin;
  runState: HostRunState;
  workerRunning: boolean;
  workerStartedAt: string | null;
  switchOn: boolean | null;
  failureReason: string | null;
  leaseHeldElsewhere: boolean;
  intervalMs: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Build the row without writing it — the exact shape readers may rely on. */
export function buildHostPresence(input: HostPresenceInput, at = new Date()): HostPresence {
  return {
    runtimeId: input.runtimeId,
    hostLabel: input.hostLabel,
    pid: input.pid,
    origin: input.origin,
    at: at.toISOString(),
    intervalMs: input.intervalMs,
    staleAfterMs: HOST_PRESENCE_STALE_MS,
    runState: input.runState,
    workerRunning: input.workerRunning,
    workerStartedAt: input.workerStartedAt,
    switchOn: input.switchOn,
    // Never let a stack trace or a connection string into a row a phone renders.
    failureReason: input.failureReason ? input.failureReason.slice(0, 400) : null,
    leaseHeldElsewhere: input.leaseHeldElsewhere,
  };
}

/**
 * Refresh the presence row. Throws on a database error so the caller can decide
 * (the host swallows it: a missed tick simply ages the row, which is the
 * correct signal).
 */
export async function writeHostPresence(
  prisma: PrismaClient,
  input: HostPresenceInput,
): Promise<HostPresence> {
  const presence = buildHostPresence(input);
  await prisma.adminWorkerMemory.upsert({
    where: { memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: HOST_PRESENCE_KEY } },
    create: {
      memoryType: MEMORY_TYPE,
      memoryKey: HOST_PRESENCE_KEY,
      memoryValue: presence as never,
      confidence: 1,
      lastUsedAt: new Date(),
    },
    update: { memoryValue: presence as never, lastUsedAt: new Date() },
  });
  return presence;
}

function parsePresence(value: unknown): HostPresence | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const runtimeId = typeof rec.runtimeId === "string" ? rec.runtimeId : null;
  const at = typeof rec.at === "string" ? rec.at : null;
  if (!runtimeId || !at) return null;
  const staleAfterMs =
    typeof rec.staleAfterMs === "number" && rec.staleAfterMs > 0
      ? rec.staleAfterMs
      : HOST_PRESENCE_STALE_MS;
  return {
    runtimeId,
    hostLabel: typeof rec.hostLabel === "string" ? rec.hostLabel : "unknown host",
    pid: typeof rec.pid === "number" ? rec.pid : 0,
    origin: (typeof rec.origin === "string"
      ? rec.origin
      : "LOCAL_MACBOOK") as WorkerExecutionOrigin,
    at,
    intervalMs: typeof rec.intervalMs === "number" ? rec.intervalMs : 0,
    staleAfterMs,
    runState: (typeof rec.runState === "string" ? rec.runState : "off") as HostRunState,
    workerRunning: rec.workerRunning === true,
    workerStartedAt: typeof rec.workerStartedAt === "string" ? rec.workerStartedAt : null,
    switchOn: typeof rec.switchOn === "boolean" ? rec.switchOn : null,
    failureReason: typeof rec.failureReason === "string" ? rec.failureReason : null,
    leaseHeldElsewhere: rec.leaseHeldElsewhere === true,
  };
}

/**
 * Read the presence row. Never throws: a database error comes back as
 * `known: false`, so an outage is never rendered as "the Mac is off".
 */
export async function readHostPresence(prisma: PrismaClient): Promise<HostPresenceStatus> {
  let row: { memoryValue: unknown } | null;
  try {
    row = await prisma.adminWorkerMemory.findUnique({
      where: { memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: HOST_PRESENCE_KEY } },
      select: { memoryValue: true },
    });
  } catch (err) {
    return {
      presence: null,
      ageMs: null,
      alive: false,
      known: false,
      error: summarizeDatabaseError(err, 240),
    };
  }
  const presence = parsePresence(row?.memoryValue);
  if (!presence) return { presence: null, ageMs: null, alive: false, known: true };
  const parsed = Date.parse(presence.at);
  const ageMs = Number.isFinite(parsed) ? Date.now() - parsed : null;
  return {
    presence,
    ageMs,
    alive: ageMs !== null && ageMs <= presence.staleAfterMs,
    known: true,
  };
}

/**
 * Drop the row on a clean shutdown, so the phone shows "the Mac app is not
 * running" immediately rather than waiting out the staleness window. Only the
 * runtime that owns the row may clear it, and a failure is not an error: the
 * row ages out on its own.
 */
export async function clearHostPresence(prisma: PrismaClient, runtimeId: string): Promise<void> {
  const current = await readHostPresence(prisma).catch(() => null);
  if (!current?.presence || current.presence.runtimeId !== runtimeId) return;
  await prisma.adminWorkerMemory
    .delete({
      where: { memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: HOST_PRESENCE_KEY } },
    })
    .catch(() => undefined);
}

/** One line for a status surface. */
export function describeHostPresence(status: HostPresenceStatus): string {
  if (!status.known) {
    return `Mac runtime state unknown — the database could not be read (${status.error ?? "error"}).`;
  }
  if (!status.presence) return "Mac runtime not running (no local host has checked in).";
  const seconds = Math.round((status.ageMs ?? 0) / 1000);
  if (!status.alive) {
    return `Mac runtime last seen ${seconds}s ago on ${status.presence.hostLabel} — not answering.`;
  }
  return status.presence.workerRunning
    ? `Mac runtime alive on ${status.presence.hostLabel}, worker running.`
    : `Mac runtime alive on ${status.presence.hostLabel}, worker not running.`;
}

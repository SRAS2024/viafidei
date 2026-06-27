/**
 * Read / write the singleton AdminWorkerState row. The state row is the
 * single source of truth for the worker's current mode, current
 * blocker, and pause toggle. The diagnostics page reads this row to
 * render its status badge; the API routes write to it when the
 * operator hits Pause / Resume.
 */

import type { AdminWorkerMode, AdminWorkerPriority, PrismaClient } from "@prisma/client";

const SINGLETON_ID = "singleton";

export type AdminWorkerStateSnapshot = {
  id: string;
  currentMode: AdminWorkerMode;
  currentPriority: AdminWorkerPriority;
  currentGoal: string | null;
  currentTask: string | null;
  lastHeartbeatAt: Date | null;
  lastSuccessfulAt: Date | null;
  lastFailedAt: Date | null;
  currentBlocker: string | null;
  recoveryAction: string | null;
  workerVersion: string;
  paused: boolean;
  pausedReason: string | null;
  pausedByUsername: string | null;
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Read the singleton state row, creating it if (for any reason) it is
 * missing — the migration seeds the row but defensive reads protect
 * against partial deploys.
 */
export async function getAdminWorkerState(prisma: PrismaClient): Promise<AdminWorkerStateSnapshot> {
  const row = await prisma.adminWorkerState.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: {
      id: SINGLETON_ID,
      currentMode: "SETUP",
      currentPriority: "WORKER_HEALTH",
    },
  });
  return row;
}

export async function setMode(
  prisma: PrismaClient,
  mode: AdminWorkerMode,
  opts: { currentGoal?: string; currentTask?: string; currentBlocker?: string | null } = {},
): Promise<void> {
  await prisma.adminWorkerState.update({
    where: { id: SINGLETON_ID },
    data: {
      currentMode: mode,
      ...(opts.currentGoal !== undefined ? { currentGoal: opts.currentGoal } : {}),
      ...(opts.currentTask !== undefined ? { currentTask: opts.currentTask } : {}),
      ...(opts.currentBlocker !== undefined ? { currentBlocker: opts.currentBlocker } : {}),
    },
  });
}

export async function setPriority(
  prisma: PrismaClient,
  priority: AdminWorkerPriority,
): Promise<void> {
  await prisma.adminWorkerState.update({
    where: { id: SINGLETON_ID },
    data: { currentPriority: priority },
  });
}

export async function writeHeartbeat(prisma: PrismaClient): Promise<void> {
  // The single source of truth for worker liveness is
  // AdminWorkerState.lastHeartbeatAt (spec §18). The legacy WorkerHeartbeat
  // dual-write (and its diagnostics rating) were removed once the
  // heartbeat-unification transition completed — nothing reads that table now.
  await prisma.adminWorkerState.update({
    where: { id: SINGLETON_ID },
    data: { lastHeartbeatAt: new Date() },
  });
}

export async function recordSuccess(
  prisma: PrismaClient,
  opts: { summary?: string } = {},
): Promise<void> {
  await prisma.adminWorkerState.update({
    where: { id: SINGLETON_ID },
    data: {
      lastSuccessfulAt: new Date(),
      currentBlocker: null,
      recoveryAction: null,
      ...(opts.summary ? { currentTask: opts.summary } : {}),
    },
  });
}

export async function recordFailure(
  prisma: PrismaClient,
  opts: { blocker: string; recoveryAction?: string },
): Promise<void> {
  await prisma.adminWorkerState.update({
    where: { id: SINGLETON_ID },
    data: {
      lastFailedAt: new Date(),
      currentBlocker: opts.blocker,
      recoveryAction: opts.recoveryAction ?? null,
    },
  });
}

export async function pause(
  prisma: PrismaClient,
  opts: { reason: string; byUsername: string },
): Promise<AdminWorkerStateSnapshot> {
  return prisma.adminWorkerState.update({
    where: { id: SINGLETON_ID },
    data: {
      paused: true,
      pausedReason: opts.reason,
      pausedByUsername: opts.byUsername,
      pausedAt: new Date(),
      currentMode: "PAUSED",
    },
  });
}

export async function resume(
  prisma: PrismaClient,
  opts: { byUsername: string } = { byUsername: "system" },
): Promise<AdminWorkerStateSnapshot> {
  return prisma.adminWorkerState.update({
    where: { id: SINGLETON_ID },
    data: {
      paused: false,
      pausedReason: null,
      pausedAt: null,
      pausedByUsername: opts.byUsername,
      currentMode: "CONSTANT_FILL",
    },
  });
}

/**
 * True when the worker should skip non-security tasks. Security defense
 * runs even when paused (see `security-defender.ts`).
 */
export function isPaused(state: AdminWorkerStateSnapshot): boolean {
  return state.paused;
}

/**
 * Worker health monitor. Tracks heartbeat freshness + recent failures
 * so the diagnostics card and the central loop can surface "the
 * worker is unhealthy" before content suffers.
 */

import type { PrismaClient } from "@prisma/client";

import { getAdminWorkerState } from "./state";

export interface WorkerHealthSnapshot {
  heartbeatAgeMs: number | null;
  lastSuccessAgeMs: number | null;
  lastFailureAgeMs: number | null;
  isHealthy: boolean;
  blocker: string | null;
}

export async function checkWorkerHealth(prisma: PrismaClient): Promise<WorkerHealthSnapshot> {
  const state = await getAdminWorkerState(prisma);
  const now = Date.now();
  const heartbeatAgeMs = state.lastHeartbeatAt ? now - state.lastHeartbeatAt.getTime() : null;
  const lastSuccessAgeMs = state.lastSuccessfulAt ? now - state.lastSuccessfulAt.getTime() : null;
  const lastFailureAgeMs = state.lastFailedAt ? now - state.lastFailedAt.getTime() : null;
  const isHealthy =
    !state.paused &&
    state.currentBlocker == null &&
    (heartbeatAgeMs == null || heartbeatAgeMs < 5 * 60_000);
  return {
    heartbeatAgeMs,
    lastSuccessAgeMs,
    lastFailureAgeMs,
    isHealthy,
    blocker: state.currentBlocker ?? null,
  };
}

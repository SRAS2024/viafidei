/**
 * Worker heartbeat. Each running worker writes its workerId / status /
 * counters into `WorkerHeartbeat` on a periodic cadence. The admin
 * dashboard reads this table to show active vs stale workers and the
 * cron route fires a warning when the queue has pending jobs but no
 * healthy worker is alive.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";

const STALE_THRESHOLD_MS = 90 * 1000;

export type WorkerStatus = "idle" | "running" | "shutting_down" | "stopped";

export type HeartbeatUpdate = {
  workerId: string;
  startedAt: Date;
  processedCount: number;
  failedCount: number;
  retryCount: number;
  currentJobId?: string | null;
  status?: WorkerStatus;
  hostname?: string;
  version?: string;
};

export async function writeHeartbeat(update: HeartbeatUpdate): Promise<void> {
  try {
    await prisma.workerHeartbeat.upsert({
      where: { workerId: update.workerId },
      create: {
        workerId: update.workerId,
        startedAt: update.startedAt,
        processedCount: update.processedCount,
        failedCount: update.failedCount,
        retryCount: update.retryCount,
        currentJobId: update.currentJobId ?? null,
        status: update.status ?? "idle",
        hostname: update.hostname ?? null,
        version: update.version ?? null,
        lastHeartbeatAt: new Date(),
      },
      update: {
        processedCount: update.processedCount,
        failedCount: update.failedCount,
        retryCount: update.retryCount,
        currentJobId: update.currentJobId ?? null,
        status: update.status ?? "idle",
        lastHeartbeatAt: new Date(),
      },
    });
  } catch (e) {
    logger.warn("worker.heartbeat.write_failed", {
      workerId: update.workerId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export type WorkerHealthRow = {
  workerId: string;
  startedAt: Date;
  lastHeartbeatAt: Date;
  ageMs: number;
  isStale: boolean;
  status: string;
  processedCount: number;
  failedCount: number;
  retryCount: number;
  currentJobId: string | null;
};

export async function listWorkerHealth(now: Date = new Date()): Promise<WorkerHealthRow[]> {
  const rows = await prisma.workerHeartbeat.findMany({
    orderBy: { lastHeartbeatAt: "desc" },
  });
  return rows.map((r) => {
    const ageMs = now.getTime() - r.lastHeartbeatAt.getTime();
    return {
      workerId: r.workerId,
      startedAt: r.startedAt,
      lastHeartbeatAt: r.lastHeartbeatAt,
      ageMs,
      isStale: ageMs > STALE_THRESHOLD_MS,
      status: r.status,
      processedCount: r.processedCount,
      failedCount: r.failedCount,
      retryCount: r.retryCount,
      currentJobId: r.currentJobId,
    };
  });
}

export async function hasHealthyWorker(now: Date = new Date()): Promise<boolean> {
  const cutoff = new Date(now.getTime() - STALE_THRESHOLD_MS);
  const count = await prisma.workerHeartbeat.count({
    where: { lastHeartbeatAt: { gt: cutoff }, status: { not: "stopped" } },
  });
  return count > 0;
}

/**
 * Remove a worker's heartbeat row on graceful shutdown so the
 * dashboard does not surface an obsolete entry.
 */
export async function removeHeartbeat(workerId: string): Promise<void> {
  try {
    await prisma.workerHeartbeat.delete({ where: { workerId } });
  } catch {
    // Already removed or never written — no-op.
  }
}

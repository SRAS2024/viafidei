/**
 * Worker heartbeat. Each running worker writes its workerId / status /
 * counters into `WorkerHeartbeat` on a periodic cadence. The admin
 * dashboard reads this table to show active vs stale workers and the
 * cron route fires a warning when the queue has pending jobs but no
 * healthy worker is alive.
 */

import { prisma } from "../../db/client";

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
  /**
   * Process identity. The dedicated worker service records "worker".
   * Stored in the `WorkerHeartbeat.metadata` JSON column so the admin
   * diagnostics can prove the heartbeat came from the worker process
   * (and not, say, a web request that wandered into worker code).
   */
  processType?: string;
};

/**
 * Write (upsert) a worker heartbeat row.
 *
 * This intentionally does NOT swallow database errors. The caller
 * decides whether a failed write is fatal — the worker's first
 * startup heartbeat must fail loudly so Railway restarts a worker
 * that can't reach the database — or merely a logged warning, which
 * is the right call for the periodic in-loop heartbeats. A silently
 * swallowed heartbeat write is exactly how a worker ends up looking
 * dead on the dashboard while the process is still alive.
 */
export async function writeHeartbeat(update: HeartbeatUpdate): Promise<void> {
  const metadata = update.processType ? { processType: update.processType } : undefined;
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
      metadata,
      lastHeartbeatAt: new Date(),
    },
    update: {
      processedCount: update.processedCount,
      failedCount: update.failedCount,
      retryCount: update.retryCount,
      currentJobId: update.currentJobId ?? null,
      status: update.status ?? "idle",
      metadata,
      lastHeartbeatAt: new Date(),
    },
  });
}

/** Pull a string `processType` out of the heartbeat `metadata` JSON. */
function readProcessType(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).processType;
    if (typeof value === "string") return value;
  }
  return null;
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
  hostname: string | null;
  version: string | null;
  processType: string | null;
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
      hostname: r.hostname ?? null,
      version: r.version ?? null,
      processType: readProcessType(r.metadata),
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

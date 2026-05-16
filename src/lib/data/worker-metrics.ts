/**
 * Worker metrics aggregator. Computes per-worker rollups from
 * `IngestionJobQueue` rows (durationMs, finished status) keyed by
 * `leasedBy`. Used by the worker dashboard.
 */

import { prisma } from "../db/client";

export type WorkerMetric = {
  workerId: string;
  processed: number;
  failed: number;
  retried: number;
  avgDurationMs: number | null;
  failureRate: number;
  retryRate: number;
  currentJobId: string | null;
  idleSinceMs: number | null;
};

/**
 * Aggregate per-worker counters over the last 24 hours.
 *   - processed: count of completed rows last 24h.
 *   - failed: count of failed rows last 24h.
 *   - retried: count of retrying rows last 24h.
 *   - avgDurationMs: mean of durationMs across completed rows.
 *   - failureRate: failed / (processed + failed + retried).
 *   - retryRate: retried / (processed + failed + retried).
 *   - currentJobId: the worker's current in-flight row (running).
 *   - idleSinceMs: age of the worker's last heartbeat with
 *     status='idle'.
 */
export async function listWorkerMetrics(now: Date = new Date()): Promise<WorkerMetric[]> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const heartbeats = await prisma.workerHeartbeat.findMany();
  const workerIds = heartbeats.map((h) => h.workerId);
  if (workerIds.length === 0) return [];

  const grouped = await prisma.ingestionJobQueue.groupBy({
    by: ["leasedBy", "status"],
    where: {
      leasedBy: { in: workerIds },
      finishedAt: { gte: cutoff },
    },
    _count: { _all: true },
  });

  // Per-worker average duration over the last 24h (completed only).
  const aggregates = await prisma.ingestionJobQueue.groupBy({
    by: ["leasedBy"],
    where: {
      leasedBy: { in: workerIds },
      status: "completed",
      finishedAt: { gte: cutoff },
      durationMs: { not: null },
    },
    _avg: { durationMs: true },
  });
  const avgByWorker = new Map(
    aggregates
      .filter((a) => a.leasedBy)
      .map((a) => [a.leasedBy as string, a._avg.durationMs ?? null]),
  );

  return heartbeats.map((h) => {
    const rows = grouped.filter((g) => g.leasedBy === h.workerId);
    const processed = rows
      .filter((g) => g.status === "completed")
      .reduce((sum, g) => sum + g._count._all, 0);
    const failed = rows
      .filter((g) => g.status === "failed")
      .reduce((sum, g) => sum + g._count._all, 0);
    const retried = rows
      .filter((g) => g.status === "retrying")
      .reduce((sum, g) => sum + g._count._all, 0);
    const total = processed + failed + retried;
    return {
      workerId: h.workerId,
      processed,
      failed,
      retried,
      avgDurationMs: avgByWorker.get(h.workerId) ?? null,
      failureRate: total > 0 ? failed / total : 0,
      retryRate: total > 0 ? retried / total : 0,
      currentJobId: h.currentJobId,
      idleSinceMs: h.status === "idle" ? now.getTime() - h.lastHeartbeatAt.getTime() : null,
    };
  });
}

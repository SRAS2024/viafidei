/**
 * Worker health diagnostics.
 *
 * Builds the data behind the admin worker health card: is a worker
 * alive, when did it last beat, what is it processing, and — when it
 * is missing — the likely causes the operator should check.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { listWorkerHealth } from "../ingestion/queue/heartbeat";
import { countQueueByStatus, queueLatencySnapshot } from "../ingestion/queue/queue";

const QUEUE_NOT_DRAINING_AGE_MS = 5 * 60 * 1000;

export type WorkerHealthDiagnostics = {
  generatedAt: Date;
  workerAlive: boolean;
  lastHeartbeatAt: Date | null;
  heartbeatAgeMs: number | null;
  processType: string | null;
  workerId: string | null;
  hostname: string | null;
  processedCount: number | null;
  failedCount: number | null;
  retryCount: number | null;
  currentJobId: string | null;
  workerStatus: string | null;
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  oldestPendingAgeMs: number | null;
  /** Headline line the admin reads first. */
  message: string;
  /** When the worker heartbeat is missing — things to check. */
  likelyCauses: string[];
  /** Top distinct failure reasons across failed queue jobs. */
  topFailureReasons: Array<{ reason: string; count: number }>;
  errors: Record<string, string>;
};

const MISSING_WORKER_CAUSES = [
  "worker process exited",
  "worker cannot write heartbeat",
  "worker cannot connect to database",
  "worker is running the wrong command",
  "worker service is not deployed",
  "worker service has stale environment variables",
];

async function safe<T>(
  fn: () => Promise<T>,
  label: string,
  fallback: T,
  errors: Record<string, string>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors[label] = msg;
    logger.warn("worker-health.query_failed", { label, error: msg });
    return fallback;
  }
}

export async function getWorkerHealthDiagnostics(
  now: Date = new Date(),
): Promise<WorkerHealthDiagnostics> {
  const errors: Record<string, string> = {};

  const workers = await safe(() => listWorkerHealth(now), "workers", [], errors);
  const counts = await safe(
    () => countQueueByStatus(),
    "queueCounts",
    { pending: 0, running: 0, completed: 0, failed: 0, skipped: 0, retrying: 0 },
    errors,
  );
  const latency = await safe(
    () => queueLatencySnapshot(),
    "queueLatency",
    { oldestPendingAgeMs: null, oldestRetryingAgeMs: null, avgWaitMs: null },
    errors,
  );

  const liveWorkers = workers.filter((w) => !w.isStale && w.status !== "stopped");
  // Prefer a worker that identifies itself as the worker process.
  const primary = liveWorkers.find((w) => w.processType === "worker") ?? liveWorkers[0] ?? null;
  const workerAlive = liveWorkers.length > 0;

  const failureGroups = await safe(
    () =>
      prisma.ingestionJobQueue.groupBy({
        by: ["lastError"],
        where: { status: "failed", lastError: { not: null } },
        _count: { _all: true },
      }),
    "failureReasons",
    [] as Array<{ lastError: string | null; _count: { _all: number } }>,
    errors,
  );
  const topFailureReasons = failureGroups
    .filter((g): g is { lastError: string; _count: { _all: number } } => g.lastError !== null)
    .map((g) => ({ reason: g.lastError, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const pendingJobs = counts.pending;
  const runningJobs = counts.running;
  const failedJobs = counts.failed;
  const oldestPendingAgeMs = latency.oldestPendingAgeMs;

  let message: string;
  let likelyCauses: string[] = [];
  if (!workerAlive) {
    message =
      pendingJobs > 0
        ? "Queue has pending jobs but no healthy worker is processing them."
        : "No healthy worker heartbeat detected.";
    likelyCauses = MISSING_WORKER_CAUSES;
  } else if (
    pendingJobs > 0 &&
    oldestPendingAgeMs != null &&
    oldestPendingAgeMs > QUEUE_NOT_DRAINING_AGE_MS
  ) {
    message = "Worker is alive but queue is not draining.";
  } else if (failedJobs > 0) {
    message = `Worker is alive; ${failedJobs} queue job(s) have failed — see top failure reasons.`;
  } else {
    message = "Healthy worker heartbeat detected.";
  }

  return {
    generatedAt: now,
    workerAlive,
    lastHeartbeatAt: primary?.lastHeartbeatAt ?? null,
    heartbeatAgeMs: primary?.ageMs ?? null,
    processType: primary?.processType ?? null,
    workerId: primary?.workerId ?? null,
    hostname: primary?.hostname ?? null,
    processedCount: primary?.processedCount ?? null,
    failedCount: primary?.failedCount ?? null,
    retryCount: primary?.retryCount ?? null,
    currentJobId: primary?.currentJobId ?? null,
    workerStatus: primary?.status ?? null,
    pendingJobs,
    runningJobs,
    failedJobs,
    oldestPendingAgeMs,
    message,
    likelyCauses,
    topFailureReasons,
    errors,
  };
}

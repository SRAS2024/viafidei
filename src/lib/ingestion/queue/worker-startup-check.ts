/**
 * Worker startup self-test.
 *
 * Runs exactly once, before the worker enters its polling loop, and
 * proves the worker can actually do its job:
 *
 *   1. `DATABASE_URL` is configured.
 *   2. Prisma can connect to the database.
 *   3. The `WorkerHeartbeat` table is readable.
 *   4. The `IngestionJobQueue` table is readable.
 *   5. A heartbeat row can be written.
 *   6. Pending jobs can be counted.
 *   7. The process type is `worker`.
 *
 * If the check fails the worker should exit with a non-zero code so
 * Railway restarts it — far better than a dead worker that silently
 * never writes a heartbeat while the queue backs up.
 *
 * Secret values are never logged. The result reports only whether
 * `DATABASE_URL` is configured, never its contents.
 */

import { prisma } from "../../db/client";

export type WorkerStartupCheckResult = {
  ok: boolean;
  databaseUrlConfigured: boolean;
  databaseReachable: boolean;
  heartbeatTableReadable: boolean;
  queueTableReadable: boolean;
  heartbeatWritable: boolean;
  pendingJobs: number | null;
  errorMessage?: string;
};

/**
 * Heartbeat row id used only by the write-probe below. It is written
 * with `status: "stopped"` (so `hasHealthyWorker()` never counts it)
 * and deleted immediately afterwards.
 */
const STARTUP_PROBE_WORKER_ID = "__worker_startup_probe__";

export async function runWorkerStartupCheck(
  options: { processType?: string } = {},
): Promise<WorkerStartupCheckResult> {
  const result: WorkerStartupCheckResult = {
    ok: false,
    databaseUrlConfigured: false,
    databaseReachable: false,
    heartbeatTableReadable: false,
    queueTableReadable: false,
    heartbeatWritable: false,
    pendingJobs: null,
  };

  // The startup check must only ever run inside the worker process. A
  // non-"worker" process type means the deploy is wired up wrong —
  // e.g. the web service command is running the worker entrypoint.
  const processType = options.processType ?? "worker";
  if (processType !== "worker") {
    result.errorMessage = `Unexpected process type "${processType}" — expected "worker"`;
    return result;
  }

  try {
    result.databaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());
    if (!result.databaseUrlConfigured) {
      result.errorMessage = "DATABASE_URL is not configured";
      return result;
    }

    await prisma.$queryRaw`SELECT 1`;
    result.databaseReachable = true;

    await prisma.workerHeartbeat.count();
    result.heartbeatTableReadable = true;

    const pendingJobs = await prisma.ingestionJobQueue.count({ where: { status: "pending" } });
    result.queueTableReadable = true;
    result.pendingJobs = pendingJobs;

    const now = new Date();
    await prisma.workerHeartbeat.upsert({
      where: { workerId: STARTUP_PROBE_WORKER_ID },
      create: {
        workerId: STARTUP_PROBE_WORKER_ID,
        startedAt: now,
        status: "stopped",
        lastHeartbeatAt: now,
      },
      update: { lastHeartbeatAt: now, status: "stopped" },
    });
    // Best-effort cleanup — the probe row is disposable. A leftover row
    // is harmless because its "stopped" status excludes it from the
    // healthy-worker count.
    await prisma.workerHeartbeat
      .deleteMany({ where: { workerId: STARTUP_PROBE_WORKER_ID } })
      .catch(() => undefined);
    result.heartbeatWritable = true;

    result.ok = true;
    return result;
  } catch (error) {
    result.errorMessage = error instanceof Error ? error.message : String(error);
    return result;
  }
}

#!/usr/bin/env tsx
/**
 * Dedicated ingestion worker. Runs the durable-queue loop without
 * the web server. Designed to be a separate process from the Next
 * app so the web container stays focused on serving pages and APIs
 * while long-running ingestion batches happen elsewhere.
 *
 * Usage:
 *   tsx scripts/run-worker.ts                       # long-running
 *   tsx scripts/run-worker.ts --one-shot            # drain the queue and exit
 *   tsx scripts/run-worker.ts --max-jobs 25         # exit after N jobs
 *   tsx scripts/run-worker.ts --worker-id worker-A  # stable id (default: random uuid)
 *
 * Multiple workers can run in parallel: the lease/SKIP LOCKED claim
 * guarantees no two workers process the same job.
 */

import { runWorkerLoop, releaseActiveLeases } from "../src/lib/ingestion/queue/worker";
import { runWorkerStartupCheck } from "../src/lib/ingestion/queue/worker-startup-check";
import { registerVaticanAdapters } from "../src/lib/ingestion/sources";
import { removeHeartbeat } from "../src/lib/ingestion/queue/heartbeat";
import { logger } from "../src/lib/observability/logger";

function parseFlag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return null;
  return process.argv[i + 1] ?? "";
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const workerId = parseFlag("worker-id") ?? undefined;
  const oneShot = hasFlag("one-shot");
  const maxJobsArg = parseFlag("max-jobs");
  const maxJobs = maxJobsArg ? Number.parseInt(maxJobsArg, 10) : undefined;

  // Workers need the same adapter registry the web process has.
  await registerVaticanAdapters();

  let shuttingDown = false;
  const effectiveWorkerId = workerId ?? `worker-${process.pid}`;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("worker shutdown signal", { signal, workerId: effectiveWorkerId });
    // Release any active leases so the next worker can pick the job
    // up without waiting for the stale-lease timeout.
    await releaseActiveLeases(effectiveWorkerId).catch(() => undefined);
    await removeHeartbeat(effectiveWorkerId).catch(() => undefined);
    // Give the loop one cycle to detect the flag and exit.
    setTimeout(() => process.exit(0), 1_000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Startup self-test — proves the worker can reach the database and
  // read/write the queue + heartbeat tables before it enters the
  // loop. A failed check exits non-zero so Railway restarts the
  // worker instead of leaving a dead process that never heartbeats.
  const startupCheck = await runWorkerStartupCheck({ processType: "worker" });
  if (!startupCheck.ok) {
    logger.error("viafidei.worker_service.startup_check_failed", {
      workerId: effectiveWorkerId,
      ...startupCheck,
    });
    process.exit(1);
  }
  logger.info("viafidei.worker_service.startup_check_ok", {
    workerId: effectiveWorkerId,
    ...startupCheck,
  });

  logger.info("viafidei.worker_service.started", {
    workerId: effectiveWorkerId,
    oneShot,
    maxJobs: maxJobs ?? null,
    processType: "worker",
  });

  const result = await runWorkerLoop({
    workerId: effectiveWorkerId,
    oneShot: oneShot || shuttingDown,
    maxJobs,
  });

  logger.info("worker exited", result);

  // A long-running worker is supposed to poll forever. If the loop
  // returns without `--one-shot`, `--max-jobs`, or a graceful
  // shutdown, something went wrong — exit non-zero so Railway
  // restarts the service.
  if (!oneShot && !maxJobs && !shuttingDown) {
    logger.error("worker exited unexpectedly in long-running mode", result);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  logger.error("worker fatal", { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});

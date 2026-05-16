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

import { runWorkerLoop } from "../src/lib/ingestion/queue/worker";
import { registerVaticanAdapters } from "../src/lib/ingestion/sources";
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
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("worker shutdown", { signal });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const result = await runWorkerLoop({
    workerId,
    oneShot: oneShot || shuttingDown,
    maxJobs,
  });

  logger.info("worker exited", result);
  process.exit(0);
}

main().catch((e) => {
  logger.error("worker fatal", { error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});

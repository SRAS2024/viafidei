#!/usr/bin/env tsx
/**
 * Worker health CLI. Prints a snapshot of the worker fleet,
 * queue counts, oldest pending job age, and any active stall
 * conditions. Useful for quick "is the worker alive?" checks
 * without needing to open the admin dashboard.
 *
 * Usage:
 *   npm run worker:status
 *   tsx scripts/worker-status.ts --json
 */

import { listWorkerHealth, hasHealthyWorker } from "../src/lib/ingestion/queue/heartbeat";
import { getQueueHealthSummary } from "../src/lib/data/queue-health";

function ms(n: number | null): string {
  if (n == null) return "—";
  if (n < 1_000) return `${n}ms`;
  if (n < 60_000) return `${(n / 1_000).toFixed(1)}s`;
  if (n < 60 * 60_000) return `${(n / 60_000).toFixed(1)}m`;
  return `${(n / (60 * 60_000)).toFixed(1)}h`;
}

async function main(): Promise<void> {
  const wantJson = process.argv.includes("--json");
  const [workers, health, healthy] = await Promise.all([
    listWorkerHealth(),
    getQueueHealthSummary(),
    hasHealthyWorker(),
  ]);

  if (wantJson) {
    console.log(
      JSON.stringify(
        {
          healthy,
          workers,
          queue: health,
        },
        null,
        2,
      ),
    );
    process.exit(healthy ? 0 : 1);
  }

  console.log("Worker fleet:");
  if (workers.length === 0) {
    console.log("  (none — start one with `npm run worker`)");
  } else {
    for (const w of workers) {
      const flag = w.isStale ? "STALE" : "OK";
      console.log(
        `  [${flag}] ${w.workerId} status=${w.status} last_beat=${ms(w.ageMs)} ago processed=${w.processedCount} failed=${w.failedCount}`,
      );
    }
  }

  console.log("\nQueue:");
  for (const [k, v] of Object.entries(health.counts)) {
    console.log(`  ${k.padEnd(10)} ${v}`);
  }
  console.log(`  oldest pending  ${ms(health.oldestPendingAgeMs)}`);
  console.log(`  oldest retrying ${ms(health.oldestRetryingAgeMs)}`);
  console.log(`  avg wait        ${ms(health.avgWaitMs)}`);
  if (health.pendingJobsButNoWorker) {
    console.log("\n⚠ Queue has pending jobs but no healthy worker.");
  }
  if (health.oldestPendingExceedsThreshold) {
    console.log("⚠ Oldest pending job age exceeds the configured warn threshold.");
  }
  process.exit(healthy ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
});

#!/usr/bin/env tsx
/**
 * Viafidei checklist-first worker entry point.
 *
 * Replaces the legacy scraper worker. Drains the WorkerBuildJob queue by
 * repeatedly calling `runOneBuildCycle` from `src/lib/worker`. Each cycle:
 *
 *   - Picks an approved checklist item from the queue.
 *   - Fetches every approved citation (HTTP).
 *   - Cross-checks values across sources.
 *   - Builds a complete content package against the strict schema.
 *   - Scores QA on six dimensions.
 *   - Publishes when QA passes and human review isn't required.
 *
 * Usage:
 *   tsx scripts/run-worker.ts                # loop forever
 *   tsx scripts/run-worker.ts --one-shot     # one cycle then exit
 *   tsx scripts/run-worker.ts --max-jobs N   # exit after N cycles
 *   tsx scripts/run-worker.ts --worker-id X  # supply a stable worker id
 *
 * Multiple workers can run in parallel; the lease guard guarantees no two
 * workers run the same build.
 */

import { PrismaClient } from "@prisma/client";

import { runOneBuildCycle, runWorkerLoop } from "../src/lib/worker";

function parseArgs(argv: string[]): {
  oneShot: boolean;
  maxJobs: number | null;
  workerId: string;
} {
  let oneShot = false;
  let maxJobs: number | null = null;
  let workerId = process.env.WORKER_ID ?? `worker-${process.pid}-${Date.now()}`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--one-shot") oneShot = true;
    else if (arg === "--max-jobs") {
      maxJobs = parseInt(argv[++i] ?? "0", 10);
    } else if (arg === "--worker-id") {
      workerId = argv[++i] ?? workerId;
    }
  }
  return { oneShot, maxJobs, workerId };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker:${args.workerId}] received ${signal}; exiting...`);
    setTimeout(() => process.exit(0), 1_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    console.log(
      `[worker:${args.workerId}] starting (oneShot=${args.oneShot}, maxJobs=${args.maxJobs ?? "∞"})`,
    );
    if (args.oneShot) {
      const result = await runOneBuildCycle(prisma, args.workerId);
      console.log(`[worker:${args.workerId}] result:`, result);
      return;
    }
    await runWorkerLoop(prisma, {
      workerId: args.workerId,
      maxCycles: args.maxJobs ?? Infinity,
      onIdle: () => {
        if (!shuttingDown) console.log(`[worker:${args.workerId}] idle`);
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exitCode = 1;
});

#!/usr/bin/env tsx
/**
 * One-time migration: seed `IngestionJobQueue` from existing
 * `IngestionJob` rows. Safe to run multiple times — the planner-style
 * dedupe key prevents duplicate active rows.
 *
 * Each existing active IngestionJob becomes one `source_ingest`
 * queue row with priority inferred from current backlog progress.
 *
 * Usage:
 *   npm run migrate:jobs-to-queue
 *   tsx scripts/migrate-jobs-to-queue.ts --dry-run
 */

import { prisma } from "../src/lib/db/client";
import { enqueueDueIngestionJobs } from "../src/lib/ingestion/queue/planner";
import { logger } from "../src/lib/observability/logger";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const activeJobs = await prisma.ingestionJob.findMany({
    where: { isActive: true },
    include: { source: true },
  });
  logger.info("migrate.jobs_to_queue.start", { activeJobs: activeJobs.length, dryRun: DRY_RUN });

  if (DRY_RUN) {
    for (const j of activeJobs) {
      console.log(
        `would enqueue: ${j.jobName} (source=${j.source.host}, target=${j.targetEntity})`,
      );
    }
    process.exit(0);
  }

  const summary = await enqueueDueIngestionJobs({ fillCap: activeJobs.length });
  logger.info("migrate.jobs_to_queue.done", summary);
  console.log("Planner summary:", JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((e) => {
  logger.error("migrate.jobs_to_queue.failed", {
    error: e instanceof Error ? e.message : String(e),
  });
  process.exit(1);
});

/**
 * One-time migration: convert or delete legacy `source_ingest` queue
 * rows so the worker can stop carrying the legacy-kind translation
 * shim.
 *
 * Strategy per row:
 *
 *   - `pending` / `retrying` row with a known `sourceId` → enqueue
 *     a fresh `source_discovery` job and mark the legacy row
 *     completed. The new row uses the same priority and triggeredBy
 *     so the planner sees no behavioural change.
 *   - row with NO `sourceId` (cannot route through the new chain) →
 *     mark `failed` with a precise reason so the admin can see why
 *     the row was dropped.
 *   - `running` rows are left alone (the leasing worker is still
 *     processing them; they'll complete and the next run drains
 *     them).
 *
 * Invocation:
 *
 *   $ tsx scripts/migrate-legacy-queue-rows.ts
 *   $ tsx scripts/migrate-legacy-queue-rows.ts --dry-run
 *
 * Idempotent — already-migrated rows are skipped because the legacy
 * row is updated to `completed`/`failed` on success and the
 * dedupeKey (`migrated:<id>`) prevents duplicate follow-ups.
 */

import { prisma } from "../src/lib/db/client";
import { REMOVED_JOB_KINDS } from "../src/lib/ingestion/queue/job-kinds";
import { enqueueJob } from "../src/lib/ingestion/queue/queue";

type MigrationReport = {
  translated: number;
  failed: number;
  skipped: number;
  total: number;
  dryRun: boolean;
};

async function migrateLegacyQueueRows(options: { dryRun: boolean }): Promise<MigrationReport> {
  const report: MigrationReport = {
    translated: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    dryRun: options.dryRun,
  };
  const rows = await prisma.ingestionJobQueue.findMany({
    where: {
      jobKind: { in: [...REMOVED_JOB_KINDS] },
      status: { in: ["pending", "retrying"] },
    },
    orderBy: { createdAt: "asc" },
  });
  report.total = rows.length;
  for (const row of rows) {
    const adapterKey = (row.payload as Record<string, unknown> | null)?.adapterKey ?? row.jobName;
    if (!row.sourceId) {
      report.failed += 1;
      console.log(
        `[${options.dryRun ? "dry-run" : "migrate"}] FAIL  queue=${row.id} jobKind=${row.jobKind} reason="no sourceId — cannot route through factory chain"`,
      );
      if (!options.dryRun) {
        await prisma.ingestionJobQueue.update({
          where: { id: row.id },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage:
              "Legacy job kind migration: row had no sourceId; cannot route through the modern factory chain.",
          },
        });
      }
      continue;
    }
    report.translated += 1;
    console.log(
      `[${options.dryRun ? "dry-run" : "migrate"}] OK    queue=${row.id} jobKind=${row.jobKind} sourceId=${row.sourceId} → source_discovery`,
    );
    if (options.dryRun) continue;
    try {
      await enqueueJob({
        jobName: row.jobName,
        jobKind: "source_discovery",
        dedupeKey: `migrated:${row.id}`,
        sourceId: row.sourceId,
        jobId: row.jobId,
        contentType: row.contentType,
        payload: {
          sourceId: row.sourceId,
          adapterKey,
          contentType: row.contentType ?? undefined,
          mode: "constant" as const,
        },
        triggeredBy: row.triggeredBy === "manual" ? "manual" : "automatic",
        actorUsername: row.actorUsername ?? null,
      });
      await prisma.ingestionJobQueue.update({
        where: { id: row.id },
        data: {
          status: "completed",
          finishedAt: new Date(),
          errorMessage: `Migrated to source_discovery via migrate-legacy-queue-rows`,
        },
      });
    } catch (e) {
      report.failed += 1;
      report.translated -= 1;
      console.log(
        `[migrate] ERROR queue=${row.id} reason="${e instanceof Error ? e.message : String(e)}"`,
      );
    }
  }
  return report;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const report = await migrateLegacyQueueRows({ dryRun });
  console.log("");
  console.log("=== Legacy queue migration summary ===");
  console.log(`  mode:       ${dryRun ? "dry-run" : "applied"}`);
  console.log(`  total:      ${report.total}`);
  console.log(`  translated: ${report.translated}`);
  console.log(`  failed:     ${report.failed}`);
  console.log(`  skipped:    ${report.skipped}`);
  process.exit(report.failed > 0 && !dryRun ? 1 : 0);
}

main().catch((e) => {
  console.error("migrate-legacy-queue-rows: fatal", e);
  process.exit(2);
});

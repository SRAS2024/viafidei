/**
 * One-time migration: convert or delete legacy queue rows now that
 * the worker translation shim has been deleted.
 *
 * The shim used to rewrite `source_ingest` rows into
 * `source_discovery` at execution time. With the shim gone, legacy
 * rows fail permanently at dispatch with a precise diagnostic — so
 * this script must be run on every deployment that still has any
 * legacy rows in the queue. Legacy kinds handled:
 *
 *   - `source_ingest`     → enqueue a fresh `source_discovery` row.
 *   - `content_validate`  → enqueue a fresh `content_build` row with
 *                            the same payload (the build stage now
 *                            runs the whole pipeline).
 *   - `content_persist`   → same as content_validate.
 *
 * Strategy per row:
 *
 *   - `pending` / `retrying` row that can be routed → enqueue the
 *     replacement and mark the legacy row completed.
 *   - row that cannot be routed (e.g. missing sourceId for a
 *     source-side legacy row) → mark `failed` with a precise reason.
 *   - `running` rows are left alone (the leasing worker is still
 *     processing them; they'll complete on their own).
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
    const targetKind = chooseReplacementKind(row.jobKind);
    if (targetKind === "source_discovery" && !row.sourceId) {
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
    if (targetKind === null) {
      report.skipped += 1;
      console.log(
        `[${options.dryRun ? "dry-run" : "migrate"}] SKIP  queue=${row.id} jobKind=${row.jobKind} reason="no replacement mapping"`,
      );
      continue;
    }
    report.translated += 1;
    console.log(
      `[${options.dryRun ? "dry-run" : "migrate"}] OK    queue=${row.id} jobKind=${row.jobKind} sourceId=${row.sourceId ?? "(none)"} → ${targetKind}`,
    );
    if (options.dryRun) continue;
    try {
      const payload = (row.payload as Record<string, unknown> | null) ?? {};
      const replacementPayload =
        targetKind === "source_discovery"
          ? {
              sourceId: row.sourceId,
              adapterKey,
              contentType: row.contentType ?? undefined,
              mode: "constant" as const,
            }
          : {
              sourceDocumentId: payload.sourceDocumentId,
              sourceUrl: payload.sourceUrl,
              sourceId: row.sourceId ?? undefined,
              contentType: row.contentType ?? undefined,
            };
      await enqueueJob({
        jobName: row.jobName,
        jobKind: targetKind,
        dedupeKey: `migrated:${row.id}`,
        sourceId: row.sourceId,
        jobId: row.jobId,
        contentType: row.contentType,
        payload: replacementPayload,
        triggeredBy: row.triggeredBy === "manual" ? "manual" : "automatic",
        actorUsername: row.actorUsername ?? null,
      });
      await prisma.ingestionJobQueue.update({
        where: { id: row.id },
        data: {
          status: "completed",
          finishedAt: new Date(),
          errorMessage: `Migrated to ${targetKind} via migrate-legacy-queue-rows`,
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

function chooseReplacementKind(
  legacyKind: string,
): "source_discovery" | "content_build" | null {
  if (legacyKind === "source_ingest") return "source_discovery";
  if (legacyKind === "content_validate" || legacyKind === "content_persist") {
    return "content_build";
  }
  return null;
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

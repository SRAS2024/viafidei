import { prisma } from "@/lib/db/client";
import { checkRequiredTables, checkSeedContent } from "@/lib/db/tables";
import { listAdapterSecondaryHosts } from "@/lib/ingestion";
import {
  finalizeSection,
  runDiagnostic,
  startSection,
  type DiagnosticResult,
  type DiagnosticSection,
} from "./types";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Data management diagnostics:
 *
 *   - Are all required tables present?
 *   - What are the live content counts? (one row per public table)
 *   - How many ingestion runs in the last 24h? Failed? Review-required?
 *   - How many data-management actions logged in the last 24h?
 *
 * Every value is a count or a label — no row contents are returned.
 */
export async function runDataManagementDiagnostics(): Promise<DiagnosticSection> {
  const shell = startSection("data_management", "Data management");

  const results: DiagnosticResult[] = [];

  results.push(
    await runDiagnostic("dm.tables", "Required tables present", shell.requestId, async () => {
      const check = await checkRequiredTables();
      if (!check.ok) {
        return {
          severity: "fail",
          summary: "One or more required tables are missing.",
          explanation:
            "Run `prisma migrate deploy` so every required table exists. " +
            "Missing tables crash any route that reads them.",
          evidence: {
            missing: check.missing.join(", ") || "(none)",
            columnsMissing: check.columnsMissing.length,
          },
        };
      }
      return {
        severity: "pass",
        summary: `${check.present.length} required tables present.`,
        evidence: { tablesPresent: check.present.length },
      };
    }),
  );

  results.push(
    await runDiagnostic("dm.content_counts", "Content counts", shell.requestId, async () => {
      const seed = await checkSeedContent();
      const total = Object.values(seed.counts ?? {}).reduce((a, b) => a + b, 0);
      if (!seed.ok) {
        return {
          severity: "warn",
          summary: `Catalog is below seed baseline (${total} rows total).`,
          explanation:
            "The seeder runs every boot but its target may not be met yet. " +
            "Check /admin/ingestion for backlog status.",
          evidence: { totalRows: total, ...seed.counts },
        };
      }
      return {
        severity: "pass",
        summary: `${total} catalog rows across all public tables.`,
        evidence: { totalRows: total, ...seed.counts },
      };
    }),
  );

  results.push(
    await runDiagnostic(
      "dm.recent_runs",
      "Ingestion runs (last 24h)",
      shell.requestId,
      async () => {
        const since = new Date(Date.now() - RECENT_WINDOW_MS);
        const [total, failed, reviewRequired] = await Promise.all([
          prisma.ingestionJobRun.count({ where: { startedAt: { gte: since } } }),
          prisma.ingestionJobRun.count({
            where: { startedAt: { gte: since }, status: "FAILED" },
          }),
          prisma.ingestionJobRun.count({
            where: { startedAt: { gte: since }, recordsReviewRequired: { gt: 0 } },
          }),
        ]);
        if (failed > 0) {
          return {
            severity: "warn",
            summary: `${failed} of ${total} ingestion runs failed in the last 24h.`,
            explanation:
              "Inspect /admin/logs/admin and /admin/ingestion for the failure detail. " +
              "Adapter errors and source rate-limits are the usual cause.",
            evidence: { total, failed, reviewRequired },
          };
        }
        return {
          severity: "pass",
          summary: `${total} ingestion runs in the last 24h (no failures).`,
          evidence: { total, failed, reviewRequired },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "dm.cleanup_actions",
      "Data-management actions logged (last 24h)",
      shell.requestId,
      async () => {
        const since = new Date(Date.now() - RECENT_WINDOW_MS);
        const total = await prisma.dataManagementLog.count({
          where: { createdAt: { gte: since } },
        });
        return {
          severity: "pass",
          summary: `${total} data-management actions in the last 24h.`,
          evidence: { total },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "dm.janitor_activity",
      "Catalog janitor activity (last 24h)",
      shell.requestId,
      async () => {
        const since = new Date(Date.now() - RECENT_WINDOW_MS);
        const grouped = await prisma.dataManagementLog.groupBy({
          by: ["action"],
          where: {
            createdAt: { gte: since },
            reason: { contains: "Janitor:" },
          },
          _count: { _all: true },
        });
        const counts = Object.fromEntries(
          grouped.map((row) => [row.action, row._count._all]),
        ) as Record<string, number>;
        const repackaged = counts.UPDATE ?? 0;
        const hardDeleted = counts.DELETE ?? 0;
        const divertedToReview = counts.CATEGORY_FIX ?? 0;
        return {
          severity: "pass",
          summary: `Janitor: ${repackaged} repackaged · ${hardDeleted} hard-deleted · ${divertedToReview} diverted to REVIEW.`,
          explanation:
            "The catalog janitor runs on every cron tick. It applies the format → clean → " +
            "validate pipeline to every PUBLISHED row, repackages titles / bodies that " +
            "needed cleanup, hard-deletes anything classified as noise (landing pages, " +
            "navigation cruft, meta-descriptions), and diverts soft fails to REVIEW.",
          evidence: { repackaged, hardDeleted, divertedToReview },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "dm.adapter_coverage",
      "Adapter source coverage",
      shell.requestId,
      async () => {
        const secondary = listAdapterSecondaryHosts();
        const adapters = Object.keys(secondary).length;
        const hosts = new Set<string>();
        for (const list of Object.values(secondary)) for (const h of list) hosts.add(h);
        return {
          severity: "pass",
          summary: `${adapters} adapters draw from a documented ${hosts.size} secondary hosts beyond their primary upstream.`,
          explanation:
            "Each adapter walks the primary host registered in IngestionJob plus a curated " +
            "list of secondary hosts. The dashboard 'jobs' column shows only the primary; " +
            "the full set is `ADAPTER_SECONDARY_HOSTS` in src/lib/ingestion/sources/bootstrap.ts.",
          evidence: { adapters, secondaryHosts: hosts.size },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "dm.ingestion_pipeline",
      "Ingestion pipeline activity (last 24h)",
      shell.requestId,
      async () => {
        const since = new Date(Date.now() - RECENT_WINDOW_MS);
        const grouped = await prisma.dataManagementLog.groupBy({
          by: ["action"],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        });
        const counts = Object.fromEntries(
          grouped.map((row) => [row.action, row._count._all]),
        ) as Record<string, number>;
        return {
          severity: "pass",
          summary: `Pipeline: ${counts.ADD ?? 0} added · ${counts.UPDATE ?? 0} updated · ${counts.DELETE ?? 0} deleted · ${counts.CATEGORY_FIX ?? 0} re-classified · ${counts.REJECT ?? 0} rejected.`,
          explanation:
            "Aggregate of every DataManagementLog action over the last 24 hours. ADD + " +
            "UPDATE come from ingestion runs and the janitor's repackaging pass; DELETE is " +
            "the noise hard-delete; CATEGORY_FIX is the classifier re-routing kinds and " +
            "soft-fail review divertions; REJECT is structurally-invalid rows that never " +
            "reach the catalog.",
          evidence: counts,
        };
      },
    ),
  );

  return finalizeSection(shell, results);
}

/**
 * Per-content-type 24h edit counts. Used to render the "X edits in the
 * last 24h" line under each counter on the data-management admin page.
 * Returns a flat map keyed on the lower-case contentType the
 * DataManagementLog rows use.
 */
export async function recent24hEditCounts(): Promise<Record<string, number>> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const grouped = await prisma.dataManagementLog.groupBy({
    by: ["contentType"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of grouped) {
    out[String(row.contentType).toLowerCase()] = row._count._all;
  }
  return out;
}

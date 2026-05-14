import { type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/security/cron-auth";
import { pruneExpiredRateLimits } from "@/lib/security/rate-limit";
import { pruneExpiredTokens } from "@/lib/auth";
import { runAllActiveJobs } from "@/lib/ingestion/scheduler";
import { ensureVaticanSchedule } from "@/lib/ingestion/sources";
import { markOverdueGoals } from "@/lib/data/goals";
import {
  archiveDuplicatePrayers,
  cleanupMiscategorisedContent,
  pruneOldAuditLogs,
  pruneOldIngestionRuns,
  purgeStaleArchivedContent,
} from "@/lib/data/cleanup";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import { jsonError, jsonOk } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Long-lived cron invocation; allow up to 60s for slow upstreams. Pinning
// to the Node runtime is required because the runner imports node:crypto
// transitively through the Postgres advisory-lock helper — the default
// edge runtime would refuse the build.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  if (!(await isAuthorizedCron(req))) {
    logger.warn("cron.unauthorized", { route: "/api/cron/ingest", requestId });
    return jsonError("unauthorized");
  }
  const started = Date.now();
  await ensureVaticanSchedule();
  const summary = await runAllActiveJobs();

  // Admin can disable the automatic Data Management sweep via the
  // site_settings row. When disabled, the ingestion runner still runs
  // (per-row validation, skip-existing semantics) but the catalog-wide
  // archive / hard-delete passes are skipped so the admin keeps full
  // manual control.
  const dataManagement = await getDataManagementSettings();

  const housekeeping = await Promise.all([
    pruneExpiredRateLimits(),
    pruneExpiredTokens(),
    markOverdueGoals(),
    pruneOldIngestionRuns(),
    pruneOldAuditLogs(),
  ]);
  const [prunedRateLimits, prunedTokens, overdueGoals, prunedRuns, prunedAudits] = housekeeping;

  let miscategorised: Awaited<ReturnType<typeof cleanupMiscategorisedContent>> = {
    buckets: [],
    totalArchived: 0,
  };
  let duplicatePrayers = 0;
  let purged: Awaited<ReturnType<typeof purgeStaleArchivedContent>> = {
    buckets: [],
    totalDeleted: 0,
  };

  if (dataManagement.autoCleanupEnabled) {
    // Sweep through every published content row and archive anything
    // that looks like a TV listing, source byline, newsletter blurb,
    // or one-line stub. Then permanently delete anything that has been
    // archived for long enough (default 30 days) so the catalog stays
    // lean and the pipeline self-corrects.
    [miscategorised, duplicatePrayers, purged] = await Promise.all([
      cleanupMiscategorisedContent(),
      archiveDuplicatePrayers(),
      purgeStaleArchivedContent(dataManagement.hardDeleteAfterDays),
    ]);
  }

  logger.info("cron.completed", {
    route: "/api/cron/ingest",
    requestId,
    durationMs: Date.now() - started,
    summary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    autoCleanupEnabled: dataManagement.autoCleanupEnabled,
    miscategorisedArchived: miscategorised.totalArchived,
    duplicatePrayersArchived: duplicatePrayers,
    hardDeleted: purged.totalDeleted,
  });
  return jsonOk({
    summary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    dataManagement: {
      autoCleanupEnabled: dataManagement.autoCleanupEnabled,
      miscategorised,
      duplicatePrayers,
      hardDeleted: purged,
    },
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

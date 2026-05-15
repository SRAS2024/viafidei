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
import { dispatchAdminNotifications } from "@/lib/data/admin-notifications";
import { pruneOldErrorLogs } from "@/lib/data/error-log";
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
    pruneOldErrorLogs(),
  ]);
  const [prunedRateLimits, prunedTokens, overdueGoals, prunedRuns, prunedAudits, prunedErrors] =
    housekeeping;

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

  // Admin notification dispatch — runs after ingestion + cleanup so the
  // biweekly + monthly digests reflect this tick's activity. Each
  // sub-flow guards its own "is it time?" check, so an off-cadence call
  // is just a few cheap reads. The dispatcher additionally fires per-
  // bucket milestone alerts (25 / 50 / 75 / 100 percent) so an admin
  // sees the catalog filling up in real time as targets are crossed.
  const adminNotifications = await dispatchAdminNotifications().catch((e) => {
    logger.error("cron.admin_notifications_failed", {
      route: "/api/cron/ingest",
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  });

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
    prunedErrors,
    autoCleanupEnabled: dataManagement.autoCleanupEnabled,
    miscategorisedArchived: miscategorised.totalArchived,
    duplicatePrayersArchived: duplicatePrayers,
    hardDeleted: purged.totalDeleted,
    adminNotifications: adminNotifications
      ? {
          biweeklySent:
            adminNotifications.biweekly?.ok && adminNotifications.biweekly.delivery === "sent",
          monthlyArchiveSent:
            adminNotifications.monthlyArchive?.ok &&
            adminNotifications.monthlyArchive.delivery === "sent",
          monthlyErrorReportSent:
            adminNotifications.monthlyErrorReport?.ok &&
            adminNotifications.monthlyErrorReport.delivery === "sent",
          milestonesSent: adminNotifications.milestonesSent.length,
        }
      : null,
  });
  return jsonOk({
    summary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    prunedErrors,
    dataManagement: {
      autoCleanupEnabled: dataManagement.autoCleanupEnabled,
      miscategorised,
      duplicatePrayers,
      hardDeleted: purged,
    },
    adminNotifications,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

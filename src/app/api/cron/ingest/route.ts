import { type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/security/cron-auth";
import { pruneExpiredRateLimits } from "@/lib/security/rate-limit";
import { pruneExpiredTokens } from "@/lib/auth";
import { getBacklogProgress } from "@/lib/ingestion/scheduler";
import { ensureVaticanSchedule } from "@/lib/ingestion/sources";
import { markOverdueGoals } from "@/lib/data/goals";
import {
  cleanupMiscategorisedContent,
  pruneOldAuditLogs,
  pruneOldIngestionRuns,
} from "@/lib/data/cleanup";
import { purgeArchivedByArchivedAt } from "@/lib/data/archive-cleanup";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import {
  dispatchAdminNotifications,
  sendThresholdCheckFailedWarning,
} from "@/lib/data/admin-notifications";
import { pruneOldErrorLogs } from "@/lib/data/error-log";
import {
  recoverStaleJobs,
  enqueueDueIngestionJobs,
  pruneQueueHistory,
} from "@/lib/ingestion/queue";
import { hasHealthyWorker } from "@/lib/ingestion/queue/heartbeat";
import { runAllIngestionAlerts, checkStallSignals } from "@/lib/data/ingestion-alerts";
import { autoEvaluateSourcePauses } from "@/lib/data/source-auto-pause";
import { detectStallSignals, getQueueHealthSummary } from "@/lib/data/queue-health";
import { appConfig } from "@/lib/config";
import { reportCriticalFailure } from "@/lib/data/admin-notifications";
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

  // Recover any leases that expired since the previous tick. This is
  // belt-and-suspenders for the worker's own stale-recovery loop —
  // running it here guarantees a single-server deploy (no separate
  // worker) still gets stale-job recovery on every cron pulse.
  const staleRecovered = await recoverStaleJobs().catch(() => 0);

  // Threshold check FIRST so we can fire a warning if the DB cannot
  // count totals. Constant mode is the safe default — see
  // BacklogProgressResult docs.
  const backlogProgress = await getBacklogProgress().catch(() => null);
  if (backlogProgress?.dbError && backlogProgress.errorMessage) {
    await sendThresholdCheckFailedWarning(backlogProgress.errorMessage).catch((e) => {
      logger.warn("cron.threshold_check_warning_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    });
  }

  // Plan-only cron: the worker process is the sole adapter executor.
  // We call the planner to enqueue due jobs into IngestionJobQueue,
  // then a separate worker service dequeues them.
  const plannerSummary = await enqueueDueIngestionJobs().catch((e) => {
    logger.error("cron.planner_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  });
  // Healthy-worker check: if the planner enqueued work but there is
  // no live worker heartbeat, fire a critical admin alert so the
  // operator knows nothing is consuming the queue.
  if (plannerSummary && plannerSummary.jobsEnqueued > 0) {
    const healthy = await hasHealthyWorker().catch(() => false);
    if (!healthy) {
      await reportCriticalFailure({
        kind: "no_worker_alive",
        message: `Planner enqueued ${plannerSummary.jobsEnqueued} jobs but no worker heartbeat detected.`,
      }).catch(() => undefined);
    }
  }

  // Scheduled strict-cleanup keepalive. The auto-cleanup module dedupes
  // by 5-minute bucket so calling this every tick produces at most one
  // queued cleanup per bucket. Keeps the catalog continuously fresh
  // even when there is no ingestion happening.
  try {
    const { autoEnqueueScheduledCleanup } = await import("@/lib/ingestion/queue/auto-cleanup");
    await autoEnqueueScheduledCleanup();
  } catch (e) {
    logger.warn("cron.scheduled_cleanup_enqueue_failed", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

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

  // Cleanup execution lives in the worker now. The cron route only
  // enqueues the work — strict_cleanup / archive_cleanup /
  // dedupe_cleanup all run inside the worker process. We surface zero
  // counts here so the existing log payload shape is preserved.
  const miscategorised: Awaited<ReturnType<typeof cleanupMiscategorisedContent>> = {
    buckets: [],
    totalArchived: 0,
  };
  const duplicatePrayers = 0;
  const purged: Awaited<ReturnType<typeof purgeArchivedByArchivedAt>> = {
    buckets: [],
    totalDeleted: 0,
  };

  if (dataManagement.autoCleanupEnabled) {
    // Enqueue cleanup jobs into the durable queue. The worker
    // executes them on the same Postgres advisory lock the cron used
    // to hold, so behaviour is identical from the admin's
    // perspective — but the cron route returns immediately, letting
    // the worker scale independently.
    try {
      const { enqueueJob } = await import("@/lib/ingestion/queue");
      const retentionDays =
        dataManagement.hardDeleteAfterDays ?? appConfig.ingestion.archiveRetentionDays;
      await Promise.all([
        enqueueJob({
          jobName: "strict_cleanup_scheduled",
          jobKind: "strict_cleanup",
          dedupeKey: `strict_cleanup_${new Date().toISOString().slice(0, 13)}`,
          payload: { sweepReason: "scheduled" },
          triggeredBy: "automatic",
        }),
        enqueueJob({
          jobName: "dedupe_cleanup_scheduled",
          jobKind: "dedupe_cleanup",
          dedupeKey: `dedupe_cleanup_${new Date().toISOString().slice(0, 13)}`,
          payload: {},
          triggeredBy: "automatic",
        }),
        enqueueJob({
          jobName: "archive_cleanup_scheduled",
          jobKind: "archive_cleanup",
          dedupeKey: `archive_cleanup_${new Date().toISOString().slice(0, 13)}`,
          payload: { retentionDays },
          triggeredBy: "automatic",
        }),
      ]).catch((e) => {
        logger.warn("cron.cleanup_enqueue_failed", {
          requestId,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    } catch (e) {
      logger.warn("cron.cleanup_enqueue_setup_failed", {
        requestId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Catalog janitor runs as a queued content_revalidate job, not
  // inline. See dispatch.ts for the implementation.
  const janitor = {
    buckets: [],
    totalRepackaged: 0,
    totalHardDeleted: 0,
    totalDivertedToReview: 0,
  };

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

  // Stalled-growth, repeated-failure, low-quality, and review-queue
  // alerts. Each check carries its own cooldown so an off-cadence
  // call is harmless.
  const bucketCounts =
    backlogProgress && backlogProgress.counts
      ? [
          {
            key: "prayers",
            label: "Prayers",
            currentCount: backlogProgress.counts.prayers,
            target: backlogProgress.targets.prayers,
          },
          {
            key: "saints",
            label: "Saints",
            currentCount: backlogProgress.counts.saints,
            target: backlogProgress.targets.saints,
          },
          {
            key: "parishes",
            label: "Parishes",
            currentCount: backlogProgress.counts.parishes,
            target: backlogProgress.targets.parishes,
          },
          {
            key: "churchDocuments",
            label: "Church Documents",
            currentCount: backlogProgress.counts.churchDocuments,
            target: backlogProgress.targets.churchDocuments,
          },
          {
            key: "sacraments",
            label: "Sacraments",
            currentCount: backlogProgress.counts.sacraments,
            target: backlogProgress.targets.sacraments,
          },
          {
            key: "consecrations",
            label: "Consecrations",
            currentCount: backlogProgress.counts.consecrations,
            target: backlogProgress.targets.consecrations,
          },
        ]
      : [];
  const alerts = await runAllIngestionAlerts(bucketCounts).catch((e) => {
    logger.warn("cron.alerts_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { stalledGrowth: 0, sourceFailures: 0, lowQualitySources: 0, reviewQueueLarge: false };
  });

  // Strict QA alerts: invalid-public-row count, stale cleanup,
  // rejection-rate spike, system health score collapse. Each has a
  // 24h cooldown so a persistent failure produces a daily reminder.
  try {
    const { runStrictQAAlerts } = await import("@/lib/data/strict-qa-alerts");
    await runStrictQAAlerts();
  } catch (e) {
    logger.warn("cron.strict_qa_alerts_failed", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Auto-pause sources that have crossed failure/low-quality
  // thresholds. Each paused source triggers one admin email.
  const autoPause = await autoEvaluateSourcePauses().catch((e) => {
    logger.warn("cron.auto_pause_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { paused: [] as string[] };
  });

  // Auto-resume: probe auto-paused sources for recovery. Temporary
  // failures (timeouts, rate limits, 5xx blips) get re-enabled once
  // a successful sync is observed; structurally-bad sources stay
  // paused.
  try {
    const { autoResumeRecoveredSources, notifyStructurallyBadSources } =
      await import("@/lib/data/source-auto-pause");
    await autoResumeRecoveredSources();
    await notifyStructurallyBadSources();
  } catch (e) {
    logger.warn("cron.auto_resume_failed", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Stall-class alerts. Each class fires its own distinct admin
  // email with a 24h cooldown so the operator knows which corner
  // of the pipeline is stuck.
  const queueHealth = await getQueueHealthSummary().catch(() => null);
  const contentTypesBelowTarget = bucketCounts
    .filter((b) => b.currentCount < b.target)
    .map((b) => b.key);
  const stallSignals = await detectStallSignals({
    contentTypesBelowTarget,
    pendingCount: queueHealth?.counts.pending ?? 0,
    workerHealthy: queueHealth?.hasHealthyWorker ?? false,
    completionsLastHourCount: queueHealth?.counts.completed ?? 0,
    contentGrowthLastHour: 0,
  });
  const stalls = await checkStallSignals(stallSignals).catch((e) => {
    logger.warn("cron.stall_alerts_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { sent: [] as string[] };
  });

  // Queue history retention pruner — cheap deleteMany call.
  const prunedQueueHistory = await pruneQueueHistory().catch(() => ({
    completed: 0,
    skipped: 0,
    failed: 0,
  }));

  logger.info("cron.completed", {
    route: "/api/cron/ingest",
    requestId,
    durationMs: Date.now() - started,
    plannerSummary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    prunedErrors,
    prunedQueueHistory,
    staleRecovered,
    mode: backlogProgress?.mode ?? "constant",
    backlogDbError: backlogProgress?.dbError ?? false,
    autoCleanupEnabled: dataManagement.autoCleanupEnabled,
    miscategorisedArchived: miscategorised.totalArchived,
    duplicatePrayersArchived: duplicatePrayers,
    hardDeleted: purged.totalDeleted,
    janitor: {
      repackaged: janitor.totalRepackaged,
      hardDeleted: janitor.totalHardDeleted,
      divertedToReview: janitor.totalDivertedToReview,
    },
    alerts,
    autoPausedSources: autoPause.paused.length,
    stallAlertsSent: stalls.sent,
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
          milestonesRecordedWithoutSend: adminNotifications.milestonesRecordedWithoutSend.length,
        }
      : null,
  });
  return jsonOk({
    plannerSummary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    prunedErrors,
    prunedQueueHistory,
    staleRecovered,
    mode: backlogProgress?.mode ?? "constant",
    backlogDbError: backlogProgress?.dbError ?? false,
    dataManagement: {
      autoCleanupEnabled: dataManagement.autoCleanupEnabled,
      miscategorised,
      duplicatePrayers,
      hardDeleted: purged,
    },
    janitor,
    alerts,
    adminNotifications,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

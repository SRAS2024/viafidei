import { prisma } from "@/lib/db/client";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import {
  getRecentActivityByAction,
  getRecentActivityByContentType,
} from "@/lib/data/data-management-log";
import {
  finalizeSection,
  runDiagnostic,
  startSection,
  type DiagnosticResult,
  type DiagnosticSection,
} from "./types";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * High-level "is ingestion healthy?" status string used by the admin
 * dashboard. Derived from the latest IngestionJobRun, the data-management
 * settings, and the backlog progress. Kept as a separate function (vs.
 * just running the diagnostic) so the dashboard can render the same
 * label without paying the cost of every diagnostic.
 */
export type IngestionLiveStatus =
  | "running"
  | "active"
  | "maintenance"
  | "disabled"
  | "blocked"
  | "stale"
  | "failing"
  | "idle";

export type IngestionLiveSnapshot = {
  status: IngestionLiveStatus;
  detail: string;
  lastRun: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    jobName: string;
    sourceName: string;
    errorMessage: string | null;
    recordsSeen: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
    recordsFailed: number;
  } | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalRuns24h: number;
  failedRuns24h: number;
  autoCleanupEnabled: boolean;
  hardDeleteAfterDays: number;
};

/**
 * Compute the current ingestion live snapshot. Reads:
 *
 *   • the most recent IngestionJobRun (any status),
 *   • the most recent SUCCESS run (for "last successful run"),
 *   • the most recent FAILED / PARTIAL run (for "last failed run"),
 *   • the 24-hour total / failed counts,
 *   • and the data-management toggle.
 *
 * No writes; safe to call on every page render. The dashboard polls
 * it via `/api/admin/diagnostics/ingestion`.
 */
export async function loadIngestionLiveSnapshot(): Promise<IngestionLiveSnapshot> {
  const settings = await getDataManagementSettings();
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  const [latest, lastSuccess, lastFailure, totalRuns24h, failedRuns24h] = await Promise.all([
    prisma.ingestionJobRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { job: { include: { source: true } } },
    }),
    prisma.ingestionJobRun.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
    }),
    prisma.ingestionJobRun.findFirst({
      where: { status: { in: ["FAILED", "PARTIAL"] } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.ingestionJobRun.count({ where: { startedAt: { gte: since } } }),
    prisma.ingestionJobRun.count({
      where: { startedAt: { gte: since }, status: { in: ["FAILED", "PARTIAL"] } },
    }),
  ]);

  let status: IngestionLiveStatus = "idle";
  let detail =
    "No ingestion runs recorded yet — the scheduler creates them on the first cron tick.";

  if (!settings.autoCleanupEnabled) {
    status = "disabled";
    detail =
      "Automatic Data Management is disabled. Per-row ingestion validation still runs; catalog-wide cleanup is paused.";
  } else if (latest) {
    const ageMs = Date.now() - latest.startedAt.getTime();
    const ageHours = ageMs / (60 * 60 * 1000);
    if (latest.status === "RUNNING") {
      status = "running";
      detail = `${latest.job.source.name} → ${latest.job.jobName} running since ${latest.startedAt.toISOString().slice(0, 16)}.`;
    } else if (latest.status === "FAILED") {
      status = "failing";
      detail = `Last run failed: ${latest.errorMessage?.slice(0, 200) ?? "no error message recorded"}`;
    } else if (latest.status === "PARTIAL") {
      status = "failing";
      detail =
        "Last run finished PARTIAL — some items were rejected or sent to review. Check the Data Management logs.";
    } else if (latest.status === "SUCCESS") {
      if (ageHours > 48) {
        status = "stale";
        detail = `Last successful run was ${Math.round(ageHours)}h ago. Check the cron schedule.`;
      } else if (failedRuns24h > 0) {
        status = "active";
        detail = `${failedRuns24h} of ${totalRuns24h} runs in the last 24h failed; the most recent run succeeded.`;
      } else if (totalRuns24h === 0) {
        // Auto cleanup is on, but no run in 24h — this can happen on a
        // brand-new deploy or when maintenance mode is throttling runs.
        status = "maintenance";
        detail = `No ingestion runs in the last 24h. Last success at ${latest.startedAt.toISOString().slice(0, 16)}.`;
      } else {
        status = "active";
        detail = `${totalRuns24h} successful runs in the last 24h.`;
      }
    }
  } else {
    // autoCleanupEnabled but no runs recorded — the scheduler may be
    // blocked, e.g. cron-token misconfigured. Surface that explicitly.
    status = "blocked";
    detail =
      "Automatic Data Management is enabled, but no IngestionJobRun rows have been written yet. The cron token may be misconfigured or the scheduler may be disabled.";
  }

  const finishedAt = latest?.finishedAt ?? null;
  const durationMs =
    latest && finishedAt ? finishedAt.getTime() - latest.startedAt.getTime() : null;

  return {
    status,
    detail,
    lastRun: latest
      ? {
          status: latest.status,
          startedAt: latest.startedAt.toISOString(),
          finishedAt: finishedAt ? finishedAt.toISOString() : null,
          durationMs,
          jobName: latest.job.jobName,
          sourceName: latest.job.source.name,
          errorMessage: latest.errorMessage,
          recordsSeen: latest.recordsSeen,
          recordsCreated: latest.recordsCreated,
          recordsUpdated: latest.recordsUpdated,
          recordsSkipped: latest.recordsSkipped,
          recordsFailed: latest.recordsFailed,
        }
      : null,
    lastSuccessAt: lastSuccess ? lastSuccess.startedAt.toISOString() : null,
    lastFailureAt: lastFailure ? lastFailure.startedAt.toISOString() : null,
    totalRuns24h,
    failedRuns24h,
    autoCleanupEnabled: settings.autoCleanupEnabled,
    hardDeleteAfterDays: settings.hardDeleteAfterDays,
  };
}

/**
 * Ingestion & Data Management diagnostics — reports every signal an
 * admin needs to decide whether the pipeline is healthy. Designed to
 * always return a populated section even when the database is empty
 * (e.g. brand-new deploy), so the admin diagnostics page never shows
 * an unexplained "no checks ran".
 */
export async function runIngestionDiagnostics(): Promise<DiagnosticSection> {
  const shell = startSection("ingestion", "Ingestion & Data Management");
  const results: DiagnosticResult[] = [];

  results.push(
    await runDiagnostic(
      "ingestion.live_status",
      "Live ingestion status",
      shell.requestId,
      async () => {
        const snap = await loadIngestionLiveSnapshot();
        const severity =
          snap.status === "failing" || snap.status === "blocked"
            ? "fail"
            : snap.status === "stale" || snap.status === "disabled"
              ? "warn"
              : snap.status === "running" ||
                  snap.status === "active" ||
                  snap.status === "maintenance"
                ? "pass"
                : "warn";
        return {
          severity,
          summary: `${snap.status.toUpperCase()} — ${snap.detail}`,
          evidence: {
            status: snap.status,
            totalRuns24h: snap.totalRuns24h,
            failedRuns24h: snap.failedRuns24h,
            autoCleanupEnabled: snap.autoCleanupEnabled,
            hardDeleteAfterDays: snap.hardDeleteAfterDays,
            lastRunStatus: snap.lastRun?.status ?? null,
            lastRunStartedAt: snap.lastRun?.startedAt ?? null,
            lastSuccessAt: snap.lastSuccessAt,
            lastFailureAt: snap.lastFailureAt,
          },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic("ingestion.last_run", "Last ingestion run", shell.requestId, async () => {
      const lastRun = await prisma.ingestionJobRun.findFirst({
        orderBy: { startedAt: "desc" },
        include: { job: { include: { source: true } } },
      });
      if (!lastRun) {
        return {
          severity: "warn",
          summary: "No IngestionJobRun rows yet.",
          explanation:
            "The scheduler creates them on the first cron tick — confirm /api/cron/ingest is wired up on the host and the cron token is set.",
        };
      }
      const finished = lastRun.finishedAt;
      const durationMs = finished ? finished.getTime() - lastRun.startedAt.getTime() : null;
      const severity =
        lastRun.status === "SUCCESS"
          ? "pass"
          : lastRun.status === "FAILED"
            ? "fail"
            : lastRun.status === "PARTIAL"
              ? "warn"
              : "pass";
      return {
        severity,
        summary: `${lastRun.job.source.name} → ${lastRun.job.jobName} · ${lastRun.status} · seen ${lastRun.recordsSeen} / created ${lastRun.recordsCreated} / updated ${lastRun.recordsUpdated} / skipped ${lastRun.recordsSkipped} / failed ${lastRun.recordsFailed}`,
        explanation: lastRun.errorMessage
          ? `Error message: ${lastRun.errorMessage.slice(0, 240)}`
          : undefined,
        evidence: {
          sourceName: lastRun.job.source.name,
          jobName: lastRun.job.jobName,
          status: lastRun.status,
          startedAt: lastRun.startedAt.toISOString(),
          finishedAt: finished ? finished.toISOString() : null,
          durationMs,
          recordsSeen: lastRun.recordsSeen,
          recordsCreated: lastRun.recordsCreated,
          recordsUpdated: lastRun.recordsUpdated,
          recordsSkipped: lastRun.recordsSkipped,
          recordsFailed: lastRun.recordsFailed,
          recordsReviewRequired: lastRun.recordsReviewRequired,
        },
      };
    }),
  );

  results.push(
    await runDiagnostic(
      "ingestion.last_success",
      "Last successful run",
      shell.requestId,
      async () => {
        const lastSuccess = await prisma.ingestionJobRun.findFirst({
          where: { status: "SUCCESS" },
          orderBy: { startedAt: "desc" },
          include: { job: { include: { source: true } } },
        });
        if (!lastSuccess) {
          return {
            severity: "warn",
            summary: "No SUCCESS runs recorded yet.",
            explanation:
              "Either ingestion has never completed cleanly or the table has just been pruned. Watch /admin/logs/ingestion for the next run.",
          };
        }
        const ageHours = Math.round(
          (Date.now() - lastSuccess.startedAt.getTime()) / (60 * 60 * 1000),
        );
        return {
          severity: ageHours > 48 ? "warn" : "pass",
          summary: `${lastSuccess.job.source.name} → ${lastSuccess.job.jobName} succeeded ${ageHours}h ago.`,
          evidence: {
            sourceName: lastSuccess.job.source.name,
            jobName: lastSuccess.job.jobName,
            startedAt: lastSuccess.startedAt.toISOString(),
            ageHours,
          },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic("ingestion.last_failure", "Last failed run", shell.requestId, async () => {
      const lastFailure = await prisma.ingestionJobRun.findFirst({
        where: { status: { in: ["FAILED", "PARTIAL"] } },
        orderBy: { startedAt: "desc" },
        include: { job: { include: { source: true } } },
      });
      if (!lastFailure) {
        return {
          severity: "pass",
          summary: "No FAILED or PARTIAL runs on record.",
        };
      }
      const ageHours = Math.round(
        (Date.now() - lastFailure.startedAt.getTime()) / (60 * 60 * 1000),
      );
      const severity = ageHours < 1 ? "fail" : ageHours < 24 ? "warn" : "pass";
      return {
        severity,
        summary: `${lastFailure.job.source.name} → ${lastFailure.job.jobName} failed ${ageHours}h ago.`,
        explanation: lastFailure.errorMessage
          ? `Error: ${lastFailure.errorMessage.slice(0, 240)}`
          : undefined,
        evidence: {
          sourceName: lastFailure.job.source.name,
          jobName: lastFailure.job.jobName,
          status: lastFailure.status,
          startedAt: lastFailure.startedAt.toISOString(),
          ageHours,
          errorMessage: lastFailure.errorMessage,
        },
      };
    }),
  );

  results.push(
    await runDiagnostic(
      "ingestion.runs_24h",
      "Ingestion runs in the last 24h",
      shell.requestId,
      async () => {
        const since = new Date(Date.now() - RECENT_WINDOW_MS);
        const [total, failed, partial] = await Promise.all([
          prisma.ingestionJobRun.count({ where: { startedAt: { gte: since } } }),
          prisma.ingestionJobRun.count({
            where: { startedAt: { gte: since }, status: "FAILED" },
          }),
          prisma.ingestionJobRun.count({
            where: { startedAt: { gte: since }, status: "PARTIAL" },
          }),
        ]);
        if (failed > 0) {
          return {
            severity: "warn",
            summary: `${failed} of ${total} ingestion runs failed in the last 24h${partial > 0 ? ` (and ${partial} partial)` : ""}.`,
            evidence: { total, failed, partial },
          };
        }
        return {
          severity: "pass",
          summary: `${total} ingestion runs in the last 24h (no failures).`,
          evidence: { total, failed, partial },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "ingestion.data_management_actions_24h",
      "Data Management actions (last 24h)",
      shell.requestId,
      async () => {
        const [byAction, byContentType] = await Promise.all([
          getRecentActivityByAction(24).catch(() => ({}) as Record<string, number>),
          getRecentActivityByContentType(24).catch(() => ({}) as Record<string, number>),
        ]);
        const total = Object.values(byAction).reduce((a, b) => a + b, 0);
        const settings = await getDataManagementSettings();
        if (total === 0) {
          return {
            severity: settings.autoCleanupEnabled ? "pass" : "warn",
            summary: `0 data-management actions in the last 24h.`,
            explanation: settings.autoCleanupEnabled
              ? "Auto-cleanup is enabled and the pipeline is idle — every ingestion run dedup-skipped or the cron has not ticked yet."
              : "Auto-cleanup is disabled. The cron job is still running per-row validation but the catalog-wide cleanup sweep is paused.",
            evidence: { totalActions: 0, autoCleanupEnabled: settings.autoCleanupEnabled },
          };
        }
        return {
          severity: "pass",
          summary: `${total} data-management actions in the last 24h.`,
          evidence: {
            totalActions: total,
            actions: Object.entries(byAction)
              .map(([a, n]) => `${a}=${n}`)
              .join(", "),
            contentTypes: Object.entries(byContentType)
              .map(([a, n]) => `${a}=${n}`)
              .join(", "),
            autoCleanupEnabled: settings.autoCleanupEnabled,
          },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "ingestion.published_content",
      "Published content counts",
      shell.requestId,
      async () => {
        const [prayers, saints, apparitions, parishes, devotions, liturgy, guides] =
          await Promise.all([
            prisma.prayer.count({ where: { status: "PUBLISHED" } }),
            prisma.saint.count({ where: { status: "PUBLISHED" } }),
            prisma.marianApparition.count({ where: { status: "PUBLISHED" } }),
            prisma.parish.count({ where: { status: "PUBLISHED" } }),
            prisma.devotion.count({ where: { status: "PUBLISHED" } }),
            prisma.liturgyEntry.count({ where: { status: "PUBLISHED" } }),
            prisma.spiritualLifeGuide.count({ where: { status: "PUBLISHED" } }),
          ]);
        const total = prayers + saints + apparitions + parishes + devotions + liturgy + guides;
        return {
          severity: total === 0 ? "fail" : "pass",
          summary:
            total === 0
              ? "No PUBLISHED rows across the catalog — the seeder may not have run."
              : `${total} published rows across the catalog.`,
          evidence: {
            prayers,
            saints,
            apparitions,
            parishes,
            devotions,
            liturgy,
            guides,
            total,
          },
        };
      },
    ),
  );

  results.push(
    await runDiagnostic(
      "ingestion.review_queue",
      "Review queue size",
      shell.requestId,
      async () => {
        const [prayers, saints, apparitions, devotions, liturgy, guides] = await Promise.all([
          prisma.prayer.count({ where: { status: "REVIEW" } }),
          prisma.saint.count({ where: { status: "REVIEW" } }),
          prisma.marianApparition.count({ where: { status: "REVIEW" } }),
          prisma.devotion.count({ where: { status: "REVIEW" } }),
          prisma.liturgyEntry.count({ where: { status: "REVIEW" } }),
          prisma.spiritualLifeGuide.count({ where: { status: "REVIEW" } }),
        ]);
        const total = prayers + saints + apparitions + devotions + liturgy + guides;
        return {
          severity: total > 200 ? "warn" : "pass",
          summary:
            total === 0
              ? "Review queue is empty."
              : `${total} items awaiting moderation across the catalog.`,
          evidence: { prayers, saints, apparitions, devotions, liturgy, guides, total },
        };
      },
    ),
  );

  return finalizeSection(shell, results);
}

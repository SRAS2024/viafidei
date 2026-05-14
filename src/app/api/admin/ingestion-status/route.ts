import { requireAdmin } from "@/lib/auth";
import { getBacklogProgress } from "@/lib/ingestion/scheduler";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import { getRecentActivityByContentType } from "@/lib/data/data-management-log";
import { prisma } from "@/lib/db/client";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Live status feed for the Ingestion & Data Management admin page.
 *
 * Returns up-to-date content counts, 24-hour edit counts grouped by
 * content type, the current Data Management settings (so the admin
 * sees whether auto-cleanup is on or off without refreshing the page),
 * and the latest ingestion run's status so the admin can see at a
 * glance whether the system is active, paused, disabled, running, or
 * failed.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const [progress, settings, activity24h, latestRun] = await Promise.all([
    getBacklogProgress().catch(() => null),
    getDataManagementSettings(),
    getRecentActivityByContentType(24).catch(() => ({} as Record<string, number>)),
    prisma.ingestionJobRun
      .findFirst({
        orderBy: { startedAt: "desc" },
        include: { job: { include: { source: true } } },
      })
      .catch(() => null),
  ]);

  // High-level status string the admin can scan in one glance.
  let status: "active" | "paused" | "disabled" | "running" | "failed" | "idle" = "idle";
  let statusDetail = "No recent activity.";
  if (!settings.autoCleanupEnabled) {
    status = "paused";
    statusDetail =
      "Automatic Data Management is paused. Per-row ingestion validation still runs; catalog-wide cleanup is on manual control.";
  } else if (latestRun) {
    if (latestRun.status === "RUNNING") {
      status = "running";
      statusDetail = `${latestRun.job.source.name} → ${latestRun.job.jobName} running since ${latestRun.startedAt.toISOString().slice(0, 16)}.`;
    } else if (latestRun.status === "FAILED") {
      status = "failed";
      statusDetail = `Last run failed: ${latestRun.errorMessage?.slice(0, 200) ?? "no error message recorded"}`;
    } else if (latestRun.status === "PARTIAL") {
      status = "active";
      statusDetail = "Last run partially completed — some items were rejected or sent to review.";
    } else {
      status = "active";
      statusDetail = `Last run ${latestRun.status.toLowerCase()} at ${latestRun.startedAt.toISOString().slice(0, 16)}.`;
    }
  }

  return jsonOk({
    progress,
    settings,
    activity24h,
    status,
    statusDetail,
    latestRun: latestRun
      ? {
          status: latestRun.status,
          startedAt: latestRun.startedAt.toISOString(),
          finishedAt: latestRun.finishedAt?.toISOString() ?? null,
          recordsSeen: latestRun.recordsSeen,
          recordsCreated: latestRun.recordsCreated,
          recordsUpdated: latestRun.recordsUpdated,
          recordsSkipped: latestRun.recordsSkipped,
          recordsFailed: latestRun.recordsFailed,
          errorMessage: latestRun.errorMessage,
          jobName: latestRun.job.jobName,
          sourceName: latestRun.job.source.name,
        }
      : null,
  });
}

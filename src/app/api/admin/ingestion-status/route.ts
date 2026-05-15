import { requireAdmin } from "@/lib/auth";
import { getBacklogProgress } from "@/lib/ingestion/scheduler";
import { getRecentActivityByContentType } from "@/lib/data/data-management-log";
import { loadIngestionLiveSnapshot } from "@/lib/diagnostics";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Live status feed for the Ingestion & Data Management admin page.
 *
 * Returns the live ingestion snapshot, up-to-date content counts, and
 * 24-hour edit counts grouped by content type so the polling panel
 * can re-render without a page reload.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const [progress, activity24h, snapshot] = await Promise.all([
    getBacklogProgress().catch(() => null),
    getRecentActivityByContentType(24).catch(() => ({}) as Record<string, number>),
    loadIngestionLiveSnapshot(),
  ]);

  return jsonOk({
    progress,
    settings: {
      autoCleanupEnabled: snapshot.autoCleanupEnabled,
      hardDeleteAfterDays: snapshot.hardDeleteAfterDays,
    },
    activity24h,
    status: snapshot.status,
    statusDetail: snapshot.detail,
    latestRun: snapshot.lastRun
      ? {
          status: snapshot.lastRun.status,
          startedAt: snapshot.lastRun.startedAt,
          finishedAt: snapshot.lastRun.finishedAt,
          recordsSeen: snapshot.lastRun.recordsSeen,
          recordsCreated: snapshot.lastRun.recordsCreated,
          recordsUpdated: snapshot.lastRun.recordsUpdated,
          recordsSkipped: snapshot.lastRun.recordsSkipped,
          recordsFailed: snapshot.lastRun.recordsFailed,
          errorMessage: snapshot.lastRun.errorMessage,
          jobName: snapshot.lastRun.jobName,
          sourceName: snapshot.lastRun.sourceName,
        }
      : null,
  });
}

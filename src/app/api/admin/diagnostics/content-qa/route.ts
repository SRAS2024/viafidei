import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getCleanupHealth } from "@/lib/content-qa";
import { getStrictThresholdDashboard } from "@/lib/content-qa";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only content QA diagnostic endpoint. Returns:
 *
 *   - cleanup health summary (mode, deleteAllInvalid, last run, stale
 *     flag, invalid public row count by content type, deletes per
 *     bucket in the last 24h, per-query health booleans).
 *   - strict threshold dashboard rows (raw vs valid counts).
 *   - queue / worker / source counts for sanity.
 *   - oldest pending queue job age.
 *
 * Every metric is wrapped in a safe-or-default so a single failing
 * query never returns a fake "zero" — the dashboard inspects the
 * `queryHealth` map and renders a diagnostic error per failing card.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;

  const queryHealth: Record<string, { ok: boolean; errorMessage?: string }> = {};
  async function safe<T>(key: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      const v = await fn();
      queryHealth[key] = { ok: true };
      return v;
    } catch (err) {
      queryHealth[key] = {
        ok: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
      return fallback;
    }
  }

  const [
    cleanup,
    thresholds,
    queueCounts,
    workerCount,
    staleWorkerCount,
    oldestPending,
    rejectedLast24h,
    sourceActive,
    sourcePaused,
  ] = await Promise.all([
    safe("cleanupHealth", () => getCleanupHealth(), null),
    safe(
      "thresholds",
      () => getStrictThresholdDashboard(),
      [] as Awaited<ReturnType<typeof getStrictThresholdDashboard>>,
    ),
    safe(
      "queueCounts",
      () =>
        prisma.ingestionJobQueue.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
      [] as Array<{ status: string; _count?: { _all: number } }>,
    ),
    safe(
      "workerActive",
      () =>
        prisma.workerHeartbeat.count({
          where: {
            lastHeartbeatAt: { gte: new Date(Date.now() - 90 * 1000) },
          },
        }),
      0,
    ),
    safe(
      "workerStale",
      () =>
        prisma.workerHeartbeat.count({
          where: {
            lastHeartbeatAt: { lt: new Date(Date.now() - 90 * 1000) },
          },
        }),
      0,
    ),
    safe(
      "oldestPending",
      () =>
        prisma.ingestionJobQueue.findFirst({
          where: { status: "pending" },
          orderBy: { runAt: "asc" },
        }),
      null,
    ),
    safe(
      "rejectedLast24h",
      () =>
        prisma.rejectedContentLog.count({
          where: { deletedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      0,
    ),
    safe("sourceActive", () => prisma.ingestionSource.count({ where: { isActive: true } }), 0),
    safe(
      "sourcePaused",
      () => prisma.ingestionSource.count({ where: { pausedAt: { not: null } } }),
      0,
    ),
  ]);

  const queueByStatus: Record<string, number> = {};
  for (const row of queueCounts) queueByStatus[row.status] = row._count?._all ?? 0;
  const oldestPendingAgeMs = oldestPending
    ? Date.now() - new Date(oldestPending.runAt).getTime()
    : null;

  logger.info("admin.diagnostics.content_qa.ran", {
    actor: admin.username,
    requestId,
  });

  return jsonOk({
    requestId,
    cleanup,
    thresholds,
    queue: {
      countsByStatus: queueByStatus,
      oldestPendingAgeMs,
    },
    workers: {
      active: workerCount,
      stale: staleWorkerCount,
    },
    sources: {
      active: sourceActive,
      paused: sourcePaused,
    },
    deletes: {
      last24h: rejectedLast24h,
    },
    queryHealth,
  });
}

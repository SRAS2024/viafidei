/**
 * Admin dashboard warnings. Section 4 of the strict QA spec lists
 * four dashboard warnings the admin pages must surface:
 *
 *   - Raw rows > valid packages         (cleanup is behind)
 *   - Rejected content increased sharply (a source or contract change
 *                                         landed bad data)
 *   - Ingestion jobs running but valid package count not increasing
 *                                        (the pipeline is busy but
 *                                         not producing)
 *   - Admin metrics zero while queue has rows
 *                                        (the dashboard query is
 *                                         disconnected from the
 *                                         underlying tables)
 *
 * Each warning is computed live from queue + catalog tables. The
 * admin pages render a warning banner per active condition. The
 * module is read-side; it never mutates state.
 */

import { prisma } from "../db/client";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

export type DashboardWarning = {
  key: string;
  label: string;
  severity: "warn" | "fail";
  detail: string;
  actionable: string;
};

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Per-table raw-vs-valid mismatch detector. Returns the set of tables
 * where rawRows > validPackages (cleanup hasn't caught up).
 */
async function rawVsValidWarnings(): Promise<DashboardWarning[]> {
  const out: DashboardWarning[] = [];
  const tables = [
    { label: "Prayer", accessor: prisma.prayer },
    { label: "Saint", accessor: prisma.saint },
    { label: "Parish", accessor: prisma.parish },
    { label: "Devotion", accessor: prisma.devotion },
    { label: "SpiritualLifeGuide", accessor: prisma.spiritualLifeGuide },
    { label: "LiturgyEntry", accessor: prisma.liturgyEntry },
    { label: "MarianApparition", accessor: prisma.marianApparition },
  ] as const;
  for (const t of tables) {
    const accessor = t.accessor as unknown as {
      count: (args?: { where: Record<string, unknown> }) => Promise<number>;
    };
    const [raw, valid] = await Promise.all([
      safe(() => accessor.count(), 0),
      safe(() => accessor.count({ where: STRICT_PUBLIC_WHERE_CLAUSE }), 0),
    ]);
    if (raw > valid + 5) {
      out.push({
        key: `raw_vs_valid_${t.label}`,
        label: `${t.label}: raw rows > valid packages`,
        severity: "warn",
        detail: `${raw} raw rows vs ${valid} valid public packages. ${raw - valid} rows are either pending validation or failing it.`,
        actionable: `Run the strict cleanup loop (auto-runs every cron tick) or trigger manually at /admin/content-qa/dashboard.`,
      });
    }
  }
  return out;
}

/**
 * Rejection-rate spike detector. Compares the most recent hour to the
 * average over the prior 23 hours. Same algorithm as the email alert.
 */
async function rejectionSpikeWarning(): Promise<DashboardWarning | null> {
  const now = Date.now();
  const hourAgo = new Date(now - MS_HOUR);
  const dayAgo = new Date(now - MS_DAY);
  const [lastHour, priorDay] = await Promise.all([
    safe(
      () =>
        prisma.rejectedContentLog.count({
          where: { decision: "delete", deletedAt: { gte: hourAgo } },
        }),
      0,
    ),
    safe(
      () =>
        prisma.rejectedContentLog.count({
          where: { decision: "delete", deletedAt: { gte: dayAgo, lt: hourAgo } },
        }),
      0,
    ),
  ]);
  const avgPerHour = priorDay / 23;
  if (avgPerHour > 0 && lastHour > avgPerHour * 5 && lastHour >= 10) {
    return {
      key: "rejection_spike",
      label: "Rejection rate spike",
      severity: "warn",
      detail: `${lastHour} deletes in the last hour vs ${avgPerHour.toFixed(1)} / h over the prior 23h.`,
      actionable: `A bad source or contract change just landed. Check /admin/content-qa/deleted-log for the per-category breakdown.`,
    };
  }
  return null;
}

/**
 * "Running but not producing" detector. If there are completed
 * ingestion jobs in the last hour but no DataManagementLog ADD rows
 * in the same window, the pipeline is doing work but failing to
 * produce valid packages.
 */
async function runningButNotProducingWarning(): Promise<DashboardWarning | null> {
  const hourAgo = new Date(Date.now() - MS_HOUR);
  const [completedJobs, addedRows] = await Promise.all([
    safe(
      () =>
        prisma.ingestionJobQueue.count({
          where: { status: "completed", finishedAt: { gte: hourAgo } },
        }),
      0,
    ),
    safe(
      () =>
        prisma.dataManagementLog.count({
          where: { action: "ADD", createdAt: { gte: hourAgo } },
        }),
      0,
    ),
  ]);
  if (completedJobs >= 5 && addedRows === 0) {
    return {
      key: "running_but_not_producing",
      label: "Pipeline busy but no valid packages added",
      severity: "warn",
      detail: `${completedJobs} jobs completed in the last hour but zero new valid packages persisted.`,
      actionable: `Every fetched item is being rejected. Check /admin/content-qa/deleted-log for what's failing, then pause the bad source.`,
    };
  }
  return null;
}

/**
 * "Metrics zero but queue has rows" detector. If a critical surface
 * returns zero rows but the queue table has rows, the dashboard query
 * is probably disconnected from the underlying data — the dashboard
 * should render a diagnostic error rather than the misleading zero.
 */
async function metricsZeroButQueueHasRows(): Promise<DashboardWarning | null> {
  const [queueRows, runRows] = await Promise.all([
    safe(() => prisma.ingestionJobQueue.count(), 0),
    safe(() => prisma.ingestionJobRun.count(), 0),
  ]);
  // Heuristic: queue has rows but legacy run log has 0 rows. The
  // legacy path is dead, but if BOTH are non-zero we know the
  // dashboard is wired correctly. If queue is non-zero AND runs is 0
  // AND the dashboard surfaces "0 runs", that's a disconnect.
  if (queueRows > 0 && runRows === 0) {
    return {
      key: "metrics_zero_queue_has_rows",
      label: "Queue has rows but legacy run log shows zero",
      severity: "warn",
      detail: `IngestionJobQueue has ${queueRows} rows, but the legacy IngestionJobRun log is empty. Any admin page that reads from IngestionJobRun will show false zeros.`,
      actionable: `Wire the dashboard reading to the durable queue (IngestionJobQueue + WorkerHeartbeat). The legacy run log is deprecated.`,
    };
  }
  return null;
}

/**
 * Build the full list of active dashboard warnings for an admin page.
 * Empty list means the dashboard is healthy.
 */
export async function getDashboardWarnings(): Promise<DashboardWarning[]> {
  const [raw, spike, running, zero] = await Promise.all([
    rawVsValidWarnings(),
    rejectionSpikeWarning(),
    runningButNotProducingWarning(),
    metricsZeroButQueueHasRows(),
  ]);
  const all: DashboardWarning[] = [...raw];
  if (spike) all.push(spike);
  if (running) all.push(running);
  if (zero) all.push(zero);
  return all;
}

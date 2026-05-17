/**
 * Diagnostic card showing which data-management surfaces the admin
 * dashboard is reading from. Tells the operator, in one glance,
 * whether the dashboard is wired to:
 *
 *   - legacy tables                 (IngestionJobRun row counts, etc.)
 *   - new durable queue             (IngestionJobQueue + WorkerHeartbeat)
 *   - strict QA tables              (RejectedContentLog)
 *   - strict threshold counters     (publicRenderReady + isThresholdEligible)
 *
 * Each surface returns a `present` boolean by attempting a cheap
 * count; failures are caught and surfaced as `errorMessage` so a
 * disconnected table never returns a fake zero.
 */

import { prisma } from "../db/client";

export type DataSourceCard = {
  surfaces: Array<{
    key: string;
    label: string;
    present: boolean;
    rowCount: number;
    errorMessage?: string;
  }>;
  /** True when every surface is reachable. */
  allReachable: boolean;
};

async function safeCount(fn: () => Promise<number>): Promise<{
  present: boolean;
  rowCount: number;
  errorMessage?: string;
}> {
  try {
    const rowCount = await fn();
    return { present: true, rowCount };
  } catch (err) {
    return {
      present: false,
      rowCount: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getAdminDataSourceCard(): Promise<DataSourceCard> {
  const [queue, batch, cursor, worker, audit, discovered, daily, rejected, dmLog, run] =
    await Promise.all([
      safeCount(() => prisma.ingestionJobQueue.count()),
      safeCount(() => prisma.ingestionBatch.count()),
      safeCount(() => prisma.ingestionCursor.count()),
      safeCount(() => prisma.workerHeartbeat.count()),
      safeCount(() => prisma.queueAuditLog.count()),
      safeCount(() => prisma.discoveredSourceItem.count()),
      safeCount(() => prisma.dailyIngestionCounter.count()),
      safeCount(() => prisma.rejectedContentLog.count()),
      safeCount(() => prisma.dataManagementLog.count()),
      safeCount(() => prisma.ingestionJobRun.count()),
    ]);

  const surfaces = [
    {
      key: "durable_queue",
      label: "Durable queue (IngestionJobQueue)",
      ...queue,
    },
    {
      key: "ingestion_batch",
      label: "Ingestion batches (IngestionBatch)",
      ...batch,
    },
    {
      key: "ingestion_cursor",
      label: "Ingestion cursors (IngestionCursor)",
      ...cursor,
    },
    {
      key: "worker_heartbeat",
      label: "Worker heartbeats (WorkerHeartbeat)",
      ...worker,
    },
    {
      key: "queue_audit",
      label: "Queue audit log (QueueAuditLog)",
      ...audit,
    },
    {
      key: "discovered_source_items",
      label: "Discovered source items (DiscoveredSourceItem)",
      ...discovered,
    },
    {
      key: "daily_counter",
      label: "Daily counters (DailyIngestionCounter)",
      ...daily,
    },
    {
      key: "strict_qa_rejected",
      label: "Strict QA rejected (RejectedContentLog)",
      ...rejected,
    },
    {
      key: "data_management_log",
      label: "Data management log (DataManagementLog)",
      ...dmLog,
    },
    {
      key: "legacy_run_log",
      label: "Legacy ingestion run log (IngestionJobRun)",
      ...run,
    },
  ];

  const allReachable = surfaces.every((s) => s.present);
  return { surfaces, allReachable };
}

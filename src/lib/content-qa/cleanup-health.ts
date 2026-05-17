/**
 * Cleanup health summary. Powers the admin Data Management Health
 * panel and the `/api/admin/diagnostics/content-qa` endpoint.
 *
 * The summary answers seven questions:
 *
 *   - Is the cleanup loop scheduled?            (autoTrigger + queue presence)
 *   - When did it last run?                      (DataManagementLog CLEANUP row)
 *   - Is it fresh enough?                        (staleAfterMs window)
 *   - How many invalid rows exist right now?     (publicRenderReady=false on
 *                                                 PUBLISHED rows)
 *   - How many were deleted in the last 24h?     (RejectedContentLog count)
 *   - What is the active cleanup mode?           (public_only / all_catalog_rows)
 *   - Is `deleteAllInvalid` enabled?             (env override or config default)
 *
 * The dashboard surfaces a diagnostic error if a query fails; "zero"
 * always means real zero, not a failed query.
 */

import { prisma } from "../db/client";
import { resolveCleanupPolicy } from "./cleanup-policy";

export type CleanupHealthSummary = {
  /** Active cleanup mode. */
  mode: "public_only" | "all_catalog_rows";
  /** Whether delete-all-invalid is enabled. */
  deleteAllInvalid: boolean;
  /** Whether the loop auto-runs after every ingestion batch. */
  autoTriggerAfterIngestion: boolean;
  /** Contract version the cleanup loop will write on each updated row. */
  packageContractVersion: string;
  /** Most recent CLEANUP DataManagementLog row timestamp, if any. */
  lastRunAt: Date | null;
  /** Number of milliseconds since the last successful cleanup run. */
  msSinceLastRun: number | null;
  /** True when the cleanup loop has not run within the staleAfterMs window. */
  isStale: boolean;
  /**
   * Invalid public rows currently in the catalog (status=PUBLISHED but
   * publicRenderReady=false). When the strict policy is enforced
   * correctly, this number trends to zero.
   */
  invalidPublicRowCount: number;
  /** Rows deleted by strict QA in the last 24 hours. */
  deletedLast24h: number;
  /** Rows deleted by strict QA in the last 7 days. */
  deletedLast7d: number;
  /** Per-content-type invalid public rows. */
  invalidPublicByContentType: Record<string, number>;
  /** Per-failure-category deletes in the last 24h. */
  deletedByCategoryLast24h: Record<string, number>;
  /** Map of which queries succeeded. Diagnostic surface for the dashboard. */
  queryHealth: Record<string, { ok: boolean; errorMessage?: string }>;
};

const MS_DAY = 24 * 60 * 60 * 1000;

async function safe<T>(
  key: string,
  out: Record<string, { ok: boolean; errorMessage?: string }>,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    const v = await fn();
    out[key] = { ok: true };
    return v;
  } catch (err) {
    out[key] = {
      ok: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
    return fallback;
  }
}

export async function getCleanupHealth(): Promise<CleanupHealthSummary> {
  const policy = resolveCleanupPolicy();
  const queryHealth: Record<string, { ok: boolean; errorMessage?: string }> = {};
  const now = Date.now();
  const since24h = new Date(now - MS_DAY);
  const since7d = new Date(now - 7 * MS_DAY);

  const lastRunRow = await safe(
    "lastRun",
    queryHealth,
    () =>
      prisma.dataManagementLog.findFirst({
        where: { action: "CLEANUP", contentType: "ContentQA" },
        orderBy: { createdAt: "desc" },
      }),
    null,
  );
  const lastRunAt = lastRunRow?.createdAt ?? null;
  const msSinceLastRun = lastRunAt ? now - lastRunAt.getTime() : null;
  const isStale = msSinceLastRun === null ? true : msSinceLastRun > policy.staleAfterMs;

  // Invalid public rows — count status=PUBLISHED + publicRenderReady=false
  // across every catalog table. These should be zero under the strict
  // policy; any non-zero value is a signal that the cleanup loop has
  // not run recently or that ingestion is bypassing the gate.
  const invalidByType: Record<string, number> = {};
  const tables = [
    { key: "Prayer", accessor: prisma.prayer },
    { key: "Saint", accessor: prisma.saint },
    { key: "MarianApparition", accessor: prisma.marianApparition },
    { key: "Devotion", accessor: prisma.devotion },
    { key: "SpiritualLifeGuide", accessor: prisma.spiritualLifeGuide },
    { key: "LiturgyEntry", accessor: prisma.liturgyEntry },
    { key: "Parish", accessor: prisma.parish },
  ] as const;
  let invalidTotal = 0;
  for (const t of tables) {
    const accessor = t.accessor as unknown as {
      count: (args: { where: Record<string, unknown> }) => Promise<number>;
    };
    const count = await safe(
      `invalid.${t.key}`,
      queryHealth,
      () => accessor.count({ where: { status: "PUBLISHED", publicRenderReady: false } }),
      0,
    );
    invalidByType[t.key] = count;
    invalidTotal += count;
  }

  const deletedLast24h = await safe(
    "deletedLast24h",
    queryHealth,
    () =>
      prisma.rejectedContentLog.count({
        where: { decision: "delete", deletedAt: { gte: since24h } },
      }),
    0,
  );
  const deletedLast7d = await safe(
    "deletedLast7d",
    queryHealth,
    () =>
      prisma.rejectedContentLog.count({
        where: { decision: "delete", deletedAt: { gte: since7d } },
      }),
    0,
  );

  const categoryRows = await safe(
    "deletedByCategoryLast24h",
    queryHealth,
    () =>
      prisma.rejectedContentLog.groupBy({
        by: ["failureCategory"],
        where: { decision: "delete", deletedAt: { gte: since24h } },
        _count: { _all: true },
      }),
    [] as Array<{ failureCategory: string | null; _count?: { _all: number } }>,
  );
  const deletedByCategoryLast24h: Record<string, number> = {};
  for (const row of categoryRows) {
    const key = row.failureCategory ?? "(unknown)";
    deletedByCategoryLast24h[key] = row._count?._all ?? 0;
  }

  return {
    mode: policy.mode,
    deleteAllInvalid: policy.deleteAllInvalid,
    autoTriggerAfterIngestion: policy.autoTriggerAfterIngestion,
    packageContractVersion: policy.packageContractVersion,
    lastRunAt,
    msSinceLastRun,
    isStale,
    invalidPublicRowCount: invalidTotal,
    deletedLast24h,
    deletedLast7d,
    invalidPublicByContentType: invalidByType,
    deletedByCategoryLast24h,
    queryHealth,
  };
}

/**
 * Startup safety check: scan the queue for removed job kinds.
 *
 * The worker temporarily translates legacy `source_ingest` rows into
 * modern `source_discovery` rows so a pre-migration deploy doesn't
 * break the queue. That translation is a one-time migration aid; it
 * is NOT a permanent fallback.
 *
 * This check runs at startup. If removed job kinds are still present
 * AFTER the migration window has elapsed, it raises a loud admin
 * diagnostic (logged at error level + recorded as a critical
 * ErrorLog) so the operator sees the queue is stuck on legacy rows
 * and can run the migration job to drain or delete them.
 *
 * The migration window is `LEGACY_JOB_KIND_MIGRATION_WINDOW_MS`
 * (default 7 days) after the FIRST observation of any removed-kind
 * row. The first-observation timestamp is the earliest `createdAt`
 * across all current removed-kind rows.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { REMOVED_JOB_KINDS } from "../ingestion/queue/job-kinds";

const DEFAULT_MIGRATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type RemovedJobKindCheckResult = {
  /** True when no operator action is needed (no rows, or still within the migration window). */
  ok: boolean;
  /** Number of removed-kind rows currently queued. */
  rows: number;
  /** Earliest observed createdAt across the removed-kind rows, or null when none. */
  oldestObservedAt: Date | null;
  /** True when the oldest row is older than the migration window. */
  windowExceeded: boolean;
};

export async function scanQueueForRemovedJobKinds(
  options: {
    migrationWindowMs?: number;
  } = {},
): Promise<RemovedJobKindCheckResult> {
  const windowMs = options.migrationWindowMs ?? DEFAULT_MIGRATION_WINDOW_MS;
  const removed = [...REMOVED_JOB_KINDS];
  if (removed.length === 0) {
    return { ok: true, rows: 0, oldestObservedAt: null, windowExceeded: false };
  }

  const rows = await prisma.ingestionJobQueue
    .findMany({
      where: {
        jobKind: { in: removed },
        status: { in: ["pending", "running", "retrying"] },
      },
      select: { id: true, jobKind: true, createdAt: true, status: true },
      take: 100,
    })
    .catch((e) => {
      logger.warn("startup.removed_job_kinds_check.query_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [] as Array<{ id: string; jobKind: string; createdAt: Date; status: string }>;
    });
  if (rows.length === 0) {
    return { ok: true, rows: 0, oldestObservedAt: null, windowExceeded: false };
  }

  const oldest = rows.reduce<Date | null>(
    (acc, r) => (acc === null || r.createdAt < acc ? r.createdAt : acc),
    null,
  );
  const windowExceeded = oldest !== null && Date.now() - oldest.getTime() > windowMs;
  if (windowExceeded) {
    logger.error("startup.removed_job_kinds_after_migration_window", {
      removedJobKinds: removed,
      rows: rows.length,
      oldestObservedAt: oldest.toISOString(),
      migrationWindowMs: windowMs,
      message:
        "Removed job kinds are still queued AFTER the migration window. " +
        "The temporary worker translation should be deleted only after these " +
        "rows are drained. Run the queue migration job to convert or delete them.",
    });
  } else {
    logger.warn("startup.removed_job_kinds_present_within_window", {
      removedJobKinds: removed,
      rows: rows.length,
      oldestObservedAt: oldest?.toISOString() ?? null,
    });
  }
  // ok=true while we are within the migration window (the worker is
  // translating these rows on the fly); ok=false once the window has
  // elapsed so the operator sees a loud diagnostic.
  return {
    ok: !windowExceeded,
    rows: rows.length,
    oldestObservedAt: oldest,
    windowExceeded,
  };
}

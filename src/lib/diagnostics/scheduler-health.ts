/**
 * Scheduler health.
 *
 * Records each planner ("scheduler") tick into QueueAuditLog and
 * reads recent ticks back for the admin scheduler health card — so a
 * failed tick surfaces the precise cause (jobs scanned, enqueued,
 * skipped + reasons, error message, duration) instead of just
 * "tick failed".
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { recordQueueAudit } from "../ingestion/queue/audit";
import type { PlannerSummary } from "../ingestion/queue/planner";

function skipReasonsOf(summary: PlannerSummary): Record<string, number> {
  return {
    alreadyQueued: summary.jobsSkippedAlreadyQueued,
    sourcePaused: summary.jobsSkippedSourcePaused,
    jobPaused: summary.jobsSkippedJobPaused,
    contentTypePaused: summary.jobsSkippedContentTypePaused,
    sourceUnhealthy: summary.jobsSkippedSourceUnhealthy,
    sourceExhausted: summary.jobsSkippedSourceExhausted,
    sourceNotConfigured: summary.jobsSkippedSourceNotConfigured,
    dailyCap: summary.jobsSkippedDailyCap,
    fillCap: summary.jobsSkippedFillCap,
  };
}

/**
 * Record one scheduler tick. Writes a `scheduler.tick_completed` or
 * `scheduler.tick_failed` audit row and emits a structured log line
 * carrying the same diagnostics.
 */
export async function recordSchedulerTick(input: {
  summary: PlannerSummary | null;
  durationMs: number;
}): Promise<void> {
  const { summary, durationMs } = input;
  const ok = summary !== null && !summary.dbError;
  const skipReasons = summary ? skipReasonsOf(summary) : {};
  const jobsSkipped = Object.values(skipReasons).reduce((a, b) => a + b, 0);
  const errorMessage = summary ? summary.errorMessage : "planner returned no summary (tick threw)";

  const fields = {
    ok,
    durationMs,
    jobsScanned: summary?.jobsScanned ?? 0,
    jobsEnqueued: summary?.jobsEnqueued ?? 0,
    jobsSkipped,
    skipReasons,
    mode: summary?.mode ?? "unknown",
    errorMessage,
  };

  if (ok) {
    logger.info("scheduler.tick_completed", fields);
  } else {
    logger.error("scheduler.tick_failed", fields);
  }

  await recordQueueAudit({
    jobQueueId: null,
    event: ok ? "scheduler.tick_completed" : "scheduler.tick_failed",
    reason: errorMessage ?? (ok ? "tick completed" : "tick failed"),
    metadata: fields,
  }).catch((e) => {
    logger.warn("scheduler-health.record_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  });
}

export type SchedulerHealth = {
  generatedAt: Date;
  lastTickAt: Date | null;
  lastSuccessfulTickAt: Date | null;
  lastFailedTickAt: Date | null;
  lastFailureReason: string | null;
  jobsEnqueuedLastTick: number | null;
  jobsScannedLastTick: number | null;
  currentMode: string | null;
  lastTickOk: boolean | null;
  /** True when a tick was recorded within the last 24h. */
  ticked24h: boolean;
  errors: string[];
};

export async function getSchedulerHealth(now: Date = new Date()): Promise<SchedulerHealth> {
  const errors: string[] = [];
  let rows: Array<{ event: string; reason: string | null; metadata: unknown; createdAt: Date }> =
    [];
  try {
    rows =
      (await prisma.queueAuditLog.findMany({
        where: { event: { startsWith: "scheduler.tick_" } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })) ?? [];
  } catch (e) {
    errors.push(`scheduler tick read: ${e instanceof Error ? e.message : String(e)}`);
  }

  const lastTick = rows[0] ?? null;
  const lastSuccess = rows.find((r) => r.event === "scheduler.tick_completed") ?? null;
  const lastFailure = rows.find((r) => r.event === "scheduler.tick_failed") ?? null;
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;

  const lastMeta =
    lastTick && lastTick.metadata && typeof lastTick.metadata === "object"
      ? (lastTick.metadata as Record<string, unknown>)
      : null;
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  return {
    generatedAt: now,
    lastTickAt: lastTick?.createdAt ?? null,
    lastSuccessfulTickAt: lastSuccess?.createdAt ?? null,
    lastFailedTickAt: lastFailure?.createdAt ?? null,
    lastFailureReason: lastFailure ? (lastFailure.reason ?? "tick failed") : null,
    jobsEnqueuedLastTick: lastMeta ? num(lastMeta.jobsEnqueued) : null,
    jobsScannedLastTick: lastMeta ? num(lastMeta.jobsScanned) : null,
    currentMode: lastMeta && typeof lastMeta.mode === "string" ? lastMeta.mode : null,
    lastTickOk: lastTick ? lastTick.event === "scheduler.tick_completed" : null,
    ticked24h: !!lastTick && lastTick.createdAt.getTime() > cutoff,
    errors,
  };
}

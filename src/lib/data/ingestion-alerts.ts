/**
 * Operational alert generators for the ingestion system. Each function
 * decides whether to send an admin alert based on the current queue
 * + source state, and stores the last-sent timestamp in
 * AdminNotificationState so the same alert is not re-sent every tick.
 *
 * Alerts:
 *   - stalled_growth        — a content type has not grown after N
 *                             cycles while still below its threshold.
 *   - source_repeated_fail  — a source has failed N times in a row.
 *   - low_quality_source    — a source's recent items are mostly REVIEW
 *                             or REJECT (low quality).
 *   - review_queue_large    — review queue exceeds threshold.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { appConfig } from "../config";
import { readAdminEmail, sendCriticalFailureAlert } from "../email";
import { getFlowState, setFlowState } from "./admin-notification-state";

const STALLED_CYCLES_DEFAULT = 6;
const SOURCE_FAIL_THRESHOLD = 5;
const LOW_QUALITY_RATIO_THRESHOLD = 0.6;
const REVIEW_QUEUE_LARGE_THRESHOLD = 500;
const RESEND_COOLDOWN_HOURS = 24;

function isWithinCooldown(lastSentAt: Date | null, now: Date): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - lastSentAt.getTime() < RESEND_COOLDOWN_HOURS * 60 * 60 * 1000;
}

export type AlertState = {
  lastSentAt: string | null;
  counter: number;
};

/**
 * Stalled-growth detector for a single content type. Caller passes the
 * current count after this tick; we compare against the prior counter
 * and increment a "cycles without growth" tally. If we hit
 * `cycleThreshold` while still below the configured target, we fire
 * one alert and reset the tally.
 */
export async function checkStalledGrowth(
  bucket: { key: string; label: string; currentCount: number; target: number },
  cycleThreshold = STALLED_CYCLES_DEFAULT,
  now: Date = new Date(),
): Promise<boolean> {
  type StalledState = AlertState & { lastCount: number; cyclesNoGrowth: number };
  const flow = `alert:stalled:${bucket.key}` as `alert:${string}`;
  const state = (await getFlowState<StalledState>(flow)) ?? {
    lastSentAt: null,
    counter: 0,
    lastCount: bucket.currentCount,
    cyclesNoGrowth: 0,
  };

  const grew = bucket.currentCount > state.lastCount;
  const cyclesNoGrowth = grew ? 0 : state.cyclesNoGrowth + 1;
  const belowTarget = bucket.currentCount < bucket.target;

  let triggered = false;
  if (!grew && cyclesNoGrowth >= cycleThreshold && belowTarget) {
    if (!isWithinCooldown(state.lastSentAt ? new Date(state.lastSentAt) : null, now)) {
      if (readAdminEmail()) {
        try {
          await sendCriticalFailureAlert({
            kind: "stalled_growth",
            message: `Content type ${bucket.label} has not grown after ${cyclesNoGrowth} ingestion cycles. Current ${bucket.currentCount} / target ${bucket.target}.`,
          });
        } catch (e) {
          logger.warn("alert.stalled_growth.send_failed", {
            bucket: bucket.key,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      triggered = true;
    }
  }

  await setFlowState<StalledState>(flow, {
    lastSentAt: triggered ? now.toISOString() : state.lastSentAt,
    counter: triggered ? state.counter + 1 : state.counter,
    lastCount: bucket.currentCount,
    cyclesNoGrowth: triggered ? 0 : cyclesNoGrowth,
  });
  return triggered;
}

export async function checkRepeatedSourceFailures(now: Date = new Date()): Promise<number> {
  let sentCount = 0;
  const sources = await prisma.ingestionSource.findMany({
    where: { consecutiveFailures: { gte: SOURCE_FAIL_THRESHOLD } },
  });
  for (const s of sources) {
    type SrcState = AlertState;
    const flow = `alert:source_fail:${s.id}` as `alert:${string}`;
    const state = (await getFlowState<SrcState>(flow)) ?? { lastSentAt: null, counter: 0 };
    if (isWithinCooldown(state.lastSentAt ? new Date(state.lastSentAt) : null, now)) continue;
    if (readAdminEmail()) {
      try {
        await sendCriticalFailureAlert({
          kind: "source_repeated_fail",
          message: `Source ${s.name} (${s.host}) has failed ${s.consecutiveFailures} consecutive times. Health: ${s.healthState}. Last error around ${s.lastFailedSync?.toISOString() ?? "unknown"}.`,
        });
        sentCount += 1;
      } catch (e) {
        logger.warn("alert.source_fail.send_failed", {
          sourceId: s.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    await setFlowState<SrcState>(flow, {
      lastSentAt: now.toISOString(),
      counter: state.counter + 1,
    });
  }
  return sentCount;
}

export async function checkLowQualitySources(now: Date = new Date()): Promise<number> {
  let sentCount = 0;
  const sources = await prisma.ingestionSource.findMany({
    where: { lowQualityRatio: { gte: LOW_QUALITY_RATIO_THRESHOLD } },
  });
  for (const s of sources) {
    type SrcState = AlertState;
    const flow = `alert:source_lowq:${s.id}` as `alert:${string}`;
    const state = (await getFlowState<SrcState>(flow)) ?? { lastSentAt: null, counter: 0 };
    if (isWithinCooldown(state.lastSentAt ? new Date(state.lastSentAt) : null, now)) continue;
    if (readAdminEmail()) {
      try {
        await sendCriticalFailureAlert({
          kind: "source_low_quality",
          message: `Source ${s.name} (${s.host}) is producing low-quality content (review/reject ratio ${(s.lowQualityRatio ?? 0).toFixed(2)}). Consider pausing or re-tiering.`,
        });
        sentCount += 1;
      } catch (e) {
        logger.warn("alert.low_quality.send_failed", {
          sourceId: s.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    await setFlowState<SrcState>(flow, {
      lastSentAt: now.toISOString(),
      counter: state.counter + 1,
    });
  }
  return sentCount;
}

export async function checkReviewQueueSize(now: Date = new Date()): Promise<boolean> {
  const reviewCount = await prisma.contentReview
    .count({ where: { decision: "PENDING" } })
    .catch(() => 0);
  if (reviewCount < REVIEW_QUEUE_LARGE_THRESHOLD) return false;
  type QState = AlertState;
  const flow = "alert:review_queue_large" as `alert:${string}`;
  const state = (await getFlowState<QState>(flow)) ?? { lastSentAt: null, counter: 0 };
  if (isWithinCooldown(state.lastSentAt ? new Date(state.lastSentAt) : null, now)) return false;
  if (readAdminEmail()) {
    try {
      await sendCriticalFailureAlert({
        kind: "review_queue_large",
        message: `Review queue has ${reviewCount} pending items (threshold ${REVIEW_QUEUE_LARGE_THRESHOLD}). Please triage.`,
      });
    } catch (e) {
      logger.warn("alert.review_queue.send_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  await setFlowState<QState>(flow, { lastSentAt: now.toISOString(), counter: state.counter + 1 });
  return true;
}

/**
 * Different stall-class alerts — each fires its own distinct admin
 * email so the operator knows which corner of the pipeline is stuck.
 *   - content_below_target_no_jobs: planner didn't enqueue any work
 *     for a below-target bucket.
 *   - jobs_enqueued_no_worker: pending jobs exist but no worker
 *     heartbeat is alive.
 *   - workers_complete_no_growth: workers are completing jobs but
 *     content counts aren't increasing.
 */
export async function checkStallSignals(
  signals: {
    contentBelowTargetButNoJobs: boolean;
    jobsEnqueuedButNotProcessed: boolean;
    jobsCompletedButContentNotGrowing: boolean;
  },
  now: Date = new Date(),
): Promise<{ sent: string[] }> {
  const sent: string[] = [];
  async function fire(key: string, message: string): Promise<void> {
    const flow = `alert:stall:${key}` as `alert:${string}`;
    const state = (await getFlowState<AlertState>(flow)) ?? { lastSentAt: null, counter: 0 };
    if (isWithinCooldown(state.lastSentAt ? new Date(state.lastSentAt) : null, now)) return;
    if (readAdminEmail()) {
      try {
        await sendCriticalFailureAlert({ kind: `stall_${key}`, message });
      } catch (e) {
        logger.warn("alert.stall.send_failed", {
          key,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    await setFlowState<AlertState>(flow, {
      lastSentAt: now.toISOString(),
      counter: state.counter + 1,
    });
    sent.push(key);
  }
  if (signals.contentBelowTargetButNoJobs) {
    await fire(
      "content_below_target_no_jobs",
      "Planner is not enqueuing jobs for content types that are still below their target. Check IngestionJob.isActive + source pauses.",
    );
  }
  if (signals.jobsEnqueuedButNotProcessed) {
    await fire(
      "jobs_enqueued_no_worker",
      "Queue has pending jobs but no healthy worker heartbeat. Start a worker: npm run worker.",
    );
  }
  if (signals.jobsCompletedButContentNotGrowing) {
    await fire(
      "workers_complete_no_growth",
      "Workers are completing jobs but content counts are not increasing. Inspect adapter output / dedupe rate.",
    );
  }
  return { sent };
}

/**
 * One-shot helper called from the cron route. Runs every check and
 * returns a structured summary so the run log captures whether any
 * alerts fired this tick.
 */
export async function runAllIngestionAlerts(
  bucketCounts: Array<{ key: string; label: string; currentCount: number; target: number }>,
  now: Date = new Date(),
): Promise<{
  stalledGrowth: number;
  sourceFailures: number;
  lowQualitySources: number;
  reviewQueueLarge: boolean;
}> {
  let stalledGrowth = 0;
  for (const b of bucketCounts) {
    const fired = await checkStalledGrowth(
      b,
      appConfig.ingestion.stalledGrowthCycleThreshold ?? STALLED_CYCLES_DEFAULT,
      now,
    ).catch(() => false);
    if (fired) stalledGrowth += 1;
  }
  const sourceFailures = await checkRepeatedSourceFailures(now).catch(() => 0);
  const lowQualitySources = await checkLowQualitySources(now).catch(() => 0);
  const reviewQueueLarge = await checkReviewQueueSize(now).catch(() => false);
  return { stalledGrowth, sourceFailures, lowQualitySources, reviewQueueLarge };
}

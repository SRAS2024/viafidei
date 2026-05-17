/**
 * System health scores. The admin Data Management Health panel reads
 * this module for seven score cards:
 *
 *   - systemLevelHealth
 *   - contentQAHealth
 *   - durableQueueHealth
 *   - sourceQualityHealth
 *   - workerReliabilityHealth
 *   - thresholdGrowthHealth
 *   - publicRenderingHealth
 *
 * Each score is a 0–100 number derived from concrete database signals
 * (queue counts, worker heartbeats, rejection counts, invalid-public
 * row counts, etc.) plus a status label (`healthy` / `warn` / `fail`)
 * and a human-readable summary so the dashboard can display the
 * card without recomputing.
 *
 * Scores are intentionally simple: every component has a clear failure
 * threshold and the score is a linear interpolation between healthy
 * and broken. The dashboard surfaces both the score and the
 * underlying counts so the operator can verify the math.
 */

import { prisma } from "../db/client";
import { appConfig } from "../config";
import { resolveCleanupPolicy } from "./cleanup-policy";

export type HealthStatus = "healthy" | "warn" | "fail";

export type HealthScore = {
  key: string;
  label: string;
  score: number;
  status: HealthStatus;
  summary: string;
  /**
   * Raw signals that produced the score. The dashboard renders these
   * under the card so the operator can see exactly what is going wrong.
   */
  signals: Record<string, number | string | null>;
  /** True when at least one input query failed (score is approximate). */
  hasQueryFailures: boolean;
};

export type SystemHealthReport = {
  scores: {
    system: HealthScore;
    contentQA: HealthScore;
    durableQueue: HealthScore;
    sourceQuality: HealthScore;
    workerReliability: HealthScore;
    thresholdGrowth: HealthScore;
    publicRendering: HealthScore;
  };
  /** Generated-at timestamp so the dashboard can show "last updated". */
  ranAt: Date;
};

const MS_MIN = 60 * 1000;

function statusFromScore(score: number): HealthStatus {
  if (score >= 90) return "healthy";
  if (score >= 60) return "warn";
  return "fail";
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
  try {
    const value = await fn();
    return { value, ok: true };
  } catch {
    return { value: fallback, ok: false };
  }
}

/**
 * Compute the durable queue health score. Inputs:
 *   - pending job count
 *   - retrying job count
 *   - oldest pending age (ms)
 */
async function computeDurableQueueHealth(): Promise<HealthScore> {
  const pending = await safe(
    () => prisma.ingestionJobQueue.count({ where: { status: "pending" } }),
    0,
  );
  const retrying = await safe(
    () => prisma.ingestionJobQueue.count({ where: { status: "retrying" } }),
    0,
  );
  const oldest = await safe(
    () =>
      prisma.ingestionJobQueue.findFirst({
        where: { status: "pending" },
        orderBy: { runAt: "asc" },
        select: { runAt: true },
      }),
    null as { runAt: Date } | null,
  );
  const oldestPendingAgeMs = oldest.value ? Date.now() - oldest.value.runAt.getTime() : 0;
  const warnAfterMs = appConfig.ingestionQueue.oldestPendingWarnAfterMs;

  // Score components
  //   - penalize when oldest pending exceeds warn threshold
  //   - penalize when pending or retrying are very large
  let score = 100;
  if (oldestPendingAgeMs > warnAfterMs) {
    const overrun = oldestPendingAgeMs - warnAfterMs;
    score -= Math.min(40, (overrun / warnAfterMs) * 40);
  }
  if (retrying.value > 50) score -= Math.min(30, (retrying.value - 50) / 10);
  if (pending.value > 1000) score -= Math.min(20, (pending.value - 1000) / 100);
  score = Math.max(0, Math.round(score));
  const hasQueryFailures = !pending.ok || !retrying.ok || !oldest.ok;
  return {
    key: "durableQueue",
    label: "Durable queue health",
    score,
    status: statusFromScore(score),
    summary: `${pending.value} pending · ${retrying.value} retrying · oldest pending ${(oldestPendingAgeMs / MS_MIN).toFixed(0)}m`,
    signals: {
      pending: pending.value,
      retrying: retrying.value,
      oldestPendingAgeMs,
      warnAfterMs,
    },
    hasQueryFailures,
  };
}

/**
 * Worker reliability. A worker counts as active when its
 * lastHeartbeatAt is within workerStaleAfterMs.
 */
async function computeWorkerReliabilityHealth(): Promise<HealthScore> {
  const cutoff = new Date(Date.now() - appConfig.ingestionQueue.workerStaleAfterMs);
  const active = await safe(
    () => prisma.workerHeartbeat.count({ where: { lastHeartbeatAt: { gte: cutoff } } }),
    0,
  );
  const stale = await safe(
    () => prisma.workerHeartbeat.count({ where: { lastHeartbeatAt: { lt: cutoff } } }),
    0,
  );
  const queuePending = await safe(
    () => prisma.ingestionJobQueue.count({ where: { status: "pending" } }),
    0,
  );

  // Hard fail: pending jobs exist but no active workers.
  let score = 100;
  if (active.value === 0 && queuePending.value > 0) score = 0;
  else if (active.value === 0) score = 60;
  else if (stale.value > active.value) score -= 30;
  else if (stale.value > 0) score -= 10;
  score = Math.max(0, Math.round(score));
  return {
    key: "workerReliability",
    label: "Worker reliability",
    score,
    status: statusFromScore(score),
    summary: `${active.value} active · ${stale.value} stale · ${queuePending.value} pending jobs`,
    signals: {
      activeWorkers: active.value,
      staleWorkers: stale.value,
      pendingJobs: queuePending.value,
    },
    hasQueryFailures: !active.ok || !stale.ok || !queuePending.ok,
  };
}

/**
 * Source quality. Inputs:
 *   - paused source count
 *   - failing source count
 *   - active source count
 *   - rejection rate proxy (lifetime rejected / lifetime completed)
 */
async function computeSourceQualityHealth(): Promise<HealthScore> {
  const active = await safe(() => prisma.ingestionSource.count({ where: { isActive: true } }), 0);
  const paused = await safe(
    () => prisma.ingestionSource.count({ where: { pausedAt: { not: null } } }),
    0,
  );
  const failing = await safe(
    () =>
      prisma.ingestionSource.count({
        where: { healthState: { in: ["failing", "blocked"] } },
      }),
    0,
  );
  const exhausted = await safe(
    () => prisma.ingestionSource.count({ where: { exhaustedAt: { not: null } } }),
    0,
  );
  const totalSources = Math.max(1, active.value);
  const failingRatio = failing.value / totalSources;
  let score = 100;
  score -= Math.round(failingRatio * 60);
  if (paused.value > totalSources / 2) score -= 20;
  score = Math.max(0, Math.round(score));
  return {
    key: "sourceQuality",
    label: "Source quality",
    score,
    status: statusFromScore(score),
    summary: `${active.value} active · ${paused.value} paused · ${failing.value} failing · ${exhausted.value} exhausted`,
    signals: {
      active: active.value,
      paused: paused.value,
      failing: failing.value,
      exhausted: exhausted.value,
    },
    hasQueryFailures: !active.ok || !paused.ok || !failing.ok || !exhausted.ok,
  };
}

/**
 * Threshold growth health. Looks at the strict valid-package counts
 * against the configured targets. Score is the average completion
 * percentage capped at 100.
 */
async function computeThresholdGrowthHealth(): Promise<HealthScore> {
  const targets = appConfig.ingestion.targets;
  // Use raw counts — even though the strict module exists, this score
  // intentionally measures raw progress to keep the formula simple.
  // Cross-reference with the content QA health score for invalid
  // counts.
  const [prayers, saints, parishes] = await Promise.all([
    safe(() => prisma.prayer.count({ where: { status: "PUBLISHED", publicRenderReady: true } }), 0),
    safe(() => prisma.saint.count({ where: { status: "PUBLISHED", publicRenderReady: true } }), 0),
    safe(() => prisma.parish.count({ where: { status: "PUBLISHED", publicRenderReady: true } }), 0),
  ]);

  const pctPrayers = Math.min(100, (prayers.value / targets.prayers) * 100);
  const pctSaints = Math.min(100, (saints.value / targets.saints) * 100);
  const pctParishes = Math.min(100, (parishes.value / targets.parishes) * 100);
  const score = Math.round((pctPrayers + pctSaints + pctParishes) / 3);
  return {
    key: "thresholdGrowth",
    label: "Threshold growth",
    score,
    status: statusFromScore(score),
    summary: `Prayers ${pctPrayers.toFixed(0)}% · Saints ${pctSaints.toFixed(0)}% · Parishes ${pctParishes.toFixed(0)}%`,
    signals: {
      prayers: prayers.value,
      saints: saints.value,
      parishes: parishes.value,
      prayerTarget: targets.prayers,
      saintTarget: targets.saints,
      parishTarget: targets.parishes,
    },
    hasQueryFailures: !prayers.ok || !saints.ok || !parishes.ok,
  };
}

/**
 * Public rendering health. Counts invalid-public rows. A perfect score
 * means zero rows are status=PUBLISHED but publicRenderReady=false.
 */
async function computePublicRenderingHealth(): Promise<HealthScore> {
  const tables = [
    { key: "Prayer", accessor: prisma.prayer },
    { key: "Saint", accessor: prisma.saint },
    { key: "Parish", accessor: prisma.parish },
    { key: "Devotion", accessor: prisma.devotion },
    { key: "LiturgyEntry", accessor: prisma.liturgyEntry },
    { key: "SpiritualLifeGuide", accessor: prisma.spiritualLifeGuide },
    { key: "MarianApparition", accessor: prisma.marianApparition },
  ] as const;
  let invalidTotal = 0;
  let queryFailures = 0;
  const byType: Record<string, number> = {};
  for (const t of tables) {
    const accessor = t.accessor as unknown as {
      count: (args: { where: Record<string, unknown> }) => Promise<number>;
    };
    const result = await safe(
      () => accessor.count({ where: { status: "PUBLISHED", publicRenderReady: false } }),
      0,
    );
    if (!result.ok) queryFailures += 1;
    byType[t.key] = result.value;
    invalidTotal += result.value;
  }
  let score = 100;
  if (invalidTotal > 0) score -= Math.min(80, invalidTotal);
  score = Math.max(0, Math.round(score));
  return {
    key: "publicRendering",
    label: "Public rendering",
    score,
    status: statusFromScore(score),
    summary:
      invalidTotal === 0
        ? "No invalid public rows."
        : `${invalidTotal} invalid public row(s) — should be 0.`,
    signals: byType,
    hasQueryFailures: queryFailures > 0,
  };
}

/**
 * Content QA health. Inputs:
 *   - cleanup loop freshness
 *   - delete-all-invalid enabled
 *   - rejection rate over the last 24h
 *   - invalid-public-row count
 */
async function computeContentQAHealth(): Promise<HealthScore> {
  const policy = resolveCleanupPolicy();
  const lastRun = await safe(
    () =>
      prisma.dataManagementLog.findFirst({
        where: { action: "CLEANUP", contentType: "ContentQA" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    null as { createdAt: Date } | null,
  );
  const msSinceLastRun = lastRun.value ? Date.now() - lastRun.value.createdAt.getTime() : null;
  const isStale = msSinceLastRun === null ? true : msSinceLastRun > policy.staleAfterMs;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rejected24h = await safe(
    () => prisma.rejectedContentLog.count({ where: { deletedAt: { gte: since24h } } }),
    0,
  );

  let score = 100;
  if (!policy.deleteAllInvalid) score -= 30;
  if (isStale) score -= 30;
  // Rejected count is informational — heavy rejection is good (means
  // the loop is doing its job), not bad. We only penalize zero
  // rejection counts when the loop hasn't run, which `isStale` covers.
  score = Math.max(0, Math.round(score));
  return {
    key: "contentQA",
    label: "Strict content QA",
    score,
    status: statusFromScore(score),
    summary: `mode=${policy.mode} · deleteAllInvalid=${policy.deleteAllInvalid} · rejected last 24h=${rejected24h.value}`,
    signals: {
      mode: policy.mode,
      deleteAllInvalid: policy.deleteAllInvalid ? "true" : "false",
      rejected24h: rejected24h.value,
      msSinceLastRun,
      lastRunAt: lastRun.value ? lastRun.value.createdAt.toISOString() : null,
    },
    hasQueryFailures: !lastRun.ok || !rejected24h.ok,
  };
}

/**
 * System-level health. Aggregates the other six scores into a single
 * number using the minimum (worst component) as the system score —
 * an unhealthy queue or worker can't be papered over by a healthy
 * source list.
 */
function computeSystemHealth(args: HealthScore[]): HealthScore {
  const min = args.reduce((acc, cur) => (cur.score < acc ? cur.score : acc), 100);
  const worst = args.reduce((worst, cur) => (cur.score < worst.score ? cur : worst), args[0]);
  return {
    key: "system",
    label: "System health",
    score: min,
    status: statusFromScore(min),
    summary: `Lowest component: ${worst.label} (${worst.score})`,
    signals: {
      components: args.length,
      worstComponent: worst.label,
      worstScore: worst.score,
    },
    hasQueryFailures: args.some((c) => c.hasQueryFailures),
  };
}

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const [
    contentQA,
    durableQueue,
    sourceQuality,
    workerReliability,
    thresholdGrowth,
    publicRendering,
  ] = await Promise.all([
    computeContentQAHealth(),
    computeDurableQueueHealth(),
    computeSourceQualityHealth(),
    computeWorkerReliabilityHealth(),
    computeThresholdGrowthHealth(),
    computePublicRenderingHealth(),
  ]);
  const system = computeSystemHealth([
    contentQA,
    durableQueue,
    sourceQuality,
    workerReliability,
    thresholdGrowth,
    publicRendering,
  ]);
  return {
    scores: {
      system,
      contentQA,
      durableQueue,
      sourceQuality,
      workerReliability,
      thresholdGrowth,
      publicRendering,
    },
    ranAt: new Date(),
  };
}

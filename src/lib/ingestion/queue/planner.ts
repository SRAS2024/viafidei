/**
 * Cron-side ingestion planner.
 *
 * The planner is short, cheap, and side-effect-light: it walks
 * active `IngestionJob` rows, consults backlog progress to decide
 * constant vs maintenance mode, and enqueues the right job into
 * `IngestionJobQueue` at the right priority. The dedicated worker
 * process (`npm run worker`) is the only ingestion-adapter executor.
 *
 * Safety invariants:
 *   - DB error while checking thresholds → stay in constant mode,
 *     never downgrade to maintenance priority, fire the
 *     `threshold_check_failed` admin warning.
 *   - Paused source / paused job / paused content type → counted
 *     in the summary, not enqueued.
 *   - Unhealthy source (failing / blocked / exhausted) → skipped
 *     unless this is a freshness check on a slower cadence.
 *   - Queue fill cap per tick — caller-configurable, prevents one
 *     cron tick from creating thousands of rows at once.
 *   - Per-content-type queue cap — no single bucket (parishes!) can
 *     starve the others.
 *   - Daily ingestion caps per source / per content type.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { getBacklogProgress } from "../scheduler";
import { isContentTypePaused } from "../../data/content-type-pause";
import { enqueueJob } from "./queue";
import { PRIORITY_CONTENT_THRESHOLD_UNMET, PRIORITY_NORMAL, PRIORITY_MAINTENANCE } from "./queue";
import { sendThresholdCheckFailedWarning } from "../../data/admin-notifications";
import { computeBalanceDecision, effectiveContentTypeCap, effectiveSourceCap } from "./balance";

export type PlannerSummary = {
  jobsScanned: number;
  jobsEnqueued: number;
  jobsSkippedAlreadyQueued: number;
  jobsSkippedSourcePaused: number;
  jobsSkippedJobPaused: number;
  jobsSkippedContentTypePaused: number;
  jobsSkippedSourceUnhealthy: number;
  jobsSkippedSourceExhausted: number;
  jobsSkippedDailyCap: number;
  jobsSkippedFillCap: number;
  promotedToConstant: number;
  assignedToMaintenance: number;
  mode: "constant" | "maintenance";
  dbError: boolean;
  errorMessage?: string;
};

const DEFAULT_FILL_CAP = 200;
const DEFAULT_PER_CONTENT_TYPE_CAP = 60;
const DEFAULT_PER_SOURCE_CAP = 10;
const DEFAULT_DAILY_PER_SOURCE = 5_000;
const DEFAULT_DAILY_PER_CONTENT_TYPE = 50_000;

/** Tier-aware priority + source-health-aware demotion + quality-score bonus. */
function priorityForJob(args: {
  mode: "constant" | "maintenance";
  contentTypeBelowTarget: boolean;
  tier: number | null | undefined;
  healthState: string | null | undefined;
  qualityScore?: number | null;
}): number {
  // Sources flagged as failing / low_quality get demoted regardless
  // of tier so a "blocked" tier-1 source can't camp at the front of
  // the queue. Blocked sources are filtered out entirely in the
  // planner loop; this handles the other unhealthy states.
  const demotion =
    args.healthState === "failing"
      ? 100
      : args.healthState === "low_quality"
        ? 50
        : args.healthState === "stale"
          ? 25
          : 0;
  // Quality-score bonus: a source with a recent valid-package-rate >
  // 0.85 gets a small priority boost (lower number wins). The
  // multiplier maxes at -20 for a perfect-record source.
  const qualityBonus =
    args.qualityScore != null && args.qualityScore > 0.85 ? -Math.round(args.qualityScore * 20) : 0;
  if (args.mode === "maintenance" && !args.contentTypeBelowTarget) {
    return PRIORITY_MAINTENANCE + demotion + qualityBonus;
  }
  if (args.contentTypeBelowTarget) {
    // Tier 1 sources jump to the front of the queue; tier 2 gets normal
    // priority; tier 3 gets demoted slightly so trusted sources fill the
    // catalog first when thresholds are unmet.
    const base = args.tier === 1 ? PRIORITY_CONTENT_THRESHOLD_UNMET : args.tier === 2 ? 30 : 60;
    return base + demotion + qualityBonus;
  }
  return PRIORITY_NORMAL + demotion + qualityBonus;
}

function isContentTypeBelowTarget(
  contentType: string | null,
  counts: Awaited<ReturnType<typeof getBacklogProgress>>["counts"],
  targets: Awaited<ReturnType<typeof getBacklogProgress>>["targets"],
): boolean {
  if (!counts || !contentType) return false;
  const map: Record<string, number> = {
    Prayer: counts.prayers,
    Saint: counts.saints,
    Parish: counts.parishes,
    LiturgyEntry: counts.churchDocuments,
    SpiritualLifeGuide: Math.max(counts.sacraments, counts.consecrations),
  };
  const targetMap: Record<string, number> = {
    Prayer: targets.prayers,
    Saint: targets.saints,
    Parish: targets.parishes,
    LiturgyEntry: targets.churchDocuments,
    SpiritualLifeGuide: targets.sacraments + targets.consecrations,
  };
  if (!(contentType in map)) return false;
  return map[contentType] < targetMap[contentType];
}

async function dailyCounter(
  sourceId: string | null,
  contentType: string | null,
  now: Date = new Date(),
): Promise<{ enqueued: number }> {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const row = await prisma.dailyIngestionCounter.findUnique({
    where: {
      day_sourceId_contentType: {
        day,
        sourceId: sourceId ?? "",
        contentType: contentType ?? "",
      },
    },
  });
  return { enqueued: row?.enqueued ?? 0 };
}

async function incrementDailyCounter(
  sourceId: string | null,
  contentType: string | null,
  now: Date = new Date(),
): Promise<void> {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await prisma.dailyIngestionCounter.upsert({
    where: {
      day_sourceId_contentType: {
        day,
        sourceId: sourceId ?? "",
        contentType: contentType ?? "",
      },
    },
    create: { day, sourceId: sourceId ?? "", contentType: contentType ?? "", enqueued: 1 },
    update: { enqueued: { increment: 1 } },
  });
}

/**
 * Build a stable dedupe key for a planner-enqueued row. The key
 * captures the inputs the planner reads, so two planner ticks
 * scheduling the same work converge on the same active row.
 */
function buildDedupeKey(args: {
  jobId: string;
  sourceId: string;
  adapterKey: string;
  contentType: string | null;
  mode: "constant" | "maintenance";
}): string {
  return [
    "ingest",
    args.jobId,
    args.sourceId,
    args.adapterKey,
    args.contentType ?? "any",
    args.mode,
  ].join("|");
}

export type PlannerOptions = {
  /** Maximum rows enqueued in a single tick. Default 200. */
  fillCap?: number;
  /** Max queued per content type per tick. Default 60. */
  perContentTypeCap?: number;
  /** Max queued per source per tick. Default 10. */
  perSourceCap?: number;
  /** Daily ingestion ceiling per source. Default 5000. */
  dailyPerSource?: number;
  /** Daily ingestion ceiling per content type. Default 50000. */
  dailyPerContentType?: number;
  /** Override the current time (tests only). */
  now?: Date;
};

/**
 * The cron route calls this on every tick. It walks every active
 * IngestionJob, decides priority via backlog progress, and enqueues
 * the right rows into `IngestionJobQueue`.
 */
export async function enqueueDueIngestionJobs(
  options: PlannerOptions = {},
): Promise<PlannerSummary> {
  const fillCap = options.fillCap ?? DEFAULT_FILL_CAP;
  const perContentTypeCap = options.perContentTypeCap ?? DEFAULT_PER_CONTENT_TYPE_CAP;
  const perSourceCap = options.perSourceCap ?? DEFAULT_PER_SOURCE_CAP;
  const dailyPerSource = options.dailyPerSource ?? DEFAULT_DAILY_PER_SOURCE;
  const dailyPerContentType = options.dailyPerContentType ?? DEFAULT_DAILY_PER_CONTENT_TYPE;
  const now = options.now ?? new Date();

  // ── Mode + safety: count, but never crash. DB error → constant mode.
  const progress = await getBacklogProgress();
  if (progress.dbError) {
    logger.warn("ingestion.planner.threshold_check_failed", {
      errorMessage: progress.errorMessage,
    });
    await sendThresholdCheckFailedWarning(progress.errorMessage ?? "unknown").catch((e) => {
      logger.warn("ingestion.planner.warning_send_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    });
  }
  const mode = progress.mode;

  const summary: PlannerSummary = {
    jobsScanned: 0,
    jobsEnqueued: 0,
    jobsSkippedAlreadyQueued: 0,
    jobsSkippedSourcePaused: 0,
    jobsSkippedJobPaused: 0,
    jobsSkippedContentTypePaused: 0,
    jobsSkippedSourceUnhealthy: 0,
    jobsSkippedSourceExhausted: 0,
    jobsSkippedDailyCap: 0,
    jobsSkippedFillCap: 0,
    promotedToConstant: 0,
    assignedToMaintenance: 0,
    mode,
    dbError: progress.dbError,
    errorMessage: progress.errorMessage,
  };

  const jobs = await prisma.ingestionJob.findMany({
    where: { isActive: true },
    include: { source: true },
    orderBy: [{ source: { tier: "asc" } }, { jobName: "asc" }],
  });
  summary.jobsScanned = jobs.length;

  // Dynamic content-type + source balancing. Throttles dominant
  // buckets, boosts under-target buckets. Read once per tick.
  const balance = await computeBalanceDecision({
    baseContentTypeCap: perContentTypeCap,
    baseSourceCap: perSourceCap,
  }).catch(() => ({
    contentTypeCap: {},
    sourceCap: {},
    underservedContentTypes: [] as string[],
    completionPct: {},
    dominantSources: [] as string[],
  }));

  const perContentTypeCount = new Map<string, number>();
  const perSourceCount = new Map<string, number>();

  // Pre-load active queue rows by jobName (for legacy dedupe path).
  const activeRows = await prisma.ingestionJobQueue.findMany({
    where: { status: { in: ["pending", "running", "retrying"] } },
    select: { jobName: true, dedupeKey: true, contentType: true, sourceId: true },
  });
  const activeByDedupe = new Set(activeRows.map((r) => r.dedupeKey).filter(Boolean) as string[]);
  for (const r of activeRows) {
    if (r.contentType) {
      perContentTypeCount.set(r.contentType, (perContentTypeCount.get(r.contentType) ?? 0) + 1);
    }
    if (r.sourceId) {
      perSourceCount.set(r.sourceId, (perSourceCount.get(r.sourceId) ?? 0) + 1);
    }
  }

  for (const job of jobs) {
    if (summary.jobsEnqueued >= fillCap) {
      summary.jobsSkippedFillCap += 1;
      continue;
    }

    // Pause checks: source, job, content type.
    if (job.source.pausedAt) {
      summary.jobsSkippedSourcePaused += 1;
      continue;
    }
    if (job.pausedAt) {
      summary.jobsSkippedJobPaused += 1;
      continue;
    }
    const ctPause = await isContentTypePaused(job.targetEntity);
    if (ctPause.paused) {
      summary.jobsSkippedContentTypePaused += 1;
      continue;
    }

    // Health: skip failing / blocked / low_quality unless we're in
    // constant mode AND the content type is below target — in that
    // case we still try a freshness check, not a full ingest.
    const health = job.source.healthState;
    if (health === "blocked") {
      summary.jobsSkippedSourceUnhealthy += 1;
      continue;
    }
    if (job.source.exhaustedAt) {
      summary.jobsSkippedSourceExhausted += 1;
      continue;
    }

    // Caps: per-content-type, per-source, daily — with dynamic
    // content-type balancing layered on top of the static caps.
    // Dominant types/sources get throttled, underserved types get
    // their cap raised.
    const ctKey = job.targetEntity;
    const ctCap = effectiveContentTypeCap(balance, ctKey, perContentTypeCap);
    const srcCap = effectiveSourceCap(balance, job.sourceId, perSourceCap);
    if ((perContentTypeCount.get(ctKey) ?? 0) >= ctCap) {
      summary.jobsSkippedFillCap += 1;
      continue;
    }
    if ((perSourceCount.get(job.sourceId) ?? 0) >= srcCap) {
      summary.jobsSkippedFillCap += 1;
      continue;
    }
    const dailySource = await dailyCounter(job.sourceId, null, now).catch(() => ({ enqueued: 0 }));
    if (dailySource.enqueued >= dailyPerSource) {
      summary.jobsSkippedDailyCap += 1;
      continue;
    }
    const dailyCt = await dailyCounter(null, ctKey, now).catch(() => ({ enqueued: 0 }));
    if (dailyCt.enqueued >= dailyPerContentType) {
      summary.jobsSkippedDailyCap += 1;
      continue;
    }

    const belowTarget =
      !progress.dbError && isContentTypeBelowTarget(ctKey, progress.counts, progress.targets);
    const underserved = balance.underservedContentTypes.includes(ctKey);
    // DB error → never downgrade. We force "constant" semantics
    // regardless of mode here.
    const effectiveMode: "constant" | "maintenance" = progress.dbError ? "constant" : mode;
    // Read the SourceQualityScore for this (source, contentType) pair
    // so good performers get a small priority bonus and bad performers
    // get nothing (plus already-paused sources have been filtered).
    const qualityScore = await Promise.resolve(
      prisma.sourceQualityScore.findUnique({
        where: { sourceId_contentType: { sourceId: job.sourceId, contentType: ctKey } },
      }),
    ).catch(() => null);
    const qualityRate = qualityScore?.validPackageRate ?? null;
    let priority = priorityForJob({
      mode: effectiveMode,
      contentTypeBelowTarget: belowTarget || progress.dbError || underserved,
      tier: job.source.tier,
      healthState: job.source.healthState,
      qualityScore: qualityRate,
    });
    // Underserved bucket below 25% of target → bump priority one band
    // lower (lower number = higher priority) so it preempts dominant
    // buckets even when the planner already chose normal priority.
    // BUT do not bypass source-health demotion: spec says "If one
    // content type is below threshold but producing mostly invalid
    // rows, reduce bad sources and promote better sources." So we
    // only boost healthy / low_quality sources, never failing /
    // blocked ones.
    const healthState = job.source.healthState;
    const sourceHealthy = healthState !== "failing" && healthState !== "blocked";
    if (underserved && sourceHealthy) {
      priority = Math.min(priority, PRIORITY_CONTENT_THRESHOLD_UNMET);
    }

    const dedupeKey = buildDedupeKey({
      jobId: job.id,
      sourceId: job.sourceId,
      adapterKey: job.jobName,
      contentType: ctKey,
      mode: effectiveMode,
    });
    if (activeByDedupe.has(dedupeKey)) {
      summary.jobsSkippedAlreadyQueued += 1;
      continue;
    }

    try {
      await enqueueJob({
        jobName: job.jobName,
        jobKind: effectiveMode === "maintenance" ? "source_freshness" : "source_ingest",
        dedupeKey,
        sourceId: job.sourceId,
        jobId: job.id,
        contentType: ctKey,
        priority,
        payload: {
          sourceId: job.sourceId,
          adapterKey: job.jobName,
          contentType: ctKey,
          mode: effectiveMode,
        },
        triggeredBy: "automatic",
      });
      activeByDedupe.add(dedupeKey);
      perContentTypeCount.set(ctKey, (perContentTypeCount.get(ctKey) ?? 0) + 1);
      perSourceCount.set(job.sourceId, (perSourceCount.get(job.sourceId) ?? 0) + 1);
      await incrementDailyCounter(job.sourceId, null, now).catch(() => undefined);
      await incrementDailyCounter(null, ctKey, now).catch(() => undefined);
      summary.jobsEnqueued += 1;
      if (priority <= PRIORITY_NORMAL) summary.promotedToConstant += 1;
      else summary.assignedToMaintenance += 1;
    } catch (e) {
      logger.warn("ingestion.planner.enqueue_failed", {
        jobName: job.jobName,
        sourceId: job.sourceId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  logger.info("ingestion.planner.completed", summary);
  return summary;
}

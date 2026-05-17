/**
 * Automatic content-type balancing for the durable queue planner.
 *
 * The planner already enforces per-content-type and per-source caps,
 * but those caps are static. This module computes *dynamic* caps
 * based on the current queue distribution + content type progress
 * toward thresholds, so:
 *
 *   - When parishes dominate the queue, parish jobs are throttled so
 *     prayers / saints / sacraments / devotions / history can grow.
 *   - When a single source dominates the queue, that source is
 *     throttled.
 *   - When a content type is far below threshold, its cap is raised
 *     and its priority is bumped.
 *
 * Returns a `BalanceDecision` the planner consults before enqueueing.
 */

import { prisma } from "../../db/client";
import { appConfig } from "../../config";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../../content-qa/thresholds";

export type BalanceDecision = {
  /**
   * Effective per-content-type caps (jobs allowed in the active queue
   * for this content type after balancing).
   */
  contentTypeCap: Record<string, number>;
  /** Effective per-source caps after balancing. */
  sourceCap: Record<string, number>;
  /**
   * Content types currently far below threshold. The planner can bump
   * their priority on enqueue.
   */
  underservedContentTypes: ReadonlyArray<string>;
  /**
   * Per-content-type completion percentage (0–1). Surfaced in
   * planner logs for observability.
   */
  completionPct: Record<string, number>;
  /** Sources that currently dominate the active queue. */
  dominantSources: ReadonlyArray<string>;
};

const DEFAULT_BASE_CT_CAP = 60;
const DEFAULT_BASE_SOURCE_CAP = 10;
const SOURCE_DOMINANCE_FRACTION = 0.4;
const CONTENT_TYPE_DOMINANCE_FRACTION = 0.5;
const UNDERSERVED_PCT_THRESHOLD = 0.25;
const UNDERSERVED_BOOST_FACTOR = 2;
const DOMINANT_PENALTY_FACTOR = 0.25;

/**
 * Compute the per-content-type and per-source caps the planner should
 * use on this tick. Inputs are read live from the queue + catalog
 * tables.
 */
export async function computeBalanceDecision(
  args: {
    baseContentTypeCap?: number;
    baseSourceCap?: number;
  } = {},
): Promise<BalanceDecision> {
  const baseCt = args.baseContentTypeCap ?? DEFAULT_BASE_CT_CAP;
  const baseSrc = args.baseSourceCap ?? DEFAULT_BASE_SOURCE_CAP;

  // Active queue distribution.
  const activeByCt = await prisma.ingestionJobQueue
    .groupBy({
      by: ["contentType"],
      where: { status: { in: ["pending", "running", "retrying"] } },
      _count: { _all: true },
    })
    .catch(() => [] as Array<{ contentType: string | null; _count?: { _all: number } }>);
  const activeBySrc = await prisma.ingestionJobQueue
    .groupBy({
      by: ["sourceId"],
      where: { status: { in: ["pending", "running", "retrying"] } },
      _count: { _all: true },
    })
    .catch(() => [] as Array<{ sourceId: string | null; _count?: { _all: number } }>);

  const totalActive = activeByCt.reduce((s, r) => s + (r._count?._all ?? 0), 0) || 1;
  const ctShare: Record<string, number> = {};
  for (const r of activeByCt) {
    if (!r.contentType) continue;
    ctShare[r.contentType] = (r._count?._all ?? 0) / totalActive;
  }
  const srcShare: Record<string, number> = {};
  for (const r of activeBySrc) {
    if (!r.sourceId) continue;
    srcShare[r.sourceId] = (r._count?._all ?? 0) / totalActive;
  }

  // Completion percentages against configured targets. We treat the
  // strict valid count (not raw rows) as the real progress signal.
  const targets = appConfig.ingestion.targets;
  const completionPct: Record<string, number> = {};
  const [prayers, saints, parishes] = await Promise.all([
    prisma.prayer.count({ where: STRICT_PUBLIC_WHERE_CLAUSE }).catch(() => 0),
    prisma.saint.count({ where: STRICT_PUBLIC_WHERE_CLAUSE }).catch(() => 0),
    prisma.parish.count({ where: STRICT_PUBLIC_WHERE_CLAUSE }).catch(() => 0),
  ]);
  completionPct.Prayer = Math.min(1, prayers / Math.max(1, targets.prayers));
  completionPct.Saint = Math.min(1, saints / Math.max(1, targets.saints));
  completionPct.Parish = Math.min(1, parishes / Math.max(1, targets.parishes));

  // Underserved content types (far below threshold) get a 2× cap boost.
  const underserved: string[] = [];
  for (const [ct, pct] of Object.entries(completionPct)) {
    if (pct < UNDERSERVED_PCT_THRESHOLD) underserved.push(ct);
  }

  // Dominant content types / sources get a 0.25× cap reduction.
  const contentTypeCap: Record<string, number> = {};
  for (const [ct, share] of Object.entries(ctShare)) {
    if (share > CONTENT_TYPE_DOMINANCE_FRACTION) {
      contentTypeCap[ct] = Math.round(baseCt * DOMINANT_PENALTY_FACTOR);
    }
  }
  for (const ct of underserved) {
    contentTypeCap[ct] = Math.round(baseCt * UNDERSERVED_BOOST_FACTOR);
  }

  const dominantSources: string[] = [];
  const sourceCap: Record<string, number> = {};
  for (const [src, share] of Object.entries(srcShare)) {
    if (share > SOURCE_DOMINANCE_FRACTION) {
      dominantSources.push(src);
      sourceCap[src] = Math.round(baseSrc * DOMINANT_PENALTY_FACTOR);
    }
  }

  return {
    contentTypeCap,
    sourceCap,
    underservedContentTypes: underserved,
    completionPct,
    dominantSources,
  };
}

/**
 * Resolve the effective per-content-type cap for `ctKey`, considering
 * the balance decision. Returns the balance-adjusted cap when set,
 * otherwise the planner's default.
 */
export function effectiveContentTypeCap(
  decision: BalanceDecision,
  ctKey: string,
  defaultCap: number,
): number {
  return decision.contentTypeCap[ctKey] ?? defaultCap;
}

/**
 * Resolve the effective per-source cap for `sourceId`. Used by the
 * planner the same way as `effectiveContentTypeCap`.
 */
export function effectiveSourceCap(
  decision: BalanceDecision,
  sourceId: string,
  defaultCap: number,
): number {
  return decision.sourceCap[sourceId] ?? defaultCap;
}

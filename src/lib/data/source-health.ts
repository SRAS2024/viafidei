/**
 * Source freshness, health, and tier management.
 *
 * Each IngestionSource row tracks:
 *   - lastSuccessfulSync   — last fetch that returned data
 *   - lastFailedSync       — last fetch that errored
 *   - lastContentUpdateAt  — last detected content change (checksum diff)
 *   - lastHttpStatus       — most recent upstream HTTP status code
 *   - lastEtag             — most recent ETag for conditional GETs
 *   - lastModifiedHeader   — most recent Last-Modified header
 *   - tier                 — 1 (official Church) / 2 (publishers) / 3 (other)
 *   - healthState          — active / stale / failing / blocked / exhausted /
 *                            low_quality / paused (string, not enum, so the
 *                            scheduler can introduce new labels without a
 *                            migration)
 *   - consecutiveFailures  — incremented on each failure, reset on success
 *   - lowQualityRatio      — share of recent items that fell to REVIEW or REJECT
 *   - pausedAt / pausedReason — admin pause toggle
 *
 * `recordSourceFreshness` is called by the worker after each adapter
 * run. The health label is recomputed eagerly so the dashboard always
 * reflects the latest signal.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

const FAILURES_BEFORE_FAILING = 3;
const STALE_DAYS = 21;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const LOW_QUALITY_THRESHOLD = 0.6;

export type SourceFreshnessSignal = {
  ok: boolean;
  httpStatus?: number | null;
  etag?: string | null;
  lastModified?: string | null;
  /** True when the adapter detected at least one content update. */
  contentChanged?: boolean;
  /** Most recent error message — only used when ok === false. */
  errorMessage?: string | null;
  /** When true, source has explicitly marked itself exhausted (no more pages). */
  exhausted?: boolean;
  /** When true, source returned 403/451 — treat as blocked. */
  blocked?: boolean;
};

export type SourceHealthLabel =
  | "active"
  | "stale"
  | "failing"
  | "blocked"
  | "exhausted"
  | "low_quality"
  | "paused";

/** Idempotent freshness update — safe to call even if `sourceId` is null. */
export async function recordSourceFreshness(
  sourceId: string | null | undefined,
  signal: SourceFreshnessSignal,
  now: Date = new Date(),
): Promise<void> {
  if (!sourceId) return;
  try {
    const source = await prisma.ingestionSource.findUnique({ where: { id: sourceId } });
    if (!source) return;
    const consecutiveFailures = signal.ok ? 0 : source.consecutiveFailures + 1;
    const lastSuccessfulSync = signal.ok ? now : source.lastSuccessfulSync;
    const lastFailedSync = signal.ok ? source.lastFailedSync : now;
    const lastContentUpdateAt = signal.contentChanged ? now : source.lastContentUpdateAt;
    const healthState: SourceHealthLabel = source.pausedAt
      ? "paused"
      : signal.blocked
        ? "blocked"
        : signal.exhausted
          ? "exhausted"
          : !signal.ok && consecutiveFailures >= FAILURES_BEFORE_FAILING
            ? "failing"
            : signal.ok &&
                lastContentUpdateAt &&
                now.getTime() - lastContentUpdateAt.getTime() > STALE_MS
              ? "stale"
              : signal.ok && (source.lowQualityRatio ?? 0) >= LOW_QUALITY_THRESHOLD
                ? "low_quality"
                : "active";
    await prisma.ingestionSource.update({
      where: { id: sourceId },
      data: {
        lastSuccessfulSync,
        lastFailedSync,
        lastContentUpdateAt,
        lastHttpStatus: signal.httpStatus ?? source.lastHttpStatus,
        lastEtag: signal.etag ?? source.lastEtag,
        lastModifiedHeader: signal.lastModified ?? source.lastModifiedHeader,
        consecutiveFailures,
        healthState,
      },
    });
  } catch (e) {
    logger.warn("source.health.update_failed", {
      sourceId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Update the rolling low-quality ratio for a source. */
export async function recordSourceQuality(
  sourceId: string,
  observation: { totalItems: number; reviewOrRejected: number },
): Promise<void> {
  if (observation.totalItems <= 0) return;
  const ratio = observation.reviewOrRejected / observation.totalItems;
  try {
    const source = await prisma.ingestionSource.findUnique({ where: { id: sourceId } });
    if (!source) return;
    // Smooth with the previous value so a single bad run does not flip the label.
    const prior = source.lowQualityRatio ?? 0;
    const blended = prior === 0 ? ratio : prior * 0.7 + ratio * 0.3;
    await prisma.ingestionSource.update({
      where: { id: sourceId },
      data: {
        lowQualityRatio: blended,
        healthState:
          blended >= LOW_QUALITY_THRESHOLD && !source.pausedAt ? "low_quality" : source.healthState,
      },
    });
  } catch (e) {
    logger.warn("source.health.quality_update_failed", {
      sourceId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function pauseSource(
  sourceId: string,
  reason: string,
  actorUsername?: string | null,
): Promise<void> {
  await prisma.ingestionSource.update({
    where: { id: sourceId },
    data: {
      pausedAt: new Date(),
      pausedReason: reason,
      healthState: "paused",
    },
  });
  logger.info("source.paused", { sourceId, reason, actorUsername });
}

export async function resumeSource(sourceId: string): Promise<void> {
  await prisma.ingestionSource.update({
    where: { id: sourceId },
    data: {
      pausedAt: null,
      pausedReason: null,
      healthState: "active",
    },
  });
  logger.info("source.resumed", { sourceId });
}

export type SourceHealthRow = {
  id: string;
  name: string;
  host: string;
  tier: number;
  isOfficial: boolean;
  healthState: string;
  lastSuccessfulSync: Date | null;
  lastFailedSync: Date | null;
  lastContentUpdateAt: Date | null;
  lastHttpStatus: number | null;
  consecutiveFailures: number;
  lowQualityRatio: number | null;
  pausedAt: Date | null;
  pausedReason: string | null;
};

export async function listSourceHealth(): Promise<SourceHealthRow[]> {
  const rows = await prisma.ingestionSource.findMany({
    orderBy: [{ tier: "asc" }, { name: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    host: s.host,
    tier: s.tier,
    isOfficial: s.isOfficial,
    healthState: s.healthState,
    lastSuccessfulSync: s.lastSuccessfulSync,
    lastFailedSync: s.lastFailedSync,
    lastContentUpdateAt: s.lastContentUpdateAt,
    lastHttpStatus: s.lastHttpStatus,
    consecutiveFailures: s.consecutiveFailures,
    lowQualityRatio: s.lowQualityRatio,
    pausedAt: s.pausedAt,
    pausedReason: s.pausedReason,
  }));
}

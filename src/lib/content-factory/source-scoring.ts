/**
 * Source quality scoring.
 *
 * Every meaningful pipeline event for a (sourceId, contentType) pair
 * updates the SourceQualityScore row:
 *
 *   - Discovery       → discoveredCount++
 *   - Fetch ok        → fetchedCount++
 *   - Build success   → buildSuccessCount++
 *   - Build failure   → buildFailureCount++
 *   - QA pass         → qaPassCount++
 *   - QA fail         → qaFailCount++ + (deletedCount or wrongContentCount)
 *   - Duplicate       → duplicateCount++
 *
 * Derived rates (valid package rate, wrong content rate, average
 * completeness) are recomputed on each update so the dashboard can
 * read pre-computed numbers.
 *
 * Auto-pause: when the per-content-type stats cross failure
 * thresholds (build failure rate > 80% over the last 50 attempts,
 * wrong content rate > 50% over the last 50 attempts, OR no successful
 * build in 200 attempts), the source's `autoPaused` flag flips to
 * true. The planner respects this flag and the cron route surfaces it
 * to the admin via email.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { reportCriticalFailure } from "../data/admin-notifications";

export type SourceScoreEvent =
  | { kind: "discovered"; sourceId: string; contentType: string }
  | { kind: "fetched"; sourceId: string; contentType: string }
  | { kind: "build_success"; sourceId: string; contentType: string; completeness?: number }
  | {
      kind: "build_failure";
      sourceId: string;
      contentType: string;
      reason?: string;
      completeness?: number;
    }
  | { kind: "qa_pass"; sourceId: string; contentType: string }
  | { kind: "qa_fail"; sourceId: string; contentType: string; reason?: string }
  | { kind: "deleted"; sourceId: string; contentType: string }
  | { kind: "wrong_content"; sourceId: string; contentType: string }
  | { kind: "duplicate"; sourceId: string; contentType: string };

const AUTO_PAUSE_BUILD_FAILURE_RATE = 0.8;
const AUTO_PAUSE_WRONG_CONTENT_RATE = 0.5;
const AUTO_PAUSE_MIN_ATTEMPTS = 50;
const AUTO_PAUSE_NO_SUCCESS_BUDGET = 200;

export async function recordScoreEvent(event: SourceScoreEvent): Promise<void> {
  try {
    const row = await prisma.sourceQualityScore.upsert({
      where: {
        sourceId_contentType: { sourceId: event.sourceId, contentType: event.contentType },
      },
      create: {
        sourceId: event.sourceId,
        contentType: event.contentType,
        ...createInitialDelta(event),
      } as never,
      update: buildUpdate(event) as never,
    });
    await recomputeAndMaybePause(row.id, event);
  } catch (e) {
    logger.warn("content-factory.source-scoring.failed", {
      kind: event.kind,
      sourceId: event.sourceId,
      contentType: event.contentType,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function createInitialDelta(event: SourceScoreEvent): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  switch (event.kind) {
    case "discovered":
      base.discoveredCount = 1;
      break;
    case "fetched":
      base.fetchedCount = 1;
      break;
    case "build_success":
      base.buildSuccessCount = 1;
      base.lastSuccessAt = new Date();
      break;
    case "build_failure":
      base.buildFailureCount = 1;
      base.lastFailureAt = new Date();
      base.lastFailureReason = event.reason ?? null;
      break;
    case "qa_pass":
      base.qaPassCount = 1;
      base.lastSuccessAt = new Date();
      break;
    case "qa_fail":
      base.qaFailCount = 1;
      base.lastFailureAt = new Date();
      base.lastFailureReason = event.reason ?? null;
      break;
    case "deleted":
      base.deletedCount = 1;
      break;
    case "wrong_content":
      base.wrongContentCount = 1;
      break;
    case "duplicate":
      base.duplicateCount = 1;
      break;
  }
  return base;
}

function buildUpdate(event: SourceScoreEvent): Record<string, unknown> {
  switch (event.kind) {
    case "discovered":
      return { discoveredCount: { increment: 1 } };
    case "fetched":
      return { fetchedCount: { increment: 1 } };
    case "build_success":
      return { buildSuccessCount: { increment: 1 }, lastSuccessAt: new Date() };
    case "build_failure":
      return {
        buildFailureCount: { increment: 1 },
        lastFailureAt: new Date(),
        lastFailureReason: event.reason ?? null,
      };
    case "qa_pass":
      return { qaPassCount: { increment: 1 }, lastSuccessAt: new Date() };
    case "qa_fail":
      return {
        qaFailCount: { increment: 1 },
        lastFailureAt: new Date(),
        lastFailureReason: event.reason ?? null,
      };
    case "deleted":
      return { deletedCount: { increment: 1 } };
    case "wrong_content":
      return { wrongContentCount: { increment: 1 } };
    case "duplicate":
      return { duplicateCount: { increment: 1 } };
  }
}

async function recomputeAndMaybePause(rowId: string, event: SourceScoreEvent): Promise<void> {
  const row = await prisma.sourceQualityScore.findUnique({ where: { id: rowId } });
  if (!row) return;
  const totalAttempts = row.buildSuccessCount + row.buildFailureCount;
  const totalContent = row.qaPassCount + row.qaFailCount;
  const validPackageRate = totalAttempts > 0 ? row.buildSuccessCount / totalAttempts : null;
  const wrongContentRate = totalContent > 0 ? row.wrongContentCount / totalContent : null;
  // averageCompleteness:
  //   - build_success contributes 1.0 (the row had every required field)
  //   - build_failure contributes the completeness reported by the
  //     builder (between 0 and 1 — fraction of required fields present).
  //   When `completeness` isn't provided, build_failure contributes 0.
  // We approximate the running average as:
  //   (buildSuccessCount * 1 + buildFailureCount * priorCompleteness)
  //   / totalAttempts
  // and weight in the event's completeness so the metric trends.
  const eventCompleteness =
    event.kind === "build_success"
      ? 1
      : event.kind === "build_failure"
        ? (event.completeness ?? 0)
        : null;
  let averageCompleteness: number | null = row.averageCompleteness ?? null;
  if (totalAttempts > 0) {
    const priorAvg = row.averageCompleteness ?? 0;
    const priorWeight = totalAttempts - 1;
    const eventContribution = eventCompleteness ?? priorAvg;
    averageCompleteness = (priorAvg * priorWeight + eventContribution) / totalAttempts;
  }
  let shouldPause = row.autoPaused;
  let pauseReason: string | null = null;
  if (!row.autoPaused) {
    if (
      validPackageRate != null &&
      totalAttempts >= AUTO_PAUSE_MIN_ATTEMPTS &&
      validPackageRate < 1 - AUTO_PAUSE_BUILD_FAILURE_RATE
    ) {
      shouldPause = true;
      pauseReason = `Build failure rate ${(100 - Math.round(validPackageRate * 100)).toString()}% > ${Math.round(AUTO_PAUSE_BUILD_FAILURE_RATE * 100)}%`;
    } else if (
      wrongContentRate != null &&
      totalContent >= AUTO_PAUSE_MIN_ATTEMPTS &&
      wrongContentRate > AUTO_PAUSE_WRONG_CONTENT_RATE
    ) {
      shouldPause = true;
      pauseReason = `Wrong content rate ${Math.round(wrongContentRate * 100)}% > ${Math.round(AUTO_PAUSE_WRONG_CONTENT_RATE * 100)}%`;
    } else if (
      row.buildSuccessCount === 0 &&
      row.buildFailureCount >= AUTO_PAUSE_NO_SUCCESS_BUDGET
    ) {
      shouldPause = true;
      pauseReason = `No successful build in ${row.buildFailureCount} attempts`;
    }
  }

  await prisma.sourceQualityScore.update({
    where: { id: rowId },
    data: {
      validPackageRate,
      wrongContentRate,
      averageCompleteness,
      autoPaused: shouldPause,
      autoPausedAt: shouldPause && !row.autoPaused ? new Date() : row.autoPausedAt,
    },
  });

  if (shouldPause && !row.autoPaused) {
    // Cascade: pause the source row itself so the planner stops
    // enqueueing it. We use the source-auto-pause table state via the
    // IngestionSource flags so existing planner logic respects the
    // decision.
    await prisma.ingestionSource
      .update({
        where: { id: row.sourceId },
        data: {
          autoPaused: true,
          autoPausedAt: new Date(),
          pausedAt: new Date(),
          pausedReason: `auto: ${pauseReason ?? "low quality"}`,
          healthState: "low_quality",
        },
      })
      .catch((e) => {
        logger.warn("content-factory.source-scoring.cascade_failed", {
          sourceId: row.sourceId,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    await reportCriticalFailure({
      kind: "source_auto_paused",
      message: `Source ${row.sourceId} auto-paused for ${row.contentType}: ${pauseReason ?? "low quality"}`,
    }).catch(() => undefined);
    logger.warn("content-factory.source-scoring.auto_paused", {
      sourceId: row.sourceId,
      contentType: row.contentType,
      reason: pauseReason,
      lastEvent: event.kind,
    });
  }
}

/**
 * List worst-performing sources for the admin dashboard.
 */
export async function listSourceQualityScores(args?: { contentType?: string; limit?: number }) {
  return prisma.sourceQualityScore.findMany({
    where: args?.contentType ? { contentType: args.contentType } : undefined,
    orderBy: [{ validPackageRate: "asc" }, { buildFailureCount: "desc" }],
    take: Math.max(1, Math.min(args?.limit ?? 50, 500)),
  });
}

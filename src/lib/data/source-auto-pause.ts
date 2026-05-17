/**
 * Automatic source pausing. When a source's failure ratio or
 * low-quality ratio crosses a threshold, the system pauses it and
 * emails the admin. The admin can resume manually from the source
 * health dashboard.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { readAdminEmail, sendCriticalFailureAlert } from "../email";

const FAILURE_THRESHOLD = 8;
const LOW_QUALITY_RATIO_THRESHOLD = 0.7;

export async function autoEvaluateSourcePauses(): Promise<{ paused: string[] }> {
  const candidates = await prisma.ingestionSource.findMany({
    where: {
      OR: [
        { consecutiveFailures: { gte: FAILURE_THRESHOLD } },
        { lowQualityRatio: { gte: LOW_QUALITY_RATIO_THRESHOLD } },
      ],
      pausedAt: null,
    },
  });
  const paused: string[] = [];
  for (const s of candidates) {
    const reason =
      s.consecutiveFailures >= FAILURE_THRESHOLD
        ? `Auto-paused after ${s.consecutiveFailures} consecutive failures`
        : `Auto-paused — low-quality ratio ${(s.lowQualityRatio ?? 0).toFixed(2)} exceeded ${LOW_QUALITY_RATIO_THRESHOLD}`;
    try {
      await prisma.ingestionSource.update({
        where: { id: s.id },
        data: {
          pausedAt: new Date(),
          pausedReason: reason,
          autoPaused: true,
          autoPausedAt: new Date(),
          healthState: "paused",
        },
      });
      paused.push(s.id);
      logger.warn("source.auto_paused", { sourceId: s.id, name: s.name, reason });
      if (readAdminEmail()) {
        await sendCriticalFailureAlert({
          kind: "source_auto_paused",
          message: `Source ${s.name} (${s.host}) was automatically paused. ${reason}. Resume via /admin/ingestion/health when investigation is complete.`,
        }).catch(() => undefined);
      }
    } catch (e) {
      logger.warn("source.auto_pause_failed", {
        sourceId: s.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { paused };
}

/**
 * Manual resume — clears the auto-pause flag too so the next
 * auto-pause cycle can re-trigger if the underlying problem returns.
 */
export async function resumeAutoPausedSource(sourceId: string): Promise<void> {
  await prisma.ingestionSource.update({
    where: { id: sourceId },
    data: {
      pausedAt: null,
      pausedReason: null,
      autoPaused: false,
      autoPausedAt: null,
      consecutiveFailures: 0,
      healthState: "active",
    },
  });
}

/**
 * Pause-reason classifier: distinguishes temporary failures (worth
 * retrying) from structural failures (leave paused, notify admin).
 *
 *   - Temporary: consecutiveFailures spike, rate-limit / timeout /
 *     5xx blips. Auto-resume eligible once a probe succeeds.
 *   - Structural: low-quality ratio (the source itself produces
 *     mostly noise), blocked by robots.txt, or admin-paused. Stays
 *     paused; admin must investigate.
 */
function isTemporaryPause(s: {
  pausedReason: string | null;
  lowQualityRatio: number | null;
  autoPaused: boolean;
}): boolean {
  if (!s.autoPaused) return false;
  if ((s.lowQualityRatio ?? 0) >= LOW_QUALITY_RATIO_THRESHOLD) return false;
  if (s.pausedReason?.toLowerCase().includes("robot")) return false;
  if (s.pausedReason?.toLowerCase().includes("low-quality")) return false;
  return true;
}

const AUTO_RESUME_PROBE_MIN_AGE_MS = 6 * 60 * 60 * 1000; // 6h
const AUTO_RESUME_PROBE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Lightweight auto-resume probe. For each auto-paused source whose
 * pause reason is temporary AND that was paused at least
 * AUTO_RESUME_PROBE_MIN_AGE_MS ago AND less than
 * AUTO_RESUME_PROBE_MAX_AGE_MS ago, check the recent freshness
 * signal: if `lastSuccessfulSync` advanced since the pause OR if
 * `consecutiveFailures` has dropped to zero, resume the source.
 *
 * Structurally-bad sources (low-quality ratio above threshold,
 * robots.txt blocks, admin-paused) stay paused regardless.
 */
export async function autoResumeRecoveredSources(): Promise<{ resumed: string[] }> {
  const now = new Date();
  const minPausedAt = new Date(now.getTime() - AUTO_RESUME_PROBE_MAX_AGE_MS);
  const maxPausedAt = new Date(now.getTime() - AUTO_RESUME_PROBE_MIN_AGE_MS);
  const candidates = await prisma.ingestionSource.findMany({
    where: {
      autoPaused: true,
      autoPausedAt: { gte: minPausedAt, lte: maxPausedAt },
    },
  });
  const resumed: string[] = [];
  for (const s of candidates) {
    if (!isTemporaryPause(s)) continue;
    // Recovery signal: most-recent successful sync is more recent than
    // the auto-pause timestamp, OR the failure counter has dropped to
    // zero (an external monitor cleared it).
    const recovered =
      (s.lastSuccessfulSync && s.autoPausedAt && s.lastSuccessfulSync > s.autoPausedAt) ||
      s.consecutiveFailures === 0;
    if (!recovered) continue;
    try {
      await prisma.ingestionSource.update({
        where: { id: s.id },
        data: {
          pausedAt: null,
          pausedReason: null,
          autoPaused: false,
          autoPausedAt: null,
          consecutiveFailures: 0,
          healthState: "active",
        },
      });
      resumed.push(s.id);
      logger.info("source.auto_resumed", {
        sourceId: s.id,
        name: s.name,
        previousPauseReason: s.pausedReason,
      });
    } catch (e) {
      logger.warn("source.auto_resume_failed", {
        sourceId: s.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { resumed };
}

/**
 * Find structurally-bad sources that have been paused for a long time
 * and should be notified to the admin one more time. Different from
 * `autoEvaluateSourcePauses` (which fires once on pause) — this is the
 * "still paused after a week" reminder for sources the system can't
 * automatically rescue.
 */
const STRUCTURAL_NOTIFY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function notifyStructurallyBadSources(): Promise<{ notified: string[] }> {
  const cutoff = new Date(Date.now() - STRUCTURAL_NOTIFY_AGE_MS);
  const candidates = await prisma.ingestionSource.findMany({
    where: {
      autoPaused: true,
      autoPausedAt: { lt: cutoff },
      OR: [{ lowQualityRatio: { gte: LOW_QUALITY_RATIO_THRESHOLD } }, { healthState: "blocked" }],
    },
  });
  const notified: string[] = [];
  for (const s of candidates) {
    logger.warn("source.structurally_bad_persists", {
      sourceId: s.id,
      name: s.name,
      lowQualityRatio: s.lowQualityRatio,
      healthState: s.healthState,
    });
    if (readAdminEmail()) {
      await sendCriticalFailureAlert({
        kind: "source_structurally_bad",
        message: `Source ${s.name} (${s.host}) has been auto-paused for over 7 days with no auto-recovery signal. Investigate or remove the source — the auto-resume loop cannot rescue structurally-bad sources.`,
      }).catch(() => undefined);
    }
    notified.push(s.id);
  }
  return { notified };
}

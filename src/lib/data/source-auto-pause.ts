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

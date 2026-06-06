/**
 * Post-pass intelligence (spec: "at the end of every major worker run,
 * generate a developer report ... worker request section").
 *
 * Runs after each worker pass. Best-effort and fail-open: gated on the
 * brain feature flag, wrapped so it can never break the loop, and a no-op
 * when the Python brain is offline. It:
 *   - self-inspects recent failures / blocked actions / pass outcomes and
 *     persists structured developer requests (deduped), and
 *   - computes worker-IQ metrics from the brain-call audit trail + memory.
 *
 * The richer per-decision intelligence (communion screen, duplicate gate,
 * quality scoring) lives at the decision sites themselves; this hook is
 * the periodic self-awareness + reporting layer.
 */

import type { PrismaClient } from "@prisma/client";

import { isBrainEnabled } from "./intelligence";
import {
  applyLearningFromOutcome,
  computeIqMetrics,
  inspectAndRecordRequests,
} from "./intelligence/service";
import { writeAdminWorkerLog } from "./logs";

async function gatherIqStats(prisma: PrismaClient): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};
  try {
    const [dupCandidates, dupPrevented, preventedBadPublishes, learningRecords, published] =
      await Promise.all([
        prisma.adminWorkerBrainCall.count({ where: { op: "detect_duplicates" } }),
        prisma.adminWorkerBrainCall.count({
          where: { op: "detect_duplicates", recommendedNextAction: "block-as-duplicate" },
        }),
        prisma.adminWorkerBrainCall.count({
          where: {
            op: { in: ["score_quality", "detect_communion_risk", "assess_source"] },
            riskLevel: { in: ["high", "critical"] },
          },
        }),
        prisma.adminWorkerMemory.count().catch(() => 0),
        prisma.publishedContent.count().catch(() => 0),
      ]);
    stats.duplicateCandidates = dupCandidates;
    stats.duplicatesPrevented = dupPrevented;
    stats.preventedBadPublishes = preventedBadPublishes;
    stats.learningRecords = learningRecords;
    stats.contentQualityNow = published; // proxy: more published content == more value delivered
  } catch {
    // leave stats partial; iqMetrics tolerates missing keys
  }
  return stats;
}

export async function runPostPassIntelligence(
  prisma: PrismaClient,
  opts: { passId: string; workerId: string },
): Promise<{ ran: boolean; developerRequests: number }> {
  if (!isBrainEnabled()) return { ran: false, developerRequests: 0 };
  try {
    const [errorLogs, blockedLogs, recentPasses] = await Promise.all([
      prisma.adminWorkerLog.findMany({
        where: { severity: { in: ["ERROR", "WARN"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { category: true, eventName: true, message: true },
      }),
      prisma.adminWorkerLog.findMany({
        where: { eventName: { contains: "block" } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { eventName: true, message: true },
      }),
      prisma.adminWorkerPass.findMany({
        orderBy: { startedAt: "desc" },
        take: 25,
        select: { status: true },
      }),
    ]);

    const failures = errorLogs.map((l) => ({ category: l.category, message: l.message }));
    const blocked = blockedLogs.map((l) => ({ reason: l.message }));
    const jobs = recentPasses.map((p) => ({ status: p.status }));

    const inspection = await inspectAndRecordRequests(
      prisma,
      { failures, blocked, jobs },
      { passId: opts.passId },
    );

    // Close the learning loop: turn the dominant repeated failure into a
    // learning signal that adjusts future behaviour (source ranking + memory).
    const topPattern = inspection.report?.failure_patterns?.find((p) => p.count >= 2);
    if (topPattern) {
      await applyLearningFromOutcome(
        prisma,
        { type: "failure", detail: topPattern.pattern },
        { passId: opts.passId },
      ).catch(() => undefined);
    }

    const stats = await gatherIqStats(prisma);
    const iq = await computeIqMetrics(prisma, stats, { passId: opts.passId });

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "intelligence_pass",
      message: inspection.available
        ? `Brain self-inspection: ${inspection.persisted.created} new + ${inspection.persisted.bumped} bumped developer request(s); IQ index ${iq.metrics?.iq_index ?? "n/a"}.`
        : "Intelligence brain offline this pass; used deterministic fallbacks.",
      safeMetadata: {
        available: inspection.available,
        developerRequestsCreated: inspection.persisted.created,
        developerRequestsBumped: inspection.persisted.bumped,
        repeatedPatterns: inspection.report?.summary?.repeated_patterns ?? 0,
        iqIndex: iq.metrics?.iq_index ?? null,
      },
    }).catch(() => undefined);

    return {
      ran: inspection.available,
      developerRequests: inspection.persisted.created + inspection.persisted.bumped,
    };
  } catch {
    // Intelligence must never break a worker pass.
    return { ran: false, developerRequests: 0 };
  }
}

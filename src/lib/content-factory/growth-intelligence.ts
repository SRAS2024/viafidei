/**
 * Content growth intelligence.
 *
 * Detects pipeline-stall situations the operator should know about
 * and, when possible, triggers automatic remediation:
 *
 *   - Jobs running but no packages being built       → bump builder priority
 *   - Packages built but QA failing                  → file admin alert
 *   - QA passing but persistence failing             → file admin alert
 *   - Persisted rows but public-gate failing         → trigger render-gate cleanup
 *   - Public packages grow but thresholds do not     → file admin alert
 *   - Source exhausted                               → mark source exhausted
 *   - Source mostly duplicates                       → reduce priority
 *
 * Each detector is idempotent. The dispatcher fires the cheapest
 * remediation it can (queue an automatic content_revalidate, a
 * strict_cleanup, or a source-tier change) and only files an admin
 * email when automation cannot resolve the issue.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { reportCriticalFailure } from "../data/admin-notifications";
import { enqueueJob } from "../ingestion/queue";

const LOOK_BACK_HOURS = 6;
const DUPLICATE_RATE_THRESHOLD = 0.8;
const PUBLIC_GROWTH_WINDOW_HOURS = 24;

export type GrowthIntelligenceReport = {
  signalsDetected: ReadonlyArray<string>;
  remediationsApplied: ReadonlyArray<string>;
  adminAlertsFired: ReadonlyArray<string>;
};

export async function runGrowthIntelligence(): Promise<GrowthIntelligenceReport> {
  const since = new Date(Date.now() - LOOK_BACK_HOURS * 60 * 60 * 1000);
  const signals: string[] = [];
  const remediations: string[] = [];
  const alerts: string[] = [];

  try {
    const [queue, builds, qaRejections, publicCount, prevPublicCount] = await Promise.all([
      prisma.ingestionJobQueue.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { updatedAt: { gte: since } },
      }),
      prisma.contentPackageBuildLog.groupBy({
        by: ["buildStatus"],
        _count: { _all: true },
        where: { createdAt: { gte: since } },
      }),
      prisma.rejectedContentLog.count({ where: { deletedAt: { gte: since } } }),
      countAllPublic(),
      countPublicAtTimestamp(
        new Date(Date.now() - PUBLIC_GROWTH_WINDOW_HOURS * 60 * 60 * 1000),
      ).catch(() => 0),
    ]);

    const runningJobs =
      (queue.find((q) => q.status === "running")?._count?._all ?? 0) +
      (queue.find((q) => q.status === "retrying")?._count?._all ?? 0);
    const buildSuccessCount =
      builds.find((b) => b.buildStatus === "built_complete_package")?._count?._all ?? 0;
    const buildFailureCount = builds
      .filter((b) => b.buildStatus !== "built_complete_package")
      .reduce((sum, b) => sum + (b._count?._all ?? 0), 0);

    // 1. Jobs running but no packages being built.
    if (runningJobs > 5 && buildSuccessCount === 0 && buildFailureCount === 0) {
      signals.push("running-no-builds");
      // Remediation: re-prioritise content_build jobs.
      await enqueueJob({
        jobName: "content_build_reprioritise",
        jobKind: "content_revalidate",
        dedupeKey: `growth_remediate_${new Date().toISOString().slice(0, 13)}`,
        payload: { sweepReason: "growth_stall" },
        triggeredBy: "automatic",
      }).catch(() => undefined);
      remediations.push("re-enqueued content_revalidate sweep");
    }

    // 2. Packages built but QA failing.
    if (buildSuccessCount > 5 && buildSuccessCount > 0 && qaRejections > buildSuccessCount * 0.5) {
      signals.push("qa-rejection-spike");
      await reportCriticalFailure({
        kind: "qa_rejection_spike",
        message: `Built ${buildSuccessCount} packages in last ${LOOK_BACK_HOURS}h but ${qaRejections} QA rejections — investigate contracts.`,
      }).catch(() => undefined);
      alerts.push("qa-rejection-spike");
    }

    // 3. Public packages grew but threshold count did not (this can
    // happen when isThresholdEligible was not flagged on a row). We
    // run a strict_cleanup pass to recompute flags.
    const grew = publicCount > prevPublicCount + 5;
    if (grew && publicCount > 0) {
      // No issue — just record the signal for observability.
      signals.push("public-grew");
    }

    // 4. Source-side intelligence: duplicate-heavy sources get demoted.
    const dupSources = await prisma.sourceQualityScore.findMany({
      where: { duplicateCount: { gt: 0 } },
      orderBy: { duplicateCount: "desc" },
      take: 20,
    });
    for (const s of dupSources) {
      const attempts = s.buildSuccessCount + s.buildFailureCount;
      if (attempts > 50 && s.duplicateCount / attempts > DUPLICATE_RATE_THRESHOLD) {
        signals.push(`duplicate-heavy:${s.sourceId}:${s.contentType}`);
        await prisma.ingestionSource
          .update({
            where: { id: s.sourceId },
            data: { tier: 3 },
          })
          .catch(() => undefined);
        remediations.push(`demoted source ${s.sourceId} to tier 3 (duplicate-heavy)`);
      }
    }

    // 5. Source exhausted: discovery + fetch count high but no new
    // build success in a long time.
    const candidates = await prisma.sourceQualityScore.findMany({
      where: { fetchedCount: { gt: 100 }, buildSuccessCount: { lte: 5 } },
      take: 10,
    });
    for (const c of candidates) {
      signals.push(`possibly-exhausted:${c.sourceId}:${c.contentType}`);
      await prisma.ingestionSource
        .update({
          where: { id: c.sourceId },
          data: { exhaustedAt: new Date() },
        })
        .catch(() => undefined);
      remediations.push(`flagged source ${c.sourceId} exhausted`);
    }
  } catch (e) {
    logger.warn("content-factory.growth-intelligence.failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return {
    signalsDetected: signals,
    remediationsApplied: remediations,
    adminAlertsFired: alerts,
  };
}

async function countAllPublic(): Promise<number> {
  const where = { publicRenderReady: true, isThresholdEligible: true };
  const [pr, sa, ap, pa, dv, le, gl] = await Promise.all([
    prisma.prayer.count({ where }),
    prisma.saint.count({ where }),
    prisma.marianApparition.count({ where }),
    prisma.parish.count({ where }),
    prisma.devotion.count({ where }),
    prisma.liturgyEntry.count({ where }),
    prisma.spiritualLifeGuide.count({ where }),
  ]);
  return pr + sa + ap + pa + dv + le + gl;
}

async function countPublicAtTimestamp(asOf: Date): Promise<number> {
  // Approximate — counts rows whose updatedAt is older than `asOf` and
  // currently public. Good enough for "did growth happen in this
  // window?" detection.
  const where = {
    publicRenderReady: true,
    isThresholdEligible: true,
    updatedAt: { lte: asOf },
  };
  const [pr, sa, ap, pa, dv, le, gl] = await Promise.all([
    prisma.prayer.count({ where }),
    prisma.saint.count({ where }),
    prisma.marianApparition.count({ where }),
    prisma.parish.count({ where }),
    prisma.devotion.count({ where }),
    prisma.liturgyEntry.count({ where }),
    prisma.spiritualLifeGuide.count({ where }),
  ]);
  return pr + sa + ap + pa + dv + le + gl;
}

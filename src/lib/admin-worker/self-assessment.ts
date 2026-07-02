/**
 * Machine self-monitoring (spec bullets 1 & 5).
 *
 * A COMPOSER — it introduces no new scoring. It reads the signals the worker
 * already records (operational state, the sampled world, the exact per-stage
 * outcome ledger, growth, quality scores, stuckness records) and folds them
 * into one `SelfAssessment`: what the worker is doing right now, whether it is
 * actually moving PUBLISHED content forward, and a typed list of WARNINGS when
 * it is looping, extracting-without-publishing, publishing low-quality output,
 * burning storage, repeatedly failing on one content type, or producing no
 * value. Everything is fail-open — a self-assessment error must never affect a
 * worker pass — and every threshold is env-tunable.
 *
 * The governance layer (`governance.ts`) turns this assessment into a
 * continue/retry/skip/pause/escalate/change-strategy decision; the escalation
 * engine (`escalation.ts`) emails the admin when a warning is serious and new.
 */

import type { PrismaClient } from "@prisma/client";

import { sampleWorld } from "./brain";
import { getAdminWorkerState } from "./state";
import { summarizeStageReliability } from "./stage-outcomes";

export type WarningKind =
  | "LOOPING"
  | "EXTRACTING_WITHOUT_PUBLISHING"
  | "PUBLISHING_LOW_QUALITY"
  | "BURNING_STORAGE"
  | "REPEATED_TYPE_FAILURE"
  | "NO_VALUE";

export type WarningSeverity = "WARN" | "ERROR";

export interface WorkerWarning {
  kind: WarningKind;
  severity: WarningSeverity;
  detail: string;
  signals: string[];
  contentType: string | null;
}

export interface RetryPattern {
  stage: string;
  failures: number;
  needsRepair: number;
  successRate: number;
}

export interface SelfAssessment {
  generatedAt: Date;
  currentTask: string | null;
  currentMode: string;
  currentBlocker: string | null;
  contentType: string | null;
  windowHours: number;
  idleMs: number | null;
  heartbeatAgeMs: number | null;
  workerLive: boolean;
  paused: boolean;
  /** New public items published in the window — the forward-progress measure. */
  publishedDelta: number;
  extractionsInWindow: number;
  publishesInWindow: number;
  /** no_op stage outcomes — a proxy for repeated / duplicate work. */
  duplicateWork: number;
  /** In-flight rows not yet published (reads + artifacts across stages). */
  unpublishedBacklog: number;
  qualityFailRate: number;
  retryPatterns: RetryPattern[];
  /** True when the worker is making meaningful forward progress. */
  productive: boolean;
  warnings: WorkerWarning[];
}

function envNum(name: string, fallback: number): number {
  const v = Number((process.env[name] ?? "").trim());
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const WORKER_LIVE_MS = 10 * 60 * 1000;

/**
 * Build the self-assessment from live signals. Pure composition over existing
 * ledgers plus a handful of targeted counts. Fail-open: on any error returns a
 * minimal, non-alarming assessment (no warnings) so nothing downstream breaks.
 */
export async function buildSelfAssessment(
  prisma: PrismaClient,
  opts: { windowHours?: number } = {},
): Promise<SelfAssessment> {
  const windowHours = opts.windowHours ?? envNum("ADMIN_WORKER_ASSESS_WINDOW_HOURS", 6);
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const generatedAt = new Date();

  try {
    const [state, world, reliability] = await Promise.all([
      getAdminWorkerState(prisma),
      sampleWorld(prisma).catch(() => null),
      summarizeStageReliability(prisma, { sinceHours: windowHours }).catch(() => []),
    ]);

    const [publishedDelta, stageCounts, qualityRows] = await Promise.all([
      prisma.publishedContent
        .count({ where: { isPublished: true, publishedAt: { gte: since } } })
        .catch(() => 0),
      prisma.adminWorkerStageOutcome
        .groupBy({
          by: ["stage", "resultType"],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
        })
        .catch(() => [] as Array<{ stage: string; resultType: string; _count: { _all: number } }>),
      prisma.contentQualityScore
        .findMany({ where: { createdAt: { gte: since } }, select: { passed: true } })
        .catch(() => [] as Array<{ passed: boolean }>),
    ]);

    const countBy = (stages: string[], resultType?: string) =>
      stageCounts
        .filter(
          (r) => stages.includes(r.stage) && (resultType ? r.resultType === resultType : true),
        )
        .reduce((s, r) => s + r._count._all, 0);

    const extractionsInWindow = countBy(["EXTRACTION", "PACKAGE_BUILD"], "success");
    const publishesInWindow = countBy(["PERSISTENCE", "PUBLIC_PUBLISH"], "success");
    const duplicateWork = stageCounts
      .filter((r) => r.resultType === "no_op")
      .reduce((s, r) => s + r._count._all, 0);

    const unpublishedBacklog = world
      ? (world.readsAwaitingExtraction ?? 0) +
        (world.artifactsAwaitingBuild ?? 0) +
        (world.artifactsAwaitingVerification ?? 0) +
        (world.artifactsAwaitingQA ?? 0) +
        (world.artifactsAwaitingPublish ?? 0)
      : 0;

    const qualityFailRate =
      qualityRows.length > 0 ? qualityRows.filter((q) => !q.passed).length / qualityRows.length : 0;

    const idleMs = world?.lastSuccessAgeMs ?? null;
    const heartbeatAgeMs = world?.heartbeatAgeMs ?? null;
    const workerLive = heartbeatAgeMs != null && heartbeatAgeMs <= WORKER_LIVE_MS;
    const paused = state.paused;
    const contentType = world?.contentGoalContentType ?? null;

    const retryPatterns: RetryPattern[] = reliability
      .filter((r) => r.failures + r.needsRepair > 0)
      .sort((a, b) => b.failures + b.needsRepair - (a.failures + a.needsRepair))
      .slice(0, 8)
      .map((r) => ({
        stage: r.stage,
        failures: r.failures,
        needsRepair: r.needsRepair,
        successRate: r.successRate,
      }));

    const warnings: WorkerWarning[] = [];

    // Only assess when the worker is actually running and not intentionally
    // paused — a dead/paused worker's lack of progress is expected and is
    // surfaced by the liveness/pause banner, not as a productivity warning.
    if (workerLive && !paused) {
      const idleHoursNoGrowth = envNum("ADMIN_WORKER_NO_GROWTH_HOURS", 12);
      const growthStaleMs = world?.timeSinceLastGrowthMs ?? (publishedDelta === 0 ? Infinity : 0);
      const noGrowth = publishedDelta === 0;

      // LOOPING — a content stage with real activity but a near-zero success
      // rate is spinning without advancing.
      const loopStage = reliability.find(
        (r) => r.total >= envNum("ADMIN_WORKER_LOOP_MIN_ATTEMPTS", 6) && r.successRate <= 0.05,
      );
      if (loopStage) {
        warnings.push({
          kind: "LOOPING",
          severity: loopStage.total >= 20 ? "ERROR" : "WARN",
          detail: `Stage ${loopStage.stage} ran ${loopStage.total}× in ${windowHours}h with a ${(loopStage.successRate * 100).toFixed(0)}% success rate — it is looping without advancing.`,
          signals: [
            `stage=${loopStage.stage}`,
            `attempts=${loopStage.total}`,
            `needsRepair=${loopStage.needsRepair}`,
            `failures=${loopStage.failures}`,
          ],
          contentType,
        });
      }

      // EXTRACTING_WITHOUT_PUBLISHING — building artifacts but nothing reaches
      // publication.
      if (extractionsInWindow >= envNum("ADMIN_WORKER_EXTRACT_MIN", 5) && publishesInWindow === 0) {
        warnings.push({
          kind: "EXTRACTING_WITHOUT_PUBLISHING",
          severity: extractionsInWindow >= 20 ? "ERROR" : "WARN",
          detail: `${extractionsInWindow} extraction/build step(s) succeeded in ${windowHours}h but 0 items were published — content is stuck before publication.`,
          signals: [
            `extractions=${extractionsInWindow}`,
            `publishes=${publishesInWindow}`,
            `backlog=${unpublishedBacklog}`,
          ],
          contentType,
        });
      }

      // PUBLISHING_LOW_QUALITY — a high share of scored content is failing the
      // quality gate.
      if (
        qualityRows.length >= envNum("ADMIN_WORKER_QUALITY_MIN_SAMPLES", 5) &&
        qualityFailRate >= 0.5
      ) {
        warnings.push({
          kind: "PUBLISHING_LOW_QUALITY",
          severity: qualityFailRate >= 0.8 ? "ERROR" : "WARN",
          detail: `${(qualityFailRate * 100).toFixed(0)}% of ${qualityRows.length} quality-scored item(s) failed the pre-publish gate in ${windowHours}h.`,
          signals: [`failRate=${qualityFailRate.toFixed(2)}`, `samples=${qualityRows.length}`],
          contentType,
        });
      }

      // BURNING_STORAGE — the unpublished backlog is large while nothing is
      // publishing, so in-flight rows accumulate without becoming content.
      if (
        unpublishedBacklog >= envNum("ADMIN_WORKER_BACKLOG_BURN", 25) &&
        publishesInWindow === 0 &&
        noGrowth
      ) {
        warnings.push({
          kind: "BURNING_STORAGE",
          severity: unpublishedBacklog >= 100 ? "ERROR" : "WARN",
          detail: `${unpublishedBacklog} in-flight row(s) are backed up unpublished while nothing is being published — storage is accumulating without producing content.`,
          signals: [`backlog=${unpublishedBacklog}`, `publishes=${publishesInWindow}`],
          contentType,
        });
      }

      // REPEATED_TYPE_FAILURE — one content type keeps failing across stages.
      const typeFailures = stageCounts
        .filter((r) => r.resultType === "failure")
        .reduce((s, r) => s + r._count._all, 0);
      if (
        contentType &&
        typeFailures >= envNum("ADMIN_WORKER_TYPE_FAIL_MIN", 8) &&
        publishedDelta === 0
      ) {
        warnings.push({
          kind: "REPEATED_TYPE_FAILURE",
          severity: "WARN",
          detail: `Repeated failures (${typeFailures}) while targeting ${contentType} with no items published in ${windowHours}h.`,
          signals: [`failures=${typeFailures}`, `target=${contentType}`],
          contentType,
        });
      }

      // NO_VALUE — a live, unpaused worker producing nothing over an extended
      // window despite doing work.
      const noGrowthLongEnough =
        growthStaleMs === Infinity || growthStaleMs >= idleHoursNoGrowth * 60 * 60 * 1000;
      const didWork = extractionsInWindow + duplicateWork + retryPatterns.length > 0;
      if (noGrowth && noGrowthLongEnough && didWork) {
        warnings.push({
          kind: "NO_VALUE",
          severity: "WARN",
          detail: `No content published in ${windowHours}h despite active work — the worker is running but producing no meaningful value.`,
          signals: [
            `publishedDelta=0`,
            `extractions=${extractionsInWindow}`,
            `duplicateWork=${duplicateWork}`,
          ],
          contentType,
        });
      }
    }

    const productive = publishedDelta > 0 || warnings.length === 0;

    return {
      generatedAt,
      currentTask: state.currentTask ?? null,
      currentMode: String(state.currentMode),
      currentBlocker: state.currentBlocker ?? null,
      contentType,
      windowHours,
      idleMs,
      heartbeatAgeMs,
      workerLive,
      paused,
      publishedDelta,
      extractionsInWindow,
      publishesInWindow,
      duplicateWork,
      unpublishedBacklog,
      qualityFailRate,
      retryPatterns,
      productive,
      warnings,
    };
  } catch {
    return {
      generatedAt,
      currentTask: null,
      currentMode: "UNKNOWN",
      currentBlocker: null,
      contentType: null,
      windowHours,
      idleMs: null,
      heartbeatAgeMs: null,
      workerLive: false,
      paused: false,
      publishedDelta: 0,
      extractionsInWindow: 0,
      publishesInWindow: 0,
      duplicateWork: 0,
      unpublishedBacklog: 0,
      qualityFailRate: 0,
      retryPatterns: [],
      productive: true,
      warnings: [],
    };
  }
}

/**
 * GrowthOrchestrator (spec §22). Continuously compares minimum +
 * desired goals to current valid public counts and emits an action
 * plan per content type:
 *
 *   - no growth in 24h + below goal       → boost discovery cadence,
 *                                            raise source priority
 *   - no growth in 7d + below goal        → file a high-priority
 *                                            repair plan
 *   - many rejected items                 → improve source selection
 *                                            and extractor strategy
 *   - many partial packages               → search for enrichment +
 *                                            validation sources
 *   - reached goal                        → move to maintenance mode
 *
 * Every run writes a durable AdminWorkerGrowthSnapshot so the admin
 * UI can show "what the worker learned recently" without recomputing —
 * at most once per SNAPSHOT_MIN_INTERVAL_MS per run, whoever the caller is
 * (the hourly reporting pass or the governor's REPORTING fallback), and the
 * cleanup pass trims the ledger to the newest rows per type.
 *
 * Staleness ("no growth in 24h / 7d") is measured against WORKER-ACTIVE time,
 * not wall-clock time: the execution host is the operator's computer and OFF
 * is a designed state, so a week with the lid closed is not a stalled
 * pipeline and must not file a DISCOVERY_FAILED plan for every type.
 */

import type { ChecklistContentType, Prisma, PrismaClient } from "@prisma/client";

import { CURATED_BUILT_CONTENT_TYPES, STRUCTURED_BUILT_CONTENT_TYPES } from "./content-types";
import { filePlan } from "./repair-plans";
import { writeAdminWorkerLog } from "./logs";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Minimum spacing between snapshot writes — the governor can invoke REPORTING every pass. */
const SNAPSHOT_MIN_INTERVAL_MS = 15 * 60 * 1000;
/** A heartbeat older than this means the worker is not running right now. */
const WORKER_LIVE_MS = 10 * 60 * 1000;

export type GrowthStatus =
  | "AT_GOAL"
  | "GROWING_OK"
  | "SLOW_24H"
  | "STUCK_7D"
  | "REJECT_HEAVY"
  | "PARTIAL_HEAVY"
  | "NEW"
  /** Below goal, but the worker has not been running since the last growth — not a pipeline stall. */
  | "WORKER_IDLE";

export interface GrowthAssessment {
  contentType: ChecklistContentType;
  publishedCount: number;
  validCount: number;
  minimumTarget: number;
  desiredTarget: number;
  gap: number;
  growth24h: number;
  growth7d: number;
  growth30d: number;
  hoursSinceLastGrowth: number | null;
  /** Hours the worker was actually running since the last growth (≤ hoursSinceLastGrowth). */
  activeHoursSinceLastGrowth: number | null;
  qaPassRate30d: number;
  publishRate30d: number;
  pipelineHealth: number;
  status: GrowthStatus;
  recommendation: string;
}

export interface GrowthOrchestrationOutcome {
  assessments: GrowthAssessment[];
  repairPlansFiled: number;
  movedToMaintenance: number;
  /** False when the run reused the recent snapshots instead of writing new rows. */
  snapshotsWritten: boolean;
}

/** True when the newest snapshot is younger than the minimum interval. Fail-open → write. */
async function snapshotsRecentlyWritten(prisma: PrismaClient, now: number): Promise<boolean> {
  try {
    const model = (prisma as unknown as { adminWorkerGrowthSnapshot?: { findFirst?: unknown } })
      .adminWorkerGrowthSnapshot;
    if (typeof model?.findFirst !== "function") return false;
    const latest = await prisma.adminWorkerGrowthSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return !!latest && now - latest.createdAt.getTime() < SNAPSHOT_MIN_INTERVAL_MS;
  } catch {
    return false;
  }
}

interface WorkerActivity {
  /** Last heartbeat, or null when unknown. */
  lastHeartbeatAt: Date | null;
  /** Whether the worker is running right now (fresh heartbeat). Null = unknown. */
  running: boolean | null;
}

/** Fail-open read of the worker's liveness; a harness without the state model yields "unknown". */
async function readWorkerActivity(prisma: PrismaClient, now: number): Promise<WorkerActivity> {
  try {
    const model = (prisma as unknown as { adminWorkerState?: { findUnique?: unknown } })
      .adminWorkerState;
    if (typeof model?.findUnique !== "function") return { lastHeartbeatAt: null, running: null };
    const state = await prisma.adminWorkerState.findUnique({
      where: { id: "singleton" },
      select: { lastHeartbeatAt: true },
    });
    const last = state?.lastHeartbeatAt ?? null;
    return {
      lastHeartbeatAt: last,
      running: last ? now - last.getTime() <= WORKER_LIVE_MS : false,
    };
  } catch {
    return { lastHeartbeatAt: null, running: null };
  }
}

/**
 * Hours of worker-active time since `lastGrowthAt`: an upper bound taken from
 * the first pass that started after the growth (a worker that was OFF for a
 * week and switched on an hour ago has one active hour, not 169). Null when
 * the pass ledger cannot answer, in which case callers fall back to wall-clock
 * time — the pre-existing, more alarming behaviour.
 */
async function activeHoursSince(
  prisma: PrismaClient,
  lastGrowthAt: Date,
  activity: WorkerActivity,
  now: number,
): Promise<number | null> {
  // No heartbeat since the growth → the worker has not run since it.
  if (activity.lastHeartbeatAt && activity.lastHeartbeatAt.getTime() <= lastGrowthAt.getTime()) {
    return 0;
  }
  try {
    const model = (prisma as unknown as { adminWorkerPass?: { findFirst?: unknown } })
      .adminWorkerPass;
    if (typeof model?.findFirst !== "function") return null;
    const firstPass = await prisma.adminWorkerPass.findFirst({
      where: { startedAt: { gte: lastGrowthAt } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    });
    if (!firstPass) return activity.running === true ? null : 0;
    return Math.max(0, Math.round((now - firstPass.startedAt.getTime()) / HOUR_MS));
  } catch {
    return null;
  }
}

export async function runGrowthOrchestrator(
  prisma: PrismaClient,
  opts: { passId?: string } = {},
): Promise<GrowthOrchestrationOutcome> {
  const goals = await prisma.contentGoal.findMany({
    orderBy: { priority: "asc" },
  });
  const now = Date.now();
  const assessments: GrowthAssessment[] = [];
  let repairPlansFiled = 0;
  let movedToMaintenance = 0;
  const [writeSnapshots, activity] = await Promise.all([
    snapshotsRecentlyWritten(prisma, now).then((recent) => !recent),
    readWorkerActivity(prisma, now),
  ]);

  for (const goal of goals) {
    const contentType = goal.contentType as ChecklistContentType;
    const [recent24, recent7, recent30, lastPublish] = await Promise.all([
      prisma.publishedContent
        .count({
          where: { contentType, isPublished: true, publishedAt: { gte: new Date(now - DAY_MS) } },
        })
        .catch(() => 0),
      prisma.publishedContent
        .count({
          where: {
            contentType,
            isPublished: true,
            publishedAt: { gte: new Date(now - 7 * DAY_MS) },
          },
        })
        .catch(() => 0),
      prisma.publishedContent
        .count({
          where: {
            contentType,
            isPublished: true,
            publishedAt: { gte: new Date(now - 30 * DAY_MS) },
          },
        })
        .catch(() => 0),
      prisma.publishedContent
        .findFirst({
          where: { contentType, isPublished: true },
          orderBy: { publishedAt: "desc" },
          select: { publishedAt: true },
        })
        .catch(() => null),
    ]);

    const lastAt = lastPublish?.publishedAt ?? null;
    const hoursSince = lastAt ? Math.round((now - lastAt.getTime()) / HOUR_MS) : null;
    const activeHours = lastAt ? await activeHoursSince(prisma, lastAt, activity, now) : null;

    // QA + publish rate signals — best-effort, default 0 when missing.
    const qaResults = await prisma.adminWorkerStrictQAResult
      .findMany({
        where: {
          createdAt: { gte: new Date(now - 30 * DAY_MS) },
          contentType,
        },
        select: { status: true },
      })
      .catch(() => [] as Array<{ status: string }>);
    const qaPassRate30d =
      qaResults.length === 0
        ? 0
        : qaResults.filter((q) => q.status === "PASSED").length / qaResults.length;

    const buildJobs = await prisma.workerBuildJob
      .count({
        where: {
          createdAt: { gte: new Date(now - 30 * DAY_MS) },
          checklistItem: { contentType },
        },
      })
      .catch(() => 0);
    const publishRate30d = buildJobs === 0 ? 0 : recent30 / buildJobs;

    // Pipeline health: blended QA + publish rate (0..1).
    const pipelineHealth = qaPassRate30d * 0.5 + publishRate30d * 0.5;

    const status = classify({
      goal,
      gap: goal.gapCount,
      growth24h: recent24,
      growth7d: recent7,
      hoursSinceLastGrowth: hoursSince,
      activeHoursSinceLastGrowth: activeHours,
      workerRunning: activity.running,
      qaPassRate30d,
      publishRate30d,
    });
    const recommendation = recommendFor(status, contentType);

    assessments.push({
      contentType,
      publishedCount: goal.currentValidCount,
      validCount: goal.currentValidCount,
      minimumTarget: goal.minimumTarget,
      desiredTarget: goal.desiredTarget,
      gap: goal.gapCount,
      growth24h: recent24,
      growth7d: recent7,
      growth30d: recent30,
      hoursSinceLastGrowth: hoursSince,
      activeHoursSinceLastGrowth: activeHours,
      qaPassRate30d: round(qaPassRate30d),
      publishRate30d: round(publishRate30d),
      pipelineHealth: round(pipelineHealth),
      status,
      recommendation,
    });

    // Persist a snapshot — used by the admin UI panel. Skipped when the newest
    // snapshot is younger than SNAPSHOT_MIN_INTERVAL_MS so a caller invoking
    // this every pass cannot grow the ledger without bound.
    if (writeSnapshots) {
      await prisma.adminWorkerGrowthSnapshot
        .create({
          data: {
            contentType,
            publishedCount: goal.currentValidCount,
            validCount: goal.currentValidCount,
            minimumTarget: goal.minimumTarget,
            desiredTarget: goal.desiredTarget,
            gap: goal.gapCount,
            growth24h: recent24,
            growth7d: recent7,
            growth30d: recent30,
            hoursSinceLastGrowth: hoursSince ?? null,
            qaPassRate30d,
            publishRate30d,
            pipelineHealth,
            status,
            recommendation,
          },
        })
        .catch(() => undefined);
    }

    // Trigger side-effects per status. A DISCOVERY_FAILED plan re-runs WEB
    // discovery, so it is only meaningful for web-growable types — filing one
    // for a curated/structured-built type (PARISH every pass, given its 200k
    // gap) just churned plans that downstream reconciliation had to close.
    if (
      status === "STUCK_7D" &&
      !STRUCTURED_BUILT_CONTENT_TYPES.has(contentType) &&
      !CURATED_BUILT_CONTENT_TYPES.has(contentType)
    ) {
      await filePlan(prisma, {
        kind: "DISCOVERY_FAILED",
        failedEntity: contentType,
        repairAction: `Content type ${contentType} has had no growth in >7 days; expand sources and re-check pipeline.`,
        metadata: { contentType, growth7d: recent7, gap: goal.gapCount },
      }).catch(() => undefined);
      repairPlansFiled += 1;
    }

    // refreshContentGoals (content-goals.ts reconcileStatus) preserves
    // MAINTENANCE while the count stays at/above target, so this write is now
    // a one-time transition rather than a flip-flop with the per-pass refresh.
    if (status === "AT_GOAL" && goal.status !== "MAINTENANCE") {
      await prisma.contentGoal
        .update({
          where: { contentType },
          data: { status: "MAINTENANCE" },
        })
        .catch(() => undefined);
      movedToMaintenance += 1;
    }
  }

  await writeAdminWorkerLog(prisma, {
    passId: opts.passId ?? null,
    category: "WORKER_PASS",
    severity: "INFO",
    eventName: "growth_orchestrator",
    message: `Growth orchestrator assessed ${assessments.length} content type(s); ${repairPlansFiled} repair plan(s) filed; ${movedToMaintenance} moved to maintenance${writeSnapshots ? "" : "; snapshots reused (written <15 min ago)"}.`,
    safeMetadata: {
      counts: assessments.map((a) => ({
        contentType: a.contentType,
        status: a.status,
        gap: a.gap,
        growth24h: a.growth24h,
      })),
    } as unknown as Prisma.InputJsonValue,
  });

  return { assessments, repairPlansFiled, movedToMaintenance, snapshotsWritten: writeSnapshots };
}

export function classify(opts: {
  goal: { gapCount: number; status: string };
  gap: number;
  growth24h: number;
  growth7d: number;
  hoursSinceLastGrowth: number | null;
  /** Null = unknown → fall back to wall-clock hours. */
  activeHoursSinceLastGrowth?: number | null;
  /** Null = unknown. */
  workerRunning?: boolean | null;
  qaPassRate30d: number;
  publishRate30d: number;
}): GrowthStatus {
  if (opts.gap <= 0) return "AT_GOAL";
  if (opts.hoursSinceLastGrowth == null) return "NEW";
  // Stale-growth thresholds count only the hours the worker was running.
  const staleHours = opts.activeHoursSinceLastGrowth ?? opts.hoursSinceLastGrowth;
  if (opts.hoursSinceLastGrowth >= 24 && opts.workerRunning === false && staleHours < 24) {
    return "WORKER_IDLE";
  }
  if (staleHours >= 7 * 24) return "STUCK_7D";
  if (staleHours >= 24) return "SLOW_24H";
  if (opts.qaPassRate30d > 0 && opts.qaPassRate30d < 0.3) return "REJECT_HEAVY";
  if (opts.publishRate30d > 0 && opts.publishRate30d < 0.2) return "PARTIAL_HEAVY";
  return "GROWING_OK";
}

function recommendFor(status: GrowthStatus, contentType: string): string {
  switch (status) {
    case "AT_GOAL":
      return `${contentType}: goal met — switch to maintenance mode.`;
    case "GROWING_OK":
      return `${contentType}: healthy growth — keep current cadence.`;
    case "SLOW_24H":
      return `${contentType}: no growth in 24h — boost discovery and source priority.`;
    case "STUCK_7D":
      return `${contentType}: no growth in 7 days — file a high-priority repair plan and expand sources.`;
    case "REJECT_HEAVY":
      return `${contentType}: many rejected items — review source selection and extractor strategy.`;
    case "PARTIAL_HEAVY":
      return `${contentType}: many partial packages — search for enrichment + validation sources.`;
    case "NEW":
      return `${contentType}: nothing published yet — kick off discovery + fetch + build.`;
    case "WORKER_IDLE":
      return `${contentType}: below goal, but the Admin Worker has not been running since the last growth — switch it on; this is not a pipeline stall.`;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

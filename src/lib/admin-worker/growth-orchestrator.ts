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
 * UI can show "what the worker learned recently" without recomputing.
 */

import type { ChecklistContentType, Prisma, PrismaClient } from "@prisma/client";

import { filePlan } from "./repair-plans";
import { writeAdminWorkerLog } from "./logs";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type GrowthStatus =
  | "AT_GOAL"
  | "GROWING_OK"
  | "SLOW_24H"
  | "STUCK_7D"
  | "REJECT_HEAVY"
  | "PARTIAL_HEAVY"
  | "NEW";

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

    // QA + publish rate signals — best-effort, default 0 when missing.
    // contentType lives on the related ChecklistItem, not on QAReport.
    const qaReports = await prisma.checklistQAReport
      .findMany({
        where: {
          createdAt: { gte: new Date(now - 30 * DAY_MS) },
          checklistItem: { contentType },
        },
        select: { passed: true },
      })
      .catch(() => [] as Array<{ passed: boolean }>);
    const qaPassRate30d =
      qaReports.length === 0 ? 0 : qaReports.filter((q) => q.passed).length / qaReports.length;

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
      qaPassRate30d: round(qaPassRate30d),
      publishRate30d: round(publishRate30d),
      pipelineHealth: round(pipelineHealth),
      status,
      recommendation,
    });

    // Persist a snapshot — used by the admin UI panel.
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

    // Trigger side-effects per status.
    if (status === "STUCK_7D") {
      await filePlan(prisma, {
        kind: "DISCOVERY_FAILED",
        failedEntity: contentType,
        repairAction: `Content type ${contentType} has had no growth in >7 days; expand sources and re-check pipeline.`,
        metadata: { contentType, growth7d: recent7, gap: goal.gapCount },
      }).catch(() => undefined);
      repairPlansFiled += 1;
    }

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
    message: `Growth orchestrator assessed ${assessments.length} content type(s); ${repairPlansFiled} repair plan(s) filed; ${movedToMaintenance} moved to maintenance.`,
    safeMetadata: {
      counts: assessments.map((a) => ({
        contentType: a.contentType,
        status: a.status,
        gap: a.gap,
        growth24h: a.growth24h,
      })),
    } as unknown as Prisma.InputJsonValue,
  });

  return { assessments, repairPlansFiled, movedToMaintenance };
}

function classify(opts: {
  goal: { gapCount: number; status: string };
  gap: number;
  growth24h: number;
  growth7d: number;
  hoursSinceLastGrowth: number | null;
  qaPassRate30d: number;
  publishRate30d: number;
}): GrowthStatus {
  if (opts.gap <= 0) return "AT_GOAL";
  if (opts.hoursSinceLastGrowth == null) return "NEW";
  if (opts.hoursSinceLastGrowth >= 7 * 24) return "STUCK_7D";
  if (opts.hoursSinceLastGrowth >= 24) return "SLOW_24H";
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
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

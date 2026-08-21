/**
 * Admin Worker Command Center snapshot (spec §11).
 *
 * One function that assembles everything the Admin Worker command center
 * shows — worker status, mode, priority, heartbeat, content goals and
 * coverage, pipeline state, current task, recent passes and decisions, brain
 * reasoning and ranked alternatives, source reputation and coverage, memory
 * and knowledge, logs, rules, skills, repair plans, the review queue, package
 * artifacts, quality scores, strict QA, rollbacks, security activity, homepage
 * drafts, diagnostics, intelligence status, current source activity,
 * publishing activity and content growth.
 *
 * The browser admin no longer renders this: the command center moved into the
 * native Via Fidei application, which reads this snapshot from the local
 * worker runtime over loopback. Every figure is still read live from Postgres
 * — the database remains the worker's long-term memory (spec §21) — but the
 * *computation* now happens on the operator's MacBook.
 *
 * Everything is defensive: each query is individually guarded so one missing
 * table or slow query can never blank the whole console.
 */

import type { PrismaClient } from "@prisma/client";

import { computeContentFunnel } from "./content-growth-monitor";
import { refreshContentGoals } from "./content-goals";
import { dailyReadingsCoverage } from "./daily-readings";
import { runAdminWorkerDiagnostics, summarizeRatings } from "./diagnostics";
import { readExecutionStatus, type ExecutionStatus } from "./execution-host";
import { listAdminWorkerLogs } from "./logs";
import { loadCommandCenterMetrics } from "./metrics";
import { planMission } from "./mission-planner";
import { listRecentPasses } from "./passes";
import { listRecentSecurityActions } from "./security-defender";
import { listPendingReview } from "./human-review";
import { getAdminWorkerState } from "./state";
import { listRules } from "./rules";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export interface CommandCenterSnapshot {
  generatedAt: string;
  execution: ExecutionStatus;
  state: Awaited<ReturnType<typeof getAdminWorkerState>>;
  heartbeatAgeMs: number | null;
  workerLive: boolean;
  diagnostics: {
    ratings: Awaited<ReturnType<typeof runAdminWorkerDiagnostics>>;
    summary: ReturnType<typeof summarizeRatings>;
  };
  metrics: Awaited<ReturnType<typeof loadCommandCenterMetrics>>;
  mission: Awaited<ReturnType<typeof planMission>> | null;
  goals: unknown[];
  funnel: unknown[];
  coverage: unknown[];
  growth: unknown[];
  pipeline: unknown[];
  artifactStatus: Record<string, number>;
  passes: unknown[];
  decisions: unknown[];
  brain: {
    latestFinalBrain: string | null;
    degradedEvents24h: number;
    selectActionCalls24h: number;
    latestDecision: unknown | null;
    rankedAlternatives: unknown[];
    reasoning: unknown[];
  };
  sourceReputation: unknown[];
  sourceActivity: unknown[];
  memory: unknown[];
  knowledge: { nodes: number; edges: number; recentNodes: unknown[] };
  logs: unknown[];
  rules: Array<{ id: string; category: string; version: number; description: string }>;
  skills: unknown[];
  repairPlans: unknown[];
  reviewQueue: unknown[];
  qualityScores: unknown[];
  strictQA: unknown[];
  rollbacks: unknown[];
  security: unknown[];
  homepageDrafts: unknown[];
  publishing: unknown[];
  readingsCoverage: unknown | null;
  contentCatalogTotal: number;
}

/**
 * Load the full command-center snapshot. `refreshGoals` runs the (cheap) live
 * goal refresh first so gap counts are current; the local host calls it with
 * `false` for the fast polling path.
 */
export async function loadCommandCenterSnapshot(
  prisma: PrismaClient,
  opts: { refreshGoals?: boolean; logLimit?: number } = {},
): Promise<CommandCenterSnapshot> {
  if (opts.refreshGoals !== false) {
    await safe(refreshContentGoals(prisma), undefined as never);
  }
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    execution,
    state,
    ratings,
    metrics,
    mission,
    goals,
    passes,
    decisions,
    coverage,
    growth,
    security,
    reviewQueue,
    repairPlans,
    memory,
    qualityScores,
    strictQA,
    rollbacks,
    homepageDrafts,
    sourceReputation,
    sourceActivity,
    logs,
    artifactRows,
    graphNodes,
    graphEdges,
    recentGraphNodes,
    skills,
    publishing,
    readingsCoverage,
    latestBrainDecided,
    degradedEvents24h,
    selectActionCalls24h,
    reasoning,
    catalogTotal,
  ] = await Promise.all([
    safe(readExecutionStatus(prisma), {
      state: "OFF",
      switch: { on: false, changedAt: null, changedBy: null, changedFrom: null },
      lease: null,
      leaseAgeMs: null,
      leaseLive: false,
      executingLocally: false,
      label: "Execution status unavailable.",
    } as ExecutionStatus),
    getAdminWorkerState(prisma),
    safe(runAdminWorkerDiagnostics(prisma), []),
    safe(loadCommandCenterMetrics(prisma), {
      publishRate30d: 0,
      qaPassRate30d: 0,
      deletionRate30d: 0,
      reviewQueueCount: 0,
      recentSecurityActions24h: 0,
      monthlyReportLastAt: null,
      monthlyReportFresh: false,
      publishedContentLive: 0,
      queueInFlight: 0,
    }),
    safe(planMission(prisma), null),
    safe(
      prisma.contentGoal.findMany({ orderBy: [{ gapCount: "desc" }, { priority: "asc" }] }),
      [] as unknown[],
    ),
    safe(listRecentPasses(prisma, { limit: 15 }), [] as unknown[]),
    safe(
      prisma.adminWorkerDecision.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerSourceCoverage.findMany({
        orderBy: [{ blockedByCoverage: "desc" }, { coverageScore: "asc" }],
        take: 40,
      }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerGrowthSnapshot.findMany({
        distinct: ["contentType"],
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      [] as unknown[],
    ),
    safe(listRecentSecurityActions(prisma, { limit: 15 }), [] as unknown[]),
    safe(listPendingReview(prisma, { limit: 25 }), [] as unknown[]),
    safe(
      prisma.adminWorkerRepairPlan.findMany({ orderBy: { updatedAt: "desc" }, take: 15 }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerMemory.findMany({
        orderBy: [{ lastUsedAt: "desc" }, { confidence: "desc" }],
        take: 25,
        select: {
          memoryType: true,
          memoryKey: true,
          confidence: true,
          successCount: true,
          failureCount: true,
          lastUsedAt: true,
        },
      }),
      [] as unknown[],
    ),
    safe(
      prisma.contentQualityScore.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerStrictQAResult.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerRollbackLedger.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      [] as unknown[],
    ),
    safe(
      prisma.homepageWorkerDraft.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerSourceReputation.findMany({
        orderBy: [{ lastScoreUpdate: "desc" }],
        take: 30,
      }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerSourceRead.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          sourceUrl: true,
          sourceHost: true,
          detectedContentType: true,
          confidenceScore: true,
          byteSize: true,
          createdAt: true,
        },
      }),
      [] as unknown[],
    ),
    safe(listAdminWorkerLogs(prisma, { limit: opts.logLimit ?? 120 }), [] as unknown[]),
    safe(
      prisma.adminWorkerPackageArtifact.groupBy({ by: ["status"], _count: { _all: true } }),
      [] as Array<{ status: string; _count: { _all: number } }>,
    ),
    safe(prisma.adminWorkerGraphNode.count(), 0),
    safe(prisma.adminWorkerGraphEdge.count(), 0),
    safe(
      prisma.adminWorkerGraphNode.findMany({ orderBy: { updatedAt: "desc" }, take: 15 }),
      [] as unknown[],
    ),
    safe(
      prisma.adminWorkerSkillExecution.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      [] as unknown[],
    ),
    safe(
      prisma.publishedContent.findMany({
        where: { isPublished: true },
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: { id: true, contentType: true, title: true, slug: true, updatedAt: true },
      }),
      [] as unknown[],
    ),
    safe(dailyReadingsCoverage(prisma), null),
    safe(
      prisma.adminWorkerLog.findFirst({
        where: { eventName: "brain_decided" },
        orderBy: { createdAt: "desc" },
        select: { safeMetadata: true, createdAt: true },
      }),
      null,
    ),
    safe(
      prisma.adminWorkerLog.count({
        where: {
          eventName: {
            in: [
              "python_brain_unavailable",
              "python_brain_invalid_decision",
              "python_brain_rejected_action",
            ],
          },
          createdAt: { gte: since24h },
        },
      }),
      0,
    ),
    safe(
      prisma.adminWorkerBrainCall.count({
        where: { op: "select_action", createdAt: { gte: since24h } },
      }),
      0,
    ),
    safe(
      prisma.adminWorkerReasoningGraph.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      [] as unknown[],
    ),
    safe(prisma.publishedContent.count({ where: { isPublished: true } }), 0),
  ]);

  const funnel = await safe(computeContentFunnel(prisma), [] as unknown[]);
  const pipeline = await safe(
    import("./pipeline-stages").then(({ pipelineSnapshot }) => pipelineSnapshot(prisma)),
    [] as unknown[],
  );

  const artifactStatus = Object.fromEntries(
    (artifactRows as Array<{ status: string; _count: { _all: number } }>).map((r) => [
      r.status,
      r._count._all,
    ]),
  ) as Record<string, number>;

  const heartbeatAgeMs = state.lastHeartbeatAt
    ? Date.now() - state.lastHeartbeatAt.getTime()
    : null;

  const latestMeta = (latestBrainDecided as { safeMetadata?: unknown } | null)?.safeMetadata as
    | { finalBrain?: string; alternatives?: unknown[] }
    | null
    | undefined;

  return {
    generatedAt: new Date().toISOString(),
    execution,
    state,
    heartbeatAgeMs,
    // Liveness now means "the LOCAL runtime is alive" (spec §23): a fresh
    // heartbeat only counts while the local lease is live.
    workerLive:
      execution.executingLocally && heartbeatAgeMs != null && heartbeatAgeMs <= 10 * 60 * 1000,
    diagnostics: { ratings, summary: summarizeRatings(ratings) },
    metrics,
    mission,
    goals: goals as unknown[],
    funnel: funnel as unknown[],
    coverage: coverage as unknown[],
    growth: growth as unknown[],
    pipeline: pipeline as unknown[],
    artifactStatus,
    passes: passes as unknown[],
    decisions: decisions as unknown[],
    brain: {
      latestFinalBrain: latestMeta?.finalBrain ?? null,
      degradedEvents24h: degradedEvents24h as number,
      selectActionCalls24h: selectActionCalls24h as number,
      latestDecision: latestBrainDecided,
      rankedAlternatives: Array.isArray(latestMeta?.alternatives) ? latestMeta.alternatives : [],
      reasoning: reasoning as unknown[],
    },
    sourceReputation: sourceReputation as unknown[],
    sourceActivity: sourceActivity as unknown[],
    memory: memory as unknown[],
    knowledge: {
      nodes: graphNodes as number,
      edges: graphEdges as number,
      recentNodes: recentGraphNodes as unknown[],
    },
    logs: logs as unknown[],
    rules: listRules().map((r) => ({
      id: r.id,
      category: r.category,
      version: r.version,
      description: r.description,
    })),
    skills: skills as unknown[],
    repairPlans: repairPlans as unknown[],
    reviewQueue: reviewQueue as unknown[],
    qualityScores: qualityScores as unknown[],
    strictQA: strictQA as unknown[],
    rollbacks: rollbacks as unknown[],
    security: security as unknown[],
    homepageDrafts: homepageDrafts as unknown[],
    publishing: publishing as unknown[],
    readingsCoverage,
    contentCatalogTotal: catalogTotal as number,
  };
}

/**
 * Admin Worker report generator. Two report types:
 *
 *   1. Developer Audit PDF — operator-triggered from the diagnostics
 *      card; periods are LAST_24_HOURS, LAST_7_DAYS, LAST_30_DAYS.
 *   2. Monthly Admin Worker Report PDF — sent on the last day of every
 *      month to ADMIN_EMAIL with the full 30-day log split into daily
 *      sections.
 *
 * Both reports redact secrets (passwords, API keys, session secrets,
 * tokens, cookies, authorization headers, full database URLs, private
 * env-var values) and KEEP useful debugging data (worker ID, source
 * host, content type, job kind, timestamps, route paths, diagnostic
 * status, failure category).
 */

import type { AdminDeveloperReportPeriod, PrismaClient } from "@prisma/client";

import { listAdminWorkerLogs } from "./logs";
import { listRecentPasses } from "./passes";
import { runAdminWorkerDiagnostics, summarizeRatings } from "./diagnostics";

const SECRET_KEYS = [
  "password",
  "apikey",
  "api_key",
  "session_secret",
  "sessionsecret",
  "token",
  "cookie",
  "authorization",
  "database_url",
];

export function redactSecrets(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return SECRET_KEYS.some((k) => value.toLowerCase().includes(k)) ? "[REDACTED]" : value;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const isSecret = SECRET_KEYS.some((s) => k.toLowerCase().includes(s));
      out[k] = isSecret ? "[REDACTED]" : redactSecrets(v);
    }
    return out;
  }
  return value;
}

export function periodToSince(period: AdminDeveloperReportPeriod): Date {
  const now = Date.now();
  switch (period) {
    case "LAST_24_HOURS":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "LAST_7_DAYS":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "LAST_30_DAYS":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
}

export interface DeveloperAuditData {
  generatedAt: Date;
  period: AdminDeveloperReportPeriod;
  diagnosticsResults: Awaited<ReturnType<typeof runAdminWorkerDiagnostics>>;
  diagnosticsSummary: ReturnType<typeof summarizeRatings>;
  recentPasses: Awaited<ReturnType<typeof listRecentPasses>>;
  workerLogs: Awaited<ReturnType<typeof listAdminWorkerLogs>>;
  // Spec §19 — the audit must now include brain decisions, mission
  // plans, pipeline stage history, content goal progress, growth
  // snapshots, source coverage, source reputation, memory rows,
  // repair plans, security actions, post-publish verifications.
  brainDecisions: Array<{
    id: string;
    createdAt: Date;
    chosenAction: string;
    missionStage: string | null;
    contentType: string | null;
    confidence: number;
    riskScore: number;
    reason: string | null;
    brainExplanation: string | null;
    brainFailure: string | null;
  }>;
  pipelineStages: Array<{
    id: string;
    pipelineKey: string | null;
    stageName: string;
    status: string;
    contentType: string | null;
    failureReason: string | null;
    createdAt: Date;
  }>;
  contentGoals: Array<{
    contentType: string;
    minimumTarget: number;
    desiredTarget: number;
    currentValidCount: number;
    gapCount: number;
    status: string;
  }>;
  growthSnapshots: Array<{
    contentType: string;
    status: string;
    gap: number;
    growth24h: number;
    growth7d: number;
    recommendation: string | null;
    createdAt: Date;
  }>;
  sourceCoverage: Array<{
    contentType: string;
    coverageScore: number;
    blockedByCoverage: boolean;
    blockReason: string | null;
  }>;
  sourceReputation: Array<{
    sourceHost: string;
    contentType: string | null;
    reputationTier: string;
    publicPublishRate: number;
    qaPassRate: number;
    fetchSuccessRate: number;
    paused: boolean;
  }>;
  recentMemory: Array<{
    memoryType: string;
    memoryKey: string;
    confidence: number;
    successCount: number;
    failureCount: number;
    lastUsedAt: Date | null;
  }>;
  repairPlans: Array<{
    id: string;
    kind: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    finalResult: string | null;
    createdAt: Date;
  }>;
  postPublishVerifications: Array<{
    contentType: string;
    contentId: string;
    slug: string;
    result: string;
    errorMessage: string | null;
    createdAt: Date;
  }>;
  /** Spec §3 + §15: strict-QA results for the audit period. */
  strictQAResults: Array<{
    id: string;
    contentType: string;
    status: string;
    finalScore: number;
    blockingReasons: string[];
    createdAt: Date;
  }>;
  /** Spec §4 + §15: ContentQualityScore rows for the audit period. */
  qualityScores: Array<{
    id: string;
    contentType: string;
    contentId: string;
    finalScore: number;
    createdAt: Date;
  }>;
  /** Spec §1 + §15: structured-block creation activity. */
  structuredBlockStats: {
    total: number;
    rejected: number;
    perType: Array<{ blockType: string; count: number }>;
  };
  /** Spec §17: per-content-type growth execution funnel. */
  contentFunnel: Array<{
    contentType: string;
    candidatesDiscovered: number;
    packageArtifactsCreated: number;
    strictQAPasses: number;
    publishedItems: number;
    postPublishPasses: number;
    firstEmptyStage: string | null;
  }>;
  currentBlockers: string[];
  /** Spec §15: live "why no content growth" diagnostic snapshot. */
  whyNoGrowth: {
    blocker: string;
    blockerExplanation: string;
    exactTable: string;
    nextAutomaticRepair: string | null;
    nextWorkerDecision: string;
    checks: Array<{ stage: string; ok: boolean; count: number; detail: string }>;
  } | null;
}

export async function collectDeveloperAuditData(
  prisma: PrismaClient,
  period: AdminDeveloperReportPeriod,
): Promise<DeveloperAuditData> {
  const since = periodToSince(period);
  const [
    diagnosticsResults,
    recentPasses,
    workerLogs,
    brainDecisionsRaw,
    pipelineStagesRaw,
    contentGoalsRaw,
    growthSnapshotsRaw,
    sourceCoverageRaw,
    sourceReputationRaw,
    recentMemoryRaw,
    repairPlansRaw,
    postPublishVerificationsRaw,
    strictQAResultsRaw,
    qualityScoresRaw,
    sourceBlocksRaw,
    sourceBlocksByType,
    blockerState,
  ] = await Promise.all([
    runAdminWorkerDiagnostics(prisma),
    listRecentPasses(prisma, { limit: 100 }),
    listAdminWorkerLogs(prisma, { since, limit: 1000 }),
    // Spec §19: brain decisions
    prisma.adminWorkerDecision
      .findMany({
        where: { createdAt: { gte: since }, decisionType: "brain_pass" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          createdAt: true,
          chosenAction: true,
          missionStage: true,
          contentType: true,
          confidence: true,
          riskScore: true,
          reason: true,
          brainExplanation: true,
          brainFailure: true,
        },
      })
      .catch(() => []),
    // Spec §19: pipeline stage history
    prisma.adminWorkerPipelineStage
      .findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          pipelineKey: true,
          stageName: true,
          status: true,
          contentType: true,
          failureReason: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    // Spec §19: content goal progress
    prisma.contentGoal
      .findMany({
        orderBy: [{ gapCount: "desc" }, { priority: "asc" }],
      })
      .catch(() => []),
    // Spec §19: growth snapshots
    prisma.adminWorkerGrowthSnapshot
      .findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
      .catch(() => []),
    // Spec §19: source coverage
    prisma.adminWorkerSourceCoverage
      .findMany({ orderBy: [{ blockedByCoverage: "desc" }, { coverageScore: "asc" }] })
      .catch(() => []),
    // Spec §19: source reputation
    prisma.adminWorkerSourceReputation
      .findMany({
        orderBy: [{ reputationTier: "asc" }, { contentBuildSuccessRate: "desc" }],
        take: 200,
      })
      .catch(() => []),
    // Spec §19: memory changes (recently used)
    prisma.adminWorkerMemory
      .findMany({
        orderBy: [{ lastUsedAt: "desc" }, { confidence: "desc" }],
        take: 100,
      })
      .catch(() => []),
    // Spec §19: repair plans
    prisma.adminWorkerRepairPlan
      .findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
      .catch(() => []),
    // Spec §19: post-publish verification logs
    prisma.postPublishVerification
      .findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
      .catch(() => []),
    // Spec §3 follow-up: strict-QA results
    prisma.adminWorkerStrictQAResult
      .findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          contentType: true,
          status: true,
          finalScore: true,
          blockingReasons: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    // Spec §4 follow-up: ContentQualityScore rows
    prisma.contentQualityScore
      .findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          contentType: true,
          contentId: true,
          finalScore: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    // Spec §1 follow-up: structured-block totals
    prisma.adminWorkerSourceBlock.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.adminWorkerSourceBlock
      .groupBy({
        by: ["blockType"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      })
      .catch(() => [] as Array<{ blockType: string; _count: { _all: number } }>),
    // Spec §19: current blockers (from AdminWorkerState)
    prisma.adminWorkerState
      .findUnique({ where: { id: "singleton" }, select: { currentBlocker: true } })
      .catch(() => null),
  ]);

  // Compute rejected-block count separately so groupBy stays simple.
  const rejectedBlockCount = await prisma.adminWorkerSourceBlock
    .count({ where: { createdAt: { gte: since }, isRejected: true } })
    .catch(() => 0);

  const currentBlockers: string[] = [];
  if (blockerState?.currentBlocker) currentBlockers.push(blockerState.currentBlocker);
  // Pipeline-stage blockers
  const blockedStages = pipelineStagesRaw.filter(
    (s) => s.status === "BLOCKED" || s.status === "FAILED",
  );
  for (const s of blockedStages.slice(0, 5)) {
    if (s.failureReason) currentBlockers.push(`${s.stageName}: ${s.failureReason}`);
  }

  return {
    generatedAt: new Date(),
    period,
    diagnosticsResults,
    diagnosticsSummary: summarizeRatings(diagnosticsResults),
    recentPasses,
    workerLogs,
    brainDecisions: brainDecisionsRaw.map((d) => ({
      id: d.id,
      createdAt: d.createdAt,
      chosenAction: d.chosenAction,
      missionStage: d.missionStage,
      contentType: d.contentType,
      confidence: d.confidence,
      riskScore: d.riskScore,
      reason: d.reason,
      brainExplanation: d.brainExplanation,
      brainFailure: d.brainFailure,
    })),
    pipelineStages: pipelineStagesRaw,
    contentGoals: contentGoalsRaw.map((g) => ({
      contentType: g.contentType,
      minimumTarget: g.minimumTarget,
      desiredTarget: g.desiredTarget,
      currentValidCount: g.currentValidCount,
      gapCount: g.gapCount,
      status: g.status,
    })),
    growthSnapshots: growthSnapshotsRaw.map((s) => ({
      contentType: s.contentType,
      status: s.status,
      gap: s.gap,
      growth24h: s.growth24h,
      growth7d: s.growth7d,
      recommendation: s.recommendation,
      createdAt: s.createdAt,
    })),
    sourceCoverage: sourceCoverageRaw.map((c) => ({
      contentType: c.contentType,
      coverageScore: c.coverageScore,
      blockedByCoverage: c.blockedByCoverage,
      blockReason: c.blockReason,
    })),
    sourceReputation: sourceReputationRaw.map((r) => ({
      sourceHost: r.sourceHost,
      contentType: r.contentType,
      reputationTier: r.reputationTier,
      publicPublishRate: r.publicPublishRate,
      qaPassRate: r.qaPassRate,
      fetchSuccessRate: r.fetchSuccessRate,
      paused: r.paused,
    })),
    recentMemory: recentMemoryRaw.map((m) => ({
      memoryType: m.memoryType,
      memoryKey: m.memoryKey,
      confidence: m.confidence,
      successCount: m.successCount,
      failureCount: m.failureCount,
      lastUsedAt: m.lastUsedAt,
    })),
    repairPlans: repairPlansRaw.map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      attempts: p.attempts,
      maxAttempts: p.maxAttempts,
      finalResult: p.finalResult,
      createdAt: p.createdAt,
    })),
    postPublishVerifications: postPublishVerificationsRaw.map((v) => ({
      contentType: v.contentType,
      contentId: v.contentId,
      slug: v.slug,
      result: v.result,
      errorMessage: v.errorMessage,
      createdAt: v.createdAt,
    })),
    strictQAResults: strictQAResultsRaw.map((q) => ({
      id: q.id,
      contentType: q.contentType,
      status: q.status,
      finalScore: q.finalScore,
      blockingReasons: q.blockingReasons,
      createdAt: q.createdAt,
    })),
    qualityScores: qualityScoresRaw.map((q) => ({
      id: q.id,
      contentType: q.contentType,
      contentId: q.contentId,
      finalScore: q.finalScore,
      createdAt: q.createdAt,
    })),
    structuredBlockStats: {
      total: sourceBlocksRaw,
      rejected: rejectedBlockCount,
      perType: sourceBlocksByType.map((b) => ({
        blockType: b.blockType,
        count: b._count._all,
      })),
    },
    contentFunnel: await collectContentFunnel(prisma),
    currentBlockers,
    whyNoGrowth: await collectWhyNoGrowthSnapshot(prisma),
  };
}

/**
 * Spec §17: per-content-type growth funnel for the Developer Audit.
 * Best-effort: degrades to an empty array on failure.
 */
async function collectContentFunnel(
  prisma: PrismaClient,
): Promise<DeveloperAuditData["contentFunnel"]> {
  try {
    const { computeContentFunnel } = await import("./content-growth-monitor");
    const rows = await computeContentFunnel(prisma);
    return rows.map((r) => ({
      contentType: r.contentType,
      candidatesDiscovered: r.candidatesDiscovered,
      packageArtifactsCreated: r.packageArtifactsCreated,
      strictQAPasses: r.strictQAPasses,
      publishedItems: r.publishedItems,
      postPublishPasses: r.postPublishPasses,
      firstEmptyStage: r.firstEmptyStage,
    }));
  } catch {
    return [];
  }
}

/**
 * Snapshot the live why-no-growth diagnostic for the Developer Audit
 * (spec §15 + §16). Best-effort: degrades to null on failure.
 */
async function collectWhyNoGrowthSnapshot(
  prisma: PrismaClient,
): Promise<DeveloperAuditData["whyNoGrowth"]> {
  try {
    const { diagnoseWhyNoGrowth } = await import("./why-no-growth");
    const report = await diagnoseWhyNoGrowth(prisma);
    return {
      blocker: report.blocker,
      blockerExplanation: report.blockerExplanation,
      exactTable: report.exactTable,
      nextAutomaticRepair: report.nextAutomaticRepair,
      nextWorkerDecision: report.nextWorkerDecision,
      checks: report.checks.map((c) => ({
        stage: c.stage,
        ok: c.ok,
        count: c.count,
        detail: c.detail,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Developer Audit table of contents (spec §19). The PDF generator
 * uses this list both for the actual TOC and to enforce that every
 * section is at least present in the audit (even if empty), so
 * comparing two audits over time is straightforward.
 */
export const DEVELOPER_AUDIT_SECTIONS = [
  "Table of Contents",
  "Executive Summary",
  "Diagnostics Results",
  "Admin Worker Brain Decisions",
  "Mission Plans",
  "Pipeline Stage History",
  "Content Goal Progress",
  "Content Growth Funnel",
  "Source Coverage",
  "Discovery Logs",
  "Fetch Logs",
  "Source Read Logs",
  "Structured Block Logs",
  "Classification Logs",
  "Extraction Logs",
  "Package Artifact Logs",
  "Checklist and Citation Logs",
  "Verification Logs",
  "QA Logs",
  "Strict QA Logs",
  "Quality Score Logs",
  "Publishing Logs",
  "Post-Publish Verification Logs",
  "Search and Sitemap Logs",
  "Cache Logs",
  "Repair Logs",
  "Security Logs",
  "Homepage Logs",
  "Source Reputation Changes",
  "Memory Changes",
  "Why No Content Growth",
  "Current Blockers",
  "Recommended Repairs",
  "Worker Logs",
  "System Logs",
  "Content Growth and Publishing",
  "Homepage Actions",
] as const;

export type DeveloperAuditSection = (typeof DEVELOPER_AUDIT_SECTIONS)[number];

export interface MonthlySummary {
  monthStart: Date;
  monthEnd: Date;
  totalContentBuilt: number;
  totalContentPublished: number;
  totalContentRejected: number;
  totalContentDeleted: number;
  totalSourcesUsed: number;
  bestSources: Array<{ host: string; saved: number }>;
  worstSources: Array<{ host: string; failures: number }>;
  workerUptimePct: number;
  workerFailures: number;
  securityEvents: number;
  homepageChanges: number;
}

/**
 * Compute the high-level monthly summary the email body shows.
 * Detailed per-day breakdown is computed by `dailyBreakdown`.
 */
export async function buildMonthlySummary(
  prisma: PrismaClient,
  monthStart: Date,
  monthEnd: Date,
): Promise<MonthlySummary> {
  const [passes, bestSources, securityCount, homepageDrafts] = await Promise.all([
    prisma.adminWorkerPass.findMany({
      where: { startedAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.adminWorkerSourceReputation.findMany({
      orderBy: { publicPublishRate: "desc" },
      take: 5,
    }),
    prisma.securityEvent.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.homepageWorkerDraft.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  const totals = passes.reduce(
    (acc, p) => ({
      built: acc.built + p.contentBuilt,
      published: acc.published + p.contentPublished,
      rejected: acc.rejected + p.contentRejected,
      failures: acc.failures + (p.status === "FAILED" ? 1 : 0),
      total: acc.total + 1,
    }),
    { built: 0, published: 0, rejected: 0, failures: 0, total: 0 },
  );
  const uptime = totals.total === 0 ? 0 : 1 - totals.failures / totals.total;

  return {
    monthStart,
    monthEnd,
    totalContentBuilt: totals.built,
    totalContentPublished: totals.published,
    totalContentRejected: totals.rejected,
    totalContentDeleted: 0,
    totalSourcesUsed: bestSources.length,
    bestSources: bestSources.map((s) => ({
      host: s.sourceHost,
      saved: Math.round(s.publicPublishRate * 100),
    })),
    worstSources: [],
    workerUptimePct: uptime,
    workerFailures: totals.failures,
    securityEvents: securityCount,
    homepageChanges: homepageDrafts,
  };
}

/** Return the last calendar day of the given month. */
export function lastDayOfMonth(year: number, month0: number): Date {
  return new Date(year, month0 + 1, 0);
}

export function isLastDayOfMonth(d: Date): boolean {
  const tomorrow = new Date(d);
  tomorrow.setDate(d.getDate() + 1);
  return tomorrow.getMonth() !== d.getMonth();
}

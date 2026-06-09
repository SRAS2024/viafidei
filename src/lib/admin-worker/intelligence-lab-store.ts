/**
 * Intelligence Laboratory persistence + read layer.
 *
 * TypeScript owns persistence (spec): the brain produces envelopes; these
 * helpers write the durable Lab* rows (proof packets, hypotheses, causal
 * graphs, benchmark/brain-version scores, strategy tournaments, capability
 * proposals, adversarial cases, architecture reports, …) and read them back
 * for the admin dashboard + the Developer Audit. Every query is guarded so the
 * worker loop and the pages never break when a table is empty or the DB blips.
 * Rows carry passId / brainCallId / contentId so they stay auditable + replayable.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

type Json = Prisma.InputJsonValue;

const j = (v: unknown): Json => (v ?? {}) as Json;

// ── Writers ──────────────────────────────────────────────────────────────────

export async function persistProofPacket(
  prisma: PrismaClient,
  packet: {
    passId?: string | null;
    contentId?: string | null;
    contentType?: string | null;
    claim?: string | null;
    sensitive?: boolean;
    conditionsSatisfied?: string[];
    conditionsFailed?: string[];
    riskLevel?: string;
    recommendedAction?: string;
    humanReviewRequired?: boolean;
    proven?: boolean;
    whatWouldChange?: string[];
    payload?: unknown;
  },
): Promise<string | null> {
  return prisma.labProofPacket
    .create({
      data: {
        passId: packet.passId ?? null,
        contentId: packet.contentId ?? null,
        contentType: packet.contentType ?? null,
        claim: packet.claim ?? null,
        sensitive: packet.sensitive ?? false,
        conditionsSatisfied: packet.conditionsSatisfied ?? [],
        conditionsFailed: packet.conditionsFailed ?? [],
        riskLevel: packet.riskLevel ?? "low",
        recommendedAction: packet.recommendedAction ?? "review",
        humanReviewRequired: packet.humanReviewRequired ?? false,
        proven: packet.proven ?? false,
        whatWouldChange: packet.whatWouldChange ?? [],
        payload: j(packet.payload),
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistArchitectureReport(
  prisma: PrismaClient,
  report: { passId?: string | null; integrity?: number; clean?: boolean; violations?: unknown },
): Promise<string | null> {
  return prisma.labArchitectureIntegrityReport
    .create({
      data: {
        passId: report.passId ?? null,
        integrity: report.integrity ?? 1,
        clean: report.clean ?? true,
        violations: j(report.violations ?? []),
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistCausalGraph(
  prisma: PrismaClient,
  g: {
    passId?: string | null;
    brainCallId?: string | null;
    factorCount?: number;
    edgeCount?: number;
    payload?: unknown;
  },
): Promise<string | null> {
  return prisma.labCausalGraph
    .create({
      data: {
        passId: g.passId ?? null,
        brainCallId: g.brainCallId ?? null,
        factorCount: g.factorCount ?? 0,
        edgeCount: g.edgeCount ?? 0,
        payload: j(g.payload),
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistHypothesis(
  prisma: PrismaClient,
  h: {
    passId?: string | null;
    hkey: string;
    statement: string;
    evidence?: string[];
    confidence?: number;
    impact?: number;
    expectedResult?: string;
    experimentPlan?: string;
    successCriteria?: string;
    status?: string;
    verdict?: string | null;
  },
): Promise<string | null> {
  return prisma.labHypothesis
    .create({
      data: {
        passId: h.passId ?? null,
        hkey: h.hkey,
        statement: h.statement,
        evidence: h.evidence ?? [],
        confidence: h.confidence ?? 0,
        impact: h.impact ?? 0,
        expectedResult: h.expectedResult ?? null,
        experimentPlan: h.experimentPlan ?? null,
        successCriteria: h.successCriteria ?? null,
        status: h.status ?? "PROPOSED",
        verdict: h.verdict ?? null,
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistBenchmarkRun(
  prisma: PrismaClient,
  b: {
    brainVersion?: string | null;
    overall?: number;
    weakest?: unknown;
    regression?: boolean;
    payload?: unknown;
  },
): Promise<string | null> {
  return prisma.labBenchmarkRun
    .create({
      data: {
        brainVersion: b.brainVersion ?? null,
        overall: b.overall ?? 0,
        weakest: j(b.weakest ?? []),
        regression: b.regression ?? false,
        payload: j(b.payload),
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistBrainVersionScore(
  prisma: PrismaClient,
  v: { version: string; score?: number; metrics?: unknown },
): Promise<string | null> {
  return prisma.labBrainVersionScore
    .create({
      data: { version: v.version, score: v.score ?? 0, metrics: j(v.metrics) },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistStrategyTournament(
  prisma: PrismaClient,
  t: {
    passId?: string | null;
    winner?: string | null;
    margin?: number;
    rationale?: string | null;
    payload?: unknown;
  },
): Promise<string | null> {
  return prisma.labStrategyTournament
    .create({
      data: {
        passId: t.passId ?? null,
        winner: t.winner ?? null,
        margin: t.margin ?? 0,
        rationale: t.rationale ?? null,
        payload: j(t.payload),
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistCapabilityProposal(
  prisma: PrismaClient,
  c: {
    passId?: string | null;
    developerRequestId?: string | null;
    name: string;
    problem?: string;
    expectedIntelligenceGain?: number;
    expectedGrowthGain?: number;
    expectedSafetyGain?: number;
    difficulty?: number;
    risk?: number;
    payload?: unknown;
  },
): Promise<string | null> {
  return prisma.labCapabilityProposal
    .create({
      data: {
        passId: c.passId ?? null,
        developerRequestId: c.developerRequestId ?? null,
        name: c.name,
        problem: c.problem ?? null,
        expectedIntelligenceGain: c.expectedIntelligenceGain ?? 0,
        expectedGrowthGain: c.expectedGrowthGain ?? 0,
        expectedSafetyGain: c.expectedSafetyGain ?? 0,
        difficulty: c.difficulty ?? 0,
        risk: c.risk ?? 0,
        reviewRequired: true,
        status: "PROPOSED",
        payload: j(c.payload),
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

export async function persistAdversarialCase(
  prisma: PrismaClient,
  a: {
    name: string;
    targetGate?: string | null;
    held?: boolean;
    regressionRequested?: boolean;
    developerRequestId?: string | null;
    payload?: unknown;
  },
): Promise<string | null> {
  return prisma.labAdversarialCase
    .create({
      data: {
        name: a.name,
        targetGate: a.targetGate ?? null,
        held: a.held ?? false,
        regressionRequested: a.regressionRequested ?? false,
        developerRequestId: a.developerRequestId ?? null,
        payload: j(a.payload),
      },
      select: { id: true },
    })
    .then((r) => r.id)
    .catch(() => null);
}

// ── Reader (dashboard + Developer Audit) ─────────────────────────────────────

export interface IntelligenceLabData {
  proofPackets: Array<{
    id: string;
    contentType: string | null;
    recommendedAction: string | null;
    proven: boolean;
    riskLevel: string;
    createdAt: Date;
  }>;
  failedProofCount: number;
  hypotheses: Array<{
    id: string;
    statement: string;
    status: string;
    confidence: number;
    createdAt: Date;
  }>;
  architectureReports: Array<{ id: string; integrity: number; clean: boolean; createdAt: Date }>;
  latestArchitectureIntegrity: number | null;
  benchmarkRuns: Array<{
    id: string;
    overall: number;
    regression: boolean;
    brainVersion: string | null;
    createdAt: Date;
  }>;
  brainVersions: Array<{ id: string; version: string; score: number; createdAt: Date }>;
  strategyTournaments: Array<{
    id: string;
    winner: string | null;
    margin: number;
    createdAt: Date;
  }>;
  capabilityProposals: Array<{
    id: string;
    name: string;
    status: string;
    risk: number;
    createdAt: Date;
  }>;
  adversarialCases: Array<{
    id: string;
    name: string;
    targetGate: string | null;
    held: boolean;
    createdAt: Date;
  }>;
  curriculumRuns: Array<{ id: string; overall: number; plateaus: string[]; createdAt: Date }>;
  digitalTwinRuns: Array<{
    id: string;
    scenarioCount: number;
    touchesProduction: boolean;
    createdAt: Date;
  }>;
  counterfactualRuns: Array<{
    id: string;
    bestAlternative: string | null;
    regret: number;
    createdAt: Date;
  }>;
  experimentPlans: Array<{ id: string; question: string; status: string; createdAt: Date }>;
  logicRuleFailures: Array<{ id: string; ruleId: string; detail: string | null; createdAt: Date }>;
  ontologyGaps: number;
  claimsByStatus: Record<string, number>;
  /** Highest-leverage next change (from the latest lab brain call, if recorded). */
  highestLeverage: string | null;
  counts: Record<string, number>;
}

/** Empty lab data — returned when no rows exist or the lab tables are absent. */
export function emptyIntelligenceLabData(): IntelligenceLabData {
  return {
    proofPackets: [],
    failedProofCount: 0,
    hypotheses: [],
    architectureReports: [],
    latestArchitectureIntegrity: null,
    benchmarkRuns: [],
    brainVersions: [],
    strategyTournaments: [],
    capabilityProposals: [],
    adversarialCases: [],
    curriculumRuns: [],
    digitalTwinRuns: [],
    counterfactualRuns: [],
    experimentPlans: [],
    logicRuleFailures: [],
    ontologyGaps: 0,
    claimsByStatus: {},
    highestLeverage: null,
    counts: {},
  };
}

export async function collectIntelligenceLabData(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<IntelligenceLabData> {
  // A mock / partial Prisma client (some unit tests) may not have the lab
  // tables generated; bail to empty rather than throwing on undefined access.
  const probe = prisma as unknown as { labProofPacket?: { findMany?: unknown } };
  if (typeof probe.labProofPacket?.findMany !== "function") {
    return emptyIntelligenceLabData();
  }
  const take = Math.max(1, Math.min(50, opts.limit ?? 10));
  const [
    proofPackets,
    failedProofCount,
    hypotheses,
    architectureReports,
    benchmarkRuns,
    brainVersions,
    strategyTournaments,
    capabilityProposals,
    adversarialCases,
    curriculumRuns,
    digitalTwinRuns,
    counterfactualRuns,
    experimentPlans,
    logicRuleFailures,
    ontologyGaps,
    claimGroups,
    latestLeverageCall,
  ] = await Promise.all([
    prisma.labProofPacket
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          contentType: true,
          recommendedAction: true,
          proven: true,
          riskLevel: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    prisma.labProofPacket.count({ where: { proven: false } }).catch(() => 0),
    prisma.labHypothesis
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, statement: true, status: true, confidence: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labArchitectureIntegrityReport
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, integrity: true, clean: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labBenchmarkRun
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, overall: true, regression: true, brainVersion: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labBrainVersionScore
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, version: true, score: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labStrategyTournament
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, winner: true, margin: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labCapabilityProposal
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, name: true, status: true, risk: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labAdversarialCase
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, name: true, targetGate: true, held: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labCurriculumRun
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, overall: true, plateaus: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labDigitalTwinRun
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, scenarioCount: true, touchesProduction: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labCounterfactualRun
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, bestAlternative: true, regret: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labExperimentPlan
      .findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, question: true, status: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labRuleEvaluation
      .findMany({
        where: { ok: false },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, ruleId: true, detail: true, createdAt: true },
      })
      .catch(() => []),
    prisma.labCatholicOntologyNode.count({ where: { entityType: "UNKNOWN" } }).catch(() => 0),
    prisma.labClaimRecord
      .groupBy({ by: ["epistemicStatus"], _count: { _all: true } })
      .catch(() => [] as Array<{ epistemicStatus: string; _count: { _all: number } }>),
    prisma.adminWorkerBrainCall
      .findFirst({
        where: { op: "rank_highest_leverage_change" },
        orderBy: { createdAt: "desc" },
        select: { reasoning: true },
      })
      .catch(() => null),
  ]);

  const claimsByStatus: Record<string, number> = {};
  for (const g of claimGroups as Array<{ epistemicStatus: string; _count: { _all: number } }>) {
    claimsByStatus[g.epistemicStatus] = g._count._all;
  }

  const counts: Record<string, number> = {
    proofPackets: proofPackets.length,
    hypotheses: hypotheses.length,
    benchmarkRuns: benchmarkRuns.length,
    capabilityProposals: capabilityProposals.length,
    adversarialCases: adversarialCases.length,
    strategyTournaments: strategyTournaments.length,
    architectureReports: architectureReports.length,
  };

  return {
    proofPackets,
    failedProofCount,
    hypotheses,
    architectureReports,
    latestArchitectureIntegrity: architectureReports[0]?.integrity ?? null,
    benchmarkRuns,
    brainVersions,
    strategyTournaments,
    capabilityProposals,
    adversarialCases,
    curriculumRuns,
    digitalTwinRuns,
    counterfactualRuns,
    experimentPlans,
    logicRuleFailures,
    ontologyGaps,
    claimsByStatus,
    highestLeverage: (latestLeverageCall as { reasoning: string | null } | null)?.reasoning ?? null,
    counts,
  };
}

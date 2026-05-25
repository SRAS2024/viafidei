/**
 * AdminWorkerDispatcher — proves the dispatcher actually executes the
 * chosen mission stage (spec §2). Replaces the old "merely log the
 * mission plan" behaviour: every stage maps to a concrete handler and
 * every dispatch returns a structured outcome (advanced / rejected /
 * repair-planned / idle) the loop can record.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/worker", () => ({
  runOneBuildCycle: vi.fn(async () => ({ kind: "idle" as const })),
}));

vi.mock("@/lib/admin-worker/homepage-mutator", () => ({
  redesignHomepage: vi.fn(async () => ({
    draftId: "d1",
    status: "AUTO_PUBLISHED",
    finalScore: 0.7,
    qualityScoreId: "q1",
    sectionsChanged: ["updated:hero"],
    reasonSummary: "test",
  })),
}));

vi.mock("@/lib/admin-worker/cleanup", () => ({
  runCleanupPass: vi.fn(async () => ({
    staleCandidatesRemoved: 3,
    expiredReviewsClosed: 1,
  })),
}));

vi.mock("@/lib/admin-worker/repair", () => ({
  recoverStuckQueue: vi.fn(async () => ({
    kind: "queue_stuck",
    attempted: false,
    succeeded: true,
    reason: "no stuck jobs",
  })),
  flagCacheRefresh: vi.fn(async () => ({
    kind: "cache_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
}));

vi.mock("@/lib/admin-worker/sitemap-discovery", () => ({
  discoverFromAllAuthorities: vi.fn(async () => [
    { host: "vatican.va", fetched: 1, inserted: 2, rejected: 0 },
    { host: "usccb.org", fetched: 1, inserted: 1, rejected: 0 },
  ]),
}));

vi.mock("@/lib/admin-worker/configured-urls", () => ({
  discoverFromConfiguredUrls: vi.fn(async () => ({
    total: 3,
    inserted: 1,
    rejected: 0,
  })),
}));

vi.mock("@/lib/admin-worker/directory-discovery", () => ({
  discoverFromDirectories: vi.fn(async () => ({
    directories: 1,
    fetched: 1,
    inserted: 1,
    rejected: 0,
  })),
}));

vi.mock("@/lib/admin-worker/diagnostics", () => ({
  runAdminWorkerDiagnostics: vi.fn(async () => [
    { name: "brain", score: 0.95, status: "pass" as const },
    { name: "discovery", score: 0.9, status: "pass" as const },
  ]),
}));

vi.mock("@/lib/admin-worker/classifier", () => ({
  classify: vi.fn(() => ({
    contentType: "PRAYER" as const,
    confidence: 0.9,
    reasons: ["URL path contains /prayer/"],
  })),
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import type { BrainAction, BrainDecision } from "@/lib/admin-worker/brain";

function makePrismaForDispatch(opts: { candidates?: number; unclassified?: number } = {}) {
  return {
    securityEvent: { count: vi.fn(async () => 0) },
    candidateSourceUrl: {
      findFirst: vi.fn(async () =>
        opts.candidates && opts.candidates > 0
          ? {
              id: "c1",
              discoveredUrl: "https://www.vatican.va/test",
              sourceHost: "www.vatican.va",
              predictedContentType: "PRAYER",
              predictedUsefulness: 0.7,
              fetchAttempts: 0,
            }
          : null,
      ),
      updateMany: vi.fn(async () => ({ count: 5 })),
      update: vi.fn(async () => ({})),
    },
    adminWorkerSourceRead: {
      findFirst: vi.fn(async () =>
        opts.unclassified && opts.unclassified > 0
          ? {
              id: "r1",
              sourceUrl: "https://www.vatican.va/test",
              sourceHost: "www.vatican.va",
              detectedContentType: null,
              extractedText: "Hail Mary, full of grace",
              extractedTitle: "Hail Mary",
              extractedHeadings: [],
            }
          : null,
      ),
      update: vi.fn(async () => ({})),
    },
    checklistQAReport: { count: vi.fn(async () => 0) },
    publishedContent: {
      findMany: vi.fn(async () => []),
    },
    postPublishVerification: {
      findMany: vi.fn(async () => []),
    },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
  } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"];
}

function makeAction(stage: BrainAction["missionStage"]): BrainAction {
  return {
    actionType: "DISCOVER_SOURCE",
    missionStage: stage,
    mode: "CONSTANT_FILL",
    priority: "CONTENT_GOAL",
    passType: "CONTENT_GOAL",
    contentType: "PRAYER",
    sourceTarget: null,
    candidateUrl: null,
    expectedOutput: "test",
    confidenceScore: 0.9,
    riskScore: 0.1,
    qualityExpectation: 0.6,
    urgencyScore: 10,
    sourceScore: 0.5,
    repairScore: 0,
    finalScore: 10,
    fallbackAction: null,
    stopCondition: "test",
    reasonSummary: "test",
    rulesEvaluated: {},
    safe: true,
    rejectionReason: null,
  };
}

function makeDecision(stage: BrainAction["missionStage"]): BrainDecision {
  const action = makeAction(stage);
  return {
    chosenMode: action.mode,
    chosenPriority: action.priority,
    chosenTaskType: action.actionType === "PAUSED" ? null : action.actionType,
    passType: action.passType,
    contentType: action.contentType,
    sourceTarget: null,
    expectedResult: action.expectedOutput,
    confidenceScore: action.confidenceScore,
    riskScore: action.riskScore,
    reason: action.reasonSummary,
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: action,
    rankedAlternatives: [action],
    missionStage: stage,
    brainExplanation: "test",
    brainFailure: null,
  };
}

describe("executeMissionStage — concrete stage handlers (spec §2)", () => {
  it("DISCOVERY runs the sitemap, configured-URL, and directory discoverers", async () => {
    const prisma = makePrismaForDispatch();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("DISCOVERY"),
    });
    expect(out.stage).toBe("DISCOVERY");
    expect(out.kind).toBe("advanced");
    // sitemap inserted 3, configured 1, directory 1 → 5 total
    expect(out.metadata).toMatchObject({ surfaced: 5 });
  });

  it("CANDIDATE_PRIORITIZATION promotes DISCOVERED candidates to PRIORITIZED", async () => {
    const prisma = makePrismaForDispatch();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("CANDIDATE_PRIORITIZATION"),
    });
    expect(out.stage).toBe("CANDIDATE_PRIORITIZATION");
    expect(out.kind).toBe("advanced");
    expect(out.metadata).toMatchObject({ promoted: 5 });
  });

  it("SOURCE_FETCH leases the highest-priority candidate", async () => {
    const prisma = makePrismaForDispatch({ candidates: 1 });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("SOURCE_FETCH"),
    });
    expect(out.stage).toBe("SOURCE_FETCH");
    expect(out.kind).toBe("advanced");
    expect(out.summary).toContain("vatican.va");
  });

  it("SOURCE_FETCH returns idle when no candidates are available", async () => {
    const prisma = makePrismaForDispatch({ candidates: 0 });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("SOURCE_FETCH"),
    });
    expect(out.kind).toBe("idle");
  });

  it("CLASSIFICATION classifies an unclassified source read", async () => {
    const prisma = makePrismaForDispatch({ unclassified: 1 });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("CLASSIFICATION"),
    });
    expect(out.stage).toBe("CLASSIFICATION");
    expect(out.kind).toBe("advanced");
    expect(out.summary).toContain("PRAYER");
  });

  it("CLASSIFICATION returns idle when nothing is unclassified", async () => {
    const prisma = makePrismaForDispatch({ unclassified: 0 });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("CLASSIFICATION"),
    });
    expect(out.kind).toBe("idle");
  });

  it("CACHE_REFRESH calls flagCacheRefresh", async () => {
    const prisma = makePrismaForDispatch();
    const { flagCacheRefresh } = await import("@/lib/admin-worker/repair");
    vi.mocked(flagCacheRefresh).mockClear();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("CACHE_REFRESH"),
    });
    expect(out.kind).toBe("advanced");
    expect(vi.mocked(flagCacheRefresh)).toHaveBeenCalledTimes(1);
  });

  it("HOMEPAGE_WORK calls the homepage mutator", async () => {
    const prisma = makePrismaForDispatch();
    const { redesignHomepage } = await import("@/lib/admin-worker/homepage-mutator");
    vi.mocked(redesignHomepage).mockClear();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("HOMEPAGE_WORK"),
    });
    expect(out.kind).toBe("advanced");
    expect(vi.mocked(redesignHomepage)).toHaveBeenCalledTimes(1);
  });

  it("REPAIR calls recoverStuckQueue", async () => {
    const prisma = makePrismaForDispatch();
    const { recoverStuckQueue } = await import("@/lib/admin-worker/repair");
    vi.mocked(recoverStuckQueue).mockClear();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("REPAIR"),
    });
    expect(out.kind).toBe("advanced");
    expect(vi.mocked(recoverStuckQueue)).toHaveBeenCalledTimes(1);
  });

  it("MAINTENANCE calls runCleanupPass", async () => {
    const prisma = makePrismaForDispatch();
    const { runCleanupPass } = await import("@/lib/admin-worker/cleanup");
    vi.mocked(runCleanupPass).mockClear();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("MAINTENANCE"),
    });
    expect(out.kind).toBe("advanced");
    expect(vi.mocked(runCleanupPass)).toHaveBeenCalledTimes(1);
  });

  it("REPORTING calls runAdminWorkerDiagnostics", async () => {
    const prisma = makePrismaForDispatch();
    const { runAdminWorkerDiagnostics } = await import("@/lib/admin-worker/diagnostics");
    vi.mocked(runAdminWorkerDiagnostics).mockClear();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("REPORTING"),
    });
    expect(out.kind).toBe("advanced");
    expect(vi.mocked(runAdminWorkerDiagnostics)).toHaveBeenCalledTimes(1);
    expect(out.metadata).toMatchObject({ ratingsCount: 2 });
  });

  it("PAUSED returns idle without invoking any handler", async () => {
    const prisma = makePrismaForDispatch();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("PAUSED"),
    });
    expect(out.kind).toBe("idle");
    expect(out.stage).toBe("PAUSED");
  });

  it("returns a 'failed' outcome when a handler throws", async () => {
    const prisma = makePrismaForDispatch();
    const { runCleanupPass } = await import("@/lib/admin-worker/cleanup");
    vi.mocked(runCleanupPass).mockRejectedValueOnce(new Error("boom"));
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: makeDecision("MAINTENANCE"),
    });
    expect(out.kind).toBe("failed");
    expect(out.summary).toContain("boom");
  });
});

/**
 * Production-readiness report (spec §28). Verifies every check is
 * present and the composite score reflects passing / failing counts.
 */

import { describe, expect, it, vi } from "vitest";

import { runReadiness } from "@/lib/admin-worker/readiness";

function makePrisma(
  stub: Partial<{
    heartbeatAgeMs: number;
    decisions: number;
    contentGoals: number;
    candidateUrls: number;
    sourceReads: number;
    buildJobs: number;
    qaReports: number;
    postPublish: number;
    publishedContent: number;
    securityActions: number;
    homepageScores: number;
    recentReport: Date | null;
    pipelineStages: number;
    growthSnapshots: number;
    sourceCoverage: number;
    coverageBlocked: number;
    crossSourceVerifications: number;
  }>,
) {
  const opts = {
    heartbeatAgeMs: 1000,
    decisions: 1,
    contentGoals: 11,
    candidateUrls: 5,
    sourceReads: 3,
    buildJobs: 4,
    qaReports: 4,
    postPublish: 2,
    publishedContent: 3,
    securityActions: 1,
    homepageScores: 1,
    recentReport: new Date() as Date | null,
    pipelineStages: 5,
    growthSnapshots: 3,
    sourceCoverage: 11,
    coverageBlocked: 0,
    crossSourceVerifications: 2,
    ...stub,
  };
  const lastHeartbeatAt = new Date(Date.now() - opts.heartbeatAgeMs);
  return {
    adminWorkerState: {
      findUnique: vi.fn(async () => ({ id: "singleton", lastHeartbeatAt })),
    },
    adminWorkerDecision: { count: vi.fn(async () => opts.decisions) },
    contentGoal: { count: vi.fn(async () => opts.contentGoals) },
    candidateSourceUrl: { count: vi.fn(async () => opts.candidateUrls) },
    publishedContent: {
      count: vi.fn(async () => opts.publishedContent),
      // Spec §1: readiness checks recent published rows trace to artifacts.
      findMany: vi.fn(async () => []),
    },
    adminWorkerPackageArtifact: { count: vi.fn(async () => 0) },
    adminWorkerSourceRead: { count: vi.fn(async () => opts.sourceReads) },
    workerBuildJob: { count: vi.fn(async () => opts.buildJobs) },
    checklistQAReport: { count: vi.fn(async () => opts.qaReports) },
    postPublishVerification: { count: vi.fn(async () => opts.postPublish) },
    adminWorkerSecurityAction: { count: vi.fn(async () => opts.securityActions) },
    homepageQualityScore: { count: vi.fn(async () => opts.homepageScores) },
    adminDeveloperReportLog: {
      findFirst: vi.fn(async () => (opts.recentReport ? { generatedAt: opts.recentReport } : null)),
    },
    adminWorkerPipelineStage: { count: vi.fn(async () => opts.pipelineStages) },
    adminWorkerGrowthSnapshot: { count: vi.fn(async () => opts.growthSnapshots) },
    adminWorkerSourceCoverage: {
      count: vi.fn(async ({ where }: { where?: { blockedByCoverage?: boolean } } = {}) => {
        if (where?.blockedByCoverage) return opts.coverageBlocked;
        return opts.sourceCoverage;
      }),
    },
    adminWorkerCrossSourceVerification: {
      count: vi.fn(async () => opts.crossSourceVerifications),
    },
  } as unknown as Parameters<typeof runReadiness>[0];
}

describe("runReadiness", () => {
  it("reports 100% when every check passes", async () => {
    const report = await runReadiness(makePrisma({}));
    expect(report.score).toBe(1);
    expect(report.failing).toBe(0);
    expect(report.checks.every((c) => c.status === "pass")).toBe(true);
  });

  it("fails the heartbeat check when stale", async () => {
    const report = await runReadiness(makePrisma({ heartbeatAgeMs: 10 * 60_000 }));
    const hb = report.checks.find((c) => c.key === "heartbeat");
    expect(hb?.status).toBe("fail");
    expect(hb?.repair).toContain("worker");
  });

  it("fails when no content goals exist", async () => {
    const report = await runReadiness(makePrisma({ contentGoals: 0 }));
    const goals = report.checks.find((c) => c.key === "content_goals");
    expect(goals?.status).toBe("fail");
  });

  it("fails when no candidate URLs exist", async () => {
    const report = await runReadiness(makePrisma({ candidateUrls: 0 }));
    expect(report.checks.find((c) => c.key === "source_discovery")?.status).toBe("fail");
  });

  it("fails when no Developer Audit has been generated", async () => {
    const report = await runReadiness(makePrisma({ recentReport: null }));
    expect(report.checks.find((c) => c.key === "developer_audit")?.status).toBe("fail");
  });

  it("includes a concrete repair instruction for every check", async () => {
    const report = await runReadiness(makePrisma({}));
    for (const check of report.checks) {
      expect(check.repair.length).toBeGreaterThan(10);
    }
  });

  it("composite score matches passing/total ratio", async () => {
    const report = await runReadiness(makePrisma({ heartbeatAgeMs: 10 * 60_000, contentGoals: 0 }));
    expect(report.failing).toBe(2);
    expect(report.score).toBeCloseTo((report.checks.length - 2) / report.checks.length, 5);
  });
});

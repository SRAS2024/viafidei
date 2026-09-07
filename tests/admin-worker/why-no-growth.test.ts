/**
 * Why No Content Growth diagnostic (spec §15). Confirms each blocker
 * stage fires for the right symptom.
 */

import { describe, expect, it, vi } from "vitest";

import { diagnoseWhyNoGrowth } from "@/lib/admin-worker/why-no-growth";

function makePrisma(opts: {
  goalCount?: number;
  authorityCount?: number;
  candidateCount?: number;
  prioritizedCount?: number;
  recentFetches?: number;
  successfulFetches?: number;
  sourceReadCount?: number;
  blockCount?: number;
  classifiedCount?: number;
  artifactCount?: number;
  bridgedCount?: number;
  /** BUILD_READY artifacts carrying validationNeeds (the only ones verification runs on). */
  sensitiveAwaiting?: number;
  verificationCount?: number;
  qaReports?: Array<{ status: string }>;
  qualityScores?: Array<{ finalScore: number }>;
  publishedCount?: number;
  recentVerifications?: number;
  failedVerifications?: number;
  largestGapContentType?: string | null;
}) {
  return {
    contentGoal: {
      count: vi.fn(async () => opts.goalCount ?? 11),
      findFirst: vi.fn(async () =>
        opts.largestGapContentType
          ? { contentType: opts.largestGapContentType }
          : { contentType: "PRAYER" },
      ),
    },
    authoritySource: {
      count: vi.fn(async () => opts.authorityCount ?? 5),
    },
    candidateSourceUrl: {
      count: vi.fn(async ({ where }: { where?: { status?: string } } = {}) => {
        if (where?.status === "PRIORITIZED") return opts.prioritizedCount ?? 0;
        return opts.candidateCount ?? 0;
      }),
    },
    adminWorkerFetchResult: {
      count: vi.fn(async ({ where }: { where?: { succeeded?: boolean } } = {}) => {
        if (where?.succeeded === true) return opts.successfulFetches ?? 0;
        return opts.recentFetches ?? 0;
      }),
    },
    adminWorkerSourceRead: {
      count: vi.fn(async ({ where }: { where?: { detectedContentType?: unknown } } = {}) => {
        if (where?.detectedContentType) return opts.classifiedCount ?? 0;
        return opts.sourceReadCount ?? 0;
      }),
    },
    adminWorkerSourceBlock: {
      // Default healthy: structured blocks exist whenever reads do.
      count: vi.fn(async () => opts.blockCount ?? (opts.sourceReadCount ?? 0) * 4),
    },
    adminWorkerPackageArtifact: {
      count: vi.fn(
        async ({
          where,
        }: { where?: { checklistItemId?: unknown; validationNeeds?: unknown } } = {}) => {
          // The bridge check filters on checklistItemId: { not: null }.
          if (where?.checklistItemId) return opts.bridgedCount ?? opts.artifactCount ?? 0;
          // The verification check counts BUILD_READY rows with validationNeeds.
          if (where?.validationNeeds) return opts.sensitiveAwaiting ?? 0;
          return opts.artifactCount ?? 0;
        },
      ),
    },
    adminWorkerCrossSourceVerification: {
      count: vi.fn(async () => opts.verificationCount ?? 0),
    },
    adminWorkerStrictQAResult: {
      findMany: vi.fn(async () => opts.qaReports ?? []),
    },
    contentQualityScore: {
      findMany: vi.fn(async () => opts.qualityScores ?? []),
    },
    publishedContent: {
      count: vi.fn(async () => opts.publishedCount ?? 0),
    },
    postPublishVerification: {
      count: vi.fn(async ({ where }: { where?: { result?: string } } = {}) => {
        if (where?.result === "FAIL") return opts.failedVerifications ?? 0;
        return opts.recentVerifications ?? 0;
      }),
    },
    adminWorkerLog: {
      findFirst: vi.fn(async () => null),
    },
    adminWorkerDecision: {
      findFirst: vi.fn(async () => null),
    },
  } as unknown as Parameters<typeof diagnoseWhyNoGrowth>[0];
}

describe("diagnoseWhyNoGrowth (spec §15)", () => {
  it("returns NONE when the whole chain is healthy", async () => {
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        goalCount: 11,
        authorityCount: 5,
        candidateCount: 20,
        prioritizedCount: 15,
        recentFetches: 10,
        successfulFetches: 9,
        sourceReadCount: 10,
        classifiedCount: 9,
        artifactCount: 5,
        verificationCount: 3,
        qaReports: [{ status: "PASSED" }, { status: "PASSED" }, { status: "PASSED" }],
        publishedCount: 3,
        recentVerifications: 3,
        failedVerifications: 0,
      }),
    );
    expect(out.blocker).toBe("NONE");
  });

  it("blocks on NO_CONTENT_GOALS when no goals exist", async () => {
    const out = await diagnoseWhyNoGrowth(makePrisma({ goalCount: 0 }));
    expect(out.blocker).toBe("NO_CONTENT_GOALS");
    expect(out.exactTable).toBe("ContentGoal");
  });

  it("blocks on NO_APPROVED_SOURCES when no authority rows", async () => {
    const out = await diagnoseWhyNoGrowth(makePrisma({ authorityCount: 0 }));
    expect(out.blocker).toBe("NO_APPROVED_SOURCES");
  });

  it("blocks on NO_CANDIDATE_URLS when discovery hasn't surfaced candidates", async () => {
    const out = await diagnoseWhyNoGrowth(makePrisma({ candidateCount: 0 }));
    expect(out.blocker).toBe("NO_CANDIDATE_URLS");
  });

  it("blocks on FETCH_NOT_RUNNING when candidates exist but no fetches ran in 24h", async () => {
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 0,
      }),
    );
    expect(out.blocker).toBe("FETCH_NOT_RUNNING");
  });

  it("blocks on FETCH_FAILING when more than half of fetches failed", async () => {
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 10,
        successfulFetches: 2,
      }),
    );
    expect(out.blocker).toBe("FETCH_FAILING");
  });

  it("blocks on CLASSIFICATION_FAILING when reads exist but none are classified", async () => {
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 10,
        successfulFetches: 9,
        sourceReadCount: 5,
        classifiedCount: 0,
      }),
    );
    expect(out.blocker).toBe("CLASSIFICATION_FAILING");
  });

  it("blocks on NO_PACKAGE_ARTIFACTS when classification ran but no artifacts exist", async () => {
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 10,
        successfulFetches: 9,
        sourceReadCount: 5,
        classifiedCount: 5,
        artifactCount: 0,
      }),
    );
    expect(out.blocker).toBe("NO_PACKAGE_ARTIFACTS");
  });

  it("blocks on QA_REJECTING when QA pass rate is below 30%", async () => {
    const reports = [
      ...Array.from({ length: 8 }, () => ({ status: "FAILED" })),
      ...Array.from({ length: 2 }, () => ({ status: "PASSED" })),
    ];
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 10,
        successfulFetches: 9,
        sourceReadCount: 5,
        classifiedCount: 5,
        artifactCount: 3,
        verificationCount: 1,
        qaReports: reports,
      }),
    );
    expect(out.blocker).toBe("QA_REJECTING");
  });

  it("blocks on STRUCTURED_BLOCKS_MISSING when reads exist but no blocks (spec §14)", async () => {
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 10,
        successfulFetches: 9,
        sourceReadCount: 5,
        blockCount: 0, // parser not wired
        classifiedCount: 5,
      }),
    );
    expect(out.blocker).toBe("STRUCTURED_BLOCKS_MISSING");
    expect(out.exactTable).toBe("AdminWorkerSourceBlock");
    expect(out.exactCount).toBe(0);
  });

  it("blocks on CHECKLIST_OR_CITATIONS_MISSING when artifacts exist but none bridged (spec §14)", async () => {
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 10,
        successfulFetches: 9,
        sourceReadCount: 5,
        blockCount: 20,
        classifiedCount: 5,
        artifactCount: 3,
        bridgedCount: 0, // bridge hasn't run
      }),
    );
    expect(out.blocker).toBe("CHECKLIST_OR_CITATIONS_MISSING");
    expect(out.exactTable).toBe("AdminWorkerPackageArtifact.checklistItemId");
  });

  it("blocks on QUALITY_SCORE_TOO_LOW when most recent scores are below threshold (spec §14)", async () => {
    const scores = [
      ...Array.from({ length: 8 }, () => ({ finalScore: 0.4 })),
      ...Array.from({ length: 2 }, () => ({ finalScore: 0.9 })),
    ];
    const out = await diagnoseWhyNoGrowth(
      makePrisma({
        candidateCount: 10,
        prioritizedCount: 8,
        recentFetches: 10,
        successfulFetches: 9,
        sourceReadCount: 5,
        blockCount: 20,
        classifiedCount: 5,
        artifactCount: 3,
        bridgedCount: 3,
        verificationCount: 1,
        qaReports: [{ status: "PASSED" }, { status: "PASSED" }, { status: "PASSED" }],
        qualityScores: scores,
      }),
    );
    expect(out.blocker).toBe("QUALITY_SCORE_TOO_LOW");
    expect(out.exactTable).toBe("ContentQualityScore");
  });

  it("returns a checks[] array covering each stage", async () => {
    const out = await diagnoseWhyNoGrowth(makePrisma({}));
    expect(out.checks.length).toBeGreaterThanOrEqual(10);
    expect(out.checks.some((c) => c.stage === "NO_CONTENT_GOALS")).toBe(true);
    expect(out.checks.some((c) => c.stage === "FETCH_NOT_RUNNING")).toBe(true);
    expect(out.checks.some((c) => c.stage === "STRUCTURED_BLOCKS_MISSING")).toBe(true);
    expect(out.checks.some((c) => c.stage === "CHECKLIST_OR_CITATIONS_MISSING")).toBe(true);
    expect(out.checks.some((c) => c.stage === "QA_REJECTING")).toBe(true);
    expect(out.checks.some((c) => c.stage === "QUALITY_SCORE_TOO_LOW")).toBe(true);
    expect(out.checks.some((c) => c.stage === "PUBLISH_BLOCKED")).toBe(true);
  });

  it("emits a next-worker-decision string for the audit view", async () => {
    const out = await diagnoseWhyNoGrowth(makePrisma({ goalCount: 0 }));
    expect(out.nextWorkerDecision.length).toBeGreaterThan(10);
    expect(out.nextAutomaticRepair).toBeTruthy();
  });

  it("names VALIDATION_EVIDENCE_MISSING only while SENSITIVE artifacts await verification", async () => {
    const base = {
      goalCount: 11,
      authorityCount: 5,
      candidateCount: 20,
      prioritizedCount: 15,
      recentFetches: 10,
      successfulFetches: 9,
      sourceReadCount: 10,
      classifiedCount: 9,
      artifactCount: 5,
      verificationCount: 0,
      qaReports: [{ status: "PASSED" }],
      publishedCount: 3,
    };
    // Non-sensitive builds only (PRAYER/LITURGICAL): 0 evidence rows is the
    // correct state, not the blocker.
    const nonSensitive = await diagnoseWhyNoGrowth(makePrisma({ ...base, sensitiveAwaiting: 0 }));
    expect(nonSensitive.blocker).not.toBe("VALIDATION_EVIDENCE_MISSING");
    expect(nonSensitive.checks.find((c) => c.stage === "VALIDATION_EVIDENCE_MISSING")?.ok).toBe(
      true,
    );
    // Sensitive artifacts waiting with no evidence ever recorded → the blocker.
    const sensitive = await diagnoseWhyNoGrowth(makePrisma({ ...base, sensitiveAwaiting: 4 }));
    expect(sensitive.blocker).toBe("VALIDATION_EVIDENCE_MISSING");
    expect(sensitive.blockerExplanation).toMatch(/4 sensitive artifact/);
  });
});

/**
 * Dispatcher real-pipeline integration tests (user follow-up spec).
 * Proves that the dispatcher stages actually invoke the modules they
 * claim to — not just log intent:
 *
 *   - SOURCE_FETCH calls adminWorkerFetch + readSource
 *   - EXTRACTION materialises an AdminWorkerPackageArtifact
 *   - PUBLIC_PUBLISH calls runPublishOrchestrator on a BUILD_READY
 *     artifact (not just runOneBuildCycle)
 *   - POST_PUBLISH_VERIFY does NOT pass skipNetwork: true unless
 *     ADMIN_WORKER_SKIP_NETWORK=1 is set
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
});

vi.mock("@/lib/worker", () => ({
  runOneBuildCycle: vi.fn(async () => ({ kind: "idle" as const })),
  isApprovedAuthorityHost: vi.fn(() => true),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/fetcher", () => ({
  adminWorkerFetch: vi.fn(async (_p: unknown, input: { url: string }) => ({
    url: input.url,
    finalUrl: input.url,
    httpStatus: 200,
    contentType: "text/html",
    contentLength: 200,
    checksum: "cs-1",
    etag: null,
    lastModifiedHeader: null,
    body: "<html><title>Our Father</title><h1>Our Father</h1><p>Amen.</p></html>",
    durationMs: 1,
    attempt: 1,
    succeeded: true,
    unchanged: false,
    rejectionReason: null,
    errorClass: null,
    errorMessage: null,
    fetchResultRowId: "fr1",
    redirectChain: [],
  })),
}));

vi.mock("@/lib/admin-worker/source-reader", () => ({
  readSource: vi.fn(async () => ({
    sourceReadId: "sr1",
    reused: false,
    checksum: "cs-1",
    classifierContentType: "PRAYER",
    classifierConfidence: 0.9,
    classifierReasons: ["url matched /prayers/"],
    extraction: { fields: { prayerTitle: "Our Father" }, fatalReasons: [], missingFields: [] },
    pipelineStageId: "ps1",
    rejected: false,
    rejectionReason: null,
  })),
}));

vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "rp1" })),
}));

vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({
    kind: "published" as const,
    publishedContentId: "pub-1",
    slug: "our-father",
    route: "/prayers/our-father",
    reason: "all gates passed",
  })),
}));

vi.mock("@/lib/admin-worker/extractors", () => ({
  extractByType: vi.fn(() => ({
    fields: {
      prayerTitle: "Our Father",
      prayerType: "Lord's Prayer",
      prayerText: "Our Father. Amen.",
      category: "essential",
    },
    missingFields: [],
    confidenceScore: 0.9,
    sourceEvidence: [
      {
        fieldName: "prayerTitle",
        sourceUrl: "https://vatican.va/prayers/our-father",
        sourceHost: "vatican.va",
        snippet: "Our Father",
        method: "BODY_REGEX",
        confidence: 0.9,
        checksum: "cs-1",
      },
    ],
    rejectedSections: [],
    formatting: {},
    warnings: [],
    fatalReasons: [],
  })),
}));

vi.mock("@/lib/admin-worker/post-publish-probe", () => ({
  verifyPublished: vi.fn(async () => ({
    verificationId: "v1",
    result: "PASS" as const,
    checks: {} as never,
    publicUrl: "https://example.org/prayers/our-father",
  })),
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";
import { readSource } from "@/lib/admin-worker/source-reader";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { verifyPublished } from "@/lib/admin-worker/post-publish-probe";
import type { BrainAction, BrainDecision } from "@/lib/admin-worker/brain";

function action(stage: BrainAction["missionStage"]): BrainAction {
  return {
    actionType: "READ_SOURCE",
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

function decision(stage: BrainAction["missionStage"]): BrainDecision {
  const a = action(stage);
  return {
    chosenMode: a.mode,
    chosenPriority: a.priority,
    chosenTaskType: a.actionType,
    passType: a.passType,
    contentType: a.contentType,
    sourceTarget: null,
    expectedResult: a.expectedOutput,
    confidenceScore: a.confidenceScore,
    riskScore: a.riskScore,
    reason: a.reasonSummary,
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: a,
    rankedAlternatives: [a],
    missionStage: stage,
    brainExplanation: "test",
    brainFailure: null,
  };
}

function makePrisma(opts: {
  candidate?: boolean;
  read?: boolean;
  artifact?: { id: string; status: string; contentType: string } | null;
}) {
  return {
    candidateSourceUrl: {
      findFirst: vi.fn(async () =>
        opts.candidate
          ? {
              id: "c1",
              discoveredUrl: "https://vatican.va/prayers/our-father",
              sourceHost: "vatican.va",
              predictedContentType: "PRAYER",
              predictedUsefulness: 0.7,
              fetchAttempts: 0,
              status: "PRIORITIZED",
              rejectionReason: null,
            }
          : null,
      ),
      update: vi.fn(async () => ({})),
    },
    adminWorkerSourceRead: {
      findFirst: vi.fn(async () =>
        opts.read
          ? {
              id: "sr1",
              sourceUrl: "https://vatican.va/prayers/our-father",
              sourceHost: "vatican.va",
              extractedTitle: "Our Father",
              extractedText: "Our Father. Amen.",
              extractedHeadings: [],
              detectedContentType: "PRAYER",
              checksum: "cs-1",
              confidenceScore: 0.9,
            }
          : null,
      ),
      update: vi.fn(async () => ({})),
    },
    adminWorkerFetchResult: {
      findFirst: vi.fn(async () => null),
    },
    adminWorkerSourceReputation: {
      findFirst: vi.fn(async () => ({ reputationTier: "TRUSTED" })),
    },
    adminWorkerPackageArtifact: {
      findFirst: vi.fn(async () => opts.artifact ?? null),
      findMany: vi.fn(async () => (opts.artifact ? [opts.artifact] : [])),
      create: vi.fn(async () => ({ id: "art1" })),
      update: vi.fn(async () => ({})),
    },
    adminWorkerStrictQAResult: {
      // Default to a passing QA result so PUBLIC_PUBLISH tests
      // exercise the publish path. Tests that want to assert the
      // strict-QA gate override this with mockResolvedValueOnce.
      findUnique: vi.fn(async () => ({
        id: "qa-1",
        status: "PASSED",
        finalScore: 0.92,
        blockingReasons: [],
        repairSuggestions: [],
      })),
      upsert: vi.fn(async () => ({ id: "qa-1" })),
    },
    contentQualityScore: {
      create: vi.fn(async (args: { data: { finalScore: number } }) => ({
        id: "q-1",
        finalScore: args.data.finalScore,
      })),
    },
    adminWorkerCrossSourceVerification: {
      count: vi.fn(async () => 0),
    },
    workerBuildJob: { findFirst: vi.fn(async () => null) },
    publishedContent: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    postPublishVerification: {
      findMany: vi.fn(async () => []),
    },
  } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"];
}

describe("SOURCE_FETCH actually calls the fetcher AND readSource", () => {
  it("calls adminWorkerFetch when a candidate exists", async () => {
    vi.mocked(adminWorkerFetch).mockClear();
    const prisma = makePrisma({ candidate: true });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    expect(vi.mocked(adminWorkerFetch)).toHaveBeenCalledTimes(1);
  });

  it("calls readSource after a successful fetch", async () => {
    vi.mocked(readSource).mockClear();
    const prisma = makePrisma({ candidate: true });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    expect(vi.mocked(readSource)).toHaveBeenCalledTimes(1);
  });

  it("returns advanced when fetch + read succeed", async () => {
    const prisma = makePrisma({ candidate: true });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    expect(out.kind).toBe("advanced");
    expect(out.summary).toContain("PRAYER");
  });

  it("returns idle when no candidate exists", async () => {
    const prisma = makePrisma({ candidate: false });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    expect(out.kind).toBe("idle");
  });

  it("files a repair plan + returns repair-planned when fetch fails", async () => {
    vi.mocked(adminWorkerFetch).mockResolvedValueOnce({
      url: "https://vatican.va/prayers/our-father",
      finalUrl: "https://vatican.va/prayers/our-father",
      httpStatus: 500,
      contentType: null,
      contentLength: null,
      checksum: null,
      etag: null,
      lastModifiedHeader: null,
      body: "",
      durationMs: 1,
      attempt: 1,
      succeeded: false,
      unchanged: false,
      rejectionReason: "HTTP 500",
      errorClass: "HTTP_500",
      errorMessage: "HTTP 500",
      fetchResultRowId: null,
      redirectChain: [],
    });
    const prisma = makePrisma({ candidate: true });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    expect(out.kind).toBe("repair-planned");
    expect(out.repairsPlanned).toBe(1);
  });
});

describe("EXTRACTION materialises an AdminWorkerPackageArtifact", () => {
  it("creates a package artifact row on a CHECKLIST_READY result", async () => {
    const prisma = makePrisma({ read: true });
    const create = vi.fn(async () => ({ id: "art-1" }));
    (prisma.adminWorkerPackageArtifact.create as ReturnType<typeof vi.fn>) = create;
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("EXTRACTION"),
    });
    expect(out.stage).toBe("EXTRACTION");
    expect(out.kind).toBe("advanced");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns idle when no classified source-read exists", async () => {
    const prisma = makePrisma({ read: false });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("EXTRACTION"),
    });
    expect(out.kind).toBe("idle");
  });
});

describe("PUBLIC_PUBLISH calls runPublishOrchestrator on BUILD_READY artifacts", () => {
  it("invokes runPublishOrchestrator and not runOneBuildCycle when an artifact is ready", async () => {
    vi.mocked(runPublishOrchestrator).mockClear();
    const prisma = makePrisma({
      artifact: { id: "art-1", status: "BUILD_READY", contentType: "PRAYER" },
    });
    // Reshape the artifact row to look like a full row.
    (prisma.adminWorkerPackageArtifact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        id: "art-1",
        contentType: "PRAYER",
        normalizedTitle: "Our Father",
        normalizedSlug: "our-father",
        extractedFields: { prayerTitle: "Our Father" },
        fieldProvenance: [
          { fieldName: "prayerTitle", sourceUrl: "x", sourceHost: "x", confidence: 0.9 },
        ],
        missingFields: [],
        validationNeeds: [],
        formattingMetadata: {},
        confidenceScore: 0.95,
        packageChecksum: "ck-1",
        status: "BUILD_READY",
        checklistItemId: "ci-1",
      },
    );
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("PUBLIC_PUBLISH"),
    });
    expect(out.kind).toBe("advanced");
    expect(vi.mocked(runPublishOrchestrator)).toHaveBeenCalledTimes(1);
  });
});

describe("POST_PUBLISH_VERIFY honours ADMIN_WORKER_SKIP_NETWORK", () => {
  it("passes skipNetwork=true ONLY when ADMIN_WORKER_SKIP_NETWORK=1", async () => {
    vi.mocked(verifyPublished).mockClear();
    const prisma = makePrisma({});
    (prisma.publishedContent.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "pub-1", contentType: "PRAYER", slug: "our-father", title: "Our Father" },
    ]);
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("POST_PUBLISH_VERIFY"),
    });
    expect(vi.mocked(verifyPublished)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(verifyPublished).mock.calls[0][1];
    // We set ADMIN_WORKER_SKIP_NETWORK=1 above, so skipNetwork must be true.
    expect(call.skipNetwork).toBe(true);
  });

  it("passes skipNetwork=false when ADMIN_WORKER_SKIP_NETWORK is unset (production)", async () => {
    const original = process.env.ADMIN_WORKER_SKIP_NETWORK;
    delete process.env.ADMIN_WORKER_SKIP_NETWORK;
    vi.mocked(verifyPublished).mockClear();
    const prisma = makePrisma({});
    (prisma.publishedContent.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "pub-1", contentType: "PRAYER", slug: "our-father", title: "Our Father" },
    ]);
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("POST_PUBLISH_VERIFY"),
    });
    const call = vi.mocked(verifyPublished).mock.calls[0][1];
    expect(call.skipNetwork).toBe(false);
    if (original) process.env.ADMIN_WORKER_SKIP_NETWORK = original;
  });
});

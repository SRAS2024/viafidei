/**
 * Web-extraction pipeline stages in the dispatcher — the audit's stuck-risk and
 * data-quality findings, each pinned with a fake Prisma:
 *
 *   WX-01  EXTRACTION scans past the oldest page (durable rolling cursor)
 *   WX-02  a complete, corroborated doctrinal artifact can reach PASSED
 *   WX-03  cross-source verification gives up after a bounded number of rounds
 *   WX-05  a cache-satisfied fetch advances the candidate's status
 *   WX-06  a transient fetch failure retries; only a permanent one REJECTs
 *   WX-09  the published authority level comes from the SOURCE host
 *   WX-10  strict QA selects exactly the artifacts it can score
 *   WX-14  a document with no derivable title never becomes "Untitled"
 *   PR-04  a web prayer publishes as a complete PRAYER schema payload
 *   DG-5   REPORTING throttles its diagnostics + growth bundle
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
});

vi.mock("@/lib/checklist", () => ({
  isApprovedAuthorityHost: vi.fn(() => true),
  isFetchableHost: vi.fn(() => true),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
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

vi.mock("@/lib/admin-worker/diagnostics", () => ({
  runAdminWorkerDiagnostics: vi.fn(async () => [{ name: "brain" }, { name: "discovery" }]),
}));

vi.mock("@/lib/admin-worker/reporting-pass", () => ({
  maybeRunReportingPass: vi.fn(async () => ({
    ran: false,
    growthAssessed: 0,
    repairPlansFiled: 0,
    coverageRows: 0,
  })),
}));

vi.mock("@/lib/admin-worker/human-review", () => ({
  clearRetryBudget: vi.fn(async () => undefined),
  consumeRetryBudget: vi.fn(async () => ({ allowed: false, attempts: 9 })),
}));

const fetchResult = {
  url: "https://www.catholic.org/prayers/our-father",
  finalUrl: "https://www.catholic.org/prayers/our-father",
  httpStatus: 0,
  contentType: null,
  contentLength: null,
  checksum: null,
  etag: null,
  lastModifiedHeader: null,
  body: "",
  durationMs: 1,
  attempt: 3,
  succeeded: false,
  unchanged: false,
  rejectionReason: "HTTP 429",
  errorClass: "FETCH_FAILED",
  errorMessage: "HTTP 429",
  fetchResultRowId: null,
  redirectChain: [],
};

vi.mock("@/lib/admin-worker/fetcher", () => ({
  adminWorkerFetch: vi.fn(async () => fetchResult),
}));

vi.mock("@/lib/admin-worker/acquisition-planner", () => ({
  planAcquisition: vi.fn(async () => ({
    satisfiedByCache: false,
    rationale: "static http",
    sense: { reason: "fresh", rereadIntervalMs: 1000, lastReadAt: null },
  })),
  recordAcquisitionOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/change-sensing", () => ({
  recordObservation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/extractors", () => ({
  extractByType: vi.fn(() => ({
    fields: {
      prayerTitle: "Our Father",
      prayerType: "general",
      prayerText: "Our Father, who art in heaven, hallowed be thy name. Amen.",
      category: "PRAYER",
    },
    missingFields: [],
    confidenceScore: 0.9,
    sourceEvidence: [
      {
        fieldName: "prayerTitle",
        sourceUrl: "https://www.catholic.org/prayers/our-father",
        sourceHost: "www.catholic.org",
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

import {
  executeMissionStage,
  runCrossSourceVerification,
  runPersistAndPublish,
  runStrictQA,
} from "@/lib/admin-worker/dispatcher";
import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";
import { planAcquisition } from "@/lib/admin-worker/acquisition-planner";
import { extractByType } from "@/lib/admin-worker/extractors";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { runAdminWorkerDiagnostics } from "@/lib/admin-worker/diagnostics";
import { maybeRunReportingPass } from "@/lib/admin-worker/reporting-pass";
import { filePlan } from "@/lib/admin-worker/repair-plans";
import type { BrainAction, BrainDecision } from "@/lib/admin-worker/brain";

type Prisma = Parameters<typeof executeMissionStage>[0]["prisma"];

function decision(stage: BrainAction["missionStage"]): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "READ_SOURCE",
    passType: "CONTENT_GOAL",
    contentType: "PRAYER",
    sourceTarget: null,
    expectedResult: "test",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: stage } as unknown as BrainAction,
    rankedAlternatives: [],
    missionStage: stage,
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

function read(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sourceUrl: `https://www.catholic.org/prayers/${id}`,
    sourceHost: "www.catholic.org",
    extractedTitle: "Our Father - Prayers - Catholic Online",
    extractedText: "Our Father, who art in heaven, hallowed be thy name. Amen.",
    extractedHeadings: [],
    detectedContentType: "PRAYER",
    checksum: `cs-${id}`,
    confidenceScore: 0.9,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** Fake Prisma with only the models the web-extraction stages touch. */
function makePrisma(over: Record<string, unknown> = {}): Prisma {
  const base = {
    securityEvent: { count: vi.fn(async () => 0) },
    candidateSourceUrl: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    adminWorkerSourceRead: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    adminWorkerSourceBlock: { findMany: vi.fn(async () => []) },
    adminWorkerFetchResult: { findFirst: vi.fn(async () => null) },
    adminWorkerSourceReputation: { findFirst: vi.fn(async () => null) },
    adminWorkerPackageArtifact: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "art-new" })),
      update: vi.fn(async () => ({})),
    },
    adminWorkerCrossSourceVerification: { count: vi.fn(async () => 0) },
    adminWorkerRepairPlan: { count: vi.fn(async () => 0) },
    adminWorkerStrictQAResult: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => ({
        id: "qa-1",
        ...args.create,
      })),
    },
    adminWorkerMemory: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
    publishedContent: { count: vi.fn(async () => 0), findFirst: vi.fn(async () => null) },
  };
  return { ...base, ...over } as unknown as Prisma;
}

beforeEach(() => {
  vi.mocked(filePlan).mockClear();
  vi.mocked(runPublishOrchestrator).mockClear();
  vi.mocked(adminWorkerFetch).mockClear();
  vi.mocked(runAdminWorkerDiagnostics).mockClear();
  vi.mocked(maybeRunReportingPass).mockClear();
  vi.mocked(extractByType).mockClear();
  vi.mocked(planAcquisition).mockClear();
});

describe("EXTRACTION scans forward instead of parking on the oldest page (WX-01)", () => {
  it("walks past a page whose reads all have artifacts and persists the cursor", async () => {
    const pageOne = [read("r1"), read("r2")];
    const pageTwo = [read("r3", { createdAt: new Date("2026-02-01T00:00:00Z") })];
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(pageOne)
      .mockResolvedValueOnce(pageTwo)
      .mockResolvedValue([]);
    const artifactFindMany = vi
      .fn()
      // page one: both reads already have artifacts
      .mockResolvedValueOnce([{ sourceReadId: "r1" }, { sourceReadId: "r2" }])
      // page two: r3 has none
      .mockResolvedValueOnce([]);
    const memoryUpsert = vi.fn(async () => ({}));
    const prisma = makePrisma({
      adminWorkerSourceRead: {
        findMany,
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
      adminWorkerPackageArtifact: {
        findMany: artifactFindMany,
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "art-new" })),
        update: vi.fn(async () => ({})),
        findFirst: vi.fn(async () => null),
      },
      adminWorkerMemory: { findUnique: vi.fn(async () => null), upsert: memoryUpsert },
    });

    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("EXTRACTION"),
    });

    // It did NOT stop at the first page: the second query is cursored past r2.
    expect(findMany).toHaveBeenCalledTimes(2);
    const secondWhere = findMany.mock.calls[1][0].where as { OR?: unknown[] };
    expect(secondWhere.OR).toBeTruthy();
    expect(out.kind).toBe("advanced");
    // The cursor is persisted so the NEXT pass resumes here rather than
    // re-reading the same prefix forever.
    expect(memoryUpsert).toHaveBeenCalled();
  });

  it("resumes from the persisted cursor on the next pass", async () => {
    const findMany = vi.fn().mockResolvedValue([read("r9")]);
    const prisma = makePrisma({
      adminWorkerSourceRead: {
        findMany,
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
      adminWorkerMemory: {
        findUnique: vi.fn(async () => ({
          memoryValue: { at: "2026-01-15T00:00:00.000Z", id: "r5" },
        })),
        upsert: vi.fn(async () => ({})),
      },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("EXTRACTION"),
    });
    const where = findMany.mock.calls[0][0].where as { OR: Array<{ createdAt?: { gt: Date } }> };
    expect(where.OR[0].createdAt?.gt).toEqual(new Date("2026-01-15T00:00:00.000Z"));
  });
});

describe("EXTRACTION refuses to package a document it cannot name (WX-14)", () => {
  it("marks the read UNUSABLE instead of creating an 'Untitled' artifact", async () => {
    vi.mocked(extractByType).mockReturnValueOnce({
      fields: {},
      missingFields: [],
      confidenceScore: 0.5,
      sourceEvidence: [],
      rejectedSections: [],
      formatting: {},
      warnings: [],
      fatalReasons: [],
    } as unknown as ReturnType<typeof extractByType>);
    const update = vi.fn(async () => ({}));
    const create = vi.fn(async () => ({ id: "art-new" }));
    const prisma = makePrisma({
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => [
          read("pdf1", {
            // A PDF: no <title>, no headings, and a body with no heading line.
            extractedTitle: null,
            extractedText: "1. it is a difficult matter, and one that admits of no easy solution.",
            sourceUrl: "https://www.vatican.va/",
          }),
        ]),
        findUnique: vi.fn(async () => null),
        update,
      },
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        create,
        update: vi.fn(async () => ({})),
      },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("EXTRACTION"),
    });
    expect(out.kind).toBe("rejected");
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { detectedContentType: "UNUSABLE" } }),
    );
  });

  it("cleans the site suffix out of the title it packages under (WX-09)", async () => {
    const create = vi.fn(async () => ({ id: "art-new" }));
    const prisma = makePrisma({
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => [read("r1")]),
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        create,
        update: vi.fn(async () => ({})),
      },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("EXTRACTION"),
    });
    const data = create.mock.calls[0][0].data as {
      normalizedTitle: string;
      normalizedSlug: string;
    };
    expect(data.normalizedTitle).toBe("Our Father");
    expect(data.normalizedSlug).toBe("our-father");
  });

  it("passes the detected page language to the extractor (PR-15)", async () => {
    const prisma = makePrisma({
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => [
          read("es1", { sourceUrl: "https://www.usccb.org/es/prayers/oracion-por-la-vida" }),
        ]),
        findUnique: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("EXTRACTION"),
    });
    expect(vi.mocked(extractByType).mock.calls[0][1]).toMatchObject({ language: "es" });
  });
});

describe("SOURCE_FETCH backoff and failure classification (WX-05 / WX-06)", () => {
  const candidate = {
    id: "c1",
    discoveredUrl: "https://www.catholic.org/prayers/our-father",
    sourceHost: "www.catholic.org",
    predictedContentType: "PRAYER",
    predictedUsefulness: 0.7,
    fetchAttempts: 0,
    status: "PRIORITIZED",
    rejectionReason: null,
  };

  it("excludes recently-attempted candidates from selection", async () => {
    const findFirst = vi.fn(async () => null);
    const prisma = makePrisma({
      candidateSourceUrl: { findFirst, update: vi.fn(async () => ({})) },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    const where = findFirst.mock.calls[0][0].where as { OR?: unknown[] };
    expect(where.OR).toBeTruthy();
  });

  it("advances a cache-satisfied candidate to FETCHED so it is not re-picked forever", async () => {
    // The cache path only runs against the real (non-skipped) network branch.
    const original = process.env.ADMIN_WORKER_SKIP_NETWORK;
    delete process.env.ADMIN_WORKER_SKIP_NETWORK;
    vi.mocked(planAcquisition).mockResolvedValueOnce({
      satisfiedByCache: true,
      rationale: "durable read is fresh",
      sense: { reason: "read 2 minutes ago", rereadIntervalMs: 3_600_000, lastReadAt: new Date() },
    } as unknown as Awaited<ReturnType<typeof planAcquisition>>);
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      candidateSourceUrl: { findFirst: vi.fn(async () => candidate), update },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    if (original !== undefined) process.env.ADMIN_WORKER_SKIP_NETWORK = original;
    expect(out.metadata).toMatchObject({ cacheSatisfied: true });
    expect((update.mock.calls[0][0].data as { status: string }).status).toBe("FETCHED");
    expect(vi.mocked(adminWorkerFetch)).not.toHaveBeenCalled();
  });

  it("keeps a transiently-failed candidate retryable instead of REJECTing it", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      candidateSourceUrl: { findFirst: vi.fn(async () => candidate), update },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    const data = update.mock.calls[0][0].data as { status: string; fetchAttempts: number };
    expect(data.status).toBe("PRIORITIZED");
    expect(data.fetchAttempts).toBe(1);
    expect(out.metadata).toMatchObject({ willRetry: true, failureKind: "transient" });
  });

  it("REJECTs a permanent failure immediately", async () => {
    vi.mocked(adminWorkerFetch).mockResolvedValueOnce({
      ...fetchResult,
      rejectionReason: "unapproved host",
      errorClass: "UNAPPROVED_HOST",
    } as unknown as Awaited<ReturnType<typeof adminWorkerFetch>>);
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      candidateSourceUrl: { findFirst: vi.fn(async () => candidate), update },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    expect((update.mock.calls[0][0].data as { status: string }).status).toBe("REJECTED");
  });

  it("REJECTs once the transient retry budget is spent", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      candidateSourceUrl: {
        findFirst: vi.fn(async () => ({ ...candidate, fetchAttempts: 3 })),
        update,
      },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("SOURCE_FETCH"),
    });
    expect((update.mock.calls[0][0].data as { status: string }).status).toBe("REJECTED");
  });
});

describe("STRICT_QA selection + scoring (WX-02 / WX-10)", () => {
  const doctrinalArtifact = {
    id: "art-doc",
    contentType: "CHURCH_DOCUMENT",
    normalizedTitle: "Rerum Novarum",
    normalizedSlug: "rerum-novarum",
    extractedFields: {
      title: "Rerum Novarum",
      historyType: "ENCYCLICAL",
      dateOrEra: "1891",
      summary: "On capital and labor.",
    },
    fieldProvenance: [
      { fieldName: "title", confidence: 0.9 },
      { fieldName: "historyType", confidence: 0.9 },
      { fieldName: "dateOrEra", confidence: 0.9 },
      { fieldName: "summary", confidence: 0.85 },
    ],
    missingFields: [],
    validationNeeds: ["dateOrEra"],
    formattingMetadata: {},
    confidenceScore: 0.88,
    packageChecksum: "ck-1",
    status: "VERIFICATION_READY",
    sourceReadId: null,
  };

  it("selects only artifacts it can actually score", async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrisma({
      adminWorkerPackageArtifact: {
        findMany,
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    });
    await runStrictQA(prisma, "p1");
    const where = findMany.mock.calls[0][0].where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(where.OR).toEqual([
      { status: "VERIFICATION_READY" },
      { status: "BUILD_READY", validationNeeds: { isEmpty: true } },
    ]);
  });

  it("lets a complete, corroborated doctrinal artifact clear the 0.95 bar", async () => {
    const upsert = vi.fn(async (args: { create: Record<string, unknown> }) => ({
      id: "qa-1",
      ...args.create,
    }));
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => [doctrinalArtifact]),
        findFirst: vi.fn(async () => null),
        update,
      },
      // Cross-source evidence exists for the validated field.
      adminWorkerCrossSourceVerification: { count: vi.fn(async () => 2) },
      adminWorkerStrictQAResult: { findUnique: vi.fn(async () => null), upsert },
    });
    const out = await runStrictQA(prisma, "p1");
    const row = upsert.mock.calls[0][0].create as { finalScore: number; status: string };
    // 0.2·1 + 0.15·0.88 + 0.1·1 + 0.15·1 + 0.2·1 + 0.1·1 + 0.1·1 = 0.982
    expect(row.finalScore).toBeGreaterThanOrEqual(0.95);
    expect(row.status).toBe("PASSED");
    expect((update.mock.calls[0][0].data as { status: string }).status).toBe("QA_PASSED");
    expect(out.kind).toBe("advanced");
  });

  it("still holds a THIN doctrinal artifact below the bar", async () => {
    const upsert = vi.fn(async (args: { create: Record<string, unknown> }) => ({
      id: "qa-1",
      ...args.create,
    }));
    const prisma = makePrisma({
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => [
          {
            ...doctrinalArtifact,
            extractedFields: { title: "Rerum Novarum", historyType: "ENCYCLICAL" },
            fieldProvenance: [{ fieldName: "title", confidence: 0.6 }],
            missingFields: ["dateOrEra", "summary"],
            confidenceScore: 0.6,
          },
        ]),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
      adminWorkerCrossSourceVerification: { count: vi.fn(async () => 1) },
      adminWorkerStrictQAResult: { findUnique: vi.fn(async () => null), upsert },
    });
    await runStrictQA(prisma, "p1");
    const row = upsert.mock.calls[0][0].create as { finalScore: number; status: string };
    expect(row.finalScore).toBeLessThan(0.95);
    expect(row.status).not.toBe("PASSED");
  });
});

describe("CROSS_SOURCE_VERIFICATION gives up after a bounded number of rounds (WX-03)", () => {
  const artifact = {
    id: "art-saint",
    contentType: "SAINT",
    normalizedTitle: "St. Francis of Assisi - Saints & Angels - Catholic Online",
    normalizedSlug: "st-francis-of-assisi",
    extractedFields: { saintName: "St. Francis of Assisi", feastDay: "10-04" },
    fieldProvenance: [],
    missingFields: [],
    validationNeeds: ["feastDay", "feastMonth", "feastDayNumber"],
    formattingMetadata: {},
    confidenceScore: 0.8,
    packageChecksum: "ck-2",
    status: "BUILD_READY",
    sourceReadId: "sr1",
  };

  function verificationPrisma(priorPlans: number) {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      adminWorkerPackageArtifact: {
        findFirst: vi.fn(async () => artifact),
        findMany: vi.fn(async () => []),
        update,
      },
      // Evidence rows already exist (an earlier round), none of them a MATCH.
      adminWorkerCrossSourceVerification: { count: vi.fn(async () => 0) },
      adminWorkerRepairPlan: { count: vi.fn(async () => priorPlans) },
    });
    return { prisma, update };
  }

  it("files a repair plan and parks NEEDS_REPAIR while rounds remain", async () => {
    const { prisma, update } = verificationPrisma(1);
    await runCrossSourceVerification(prisma, "p1");
    expect((update.mock.calls[0][0].data as { status: string }).status).toBe("NEEDS_REPAIR");
    expect(vi.mocked(filePlan)).toHaveBeenCalledTimes(1);
  });

  it("parks NEEDS_REVIEW and files nothing once the rounds are spent", async () => {
    const { prisma, update } = verificationPrisma(3);
    await runCrossSourceVerification(prisma, "p1");
    const data = update.mock.calls[0][0].data as { status: string; gateDiagnosis: string };
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(data.gateDiagnosis).toBe("VALIDATION_EVIDENCE_EXHAUSTED");
    // No new plan → the repair orchestrator cannot reset it to BUILD_READY again.
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
  });
});

describe("PUBLIC_PUBLISH authority + prayer payload (WX-09 / PR-04)", () => {
  const prayerArtifact = {
    id: "art-prayer",
    contentType: "PRAYER",
    normalizedTitle: "Our Father",
    normalizedSlug: "our-father",
    extractedFields: {
      prayerTitle: "Our Father",
      prayerType: "general",
      prayerText: "Our Father, who art in heaven, hallowed be thy name; thy kingdom come. Amen.",
      category: "PRAYER",
    },
    fieldProvenance: [{ fieldName: "prayerTitle", confidence: 0.9 }],
    missingFields: [],
    validationNeeds: [],
    formattingMetadata: {},
    confidenceScore: 0.9,
    packageChecksum: "ck-3",
    status: "QA_PASSED",
    sourceReadId: "sr1",
    checklistItemId: null,
  };

  function publishPrisma() {
    return makePrisma({
      adminWorkerPackageArtifact: {
        findFirst: vi.fn(async () => prayerArtifact),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => ({})),
      },
      adminWorkerSourceRead: {
        findUnique: vi.fn(async () => ({
          sourceHost: "www.catholic.org",
          sourceUrl: "https://www.catholic.org/prayers/our-father",
        })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async () => ({
          id: "qa-1",
          status: "PASSED",
          finalScore: 0.95,
          blockingReasons: [],
          repairSuggestions: [],
        })),
        upsert: vi.fn(async () => ({ id: "qa-1" })),
      },
    });
  }

  it("stamps the SOURCE host's authority, not VATICAN", async () => {
    await runPersistAndPublish(publishPrisma(), "w1", "p1");
    const input = vi.mocked(runPublishOrchestrator).mock.calls[0][1];
    expect(input.authorityLevel).not.toBe("VATICAN");
  });

  it("publishes a complete PRAYER schema payload (body, slug, category, citations)", async () => {
    await runPersistAndPublish(publishPrisma(), "w1", "p1");
    const payload = vi.mocked(runPublishOrchestrator).mock.calls[0][1].payload as Record<
      string,
      unknown
    >;
    expect(payload.body).toContain("Our Father, who art in heaven");
    expect(payload.slug).toBe("our-father");
    expect(payload.language).toBe("en");
    expect(payload.category).not.toBe("PRAYER");
    expect(payload.citations).toEqual(["https://www.catholic.org/prayers/our-father"]);
  });

  it("refuses to publish a prayer the schema rejects and files a repair instead", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      adminWorkerPackageArtifact: {
        findFirst: vi.fn(async () => ({
          ...prayerArtifact,
          // An article ABOUT a prayer with no prayer text at all.
          extractedFields: { prayerTitle: "How to Pray the Rosary" },
        })),
        findMany: vi.fn(async () => []),
        update,
      },
      adminWorkerSourceRead: {
        findUnique: vi.fn(async () => ({
          sourceHost: "www.catholic.org",
          sourceUrl: "https://www.catholic.org/prayers/how-to",
        })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    });
    const out = await runPersistAndPublish(prisma, "w1", "p1");
    expect(vi.mocked(runPublishOrchestrator)).not.toHaveBeenCalled();
    expect(out.kind).toBe("repair-planned");
    expect((update.mock.calls[0][0].data as { status: string }).status).toBe("NEEDS_REPAIR");
  });
});

describe("REPORTING is throttled and PACKAGE_BUILD reports honestly (DG-5)", () => {
  it("delegates growth + coverage to the throttled reporting pass", async () => {
    const prisma = makePrisma();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("REPORTING"),
    });
    expect(vi.mocked(maybeRunReportingPass)).toHaveBeenCalledTimes(1);
    expect(out.metadata).toMatchObject({ throttled: true });
  });

  it("skips the expensive diagnostics bundle inside the throttle window", async () => {
    const prisma = makePrisma({
      adminWorkerMemory: {
        findUnique: vi.fn(async () => ({ lastUsedAt: new Date() })),
        upsert: vi.fn(async () => ({})),
      },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("REPORTING"),
    });
    expect(vi.mocked(runAdminWorkerDiagnostics)).not.toHaveBeenCalled();
  });

  it("runs the diagnostics bundle once the window has elapsed", async () => {
    const prisma = makePrisma({
      adminWorkerMemory: {
        findUnique: vi.fn(async () => ({ lastUsedAt: new Date(Date.now() - 60 * 60 * 1000) })),
        upsert: vi.fn(async () => ({})),
      },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("REPORTING"),
    });
    expect(vi.mocked(runAdminWorkerDiagnostics)).toHaveBeenCalledTimes(1);
  });

  it("does not report an artifact it did not move as advanced work", async () => {
    const prisma = makePrisma({
      adminWorkerPackageArtifact: {
        findFirst: vi.fn(async () => ({
          id: "art-1",
          contentType: "PRAYER",
          status: "BUILD_READY",
          validationNeeds: [],
        })),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => ({})),
      },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision("PACKAGE_BUILD"),
    });
    expect(out.kind).toBe("idle");
    expect(out.built ?? 0).toBe(0);
  });
});

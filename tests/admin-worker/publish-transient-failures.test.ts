/**
 * Transient vs permanent publish failures (R4).
 *
 * runPersistAndPublish mapped every orchestrator "blocked" result to REJECTED.
 * That included a failed PublishedContent create/update (a database blip), an
 * unreadable strict-QA row, and a failed ContentQualityScore write — so one
 * database error permanently discarded a complete, QA-passed package; only a
 * later duplicate read could revive it. And recordStrictQA swallowed a failed
 * upsert but still returned PASSED, so runStrictQA advanced an artifact with no
 * row to QA_PASSED, where the publish gate rejected it ("no
 * AdminWorkerStrictQAResult row").
 *
 * Now: transient blocks are retryable (NEEDS_REVIEW with a backed-off retry the
 * drain honours), a missing strict-QA row re-queues the artifact for QA, a
 * permanent block is REJECTED with a typed reason code, and strict QA never
 * advances an artifact whose row did not persist.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSitemapRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSearchRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
}));
vi.mock("@/lib/admin-worker/content-goals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-worker/content-goals")>()),
  refreshContentGoals: vi.fn(async () => undefined),
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
vi.mock("@/lib/admin-worker/public-routes", () => ({
  publicRouteFor: vi.fn(() => ({
    tab: "prayers",
    tabPath: "/prayers",
    slugPath: "/prayers/our-father",
    cacheTags: [],
  })),
}));
// The real orchestrator by default; the dispatcher tests below script its
// answer to exercise the routing of each outcome.
vi.mock("@/lib/admin-worker/publish-orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-worker/publish-orchestrator")>();
  return { ...actual, runPublishOrchestrator: vi.fn(actual.runPublishOrchestrator) };
});

import {
  isPermanentDbError,
  publishRejectionCode,
  runPublishOrchestrator,
} from "@/lib/admin-worker/publish-orchestrator";
import { runPersistAndPublish, runStrictQA } from "@/lib/admin-worker/dispatcher";
import { filePlan } from "@/lib/admin-worker/repair-plans";
import { pushReputation } from "@/lib/admin-worker/source-reputation-hooks";
import { classifyReviewReason } from "@/lib/admin-worker/human-review";

type OrchestratorPrisma = Parameters<typeof runPublishOrchestrator>[0];

const PASSED_QA_ROW = {
  id: "qa-1",
  status: "PASSED",
  finalScore: 0.95,
  blockingReasons: [],
  repairSuggestions: [],
  completenessScore: 1,
  correctnessScore: 1,
  formattingScore: 1,
  provenanceScore: 1,
  validationScore: 1,
  duplicateSafetyScore: 1,
  publicReadinessScore: 1,
};

const INPUT = {
  contentType: "PRAYER",
  contentId: "ci-1",
  title: "Our Father",
  slug: "our-father",
  payload: {
    prayerText: "Our Father, who art in heaven, hallowed be thy name. Amen.",
    citations: ["https://www.usccb.org/prayers/our-father"],
  },
  authorityLevel: "USCCB",
  finalScore: 0.95,
  qaPassed: true,
  hasSourceEvidence: true,
  isDoctrinallySensitive: false,
  confidence: 0.95,
  strictQAArtifactId: "art-1",
};

function orchestratorPrisma(
  over: {
    qaRead?: () => Promise<unknown>;
    qualityCreate?: () => Promise<unknown>;
    contentCreate?: () => Promise<unknown>;
  } = {},
): OrchestratorPrisma {
  return {
    publishedContent: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(over.contentCreate ?? (async () => ({ id: "pub-1" }))),
      update: vi.fn(async () => ({ id: "pub-1" })),
    },
    adminWorkerStrictQAResult: {
      findUnique: vi.fn(over.qaRead ?? (async () => PASSED_QA_ROW)),
    },
    contentQualityScore: {
      create: vi.fn(over.qualityCreate ?? (async () => ({ id: "q-1" }))),
    },
  } as unknown as OrchestratorPrisma;
}

beforeEach(() => {
  vi.mocked(filePlan).mockClear();
  vi.mocked(pushReputation).mockClear();
});

describe("runPublishOrchestrator classifies infrastructure failures as retryable", () => {
  it("an unreadable strict-QA row is a retryable block, not a missing-row verdict", async () => {
    const result = await runPublishOrchestrator(
      orchestratorPrisma({
        qaRead: async () => {
          throw new Error("Connection terminated unexpectedly");
        },
      }),
      INPUT as never,
    );
    expect(result).toMatchObject({ kind: "blocked", blockedBy: "strict-qa", retryable: true });
  });

  it("a failed ContentQualityScore write is retryable and files no quality repair", async () => {
    const result = await runPublishOrchestrator(
      orchestratorPrisma({
        qualityCreate: async () => {
          throw new Error("timeout acquiring a connection");
        },
      }),
      INPUT as never,
    );
    expect(result).toMatchObject({ kind: "blocked", blockedBy: "quality-score", retryable: true });
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
  });

  it("a connection error on create is a retryable persist block", async () => {
    const result = await runPublishOrchestrator(
      orchestratorPrisma({
        contentCreate: async () => {
          throw Object.assign(new Error("Can't reach database server"), { code: "P1001" });
        },
      }),
      INPUT as never,
    );
    expect(result).toMatchObject({ kind: "blocked", blockedBy: "persist", retryable: true });
  });

  it("a unique-constraint violation on create is permanent and names the code", async () => {
    const result = await runPublishOrchestrator(
      orchestratorPrisma({
        contentCreate: async () => {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        },
      }),
      INPUT as never,
    );
    expect(result).toMatchObject({ kind: "blocked", blockedBy: "persist", retryable: false });
    if (result.kind === "blocked") expect(result.reason).toContain("P2002");
  });

  it("isPermanentDbError and publishRejectionCode", () => {
    expect(isPermanentDbError({ code: "P2002" })).toBe(true);
    expect(isPermanentDbError({ code: "P2024" })).toBe(false); // pool timeout
    expect(isPermanentDbError(new Error("socket hang up"))).toBe(false);
    expect(publishRejectionCode("safety")).toBe("PUBLISH_SAFETY");
    expect(publishRejectionCode("persist")).toBe("PERSIST_CONSTRAINT");
    expect(publishRejectionCode("something-new")).toBe("PUBLISH_BLOCKED");
  });

  it("the drain recognises a transient publish failure as retryable", () => {
    expect(
      classifyReviewReason("TRANSIENT_PUBLISH_FAILURE (persist): PublishedContent create() failed")
        .route,
    ).toBe("retry");
  });
});

describe("runPersistAndPublish routes each block by cause", () => {
  const artifact = {
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
    checklistItemId: "ci-1",
  };

  function dispatcherPrisma() {
    const update = vi.fn(async () => ({}));
    const memory = new Map<string, unknown>();
    const prisma = {
      adminWorkerPackageArtifact: { findFirst: vi.fn(async () => artifact), update },
      adminWorkerSourceRead: {
        findUnique: vi.fn(async () => ({
          sourceHost: "www.usccb.org",
          sourceUrl: "https://www.usccb.org/prayers/our-father",
        })),
      },
      adminWorkerStrictQAResult: { findUnique: vi.fn(async () => PASSED_QA_ROW) },
      adminWorkerCrossSourceVerification: { findMany: vi.fn(async () => []) },
      adminWorkerMemory: {
        findUnique: vi.fn(
          async (args: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
            const v = memory.get(args.where.memoryType_memoryKey.memoryKey);
            return v ? { memoryValue: v } : null;
          },
        ),
        upsert: vi.fn(
          async (args: {
            where: { memoryType_memoryKey: { memoryKey: string } };
            create: { memoryValue: unknown };
          }) => {
            memory.set(args.where.memoryType_memoryKey.memoryKey, args.create.memoryValue);
            return {};
          },
        ),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    };
    return { prisma: prisma as unknown as Parameters<typeof runPersistAndPublish>[0], update };
  }

  const lastData = (update: ReturnType<typeof vi.fn>) =>
    (update.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data;

  it("a transient block parks for a backed-off retry instead of REJECTED", async () => {
    vi.mocked(runPublishOrchestrator).mockResolvedValueOnce({
      kind: "blocked",
      blockedBy: "persist",
      retryable: true,
      reason: "PublishedContent create() failed",
    });
    const { prisma, update } = dispatcherPrisma();
    const out = await runPersistAndPublish(prisma, "w1", "p1");
    const data = lastData(update);
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(String(data.rejectionReason)).toMatch(/^TRANSIENT_PUBLISH_FAILURE \(persist\)/);
    expect(classifyReviewReason(String(data.rejectionReason)).route).toBe("retry");
    expect(out.kind).toBe("repair-planned");
    expect(out.rejected).toBe(0);
    // A database blip costs the source host no reputation.
    expect(vi.mocked(pushReputation)).not.toHaveBeenCalled();
  });

  it("a missing strict-QA row re-queues the artifact for strict QA", async () => {
    vi.mocked(runPublishOrchestrator).mockResolvedValueOnce({
      kind: "blocked",
      blockedBy: "strict-qa-missing",
      reason: "no AdminWorkerStrictQAResult row for this artifact",
    });
    const { prisma, update } = dispatcherPrisma();
    await runPersistAndPublish(prisma, "w1", "p1");
    const data = lastData(update);
    expect(data.status).toBe("BUILD_READY");
    expect(String(data.rejectionReason)).toMatch(/^STRICT_QA_ROW_MISSING/);
  });

  it("a permanent block is REJECTED with a typed reason code", async () => {
    vi.mocked(runPublishOrchestrator).mockResolvedValueOnce({
      kind: "blocked",
      blockedBy: "safety",
      reason: "publish safety: donation_page — source URL is junk",
    });
    const { prisma, update } = dispatcherPrisma();
    const out = await runPersistAndPublish(prisma, "w1", "p1");
    const data = lastData(update);
    expect(data.status).toBe("REJECTED");
    expect(String(data.rejectionReason)).toMatch(/^PUBLISH_SAFETY: publish safety/);
    expect(out.kind).toBe("rejected");
  });
});

describe("runStrictQA never advances an artifact whose strict-QA row did not persist", () => {
  it("leaves the artifact in place when the upsert fails", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => [
          {
            id: "art-1",
            contentType: "PRAYER",
            normalizedTitle: "Our Father",
            normalizedSlug: "our-father",
            extractedFields: { prayerText: "Our Father, who art in heaven. Amen." },
            fieldProvenance: [{ fieldName: "prayerText" }],
            missingFields: [],
            validationNeeds: [],
            formattingMetadata: {},
            confidenceScore: 0.95,
            status: "BUILD_READY",
            sourceReadId: null,
          },
        ]),
        update,
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => {
          throw new Error("Connection terminated unexpectedly");
        }),
      },
      publishedContent: { count: vi.fn(async () => 0) },
    } as unknown as Parameters<typeof runStrictQA>[0];
    const out = await runStrictQA(prisma, "p1");
    expect(update).not.toHaveBeenCalled();
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
    expect(out.kind).toBe("idle");
  });
});

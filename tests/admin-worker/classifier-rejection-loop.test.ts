/**
 * The gcatholic.org /dioceses/diocese/* loop (production escalation,
 * 2026-09-10: "Stage SOURCE_FETCH failed/needed-repair 21× in 6h with 0
 * successes", LOOPING / ERROR / SAINT, 11 occurrences).
 *
 * Every one of those 21 "failures" was a fetch that SUCCEEDED — dall0, dave0,
 * desm0, detr0, dubu0, croo0 — of a GCatholic diocese page the classifier then
 * scored 0.05-0.25 against the 0.55 threshold. Via Fidei has no DIOCESE content
 * type, so those pages are structurally unpublishable. This file pins the four
 * halves of the fix:
 *
 *   CL-1  a classifier-rejected URL is retired instead of re-queued forever,
 *         and a TRANSIENT fetch failure still retries (the WX-06 fix stands)
 *   CL-2  N classifier-rejected siblings suppress the URL SHAPE, reversibly
 *   CL-3  an unusable INPUT does not feed the LOOPING signal — but a real
 *         stall, and a suppression that is not holding, still do
 *   CL-4  discovery stops producing them: no unusable read may seed a crawl,
 *         and a non-web-built directory is not crawled by the web lane
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

const okFetch = {
  url: DIOCESE_URL(),
  finalUrl: DIOCESE_URL(),
  httpStatus: 200,
  contentType: "text/html",
  contentLength: 100,
  checksum: "ck-1",
  etag: null,
  lastModifiedHeader: null,
  body: "<html><title>Diocese of Dallas</title><body>Diocese</body></html>",
  durationMs: 5,
  attempt: 1,
  succeeded: true,
  unchanged: false,
  rejectionReason: null,
  errorClass: null,
  errorMessage: null,
  fetchResultRowId: "fr-1",
  redirectChain: [],
};

vi.mock("@/lib/admin-worker/fetcher", () => ({
  adminWorkerFetch: vi.fn(async () => okFetch),
}));

vi.mock("@/lib/admin-worker/source-reader", () => ({
  readSource: vi.fn(async () => ({
    sourceReadId: "sr-1",
    reused: false,
    checksum: "ck-1",
    classifierContentType: "UNUSABLE",
    classifierConfidence: 0.75,
    classifierReasons: ["No type scored above the 0.55 threshold; max=0.25"],
    extraction: null,
    pipelineStageId: null,
    rejected: true,
    rejectionReason: "No type scored above the 0.55 threshold; max=0.25",
    totalBlocks: 12,
    acceptedBlocks: 12,
    rejectedBlocks: 0,
  })),
}));

import { UNUSABLE_INPUT_RESULT_TYPE, executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";
import {
  UNCLASSIFIABLE_PREFIX_MIN_SIBLINGS,
  UNCLASSIFIABLE_REJECTION_PATTERN,
  clearSuppressedPrefixCache,
  isSuppressedUrlShape,
  unclassifiablePrefixes,
  urlShapePrefix,
} from "@/lib/admin-worker/source-reputation";
import { summarizeStageReliability } from "@/lib/admin-worker/stage-outcomes";
import { selectDirectoryPages } from "@/lib/admin-worker/directory-discovery";
import type { BrainAction, BrainDecision } from "@/lib/admin-worker/brain";

// Declared as a function so the fetch fixture above can reference it.
function DIOCESE_URL(n = "dall0") {
  return `https://gcatholic.org/dioceses/diocese/${n}`;
}

type Prisma = Parameters<typeof executeMissionStage>[0]["prisma"];

function decision(): BrainDecision {
  return {
    contentType: "SAINT",
    confidenceScore: 0.9,
    chosenAction: { missionStage: "SOURCE_FETCH" } as unknown as BrainAction,
    missionStage: "SOURCE_FETCH",
  } as unknown as BrainDecision;
}

const candidate = {
  id: "c-dall0",
  discoveredUrl: DIOCESE_URL(),
  sourceHost: "gcatholic.org",
  predictedContentType: "PARISH",
  predictedUsefulness: 0.5,
  fetchAttempts: 0,
  status: "PRIORITIZED",
  rejectionReason: null,
  rejectionPattern: null,
};

function makePrisma(over: Record<string, unknown> = {}): Prisma {
  const base = {
    securityEvent: { count: vi.fn(async () => 0) },
    candidateSourceUrl: {
      findFirst: vi.fn(async () => candidate),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    adminWorkerSourceRead: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    adminWorkerFetchResult: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    adminWorkerSourceReputation: { findFirst: vi.fn(async () => null) },
    adminWorkerStageOutcome: { create: vi.fn(async () => ({})) },
    adminWorkerLog: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
  };
  return { ...base, ...over } as unknown as Prisma;
}

/** The `data` of the candidate update the retirement path writes (the last one). */
function lastUpdateData(update: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = update.mock.calls;
  return (calls[calls.length - 1][0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.mocked(adminWorkerFetch).mockClear();
  // `suppressedUrlPrefixes` memoizes for 10 minutes in-process (the filter is
  // an unindexed scan); each test states its own suppression world.
  clearSuppressedPrefixCache();
});

describe("CL-1 a classifier-rejected candidate is retired, not re-queued forever", () => {
  it("keeps the first rejection re-lookable but marks the URL shape", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      candidateSourceUrl: {
        findFirst: vi.fn(async () => candidate),
        findMany: vi.fn(async () => []),
        update,
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.kind).toBe("rejected");
    const data = lastUpdateData(update);
    // Still FETCHED: one bad read deserves a single second look.
    expect(data.status).toBe("FETCHED");
    expect(data.rejectionPattern).toBe(UNCLASSIFIABLE_REJECTION_PATTERN);
    expect(String(data.rejectionReason)).toContain("classifier:");
  });

  it("REJECTs the SECOND classifier rejection of the same URL so it leaves the queue", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      candidateSourceUrl: {
        findFirst: vi.fn(async () => ({
          ...candidate,
          // The marker written by the first rejection.
          rejectionPattern: UNCLASSIFIABLE_REJECTION_PATTERN,
        })),
        findMany: vi.fn(async () => []),
        update,
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(lastUpdateData(update).status).toBe("REJECTED");
    expect(out.summary).toContain("will not be fetched again");
  });

  it("does NOT touch the transient-fetch-failure path (a 429 still retries)", async () => {
    vi.mocked(adminWorkerFetch).mockResolvedValueOnce({
      ...okFetch,
      succeeded: false,
      httpStatus: 429,
      body: "",
      rejectionReason: "HTTP 429",
      errorClass: "FETCH_FAILED",
      errorMessage: "HTTP 429",
    } as unknown as Awaited<ReturnType<typeof adminWorkerFetch>>);
    const update = vi.fn(async () => ({}));
    const prisma = makePrisma({
      candidateSourceUrl: {
        findFirst: vi.fn(async () => candidate),
        findMany: vi.fn(async () => []),
        update,
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    // Left retryable, and never routed through the classifier retirement.
    expect(lastUpdateData(update).status).toBe("PRIORITIZED");
    expect(out.metadata).toMatchObject({ willRetry: true, failureKind: "transient" });
    expect(out.unusableInput).toBeFalsy();
  });
});

describe("CL-2 the URL SHAPE is learned, and the learning is reversible", () => {
  const siblings = ["dall0", "dave0", "desm0", "detr0", "dubu0", "croo0"].map((n) => ({
    discoveredUrl: DIOCESE_URL(n),
    sourceHost: "gcatholic.org",
  }));

  it("derives host + parent path, and never a bare host", () => {
    expect(urlShapePrefix(DIOCESE_URL())).toBe("gcatholic.org/dioceses/diocese");
    // One path segment or fewer can never become a prefix — this must not be
    // able to degenerate into a host-wide blocklist.
    expect(urlShapePrefix("https://gcatholic.org/dioceses/")).toBeNull();
    expect(urlShapePrefix("https://gcatholic.org/")).toBeNull();
    expect(urlShapePrefix("not a url")).toBeNull();
  });

  it("suppresses a shape once enough siblings were classifier-rejected", async () => {
    const prisma = makePrisma({
      candidateSourceUrl: {
        findMany: vi.fn(async () => siblings),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    });
    const out = await unclassifiablePrefixes(prisma);
    expect(out).toHaveLength(1);
    expect(out[0].prefix).toBe("gcatholic.org/dioceses/diocese");
    expect(out[0].rejectedUrls).toBe(siblings.length);
    expect(out[0].examples[0]).toBe(DIOCESE_URL());
    expect(isSuppressedUrlShape(DIOCESE_URL("xyz0"), new Set([out[0].prefix]))).toBe(true);
    expect(isSuppressedUrlShape("https://gcatholic.org/churches/x", new Set([out[0].prefix]))).toBe(
      false,
    );
  });

  it("needs more than a couple of siblings before it acts", async () => {
    const prisma = makePrisma({
      candidateSourceUrl: {
        findMany: vi.fn(async () => siblings.slice(0, UNCLASSIFIABLE_PREFIX_MIN_SIBLINGS - 1)),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    expect(await unclassifiablePrefixes(prisma)).toEqual([]);
  });

  it("ONE page under the shape that classifies clears the whole suppression", async () => {
    const prisma = makePrisma({
      candidateSourceUrl: {
        findMany: vi.fn(async () => siblings),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => [{ sourceUrl: DIOCESE_URL("works0") }]),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
      },
    });
    expect(await unclassifiablePrefixes(prisma)).toEqual([]);
  });

  it("fails open — a broken ledger suppresses nothing", async () => {
    const prisma = {
      candidateSourceUrl: {
        findMany: vi.fn(async () => {
          throw new Error("no table");
        }),
      },
    } as unknown as Prisma;
    expect(await unclassifiablePrefixes(prisma)).toEqual([]);
  });

  it("drains the already-queued backlog under a suppressed shape", async () => {
    const updateMany = vi.fn(async () => ({ count: 1400 }));
    const prisma = makePrisma({
      candidateSourceUrl: {
        // The suppression evidence …
        findMany: vi.fn(async () => siblings),
        // … and nothing left to fetch once the sweep has run.
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => ({})),
        updateMany,
      },
    });
    await executeMissionStage({ prisma, workerId: "w1", passId: "p1", decision: decision() });
    expect(updateMany).toHaveBeenCalled();
    const where = updateMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.discoveredUrl).toMatchObject({ contains: "gcatholic.org/dioceses/diocese" });
    expect(where.status).toMatchObject({ in: ["DISCOVERED", "PRIORITIZED"] });
    expect((updateMany.mock.calls[0][0].data as { status: string }).status).toBe("REJECTED");
  });
});

describe("CL-3 the LOOPING signal separates unusable input from a real stall", () => {
  it("records an unusable page under its own result type, not 'failure'", async () => {
    const create = vi.fn(async () => ({}));
    const prisma = makePrisma({
      adminWorkerStageOutcome: { create },
      candidateSourceUrl: {
        findFirst: vi.fn(async () => candidate),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.unusableInput).toBe(true);
    const row = create.mock.calls[0][0].data as { result: string; resultType: string };
    // The row is still written, under the same result — only the coarse
    // bucket the LOOPING detector counts differs.
    expect(row.result).toBe("rejected");
    expect(row.resultType).toBe(UNUSABLE_INPUT_RESULT_TYPE);
    expect(row.resultType).not.toBe("failure");
  });

  it("still records a REAL failure as 'failure' so LOOPING is not blinded", async () => {
    vi.mocked(adminWorkerFetch).mockResolvedValueOnce({
      ...okFetch,
      succeeded: false,
      httpStatus: 500,
      body: "",
      rejectionReason: "HTTP 500",
      errorClass: "FETCH_FAILED",
      errorMessage: "HTTP 500",
    } as unknown as Awaited<ReturnType<typeof adminWorkerFetch>>);
    const create = vi.fn(async () => ({}));
    const prisma = makePrisma({
      adminWorkerStageOutcome: { create },
      candidateSourceUrl: {
        findFirst: vi.fn(async () => candidate),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    await executeMissionStage({ prisma, workerId: "w1", passId: "p1", decision: decision() });
    const row = create.mock.calls[0][0].data as { resultType: string };
    // repair-planned → needs_repair, which LOOPING counts exactly as before.
    expect(row.resultType).toBe("needs_repair");
  });

  it("counts a rejection under an ALREADY-suppressed shape as a real failure", async () => {
    // The shape is suppressed, the queue was swept, the picker excludes it —
    // and the worker fetched one anyway. The suppression is not holding, which
    // is a genuine loop and must page.
    const create = vi.fn(async () => ({}));
    const prisma = makePrisma({
      adminWorkerStageOutcome: { create },
      candidateSourceUrl: {
        findMany: vi.fn(async () =>
          ["dall0", "dave0", "desm0", "detr0", "dubu0", "croo0"].map((n) => ({
            discoveredUrl: DIOCESE_URL(n),
            sourceHost: "gcatholic.org",
          })),
        ),
        findFirst: vi.fn(async () => candidate),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: decision(),
    });
    expect(out.unusableInput).toBe(false);
    expect((create.mock.calls[0][0].data as { resultType: string }).resultType).toBe("failure");
  });
});

describe("CL-3b the detector itself reads the buckets the way the fix intends", () => {
  /**
   * `buildSelfAssessment` raises LOOPING on
   * `(failures + needsRepair) >= N && successes === 0` from
   * `summarizeStageReliability`. This asserts against that function directly,
   * so the fix is pinned to the thing that actually pages the operator.
   */
  function ledger(rows: Array<{ stage: string; resultType: string }>) {
    return {
      adminWorkerStageOutcome: {
        findMany: vi.fn(async () => rows.map((r) => ({ ...r, durationMs: 1 }))),
      },
    } as unknown as Prisma;
  }

  it("21 unusable-input rejections do not look like a looping stage", async () => {
    const rows = Array.from({ length: 21 }, () => ({
      stage: "SOURCE_FETCH",
      resultType: UNUSABLE_INPUT_RESULT_TYPE,
    }));
    const [stage] = await summarizeStageReliability(ledger(rows));
    expect(stage.total).toBe(21); // still fully visible in the ledger
    expect(stage.failures).toBe(0);
    expect(stage.needsRepair).toBe(0);
    expect(stage.failures + stage.needsRepair).toBeLessThan(6);
  });

  it("a genuine stall still trips it, even mixed in with unusable input", async () => {
    const rows = [
      ...Array.from({ length: 21 }, () => ({
        stage: "SOURCE_FETCH",
        resultType: UNUSABLE_INPUT_RESULT_TYPE,
      })),
      ...Array.from({ length: 6 }, () => ({ stage: "SOURCE_FETCH", resultType: "failure" })),
    ];
    const [stage] = await summarizeStageReliability(ledger(rows));
    expect(stage.failures + stage.needsRepair).toBeGreaterThanOrEqual(6);
    expect(stage.successes).toBe(0);
  });
});

describe("CL-4 discovery stops producing unusable URLs at the entry point", () => {
  it("never web-crawls a directory whose type is not web-built", () => {
    const { pages, skipped } = selectDirectoryPages("SAINT");
    const urls = pages.map((p) => p.url);
    // The GCatholic dioceses index is the seed that fanned out into thousands
    // of /dioceses/diocese/* candidates while the pass was hunting SAINTS.
    expect(urls).not.toContain("https://gcatholic.org/dioceses/");
    expect(urls).not.toContain("https://www.catholic-hierarchy.org/");
    expect(urls).not.toContain("https://masstimes.org/");
    expect(skipped.some((s) => s.url === "https://gcatholic.org/dioceses/")).toBe(true);
    // …and the SAINT directories it SHOULD crawl are still there.
    expect(urls).toContain("https://www.catholic.org/saints/");
  });

  it("keeps the untyped directories when no content type is targeted", () => {
    const { pages } = selectDirectoryPages(null);
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.every((p) => p.expectedContentType !== "PARISH")).toBe(true);
  });
});

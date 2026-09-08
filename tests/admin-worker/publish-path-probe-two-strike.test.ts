/**
 * Post-publish verification hardening (audit findings P2 / DG-1 / P5 / DG-11).
 *
 *   - only 404/410 (or a rendered 200 page provably lacking the title) is a
 *     FAIL; 403/408/425/429/5xx/network are WARN = "unverified"
 *   - the probe refuses to run when the public origin is localhost while the
 *     database is remote (a laptop pointed at production)
 *   - a FAIL is a first strike; only a second FAIL ≥ 10 min later confirms it
 *   - the dispatcher maps a THROWN verification to WARN and never rolls back;
 *     WARN is not a rejection and does not hurt source reputation
 *   - every automated unpublish files a HumanReviewQueue row, even in
 *     autonomous mode
 *   - cache revalidation outside the Next runtime is a successful no-op
 *   - the PUBLIC_DISPLAY_FAILED repair accepts WARN as "displayed"
 *   - the threshold-count probe measures the gap against desiredTarget
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/rollback-ledger", () => ({
  recordRollbackLedger: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSitemapRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSearchRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
}));

vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/state", () => ({
  writeHeartbeat: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/memory", () => ({
  rememberFailurePattern: vi.fn(async () => undefined),
  rememberOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(),
  CONTENT_TYPE_STRATEGIES: {},
}));

import type { PrismaClient } from "@prisma/client";

import {
  bodyProvablyLacksTitle,
  classifyProbeStatus,
  probeOriginMismatch,
  verifyPublished,
} from "@/lib/admin-worker/post-publish-probe";
import { FAIL_CONFIRMATION_GAP_MS, findPriorFailure } from "@/lib/admin-worker/post-publish";
import { decideAndExecuteRollback } from "@/lib/admin-worker/post-publish-rollback";
import { NO_TAG_CACHE_MESSAGE, revalidateForRow } from "@/lib/cache/revalidate";
import { pushReputation } from "@/lib/admin-worker/source-reputation-hooks";

const ENV_KEYS = [
  "PUBLIC_BASE_URL",
  "NEXT_PUBLIC_BASE_URL",
  "DATABASE_URL",
  "NEXT_RUNTIME",
  "ADMIN_WORKER_REQUIRE_HUMAN_REVIEW",
  "ADMIN_WORKER_SKIP_NETWORK",
];
let saved: Record<string, string | undefined>;
const realFetch = globalThis.fetch;
beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.NEXT_PUBLIC_BASE_URL;
  delete process.env.NEXT_RUNTIME;
  delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
  vi.clearAllMocks();
});

describe("probe status classification", () => {
  it("fails only on 404/410; everything else non-2xx is unverified", () => {
    expect(classifyProbeStatus(200)).toBe("ok");
    expect(classifyProbeStatus(404)).toBe("fail");
    expect(classifyProbeStatus(410)).toBe("fail");
    for (const s of [403, 408, 425, 429, 500, 502, 503, 504]) {
      expect(classifyProbeStatus(s)).toBe("unverified");
    }
  });

  it("only a fully rendered page mentioning neither title nor slug provably lacks the title", () => {
    const page = (inner: string) =>
      `<!doctype html><html><head><title>Via Fidei</title></head><body>${inner}${"x".repeat(600)}</body></html>`;
    expect(
      bodyProvablyLacksTitle(page("<h1>Something else</h1>"), "Our Father", "our-father"),
    ).toBe(true);
    // Entity-escaped title still counts as present.
    expect(
      bodyProvablyLacksTitle(page("<h1>St. John&#39;s Prayer</h1>"), "St. John's Prayer", "x"),
    ).toBe(false);
    // The slug in the page (canonical link / nav) means the route rendered.
    expect(
      bodyProvablyLacksTitle(
        page('<link rel="canonical" href="/prayers/our-father">'),
        "Our Father",
        "our-father",
      ),
    ).toBe(false);
    // An error shell served as 200 is not proof.
    expect(
      bodyProvablyLacksTitle(
        page("Application error: a client-side exception"),
        "Our Father",
        "our-father",
      ),
    ).toBe(false);
    // A tiny body is not proof either.
    expect(
      bodyProvablyLacksTitle("<html><body>nope</body></html>", "Our Father", "our-father"),
    ).toBe(false);
  });
});

describe("origin guard", () => {
  it("refuses to probe localhost against a remote database", () => {
    process.env.DATABASE_URL = "postgresql://u:p@monorail.proxy.rlwy.net:5432/railway";
    expect(probeOriginMismatch()).toMatch(/localhost while DATABASE_URL points at monorail/);
  });

  it("allows localhost against a local database and a public origin against anything", () => {
    expect(probeOriginMismatch()).toBeNull();
    process.env.DATABASE_URL = "postgresql://u:p@monorail.proxy.rlwy.net:5432/railway";
    process.env.PUBLIC_BASE_URL = "https://etviafidei.com";
    expect(probeOriginMismatch()).toBeNull();
  });

  it("verifyPublished returns WARN without touching the network when the origin is mismatched", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@monorail.proxy.rlwy.net:5432/railway";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const prisma = makeProbePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "SAINT",
      contentId: "s1",
      slug: "saint-x",
      expectedTitle: "Saint X",
    });
    expect(out.result).toBe("WARN");
    expect(out.checks.publicPageCheck).toBe("WARN");
    expect(out.checks.errorMessage).toMatch(/origin not configured/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.publishedContent.updateMany).not.toHaveBeenCalled();
  });
});

function makeProbePrisma(opts: { goal?: Record<string, unknown> | null } = {}) {
  const verifications: Array<Record<string, unknown>> = [];
  const goalUpdate = vi.fn(async () => ({}));
  return {
    captured: verifications,
    goalUpdate,
    postPublishVerification: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `v${verifications.length + 1}`, ...data };
        verifications.push(row);
        return row;
      }),
      findFirst: vi.fn(async () => null),
    },
    publishedContent: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 7),
    },
    contentGoal: {
      findUnique: vi.fn(async () => opts.goal ?? null),
      update: goalUpdate,
    },
    humanReviewQueue: { create: vi.fn(async () => ({ id: "r1" })) },
  } as unknown as PrismaClient & {
    captured: Array<Record<string, unknown>>;
    goalUpdate: ReturnType<typeof vi.fn>;
  };
}

describe("verifyPublished sub-checks over HTTP (P5)", () => {
  it("PASSes sitemap + search when the public surfaces list the item, and cache is a no-op outside Next", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/sitemap.xml")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            "<urlset><url><loc>https://www.etviafidei.com/prayers/our-father/</loc></url></urlset>",
        };
      }
      if (url.includes("/api/search/suggest")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ suggestions: [{ slug: "our-father", label: "Our Father" }] }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "<html><body><h1>Our Father</h1></body></html>",
      };
    }) as unknown as typeof fetch;
    const prisma = makeProbePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(out.checks.publicPageCheck).toBe("PASS");
    expect(out.checks.sitemapCheck).toBe("PASS");
    expect(out.checks.searchCheck).toBe("PASS");
    expect(out.checks.cacheCheck).toBe("PASS");
    expect(out.result).toBe("PASS");
  });

  it("WARNs (never FAILs) when the sitemap / search cannot confirm the item", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/sitemap.xml")) return { ok: false, status: 503, text: async () => "" };
      if (url.includes("/api/search/suggest")) {
        return { ok: true, status: 200, json: async () => ({ suggestions: [] }) };
      }
      return { ok: true, status: 200, text: async () => "<html><h1>Our Father</h1></html>" };
    }) as unknown as typeof fetch;
    const prisma = makeProbePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(out.checks.publicPageCheck).toBe("PASS");
    expect(out.checks.sitemapCheck).toBe("WARN");
    expect(out.checks.searchCheck).toBe("WARN");
    expect(out.result).toBe("WARN");
    expect(out.observed).toBe("WARN");
  });

  it("measures the content-goal gap against desiredTarget (DG-11)", async () => {
    const prisma = makeProbePrisma({
      goal: {
        id: "g1",
        contentType: "PRAYER",
        minimumTarget: 0,
        desiredTarget: 100,
        canonicalMax: null,
        currentValidCount: 7,
      },
    });
    await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
      skipNetwork: true,
    });
    expect(prisma.goalUpdate).toHaveBeenCalledTimes(1);
    const data = (
      prisma.goalUpdate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data.gapCount).toBe(93);
    expect(data.currentValidCount).toBe(7);
    expect(data.status).toBe("IN_PROGRESS");
  });
});

describe("findPriorFailure", () => {
  it("returns the latest row only when it is a FAIL, and is fail-open", async () => {
    const fail = { id: "v1", result: "FAIL", createdAt: new Date(0) };
    const p1 = { postPublishVerification: { findFirst: vi.fn(async () => fail) } } as never;
    expect(await findPriorFailure(p1, { contentType: "SAINT", contentId: "x" })).toEqual({
      id: "v1",
      createdAt: new Date(0),
    });
    const p2 = {
      postPublishVerification: { findFirst: vi.fn(async () => ({ ...fail, result: "WARN" })) },
    } as never;
    expect(await findPriorFailure(p2, { contentType: "SAINT", contentId: "x" })).toBeNull();
    const p3 = { postPublishVerification: {} } as never;
    expect(await findPriorFailure(p3, { contentType: "SAINT", contentId: "x" })).toBeNull();
    expect(FAIL_CONFIRMATION_GAP_MS).toBe(10 * 60 * 1000);
  });
});

describe("cache revalidation outside the Next runtime", () => {
  it("is a successful no-op (pages are force-dynamic)", async () => {
    const r = await revalidateForRow({
      reason: "package_created",
      contentType: "PRAYER",
      slug: "x",
    });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(true);
    expect(NO_TAG_CACHE_MESSAGE).toMatch(/force-dynamic/);
  });
});

describe("rollback tree files a review row on EVERY automated unpublish", () => {
  it("severe branch: unpublishes, files a queue row even in autonomous mode, reports humanReviewFiled", async () => {
    const create = vi.fn(async () => ({ id: "hr-1" }));
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      publishedContent: { updateMany },
      humanReviewQueue: { create },
    } as unknown as PrismaClient;
    const result = await decideAndExecuteRollback(prisma, {
      contentType: "SAINT",
      contentId: "s1",
      slug: "saint-x",
      failedCheck: "public_route",
      reason: "confirmed 404",
    });
    expect(result.kind).toBe("DELETED");
    expect(result.humanReviewFiled).toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    const data = (create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.proposedAction).toBe("restore_or_delete_unpublished_content");
    expect(data.status).toBe("PENDING");
  });

  it("ambiguous branch: also always queues", async () => {
    const create = vi.fn(async () => ({ id: "hr-2" }));
    const prisma = {
      publishedContent: { updateMany: vi.fn(async () => ({ count: 1 })) },
      humanReviewQueue: { create },
    } as unknown as PrismaClient;
    const result = await decideAndExecuteRollback(prisma, {
      contentType: "SAINT",
      contentId: "s1",
      slug: "saint-x",
      failedCheck: "tab_placement",
      reason: "tab missing",
    });
    expect(result.kind).toBe("HUMAN_REVIEW");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

// ── Dispatcher wiring ──────────────────────────────────────────────────

vi.mock("@/lib/admin-worker/post-publish-probe", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/admin-worker/post-publish-probe")>();
  return { ...mod, verifyPublished: vi.fn(mod.verifyPublished) };
});

vi.mock("@/lib/admin-worker/post-publish-rollback", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/admin-worker/post-publish-rollback")>();
  return { ...mod, decideAndExecuteRollback: vi.fn(mod.decideAndExecuteRollback) };
});

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import type { BrainDecision } from "@/lib/admin-worker/brain";

function verifyDecision(): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "POST_PUBLISH_VERIFY",
    passType: "CONTENT_GOAL",
    contentType: "PRAYER",
    sourceTarget: null,
    expectedResult: "verify",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: "POST_PUBLISH_VERIFY" },
    rankedAlternatives: [],
    missionStage: "POST_PUBLISH_VERIFY",
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

function makeDispatchPrisma(opts: {
  latest?: Array<{ contentId: string; result: string; createdAt: Date }>;
  rows?: Array<{ id: string; contentType: string; slug: string; title: string }>;
  warnCounts?: Array<{ contentId: string; _count: { _all: number } }>;
  /** Rows the whole-catalog sweep window returns, by cursor offset. */
  sweepPages?: Record<
    number,
    Array<{ id: string; contentType: string; slug: string; title: string }>
  >;
  total?: number;
  cursorOffset?: number;
}) {
  const memoryWrites: Array<Record<string, unknown>> = [];
  const findManyArgs: Array<Record<string, unknown>> = [];
  const prisma = {
    __memoryWrites: memoryWrites,
    __findManyArgs: findManyArgs,
    postPublishVerification: {
      findMany: vi.fn(async () => opts.latest ?? []),
      groupBy: vi.fn(async () => opts.warnCounts ?? []),
    },
    publishedContent: {
      count: vi.fn(async () => opts.total ?? 1),
      findMany: vi.fn(async (arg: Record<string, unknown>) => {
        findManyArgs.push(arg);
        if (typeof arg?.skip === "number") return opts.sweepPages?.[arg.skip] ?? [];
        return (
          opts.rows ?? [
            { id: "p1", contentType: "PRAYER", slug: "our-father", title: "Our Father" },
          ]
        );
      }),
    },
    adminWorkerMemory: {
      findUnique: vi.fn(async () =>
        opts.cursorOffset == null ? null : { memoryValue: { offset: opts.cursorOffset } },
      ),
      upsert: vi.fn(async (arg: Record<string, unknown>) => {
        memoryWrites.push(arg);
        return {};
      }),
    },
    workerBuildJob: {
      findFirst: vi.fn(async () => ({ resultPayload: { sourceHost: "vatican.va" } })),
    },
  };
  return prisma as unknown as Parameters<typeof executeMissionStage>[0]["prisma"] & {
    __memoryWrites: Array<Record<string, unknown>>;
    __findManyArgs: Array<Record<string, unknown>>;
  };
}

describe("POST_PUBLISH_VERIFY reaches the whole catalog and stops spinning on WARN", () => {
  it("also walks a whole-catalog sweep window, not only the newest 50 by publishedAt", async () => {
    // "the newest 50 by publishedAt" can never reach the other ~3,400 published
    // rows: whatever is in that window is re-probed forever and the rest is
    // never verified at all.
    const { verifyPublished: mocked } = await import("@/lib/admin-worker/post-publish-probe");
    vi.mocked(mocked).mockResolvedValue({
      verificationId: "v9",
      result: "PASS",
      observed: "PASS",
      failureConfirmed: false,
      publicUrl: "x",
      checks: { publicPageCheck: "PASS" } as never,
    });
    const prisma = makeDispatchPrisma({
      // Everything in the recency window is already verified and not eligible.
      latest: [{ contentId: "p1", result: "PASS", createdAt: new Date() }],
      total: 3_457,
      cursorOffset: 100,
      sweepPages: {
        100: [{ id: "old-1", contentType: "SAINT", slug: "st-old", title: "St Old" }],
      },
    });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    // It probed a row from the sweep window, not from the recency window.
    expect(vi.mocked(mocked).mock.calls[0][1]).toMatchObject({ contentId: "old-1" });
    // …and the cursor advanced, so the next dispatch covers the next page.
    const write = prisma.__memoryWrites[0] as { update: { memoryValue: { offset: number } } };
    expect(write.update.memoryValue.offset).toBe(150);
  });

  it("wraps the sweep cursor at the end of the catalog", async () => {
    const { verifyPublished: mocked } = await import("@/lib/admin-worker/post-publish-probe");
    vi.mocked(mocked).mockResolvedValue({
      verificationId: "v9",
      result: "PASS",
      observed: "PASS",
      failureConfirmed: false,
      publicUrl: "x",
      checks: { publicPageCheck: "PASS" } as never,
    });
    const prisma = makeDispatchPrisma({ total: 120, cursorOffset: 100, sweepPages: { 100: [] } });
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    const write = prisma.__memoryWrites[0] as { update: { memoryValue: { offset: number } } };
    expect(write.update.memoryValue.offset).toBe(0);
  });

  it("backs off re-probing a row that keeps coming back WARN", async () => {
    // post-publish-probe.ts degrades a missing/mismatched origin to WARN on
    // EVERY check, so without a backoff the stage cycled the same rows forever
    // — one PostPublishVerification row and one WARN log row per dispatch.
    const { verifyPublished: mocked } = await import("@/lib/admin-worker/post-publish-probe");
    vi.mocked(mocked).mockResolvedValue({
      verificationId: "v9",
      result: "WARN",
      observed: "WARN",
      failureConfirmed: false,
      publicUrl: "x",
      checks: { publicPageCheck: "WARN" } as never,
    });
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const out = await executeMissionStage({
      prisma: makeDispatchPrisma({
        latest: [{ contentId: "p1", result: "WARN", createdAt: twoDaysAgo }],
        // Six previous WARNs: the re-probe window is now six days, not one.
        warnCounts: [{ contentId: "p1", _count: { _all: 6 } }],
        total: 1,
        sweepPages: { 0: [] },
      }),
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    expect(out.kind).toBe("idle");
    expect(out.summary).toMatch(/already verified/);
    expect(vi.mocked(mocked)).not.toHaveBeenCalled();
  });
});

describe("dispatcher POST_PUBLISH_VERIFY", () => {
  it("maps a THROWN verification to WARN, never rolls back, and does not penalise the source", async () => {
    const { verifyPublished: mocked } = await import("@/lib/admin-worker/post-publish-probe");
    const { decideAndExecuteRollback: rollbackMock } =
      await import("@/lib/admin-worker/post-publish-rollback");
    vi.mocked(mocked).mockRejectedValueOnce(new Error("db blip while recording"));
    const out = await executeMissionStage({
      prisma: makeDispatchPrisma({}),
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    expect(out.kind).not.toBe("rejected");
    expect(out.rejected).toBe(0);
    expect(vi.mocked(rollbackMock)).not.toHaveBeenCalled();
    expect(vi.mocked(pushReputation)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ stage: "post_publish", ok: true }),
    );
  });

  it("treats WARN as not-a-rejection (reputation ok) and only rolls back on a confirmed FAIL", async () => {
    const { verifyPublished: mocked } = await import("@/lib/admin-worker/post-publish-probe");
    const { decideAndExecuteRollback: rollbackMock } =
      await import("@/lib/admin-worker/post-publish-rollback");
    vi.mocked(mocked).mockResolvedValueOnce({
      verificationId: "v1",
      result: "WARN",
      observed: "FAIL",
      failureConfirmed: false,
      publicUrl: "x",
      checks: { publicPageCheck: "FAIL" } as never,
    });
    const warn = await executeMissionStage({
      prisma: makeDispatchPrisma({}),
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    expect(warn.kind).toBe("idle");
    expect(warn.rejected).toBe(0);
    expect(vi.mocked(rollbackMock)).not.toHaveBeenCalled();

    vi.mocked(rollbackMock).mockResolvedValueOnce({
      kind: "HUMAN_REVIEW",
      repairAttempted: null,
      rollbackAction: "unpublished",
      humanReviewFiled: true,
      reason: "t",
    });
    vi.mocked(mocked).mockResolvedValueOnce({
      verificationId: "v2",
      result: "FAIL",
      observed: "FAIL",
      failureConfirmed: true,
      publicUrl: "x",
      checks: { publicPageCheck: "FAIL" } as never,
    });
    const fail = await executeMissionStage({
      prisma: makeDispatchPrisma({}),
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    expect(fail.kind).toBe("rejected");
    expect(vi.mocked(rollbackMock)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(rollbackMock).mock.calls[0][1].reason).toMatch(/confirmed by two probes/);
  });

  it("re-probes an unconfirmed first-strike FAIL once the confirmation gap has passed, not before", async () => {
    const { verifyPublished: mocked } = await import("@/lib/admin-worker/post-publish-probe");
    vi.mocked(mocked).mockResolvedValue({
      verificationId: "v3",
      result: "WARN",
      observed: "WARN",
      failureConfirmed: false,
      publicUrl: "x",
      checks: { publicPageCheck: "WARN" } as never,
    });
    // Too recent → nothing to do this pass.
    const recent = await executeMissionStage({
      prisma: makeDispatchPrisma({
        latest: [{ contentId: "p1", result: "FAIL", createdAt: new Date(Date.now() - 2 * 60_000) }],
      }),
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    expect(recent.kind).toBe("idle");
    expect(recent.summary).toMatch(/already verified/);
    expect(vi.mocked(mocked)).not.toHaveBeenCalled();

    // Old enough → re-probed.
    await executeMissionStage({
      prisma: makeDispatchPrisma({
        latest: [
          { contentId: "p1", result: "FAIL", createdAt: new Date(Date.now() - 11 * 60_000) },
        ],
      }),
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    expect(vi.mocked(mocked)).toHaveBeenCalledTimes(1);

    // A PASS row means verified — skipped.
    vi.mocked(mocked).mockClear();
    const done = await executeMissionStage({
      prisma: makeDispatchPrisma({
        latest: [
          { contentId: "p1", result: "PASS", createdAt: new Date(Date.now() - 11 * 60_000) },
        ],
      }),
      workerId: "w1",
      passId: "pass-1",
      decision: verifyDecision(),
    });
    expect(done.kind).toBe("idle");
    expect(vi.mocked(mocked)).not.toHaveBeenCalled();
  });
});

describe("PUBLIC_DISPLAY_FAILED repair accepts WARN as displayed", () => {
  it("resolves the plan on WARN and only fails on FAIL / thrown", async () => {
    const { verifyPublished: mocked } = await import("@/lib/admin-worker/post-publish-probe");
    const { runRepairOrchestrator } = await import("@/lib/admin-worker/repair-orchestrator");
    const plan = {
      id: "plan-1",
      kind: "PUBLIC_DISPLAY_FAILED",
      failedEntity: "pub-1",
      repairAction: "verify route",
      status: "PENDING",
      attempts: 0,
      maxAttempts: 5,
      lastAttemptAt: null,
      nextAttemptAt: null,
    };
    const prisma = () =>
      ({
        adminWorkerRepairPlan: {
          findMany: vi.fn(async () => [plan]),
          update: vi.fn(async () => undefined),
        },
        publishedContent: {
          findFirst: vi.fn(async () => ({
            id: "pub-1",
            contentType: "SAINT",
            slug: "st-francis",
            title: "St Francis",
          })),
        },
      }) as unknown as Parameters<typeof runRepairOrchestrator>[0];

    vi.mocked(mocked).mockResolvedValueOnce({
      verificationId: "v",
      result: "WARN",
      observed: "WARN",
      failureConfirmed: false,
      publicUrl: "x",
      checks: { publicPageCheck: "PASS", sitemapCheck: "WARN" } as never,
    });
    const warn = await runRepairOrchestrator(prisma());
    expect(warn.plansSucceeded).toBe(1);

    vi.mocked(mocked).mockResolvedValueOnce({
      verificationId: "v",
      result: "FAIL",
      observed: "FAIL",
      failureConfirmed: true,
      publicUrl: "x",
      checks: { publicPageCheck: "FAIL" } as never,
    });
    const fail = await runRepairOrchestrator(prisma());
    expect(fail.plansSucceeded).toBe(0);
  });
});

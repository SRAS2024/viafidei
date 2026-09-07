/**
 * "review" outcomes are non-terminal in autonomous mode (audit finding P4).
 *
 *   - human-review.ts classifies review reasons into retry / repair / terminal
 *     and keeps a per-artifact retry budget with exponential backoff
 *   - the dispatcher routes a review outcome: score-band → QUALITY_SCORE_FAILED
 *     plan + NEEDS_REPAIR; transient/advisory → NEEDS_REVIEW with a retry;
 *     doctrinal doubt → terminal; budget spent → terminal; human-review mode →
 *     terminal
 *   - the build-ready drain recovers retryable NEEDS_REVIEW artifacts once
 *     their backoff has elapsed and while they have budget left
 *   - fileHumanReview({ alwaysQueue }) creates a row even in autonomous mode
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "plan-1" })),
}));

vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(),
  CONTENT_TYPE_STRATEGIES: {},
}));

const orchestrator = { result: { kind: "review", reason: "" } as Record<string, unknown> };
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => orchestrator.result),
}));

import type { PrismaClient } from "@prisma/client";

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import type { BrainDecision } from "@/lib/admin-worker/brain";
import { filePlan } from "@/lib/admin-worker/repair-plans";
import {
  REVIEW_RETRY_BUDGET,
  classifyReviewReason,
  consumeRetryBudget,
  fileHumanReview,
  readRetryBudget,
  reviewRetryDelayMs,
} from "@/lib/admin-worker/human-review";

let savedEnv: string | undefined;
beforeEach(() => {
  savedEnv = process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  orchestrator.result = { kind: "review", reason: "" };
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW;
  else process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = savedEnv;
  vi.clearAllMocks();
});

/** In-memory AdminWorkerMemory so the budget round-trips like the real table. */
function memoryStore() {
  const rows = new Map<string, { memoryValue: unknown }>();
  return {
    rows,
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) =>
          rows.get(where.memoryType_memoryKey.memoryKey) ?? null,
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue: unknown };
        }) => {
          rows.set(where.memoryType_memoryKey.memoryKey, { memoryValue: update.memoryValue });
          return {};
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { memoryKey: string } }) => {
        rows.delete(where.memoryKey);
        return { count: 1 };
      }),
    },
  };
}

describe("human-review: reason table + retry budget", () => {
  it("classifies reasons: transient/advisory → retry, score band → repair, doctrinal doubt → terminal", () => {
    expect(classifyReviewReason("proof-based publishing: brain offline").route).toBe("retry");
    expect(
      classifyReviewReason("specialist panel routed to review (objections: citation)").route,
    ).toBe("retry");
    expect(classifyReviewReason("finalScore 0.83 < 0.85").route).toBe("repair");
    expect(classifyReviewReason("confidence 0.70 < 0.8").route).toBe("repair");
    expect(
      classifyReviewReason("communion risk 0.91 (schismatic); requires human verification").route,
    ).toBe("terminal");
    expect(classifyReviewReason("verifier blocked: sources conflict").route).toBe("terminal");
    expect(classifyReviewReason(null).route).toBe("terminal");
  });

  it("consumes the budget with exponential backoff and clears on success", async () => {
    const mem = memoryStore();
    const prisma = mem as unknown as PrismaClient;
    expect(reviewRetryDelayMs(1)).toBe(10 * 60_000);
    expect(reviewRetryDelayMs(3)).toBe(40 * 60_000);
    const a1 = await consumeRetryBudget(prisma, "review", "art-1", { reason: "r" });
    expect(a1).toMatchObject({ allowed: true, attempts: 1 });
    const state = await readRetryBudget(prisma, "review", "art-1");
    expect(state.attempts).toBe(1);
    expect(state.nextRetryAt!.getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    for (let i = 2; i <= REVIEW_RETRY_BUDGET; i++) {
      expect((await consumeRetryBudget(prisma, "review", "art-1")).allowed).toBe(true);
    }
    expect((await consumeRetryBudget(prisma, "review", "art-1")).allowed).toBe(false);
  });

  it("is fail-open against a client without the memory table", async () => {
    const prisma = {} as unknown as PrismaClient;
    expect(await readRetryBudget(prisma, "review", "x")).toMatchObject({ attempts: 0 });
    expect((await consumeRetryBudget(prisma, "review", "x")).allowed).toBe(true);
  });

  it("alwaysQueue creates a row even in autonomous mode", async () => {
    const create = vi.fn(async () => ({ id: "hr-1" }));
    const prisma = { humanReviewQueue: { create } } as unknown as PrismaClient;
    const silent = await fileHumanReview(prisma, {
      proposedAction: "publish",
      reason: "r",
      confidence: 0.5,
    });
    expect(silent.id).toBe("autonomous");
    expect(create).not.toHaveBeenCalled();
    const queued = await fileHumanReview(prisma, {
      proposedAction: "restore_or_delete_unpublished_content",
      reason: "r",
      confidence: 0.5,
      alwaysQueue: true,
    });
    expect(queued.id).toBe("hr-1");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

// ── Dispatcher routing ─────────────────────────────────────────────────

function publishDecision(): BrainDecision {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "PUBLIC_PUBLISH",
    passType: "CONTENT_GOAL",
    contentType: "SAINT",
    sourceTarget: null,
    expectedResult: "publish",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "test",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: "PUBLIC_PUBLISH" },
    rankedAlternatives: [],
    missionStage: "PUBLIC_PUBLISH",
    brainExplanation: "test",
    brainFailure: null,
  } as unknown as BrainDecision;
}

function makePublishPrisma(mem = memoryStore()) {
  const artifactUpdate = vi.fn(async () => ({}));
  return {
    artifactUpdate,
    mem,
    adminWorkerPackageArtifact: {
      findFirst: vi.fn(async () => ({
        id: "art-1",
        contentType: "SAINT",
        normalizedTitle: "Saint Example",
        normalizedSlug: "saint-example",
        extractedFields: { name: "Saint Example" },
        fieldProvenance: [{ fieldName: "name", sourceUrl: "x", sourceHost: "vatican.va" }],
        missingFields: [],
        validationNeeds: [],
        confidenceScore: 0.83,
        status: "QA_PASSED",
        checklistItemId: "ci-1",
        sourceReadId: null,
      })),
      update: artifactUpdate,
    },
    adminWorkerStrictQAResult: {
      findUnique: vi.fn(async () => ({
        id: "qa-1",
        status: "PASSED",
        finalScore: 0.83,
        blockingReasons: [],
        repairSuggestions: [],
      })),
    },
    adminWorkerCrossSourceVerification: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    adminWorkerMemory: mem.adminWorkerMemory,
  } as unknown as Parameters<typeof executeMissionStage>[0]["prisma"] & {
    artifactUpdate: ReturnType<typeof vi.fn>;
    mem: ReturnType<typeof memoryStore>;
  };
}

function lastStatus(prisma: { artifactUpdate: ReturnType<typeof vi.fn> }): Record<string, unknown> {
  const calls = prisma.artifactUpdate.mock.calls as unknown as Array<
    [{ data: Record<string, unknown> }]
  >;
  return calls[calls.length - 1][0].data;
}

describe("dispatcher PUBLIC_PUBLISH review routing (autonomous mode)", () => {
  it("score-band review → QUALITY_SCORE_FAILED plan + NEEDS_REPAIR + repair-planned outcome", async () => {
    orchestrator.result = { kind: "review", reason: "finalScore 0.83 < 0.85" };
    const prisma = makePublishPrisma();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect(out.kind).toBe("repair-planned");
    expect(out.repairsPlanned).toBe(1);
    expect(out.rejected).toBe(0);
    expect(lastStatus(prisma).status).toBe("NEEDS_REPAIR");
    expect(vi.mocked(filePlan)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: "QUALITY_SCORE_FAILED", failedEntity: "art-1" }),
    );
    expect((await readRetryBudget(prisma, "review", "art-1")).attempts).toBe(1);
  });

  it("transient review (proof gate) → NEEDS_REVIEW with a backed-off retry recorded", async () => {
    orchestrator.result = { kind: "review", reason: "proof-based publishing: brain offline" };
    const prisma = makePublishPrisma();
    const out = await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect(out.kind).toBe("rejected");
    expect(out.summary).toMatch(/autonomous retry/);
    expect(lastStatus(prisma).status).toBe("NEEDS_REVIEW");
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
    const budget = await readRetryBudget(prisma, "review", "art-1");
    expect(budget.attempts).toBe(1);
    expect(budget.nextRetryAt).not.toBeNull();
  });

  it("doctrinal doubt (communion risk) → terminal NEEDS_REVIEW, no budget spent", async () => {
    orchestrator.result = {
      kind: "review",
      reason:
        "communion risk 0.92 (non-Catholic source); requires human verification before publish",
    };
    const prisma = makePublishPrisma();
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect(lastStatus(prisma).status).toBe("NEEDS_REVIEW");
    expect((await readRetryBudget(prisma, "review", "art-1")).attempts).toBe(0);
  });

  it("stops retrying once the budget is spent", async () => {
    orchestrator.result = { kind: "review", reason: "proof-based publishing: brain offline" };
    const mem = memoryStore();
    const prisma = makePublishPrisma(mem);
    for (let i = 0; i < REVIEW_RETRY_BUDGET; i++) {
      await consumeRetryBudget(prisma, "review", "art-1");
    }
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    const data = lastStatus(prisma);
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(String(data.rejectionReason)).toContain("retry budget spent");
  });

  it("human-review mode leaves the item parked for a person (no retry, no plan)", async () => {
    process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW = "1";
    orchestrator.result = { kind: "review", reason: "finalScore 0.83 < 0.85" };
    const prisma = makePublishPrisma();
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect(lastStatus(prisma).status).toBe("NEEDS_REVIEW");
    expect(vi.mocked(filePlan)).not.toHaveBeenCalled();
    expect((await readRetryBudget(prisma, "review", "art-1")).attempts).toBe(0);
  });

  it("a publish clears the retry budget", async () => {
    orchestrator.result = {
      kind: "published",
      publishedContentId: "pub-1",
      slug: "s",
      route: "/r",
      reason: "ok",
    };
    const mem = memoryStore();
    const prisma = makePublishPrisma(mem);
    await consumeRetryBudget(prisma, "review", "art-1");
    await executeMissionStage({
      prisma,
      workerId: "w1",
      passId: "p1",
      decision: publishDecision(),
    });
    expect((await readRetryBudget(prisma, "review", "art-1")).attempts).toBe(0);
  });
});

// ── Drain recovery ─────────────────────────────────────────────────────

describe("build-ready drain recovers retryable reviews within budget + backoff", () => {
  function drainPrisma(opts: {
    reason: string;
    qa?: string | null;
    provenance?: boolean;
    budget?: { attempts: number; nextRetryAt: string | null };
  }) {
    let status = "NEEDS_REVIEW";
    const mem = memoryStore();
    if (opts.budget) {
      mem.rows.set("retry-budget:review:art-1", {
        memoryValue: { attempts: opts.budget.attempts, nextRetryAt: opts.budget.nextRetryAt },
      });
    }
    return {
      status: () => status,
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
          if (where?.status === "NEEDS_REVIEW") {
            return status === "NEEDS_REVIEW"
              ? [
                  {
                    id: "art-1",
                    fieldProvenance: opts.provenance === false ? [] : [{ field: "x" }],
                    rejectionReason: opts.reason,
                  },
                ]
              : [];
          }
          return [];
        }),
        count: vi.fn(async () => 0),
        update: vi.fn(async ({ data }: { data?: Record<string, unknown> } = {}) => {
          if (typeof data?.status === "string") status = data.status;
          return undefined;
        }),
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async () => (opts.qa === null ? null : { status: opts.qa ?? "PASSED" })),
      },
      adminWorkerCrossSourceVerification: { groupBy: vi.fn(async () => []) },
      publishedContent: { findMany: vi.fn(async () => []) },
      adminWorkerMemory: mem.adminWorkerMemory,
    } as never;
  }

  it("recovers a QA-passed proof-gate review whose backoff has elapsed", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const prisma = drainPrisma({
      reason: "proof-based publishing: brain offline",
      budget: { attempts: 1, nextRetryAt: new Date(Date.now() - 60_000).toISOString() },
    });
    const r = await runBuildReadyDrain(prisma, { active: false, driveRounds: 0 });
    expect(r.recovered).toBe(1);
    expect((prisma as { status: () => string }).status()).toBe("QA_PASSED");
  });

  it("waits while the backoff is still running, and gives up once the budget is spent", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const waiting = drainPrisma({
      reason: "proof-based publishing: brain offline",
      budget: { attempts: 1, nextRetryAt: new Date(Date.now() + 5 * 60_000).toISOString() },
    });
    expect((await runBuildReadyDrain(waiting, { active: false, driveRounds: 0 })).recovered).toBe(
      0,
    );
    const spent = drainPrisma({
      reason: "proof-based publishing: brain offline",
      budget: { attempts: REVIEW_RETRY_BUDGET + 1, nextRetryAt: null },
    });
    expect((await runBuildReadyDrain(spent, { active: false, driveRounds: 0 })).recovered).toBe(0);
  });

  it("never recovers a terminal reason, an un-QA'd item, or an unprovenanced citation objection", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const terminal = drainPrisma({ reason: "communion risk 0.9; requires human verification" });
    expect((await runBuildReadyDrain(terminal, { active: false, driveRounds: 0 })).recovered).toBe(
      0,
    );
    const noQa = drainPrisma({ reason: "proof-based publishing: x", qa: null });
    expect((await runBuildReadyDrain(noQa, { active: false, driveRounds: 0 })).recovered).toBe(0);
    const uncited = drainPrisma({
      reason: "specialist panel routed to review (objections: citation)",
      provenance: false,
    });
    expect((await runBuildReadyDrain(uncited, { active: false, driveRounds: 0 })).recovered).toBe(
      0,
    );
  });
});

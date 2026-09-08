/**
 * The governor's ESCAPE HATCH — the fix for the open LOOPING escalation
 * (kind LOOPING, severity ERROR, contentType SAINT, detail "Stage SOURCE_FETCH
 * failed/needed-repair 62× in 6h with 0 successes").
 *
 * Forcing a different stage keeps the PASS productive but leaves the BLOCKED
 * ITEM exactly where it was, so the fixated stage loops again as soon as the
 * governor's window rolls. The escape hatch adds the two pieces that actually
 * clear it:
 *
 *   1. fixation is judged PER CONTENT TYPE, so a stage that advances SAINT but
 *      never GUIDE is caught (the escalation is scoped to one content type);
 *   2. for an acquisition stage the governor performs a `reroute_source`
 *      corrective — it reads the fetch ledger for the approved host whose
 *      recent fetches ALL failed and boosts an alternate approved source — and
 *      records what it did, so the escalation can be answered and then resolve
 *      itself once the alternate source advances.
 *
 * The SOURCE_FETCH / CHECKLIST_CREATION halves of that corrective live in the
 * dispatcher and are pinned here too, since they are the same escape hatch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type { WorldState } from "@/lib/admin-worker/brain";
import {
  computeGovernorVerdict,
  evaluateGovernor,
  type GovernorOutcomeRow,
} from "@/lib/admin-worker/governor";
import { blockedFetchHosts, rerouteInsufficientArtifacts } from "@/lib/admin-worker/dispatcher";

const rerouteToAlternateSource = vi.fn(
  async (_prisma: unknown, input: { contentType: string; failedHost: string }) => ({
    kind: "extraction_rerouted" as const,
    attempted: true,
    succeeded: true,
    reason: `rerouted ${input.contentType} extraction from ${input.failedHost} to alt.example`,
    reroutedTo: "alt.example",
  }),
);

vi.mock("@/lib/admin-worker/repair", () => ({
  rerouteToAlternateSource: (...args: unknown[]) =>
    (rerouteToAlternateSource as unknown as (...a: unknown[]) => unknown)(...args),
}));

function world(overrides: Partial<WorldState> = {}): WorldState {
  return {
    pendingBuildJobs: 0,
    failedBuildJobs: 0,
    runningBuildJobs: 0,
    contentGoalGap: 0,
    contentGoalContentType: null,
    pausedSources: 0,
    trustedSources: 0,
    reviewQueuePending: 0,
    recentSecurityBreaches24h: 0,
    homepageScore: 1,
    isPaused: false,
    pausedReason: null,
    heartbeatAgeMs: 0,
    lastSuccessAgeMs: 0,
    lastFailureAgeMs: null,
    currentBlocker: null,
    candidateUrlsAvailable: 0,
    candidatesNeedingPrioritization: 0,
    pendingRepairPlans: 0,
    pipelineStagesBlocked: 0,
    unclassifiedReads: 0,
    readsAwaitingExtraction: 0,
    artifactsAwaitingChecklist: 0,
    artifactsAwaitingBuild: 0,
    artifactsAwaitingVerification: 0,
    artifactsAwaitingQA: 0,
    artifactsAwaitingPublish: 0,
    publishedButUnverified: 0,
    pendingQAReviews: 0,
    contentGoalsAtGoalCount: 0,
    contentGoalsBelowGoalCount: 0,
    timeSinceLastGrowthMs: null,
    topSourceReputation: [],
    ...overrides,
  };
}

function rows(
  stage: string,
  n: number,
  resultType: string,
  contentType: string | null = null,
): GovernorOutcomeRow[] {
  const result =
    resultType === "success"
      ? "advanced"
      : resultType === "needs_repair"
        ? "repair-planned"
        : "idle";
  return Array.from({ length: n }, () => ({
    stage,
    resultType,
    result,
    entityId: null,
    contentType,
  }));
}

const BASE = { windowMinutes: 15, minSamples: 3, maxEntityRetries: 3 };

beforeEach(() => {
  rerouteToAlternateSource.mockClear();
});

describe("per-content-type fixation", () => {
  it("catches a stage stuck on ONE content type while it advances another", () => {
    // Stage-wide this looks healthy (3 SAINT successes), which is exactly how
    // the escalation's stage stayed invisible to the stage-wide check.
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 10, publishedButUnverified: 4 }),
      chosenStage: "SOURCE_FETCH",
      chosenContentType: "GUIDE",
      rows: [
        ...rows("SOURCE_FETCH", 3, "success", "SAINT"),
        ...rows("SOURCE_FETCH", 4, "needs_repair", "GUIDE"),
      ],
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.blockedContentType).toBe("GUIDE");
    expect(v.reason).toMatch(/GUIDE/);
  });

  it("leaves a content type that IS advancing alone", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 10 }),
      chosenStage: "SOURCE_FETCH",
      chosenContentType: "SAINT",
      rows: [
        ...rows("SOURCE_FETCH", 3, "success", "SAINT"),
        ...rows("SOURCE_FETCH", 4, "needs_repair", "GUIDE"),
      ],
      ...BASE,
    });
    expect(v.intervene).toBe(false);
  });
});

describe("corrective classification", () => {
  it("chooses reroute_source when an ACQUISITION stage fixates", () => {
    // The escalation's exact shape: SOURCE_FETCH, SAINT, failure + needs_repair,
    // zero successes.
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 12, publishedButUnverified: 30 }),
      chosenStage: "SOURCE_FETCH",
      chosenContentType: "SAINT",
      rows: [
        ...rows("SOURCE_FETCH", 31, "failure", "SAINT"),
        ...rows("SOURCE_FETCH", 31, "needs_repair", "SAINT"),
      ],
      ...BASE,
    });
    expect(v.intervene).toBe(true);
    expect(v.corrective).toBe("reroute_source");
    expect(v.blockedContentType).toBe("SAINT");
    // The pass itself still does something productive.
    expect(v.forcedStage).toBe("POST_PUBLISH_VERIFY");
  });

  it("chooses drain_backlog when built work is waiting behind a non-source stage", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 10, artifactsAwaitingPublish: 4 }),
      chosenStage: "CLASSIFICATION",
      rows: rows("CLASSIFICATION", 3, "needs_repair"),
      ...BASE,
    });
    expect(v.forcedStage).toBe("PUBLIC_PUBLISH");
    expect(v.corrective).toBe("drain_backlog");
  });

  it("chooses advance_stage when the funnel — not the backlog — has the work", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 10, unclassifiedReads: 6 }),
      chosenStage: "DISCOVERY",
      rows: rows("DISCOVERY", 3, "needs_repair"),
      ...BASE,
    });
    expect(v.forcedStage).toBe("CLASSIFICATION");
    expect(v.corrective).toBe("advance_stage");
  });

  it("chooses diagnostic when nothing productive has queued work", () => {
    const v = computeGovernorVerdict({
      world: world({ contentGoalGap: 40 }),
      chosenStage: "CLASSIFICATION",
      rows: rows("CLASSIFICATION", 3, "needs_repair"),
      ...BASE,
    });
    expect(v.corrective).toBe("diagnostic");
    expect(["REPAIR", "REPORTING", "MAINTENANCE"]).toContain(v.forcedStage);
  });

  it("reports no corrective when it does not intervene", () => {
    const v = computeGovernorVerdict({
      world: world(),
      chosenStage: "EXTRACTION",
      rows: rows("EXTRACTION", 4, "success"),
      ...BASE,
    });
    expect(v.corrective).toBeNull();
  });
});

describe("evaluateGovernor performs the corrective", () => {
  function prismaWithFetchLedger(
    ledger: Array<{ sourceHost: string; succeeded: boolean }>,
  ): PrismaClient {
    return {
      adminWorkerStageOutcome: { findMany: vi.fn(async () => []) },
      adminWorkerFetchResult: { findMany: vi.fn(async () => ledger) },
    } as unknown as PrismaClient;
  }

  it("reroutes away from the host whose recent fetches ALL failed", async () => {
    const prisma = prismaWithFetchLedger([
      { sourceHost: "stuck.example", succeeded: false },
      { sourceHost: "stuck.example", succeeded: false },
      { sourceHost: "stuck.example", succeeded: false },
      { sourceHost: "fine.example", succeeded: true },
      { sourceHost: "fine.example", succeeded: false },
      { sourceHost: "fine.example", succeeded: false },
    ]);
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "SOURCE_FETCH", contentType: "SAINT", finalBrain: "python" },
      world: world({ contentGoalGap: 12, publishedButUnverified: 30 }),
      recentOutcomes: rows("SOURCE_FETCH", 6, "needs_repair", "SAINT"),
    });
    expect(v.corrective).toBe("reroute_source");
    expect(rerouteToAlternateSource).toHaveBeenCalledTimes(1);
    expect(rerouteToAlternateSource.mock.calls[0][1]).toEqual({
      contentType: "SAINT",
      // fine.example still succeeds sometimes, so it is NOT routed away from.
      failedHost: "stuck.example",
    });
    expect(v.correctiveDetail).toMatch(/rerouted SAINT/);
  });

  it("still reroutes (least-tried alternate) when no single host is the blocker", async () => {
    const prisma = prismaWithFetchLedger([{ sourceHost: "fine.example", succeeded: true }]);
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "EXTRACTION", contentType: "SAINT", finalBrain: "python" },
      world: world({ contentGoalGap: 12 }),
      recentOutcomes: rows("EXTRACTION", 6, "needs_repair", "SAINT"),
    });
    expect(rerouteToAlternateSource.mock.calls[0][1]).toEqual({
      contentType: "SAINT",
      failedHost: "",
    });
    expect(v.correctiveDetail).toBeTruthy();
  });

  it("does not reroute when the fixated stage is not source-blocked", async () => {
    const prisma = prismaWithFetchLedger([]);
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "STRICT_QA", contentType: "SAINT", finalBrain: "python" },
      world: world({ contentGoalGap: 12, artifactsAwaitingPublish: 3 }),
      recentOutcomes: rows("STRICT_QA", 6, "needs_repair", "SAINT"),
    });
    expect(rerouteToAlternateSource).not.toHaveBeenCalled();
    expect(v.correctiveDetail).toBe("forced PUBLIC_PUBLISH");
  });

  it("never performs a corrective when it does not intervene", async () => {
    const prisma = prismaWithFetchLedger([]);
    await evaluateGovernor({
      prisma,
      decision: { missionStage: "SOURCE_FETCH", contentType: "SAINT", finalBrain: "python" },
      world: world(),
      recentOutcomes: rows("SOURCE_FETCH", 6, "success", "SAINT"),
    });
    expect(rerouteToAlternateSource).not.toHaveBeenCalled();
  });

  it("is fail-open: a fetch ledger that throws still yields a verdict", async () => {
    const prisma = {
      adminWorkerStageOutcome: { findMany: vi.fn(async () => []) },
      adminWorkerFetchResult: {
        findMany: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as unknown as PrismaClient;
    const v = await evaluateGovernor({
      prisma,
      decision: { missionStage: "SOURCE_FETCH", contentType: "SAINT", finalBrain: "python" },
      world: world({ contentGoalGap: 12 }),
      recentOutcomes: rows("SOURCE_FETCH", 6, "needs_repair", "SAINT"),
    });
    expect(v.intervene).toBe(true);
    expect(v.corrective).toBe("reroute_source");
  });
});

describe("SOURCE_FETCH routes around a host that is failing everything", () => {
  it("blocks a host with a failure streak and no success", async () => {
    const prisma = {
      adminWorkerFetchResult: {
        findMany: vi.fn(async () => [
          { sourceHost: "down.example", succeeded: false },
          { sourceHost: "down.example", succeeded: false },
          { sourceHost: "down.example", succeeded: false },
          { sourceHost: "flaky.example", succeeded: false },
          { sourceHost: "flaky.example", succeeded: false },
          { sourceHost: "flaky.example", succeeded: false },
          { sourceHost: "flaky.example", succeeded: true },
          { sourceHost: "rare.example", succeeded: false },
        ]),
      },
    } as unknown as PrismaClient;
    const blocked = await blockedFetchHosts(prisma);
    expect([...blocked]).toEqual(["down.example"]);
  });

  it("is fail-open when the fetch ledger is unavailable", async () => {
    const blocked = await blockedFetchHosts({} as unknown as PrismaClient);
    expect(blocked.size).toBe(0);
  });
});

describe("CHECKLIST_CREATION reroutes artifacts it can never use", () => {
  it("reroutes the content type away from the host that produced them", async () => {
    const prisma = {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => [
          { id: "a1", contentType: "SAINT", candidateUrlId: "c1" },
          // Same content type → one reroute, not two.
          { id: "a2", contentType: "SAINT", candidateUrlId: "c1" },
        ]),
      },
      candidateSourceUrl: {
        findUnique: vi.fn(async () => ({ sourceHost: "thin.example" })),
      },
      adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
    } as unknown as PrismaClient;
    const rerouted = await rerouteInsufficientArtifacts(prisma, "pass-1", ["a1", "a2"]);
    expect(rerouted).toBe(1);
    expect(rerouteToAlternateSource).toHaveBeenCalledTimes(1);
    expect(rerouteToAlternateSource.mock.calls[0][1]).toEqual({
      contentType: "SAINT",
      failedHost: "thin.example",
    });
  });

  it("is fail-open when the artifacts cannot be read", async () => {
    const prisma = {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as unknown as PrismaClient;
    await expect(rerouteInsufficientArtifacts(prisma, "pass-1", ["a1"])).resolves.toBe(0);
    expect(rerouteToAlternateSource).not.toHaveBeenCalled();
  });
});

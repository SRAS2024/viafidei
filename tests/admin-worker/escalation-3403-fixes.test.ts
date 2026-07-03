/**
 * Regression tests for the three-escalation incident (published frozen at 3403;
 * NO_VALUE + EXTRACTION-LOOPING-on-GUIDE). Each test pins one root cause:
 *
 *   A. Governor never fired — discovery "surfacing candidates" counted as
 *      productive, so the fetch ladder was never forced while 600 candidates sat
 *      unfetched and nothing published.
 *   B. Candidate promotion to PRIORITIZED was unreachable — duplicateRisk keyed
 *      on the whole published count of a type (3403 items), pinning every new
 *      candidate below the promotion gate.
 *   D. GUIDE (a curated-built type) pinned the web-pipeline mission target and
 *      mislabeled the EXTRACTION loop.
 *   E. The gabiula.pl.tl free-hosting host was fetchable/crawlable.
 */
import { describe, expect, it, vi } from "vitest";

import { computeGovernorVerdict } from "@/lib/admin-worker/governor";
import { scoreAndPersist } from "@/lib/admin-worker/candidate-scorer";
import { nextPriorityContentType } from "@/lib/admin-worker/content-goals";
import { isNonContentHost, isFetchableHost } from "@/lib/checklist/sources/authority-registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakePrisma = any;

// ── A. Governor forces the fetch ladder on a discovery-only spin ─────────────
describe("governor: discovery-only spin with unfetched backlog", () => {
  const world = {
    isPaused: false,
    contentGoalGap: 7203,
    contentGoalContentType: "SAINT",
    candidateUrlsAvailable: 600,
    candidatesNeedingPrioritization: 0,
    readsAwaitingExtraction: 0,
    artifactsAwaitingChecklist: 0,
    artifactsAwaitingVerification: 0,
    artifactsAwaitingQA: 0,
    artifactsAwaitingPublish: 0,
    publishedButUnverified: 0,
    pendingRepairPlans: 0,
    failedBuildJobs: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  it("intervenes and forces SOURCE_FETCH (discovery success no longer masks the stall)", () => {
    const rows = Array.from({ length: 6 }, () => ({
      stage: "DISCOVERY",
      resultType: "success",
      result: "advanced",
      entityId: null,
    }));
    const v = computeGovernorVerdict({
      world,
      chosenStage: "DISCOVERY",
      rows,
      windowMinutes: 15,
      minSamples: 3,
      maxEntityRetries: 3,
    });
    expect(v.intervene).toBe(true);
    expect(v.forcedStage).toBe("SOURCE_FETCH");
  });

  it("does NOT intervene when real downstream progress is happening", () => {
    const rows = [
      { stage: "DISCOVERY", resultType: "success", result: "advanced", entityId: null },
      { stage: "SOURCE_FETCH", resultType: "success", result: "advanced", entityId: null },
      { stage: "EXTRACTION", resultType: "success", result: "advanced", entityId: null },
      { stage: "PUBLIC_PUBLISH", resultType: "success", result: "advanced", entityId: null },
    ];
    const v = computeGovernorVerdict({
      world,
      chosenStage: "SOURCE_FETCH",
      rows,
      windowMinutes: 15,
      minSamples: 3,
      maxEntityRetries: 3,
    });
    expect(v.intervene).toBe(false);
  });
});

// ── B. Candidate promotion no longer blocked by a large published corpus ─────
function scorerPrisma(opts: { gap: number }): FakePrisma {
  const updated: Record<string, unknown> = {};
  return {
    _updated: updated,
    adminWorkerSourceReputation: { findFirst: async () => null },
    contentGoal: { findUnique: async () => ({ gapCount: opts.gap, desiredTarget: 10000 }) },
    candidateSourceUrl: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(updated, data);
        return {};
      },
    },
  };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    discoveredUrl: "https://www.newadvent.org/cathen/saint-x.htm",
    sourceHost: "www.newadvent.org",
    predictedContentType: "SAINT",
    status: "DISCOVERED",
    fetchAttempts: 0,
    rejectionReason: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...overrides,
  } as any;
}

describe("candidate-scorer: promotion reflects target saturation, not corpus size", () => {
  it("a below-target type (gap>0) → duplicateRisk 0 and status PRIORITIZED", async () => {
    const prisma = scorerPrisma({ gap: 7203 });
    const score = await scoreAndPersist(prisma, candidate());
    expect(score.duplicateRisk).toBe(0);
    expect(prisma._updated.status).toBe("PRIORITIZED");
  });

  it("a target-reached type (gap=0) carries a modest duplicate penalty", async () => {
    const prisma = scorerPrisma({ gap: 0 });
    const score = await scoreAndPersist(prisma, candidate());
    expect(score.duplicateRisk).toBeGreaterThan(0);
  });
});

// ── D. Curated-built types never drive the web-extraction pipeline ───────────
describe("nextPriorityContentType: excludes curated-built types", () => {
  function goalPrisma(
    goals: Array<{
      contentType: string;
      gapCount: number;
      desiredTarget: number;
      priority: number;
    }>,
  ): FakePrisma {
    return {
      contentGoal: { findMany: async () => goals },
      adminWorkerDecision: { findMany: async () => [] },
    };
  }

  it("skips GUIDE / MARIAN_TITLE even when their gap fraction is highest", async () => {
    const prisma = goalPrisma([
      { contentType: "GUIDE", gapCount: 91, desiredTarget: 100, priority: 70 }, // frac 0.91 — would win
      { contentType: "MARIAN_TITLE", gapCount: 16, desiredTarget: 50, priority: 50 },
      { contentType: "SAINT", gapCount: 7203, desiredTarget: 10000, priority: 20 }, // frac 0.72
    ]);
    const pick = await nextPriorityContentType(prisma);
    expect(pick?.contentType).toBe("SAINT");
  });

  it("returns null when ONLY curated-built types have a gap (nothing for the web pipeline)", async () => {
    const prisma = goalPrisma([
      { contentType: "GUIDE", gapCount: 91, desiredTarget: 100, priority: 70 },
      { contentType: "MARIAN_TITLE", gapCount: 16, desiredTarget: 50, priority: 50 },
    ]);
    const pick = await nextPriorityContentType(prisma);
    expect(pick).toBeNull();
  });
});

// ── E. The junk free-hosting host is blocked everywhere ──────────────────────
describe("junk-host block", () => {
  it("gabiula.pl.tl is a non-content host and not fetchable", () => {
    expect(isNonContentHost("gabiula.pl.tl")).toBe(true);
    expect(isFetchableHost("gabiula.pl.tl")).toBe(false);
  });

  it("a real Catholic authority is still fetchable", () => {
    expect(isNonContentHost("www.vatican.va")).toBe(false);
    expect(isFetchableHost("www.vatican.va")).toBe(true);
  });
});

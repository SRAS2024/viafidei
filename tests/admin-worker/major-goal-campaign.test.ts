/**
 * Major-goal campaign controller. A WEB-growable goal with a campaign-sized gap
 * drives the worker into DRAIN (finish the built funnel, no new discovery) then
 * SURGE (all resources on that goal), generically for the biggest web blocker —
 * saints today, church-history next — and NORMAL when every remaining gap is
 * small. Curated-built (GUIDE) and structured-feed-built (PARISH) types are
 * never campaign targets: a web surge can't close their gap, so pinning the
 * campaign on PARISH's huge 200k gap starved the web pipeline and published
 * nothing (the recurring EXTRACTING_WITHOUT_PUBLISHING escalation). PARISH grows
 * on its own OSM lane instead.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { evaluateMajorGoalCampaign } from "@/lib/admin-worker/major-goal-campaign";

type Goal = { contentType: string; gapCount: number; desiredTarget: number; priority: number };

function fakePrisma(goals: Goal[], builtFunnel: number) {
  return {
    contentGoal: {
      findMany: async ({ where }: { where: { gapCount: { gte: number } } }) =>
        goals
          .filter((g) => g.gapCount >= where.gapCount.gte)
          .sort((a, b) => b.gapCount - a.gapCount),
    },
    adminWorkerPackageArtifact: {
      count: async () => builtFunnel,
    },
  } as never;
}

beforeEach(() => {
  delete process.env.ADMIN_WORKER_CAMPAIGN_MIN_GAP;
});
afterEach(() => {
  delete process.env.ADMIN_WORKER_CAMPAIGN_MIN_GAP;
});

describe("evaluateMajorGoalCampaign", () => {
  // PARISH has by far the biggest gap, but it is structured-feed-built (grows on
  // the OSM lane, NOT the web pipeline) so it is NEVER a campaign target — the
  // campaign surges on the biggest WEB-growable gap (SAINT here).
  const big: Goal[] = [
    { contentType: "PARISH", gapCount: 199_973, desiredTarget: 200_000, priority: 110 },
    { contentType: "SAINT", gapCount: 7_203, desiredTarget: 10_000, priority: 20 },
    { contentType: "CHURCH_DOCUMENT", gapCount: 123, desiredTarget: 500, priority: 10 },
  ];

  it("SURGEs on the largest WEB-growable gap, skipping the bigger structured PARISH gap", async () => {
    const s = await evaluateMajorGoalCampaign(fakePrisma(big, 0));
    expect(s.phase).toBe("SURGE");
    expect(s.majorType).toBe("SAINT");
    expect(s.majorGap).toBe(7_203);
  });

  it("DRAINs first while built artifacts still wait to publish", async () => {
    const s = await evaluateMajorGoalCampaign(fakePrisma(big, 5));
    expect(s.phase).toBe("DRAIN");
    expect(s.majorType).toBe("SAINT");
    expect(s.builtFunnel).toBe(5);
  });

  it("moves to the next-biggest WEB-growable goal once the first is met (generic)", async () => {
    // SAINT met (gap 0) → CHURCH_DOCUMENT is now the biggest campaign-sized gap
    // (PARISH stays excluded regardless).
    const afterSaint: Goal[] = [
      { contentType: "PARISH", gapCount: 199_973, desiredTarget: 200_000, priority: 110 },
      { contentType: "SAINT", gapCount: 0, desiredTarget: 10_000, priority: 20 },
      { contentType: "CHURCH_DOCUMENT", gapCount: 4_500, desiredTarget: 5_000, priority: 10 },
    ];
    const s = await evaluateMajorGoalCampaign(fakePrisma(afterSaint, 0));
    expect(s.phase).toBe("SURGE");
    expect(s.majorType).toBe("CHURCH_DOCUMENT");
  });

  it("is NORMAL when every remaining gap is below the campaign threshold", async () => {
    const small: Goal[] = [
      { contentType: "CHURCH_DOCUMENT", gapCount: 123, desiredTarget: 500, priority: 10 },
    ];
    const s = await evaluateMajorGoalCampaign(fakePrisma(small, 0));
    expect(s.phase).toBe("NORMAL");
    expect(s.majorType).toBeNull();
  });

  it("never campaigns on a curated-built type (a web surge can't close its gap)", async () => {
    const curatedBig: Goal[] = [
      { contentType: "GUIDE", gapCount: 50_000, desiredTarget: 60_000, priority: 30 },
    ];
    const s = await evaluateMajorGoalCampaign(fakePrisma(curatedBig, 0));
    expect(s.phase).toBe("NORMAL");
  });

  it("never campaigns on a structured-built type — PARISH alone yields NORMAL (OSM grows it)", async () => {
    // The recurring EXTRACTING_WITHOUT_PUBLISHING escalation: PARISH's 200k gap
    // dwarfs everything, but surging the web pipeline on it can't close the gap
    // (parishes come from the OSM lane), so with only PARISH over-threshold the
    // campaign must stay NORMAL rather than pin the web pipeline on PARISH.
    const parishOnly: Goal[] = [
      { contentType: "PARISH", gapCount: 199_973, desiredTarget: 200_000, priority: 110 },
    ];
    const s = await evaluateMajorGoalCampaign(fakePrisma(parishOnly, 0));
    expect(s.phase).toBe("NORMAL");
    expect(s.majorType).toBeNull();
  });
});

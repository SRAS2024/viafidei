/**
 * Major-goal campaign controller. A goal with a campaign-sized gap drives the
 * worker into DRAIN (finish the built funnel, no new discovery) then SURGE (all
 * resources on that goal), generically for the biggest blocker — parishes today,
 * saints/church-history next — and NORMAL when every remaining gap is small.
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
  const big: Goal[] = [
    { contentType: "PARISH", gapCount: 199_973, desiredTarget: 200_000, priority: 110 },
    { contentType: "SAINT", gapCount: 7_203, desiredTarget: 10_000, priority: 20 },
    { contentType: "CHURCH_DOCUMENT", gapCount: 123, desiredTarget: 500, priority: 10 },
  ];

  it("SURGEs on the largest-gap goal when the built funnel is clear", async () => {
    const s = await evaluateMajorGoalCampaign(fakePrisma(big, 0));
    expect(s.phase).toBe("SURGE");
    expect(s.majorType).toBe("PARISH");
    expect(s.majorGap).toBe(199_973);
  });

  it("DRAINs first while built artifacts still wait to publish", async () => {
    const s = await evaluateMajorGoalCampaign(fakePrisma(big, 5));
    expect(s.phase).toBe("DRAIN");
    expect(s.majorType).toBe("PARISH");
    expect(s.builtFunnel).toBe(5);
  });

  it("moves to the next-biggest goal once the first is met (generic, not parish-only)", async () => {
    // PARISH met (gap 0) → SAINT is now the biggest campaign-sized gap.
    const afterParish: Goal[] = [
      { contentType: "PARISH", gapCount: 0, desiredTarget: 200_000, priority: 110 },
      { contentType: "SAINT", gapCount: 7_203, desiredTarget: 10_000, priority: 20 },
    ];
    const s = await evaluateMajorGoalCampaign(fakePrisma(afterParish, 0));
    expect(s.phase).toBe("SURGE");
    expect(s.majorType).toBe("SAINT");
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
});

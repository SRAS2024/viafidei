/**
 * Campaign DRAIN bounds (audit DG-4): DRAIN only when the RECENT built funnel
 * is a real backlog (>= threshold, built within the age cap), so one stuck or
 * bouncing artifact can never pin DRAIN — and with it web discovery — forever.
 */
import { afterEach, describe, expect, it } from "vitest";

import { evaluateMajorGoalCampaign } from "@/lib/admin-worker/major-goal-campaign";

const goals = [{ contentType: "SAINT", gapCount: 7_203, desiredTarget: 10_000, priority: 20 }];

function fakePrisma(count: (where: Record<string, unknown>) => number) {
  return {
    contentGoal: { findMany: async () => goals },
    adminWorkerPackageArtifact: {
      count: async ({ where }: { where: Record<string, unknown> }) => count(where),
    },
  } as never;
}

afterEach(() => {
  delete process.env.ADMIN_WORKER_CAMPAIGN_DRAIN_MIN_FUNNEL;
  delete process.env.ADMIN_WORKER_CAMPAIGN_DRAIN_MAX_HOURS;
});

describe("evaluateMajorGoalCampaign — DRAIN bounds", () => {
  it("a handful of built artifacts is not a backlog: SURGE, not DRAIN", async () => {
    const s = await evaluateMajorGoalCampaign(fakePrisma(() => 3));
    expect(s.phase).toBe("SURGE");
    expect(s.builtFunnel).toBe(3);
  });

  it("DRAINs once the recent funnel reaches the threshold", async () => {
    const s = await evaluateMajorGoalCampaign(fakePrisma(() => 25));
    expect(s.phase).toBe("DRAIN");
  });

  it("the threshold is tunable", async () => {
    process.env.ADMIN_WORKER_CAMPAIGN_DRAIN_MIN_FUNNEL = "5";
    const s = await evaluateMajorGoalCampaign(fakePrisma(() => 5));
    expect(s.phase).toBe("DRAIN");
  });

  it("only counts artifacts built within the age cap (a stale funnel cannot pin DRAIN)", async () => {
    let captured: Record<string, unknown> = {};
    await evaluateMajorGoalCampaign(
      fakePrisma((where) => {
        captured = where;
        return 0;
      }),
    );
    const createdAt = captured.createdAt as { gte: Date };
    expect(createdAt.gte).toBeInstanceOf(Date);
    // Default cap: 2 hours.
    const ageMs = Date.now() - createdAt.gte.getTime();
    expect(ageMs).toBeGreaterThan(1.9 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThan(2.1 * 60 * 60 * 1000);
  });
});

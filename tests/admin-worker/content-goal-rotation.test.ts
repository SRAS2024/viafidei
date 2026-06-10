/**
 * nextPriorityContentType must spread discovery across content types instead of
 * fixating on the single largest absolute gap — the bug that had the live worker
 * looping DISCOVERY on PARISH (gap 299,973) forever. It ranks by gap FRACTION
 * and rotates away from the types targeted in the most recent discovery
 * decisions.
 */
import { describe, expect, it } from "vitest";

import { nextPriorityContentType } from "@/lib/admin-worker/content-goals";

type Goal = { contentType: string; gapCount: number; desiredTarget: number; priority: number };

function fakePrisma(goals: Goal[], recentDiscoveryTypes: string[]) {
  return {
    contentGoal: {
      findMany: async () => goals,
    },
    adminWorkerDecision: {
      findMany: async ({ take }: { take: number }) =>
        recentDiscoveryTypes.slice(0, take).map((contentType) => ({ contentType })),
    },
  } as never;
}

describe("nextPriorityContentType", () => {
  const goals: Goal[] = [
    { contentType: "PARISH", gapCount: 299_973, desiredTarget: 300_000, priority: 110 },
    { contentType: "SAINT", gapCount: 9_872, desiredTarget: 10_000, priority: 20 },
    { contentType: "PRAYER", gapCount: 950, desiredTarget: 1_000, priority: 10 },
  ];

  it("does not let a huge-target type monopolize — rotates off recent discovery types", async () => {
    // PARISH has the largest absolute gap AND the largest fraction, so with no
    // recent history it is chosen first…
    const first = await nextPriorityContentType(fakePrisma(goals, []));
    expect(first?.contentType).toBe("PARISH");

    // …but once PARISH was just discovered, the next pass rotates to another
    // below-goal type rather than looping on PARISH.
    const second = await nextPriorityContentType(fakePrisma(goals, ["PARISH"]));
    expect(second?.contentType).not.toBe("PARISH");

    const third = await nextPriorityContentType(fakePrisma(goals, ["PARISH", "SAINT"]));
    expect(["PRAYER"]).toContain(third?.contentType);
  });

  it("returns null when every goal is met", async () => {
    expect(await nextPriorityContentType(fakePrisma([], []))).toBeNull();
  });

  it("never excludes the only remaining option", async () => {
    const one: Goal[] = [
      { contentType: "PARISH", gapCount: 10, desiredTarget: 300_000, priority: 110 },
    ];
    // Even though PARISH was just discovered, with one option it must still be returned.
    const pick = await nextPriorityContentType(fakePrisma(one, ["PARISH"]));
    expect(pick?.contentType).toBe("PARISH");
  });
});

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

function fakePrisma(
  goals: Goal[],
  recentDiscoveryTypes: string[],
  blockedTypes: string[] = [],
  opts: { campaign?: boolean } = {},
) {
  return {
    contentGoal: {
      findMany: async ({ where }: { where?: { gapCount?: { gt?: number; gte?: number } } }) => {
        // The major-goal campaign queries with `gapCount: { gte }`. In NORMAL-mode
        // tests we return [] for that query so no campaign fires and the de-rank +
        // rotation below is what's under test; in the campaign test we return the
        // goals so a SURGE fires and overrides the ranking.
        if (where?.gapCount?.gte !== undefined) return opts.campaign ? goals : [];
        return goals; // nextPriorityContentType's own `gapCount: { gt: 0 }` query
      },
    },
    adminWorkerDecision: {
      findMany: async ({ take }: { take: number }) =>
        recentDiscoveryTypes.slice(0, take).map((contentType) => ({ contentType })),
    },
    adminWorkerSourceCoverage: {
      findMany: async () => blockedTypes.map((contentType) => ({ contentType })),
    },
    // Built funnel empty ⇒ a fired campaign goes straight to SURGE.
    adminWorkerPackageArtifact: {
      count: async () => 0,
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

  it("de-ranks source-blocked types so the worker grows what it can reach (NO_VALUE fix)", async () => {
    // PARISH has by far the largest gap fraction, but its source is BLOCKED
    // (e.g. query.wikidata.org egress-blocked) — targeting it produces no value.
    // The worker must instead target a reachable type it can actually grow.
    const pick = await nextPriorityContentType(fakePrisma(goals, [], ["PARISH"]));
    expect(pick?.contentType).not.toBe("PARISH");
    expect(["SAINT", "PRAYER"]).toContain(pick?.contentType);
  });

  it("still returns a blocked type when EVERY type is blocked (no idle/deadlock)", async () => {
    const pick = await nextPriorityContentType(
      fakePrisma(goals, [], ["PARISH", "SAINT", "PRAYER"]),
    );
    expect(pick?.contentType).toBe("PARISH"); // all blocked → ranking unchanged (highest fraction)
  });

  it("SURGE campaign forces the mission target onto the campaign goal (overrides rotation + de-rank)", async () => {
    // A major-goal campaign is SURGING on PARISH. Even though PARISH was just
    // discovered (rotation would skip it) AND is source-blocked (de-rank would
    // demote it), the campaign forces the worker to throw everything at it.
    const pick = await nextPriorityContentType(
      fakePrisma(goals, ["PARISH"], ["PARISH"], { campaign: true }),
    );
    expect(pick?.contentType).toBe("PARISH");
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

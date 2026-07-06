/**
 * nextPriorityContentType picks the WEB-pipeline mission target. It must:
 *  - NEVER pick a structured-feed-built type (PARISH) — those grow on their own
 *    ingest lane (OSM), not the web pipeline, so targeting them loops the
 *    pipeline on an ungrowable goal (the EXTRACTING_WITHOUT_PUBLISHING / DISCOVERY-
 *    on-PARISH escalation);
 *  - among the web-growable types, spread discovery instead of fixating on the
 *    single largest gap — it ranks by gap FRACTION and rotates away from the
 *    types targeted in the most recent discovery decisions.
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
  // PARISH carries the largest gap of all, but it is structured-feed-built and
  // must never be the web-pipeline mission target; the web-growable types
  // (SAINT, CHURCH_DOCUMENT, PRAYER) are what nextPriorityContentType chooses
  // among.
  const goals: Goal[] = [
    { contentType: "PARISH", gapCount: 199_973, desiredTarget: 200_000, priority: 110 },
    { contentType: "SAINT", gapCount: 9_872, desiredTarget: 10_000, priority: 20 },
    { contentType: "CHURCH_DOCUMENT", gapCount: 960, desiredTarget: 1_000, priority: 15 },
    { contentType: "PRAYER", gapCount: 900, desiredTarget: 1_000, priority: 10 },
  ];

  it("never targets the structured-built PARISH even though it has the biggest gap+fraction", async () => {
    // The EXTRACTING_WITHOUT_PUBLISHING escalation: PARISH's ~1.0 gap fraction
    // would otherwise win the mission target every pass and loop the web pipeline
    // on a type it can't grow. It must be excluded on EVERY pass.
    for (const recent of [[], ["SAINT"], ["SAINT", "PRAYER"], ["PARISH"]]) {
      const pick = await nextPriorityContentType(fakePrisma(goals, recent));
      expect(pick?.contentType).not.toBe("PARISH");
    }
  });

  it("does not let one web-growable type monopolize — rotates off recent discovery types", async () => {
    // SAINT has the largest fraction among the web-growable types, so with no
    // recent history it is chosen first…
    const first = await nextPriorityContentType(fakePrisma(goals, []));
    expect(first?.contentType).toBe("SAINT");

    // …but once SAINT was just discovered, the next pass rotates to another
    // below-goal type rather than looping on SAINT.
    const second = await nextPriorityContentType(fakePrisma(goals, ["SAINT"]));
    expect(second?.contentType).not.toBe("SAINT");

    const third = await nextPriorityContentType(fakePrisma(goals, ["SAINT", "CHURCH_DOCUMENT"]));
    expect(["PRAYER"]).toContain(third?.contentType);
  });

  it("returns null when every goal is met", async () => {
    expect(await nextPriorityContentType(fakePrisma([], []))).toBeNull();
  });

  it("returns null when only structured-built goals remain (OSM lane grows them)", async () => {
    const parishOnly: Goal[] = [
      { contentType: "PARISH", gapCount: 199_973, desiredTarget: 200_000, priority: 110 },
    ];
    expect(await nextPriorityContentType(fakePrisma(parishOnly, []))).toBeNull();
  });

  it("de-ranks source-blocked types so the worker grows what it can reach (NO_VALUE fix)", async () => {
    // SAINT has the largest web-growable fraction, but its source is BLOCKED —
    // targeting it produces no value. The worker must instead target a reachable
    // type it can actually grow.
    const pick = await nextPriorityContentType(fakePrisma(goals, [], ["SAINT"]));
    expect(pick?.contentType).not.toBe("SAINT");
    expect(["CHURCH_DOCUMENT", "PRAYER"]).toContain(pick?.contentType);
  });

  it("still returns a blocked type when EVERY web-growable type is blocked (no idle/deadlock)", async () => {
    const pick = await nextPriorityContentType(
      fakePrisma(goals, [], ["SAINT", "CHURCH_DOCUMENT", "PRAYER"]),
    );
    expect(pick?.contentType).toBe("SAINT"); // all blocked → ranking unchanged (highest fraction)
  });

  it("SURGE campaign forces the mission target onto the campaign goal (overrides rotation + de-rank)", async () => {
    // A major-goal campaign is SURGING on SAINT (the biggest web-growable gap).
    // Even though SAINT was just discovered (rotation would skip it) AND is
    // source-blocked (de-rank would demote it), the campaign forces the worker to
    // throw everything at it.
    const pick = await nextPriorityContentType(
      fakePrisma(goals, ["SAINT"], ["SAINT"], { campaign: true }),
    );
    expect(pick?.contentType).toBe("SAINT");
  });

  it("never excludes the only remaining web-growable option", async () => {
    const one: Goal[] = [
      { contentType: "SAINT", gapCount: 10, desiredTarget: 10_000, priority: 20 },
    ];
    // Even though SAINT was just discovered, with one option it must still be returned.
    const pick = await nextPriorityContentType(fakePrisma(one, ["SAINT"]));
    expect(pick?.contentType).toBe("SAINT");
  });
});

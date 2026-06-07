/**
 * AdminWorkerMissionPlanner (spec §3, §4). Walks the pipeline left to
 * right and stops at the first stage that needs work for the largest
 * gap.
 */

import { describe, expect, it, vi } from "vitest";

import { planMission } from "@/lib/admin-worker/mission-planner";

interface MockOpts {
  goalGap?: number;
  goalContentType?: string;
  candidateCount?: number;
  sourceReadCount?: number;
  unclassifiedReads?: number;
  itemsForType?: number;
  itemsWithoutCitations?: number;
  readyForBuild?: number;
  pendingQA?: number;
  publishedCount?: number;
  verifiedDistinct?: number;
}

function makePrisma(opts: MockOpts = {}) {
  return {
    contentGoal: {
      findMany: vi.fn(async () => {
        if (opts.goalGap && opts.goalGap > 0) {
          return [
            {
              contentType: opts.goalContentType ?? "PRAYER",
              gapCount: opts.goalGap,
              priority: 10,
              currentValidCount: 0,
              desiredTarget: opts.goalGap,
              status: "IN_PROGRESS",
            },
          ];
        }
        return [];
      }),
      update: vi.fn(async () => ({})),
    },
    publishedContent: {
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => opts.publishedCount ?? 0),
    },
    candidateSourceUrl: { count: vi.fn(async () => opts.candidateCount ?? 0) },
    adminWorkerSourceRead: {
      count: vi.fn(async (args?: { where?: { detectedContentType?: null } }) => {
        if (args?.where?.detectedContentType === null) return opts.unclassifiedReads ?? 0;
        return opts.sourceReadCount ?? 0;
      }),
    },
    checklistItem: {
      count: vi.fn(async (args?: { where?: { citations?: unknown; buildJobs?: unknown } }) => {
        if (args?.where?.citations) return opts.itemsWithoutCitations ?? 0;
        if (args?.where?.buildJobs) return opts.readyForBuild ?? 0;
        return opts.itemsForType ?? 0;
      }),
    },
    postPublishVerification: {
      findMany: vi.fn(async () =>
        Array.from({ length: opts.verifiedDistinct ?? 0 }, (_, i) => ({ contentId: `c${i}` })),
      ),
    },
  } as unknown as Parameters<typeof planMission>[0];
}

describe("planMission", () => {
  it("returns MAINTENANCE when all goals are met", async () => {
    const plan = await planMission(makePrisma({}));
    expect(plan.stage).toBe("MAINTENANCE");
    expect(plan.taskType).toBe("CLEANUP");
  });

  it("returns DISCOVERY when goal has gap but no candidates exist", async () => {
    const plan = await planMission(makePrisma({ goalGap: 5, candidateCount: 0 }));
    expect(plan.stage).toBe("DISCOVERY");
    expect(plan.taskType).toBe("DISCOVER_SOURCE");
  });

  it("returns FETCH_READ when candidates exist but no source-reads", async () => {
    const plan = await planMission(
      makePrisma({ goalGap: 5, candidateCount: 3, sourceReadCount: 0 }),
    );
    expect(plan.stage).toBe("FETCH_READ");
    expect(plan.taskType).toBe("READ_SOURCE");
  });

  it("returns CLASSIFY when reads exist but are unclassified", async () => {
    const plan = await planMission(
      makePrisma({ goalGap: 5, candidateCount: 3, sourceReadCount: 10, unclassifiedReads: 4 }),
    );
    expect(plan.stage).toBe("CLASSIFY");
  });

  it("returns CHECKLIST when reads classified but no items for type", async () => {
    const plan = await planMission(
      makePrisma({
        goalGap: 5,
        candidateCount: 3,
        sourceReadCount: 10,
        unclassifiedReads: 0,
        itemsForType: 0,
      }),
    );
    expect(plan.stage).toBe("CHECKLIST");
  });

  it("returns CITATION when items exist but lack citations", async () => {
    const plan = await planMission(
      makePrisma({
        goalGap: 5,
        candidateCount: 3,
        sourceReadCount: 10,
        unclassifiedReads: 0,
        itemsForType: 5,
        itemsWithoutCitations: 3,
      }),
    );
    expect(plan.stage).toBe("CITATION");
  });

  it("returns BUILD when items are ready", async () => {
    const plan = await planMission(
      makePrisma({
        goalGap: 5,
        candidateCount: 3,
        sourceReadCount: 10,
        unclassifiedReads: 0,
        itemsForType: 5,
        itemsWithoutCitations: 0,
        readyForBuild: 5,
      }),
    );
    expect(plan.stage).toBe("BUILD");
    expect(plan.taskType).toBe("BUILD_CONTENT");
  });

  it("emits a concrete nextStep description", async () => {
    const plan = await planMission(makePrisma({ goalGap: 5, candidateCount: 0 }));
    expect(plan.nextStep.length).toBeGreaterThan(10);
    expect(plan.expectedResult.length).toBeGreaterThan(10);
  });
});

/**
 * GrowthOrchestrator (spec §22). Verifies the "why no growth?" rules.
 */

import { describe, expect, it, vi } from "vitest";

import { runGrowthOrchestrator } from "@/lib/admin-worker/growth-orchestrator";

function makePrisma(opts: {
  goals: Array<{
    contentType: string;
    minimumTarget: number;
    desiredTarget: number;
    currentValidCount: number;
    gapCount: number;
    priority: number;
    status: string;
  }>;
  hoursSinceLastGrowth?: number | null;
  growth24h?: number;
  growth7d?: number;
  growth30d?: number;
  /** Age of the newest existing snapshot (ms); undefined → no snapshot model in the harness. */
  latestSnapshotAgeMs?: number | null;
  /** Worker liveness inputs; undefined → models absent (fail-open to wall-clock). */
  heartbeatAgeHours?: number | null;
  firstPassAfterGrowthHoursAgo?: number | null;
}) {
  const now = Date.now();
  const lastPublishedAt =
    opts.hoursSinceLastGrowth == null
      ? null
      : new Date(now - opts.hoursSinceLastGrowth * 60 * 60 * 1000);
  const snapshotFindFirst =
    opts.latestSnapshotAgeMs === undefined
      ? {}
      : {
          findFirst: vi.fn(async () =>
            opts.latestSnapshotAgeMs == null
              ? null
              : { createdAt: new Date(now - opts.latestSnapshotAgeMs) },
          ),
        };
  const liveness =
    opts.heartbeatAgeHours === undefined
      ? {}
      : {
          adminWorkerState: {
            findUnique: vi.fn(async () => ({
              lastHeartbeatAt:
                opts.heartbeatAgeHours == null
                  ? null
                  : new Date(now - opts.heartbeatAgeHours * 60 * 60 * 1000),
            })),
          },
          adminWorkerPass: {
            findFirst: vi.fn(async () =>
              opts.firstPassAfterGrowthHoursAgo == null
                ? null
                : {
                    startedAt: new Date(now - opts.firstPassAfterGrowthHoursAgo * 60 * 60 * 1000),
                  },
            ),
          },
        };
  return {
    ...liveness,
    contentGoal: {
      findMany: vi.fn(async () => opts.goals),
      update: vi.fn(async () => ({})),
    },
    publishedContent: {
      count: vi.fn(async ({ where }: { where: { publishedAt?: { gte: Date } } }) => {
        if (!where.publishedAt) return opts.growth30d ?? 0;
        const ms = where.publishedAt.gte.getTime();
        const day = 24 * 60 * 60 * 1000;
        if (now - ms <= day) return opts.growth24h ?? 0;
        if (now - ms <= 7 * day) return opts.growth7d ?? 0;
        return opts.growth30d ?? 0;
      }),
      findFirst: vi.fn(async () => (lastPublishedAt ? { publishedAt: lastPublishedAt } : null)),
    },
    adminWorkerStrictQAResult: { findMany: vi.fn(async () => []) },
    workerBuildJob: { count: vi.fn(async () => 0) },
    adminWorkerGrowthSnapshot: { create: vi.fn(async () => ({})), ...snapshotFindFirst },
    adminWorkerRepairPlan: { create: vi.fn(async () => ({})) },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  } as unknown as Parameters<typeof runGrowthOrchestrator>[0];
}

describe("runGrowthOrchestrator — spec §22", () => {
  it("STUCK_7D fires when no growth in 7+ days and gap > 0", async () => {
    const prisma = makePrisma({
      goals: [
        {
          contentType: "PRAYER",
          minimumTarget: 50,
          desiredTarget: 100,
          currentValidCount: 5,
          gapCount: 45,
          priority: 10,
          status: "IN_PROGRESS",
        },
      ],
      hoursSinceLastGrowth: 7 * 24 + 1,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("STUCK_7D");
    expect(out.assessments[0].recommendation).toMatch(/repair plan/);
    expect(out.repairPlansFiled).toBe(1);
  });

  it("SLOW_24H fires when no growth in 24h+ but less than 7d", async () => {
    const prisma = makePrisma({
      goals: [
        {
          contentType: "PRAYER",
          minimumTarget: 50,
          desiredTarget: 100,
          currentValidCount: 5,
          gapCount: 45,
          priority: 10,
          status: "IN_PROGRESS",
        },
      ],
      hoursSinceLastGrowth: 25,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("SLOW_24H");
    expect(out.assessments[0].recommendation).toMatch(/discovery/);
    expect(out.repairPlansFiled).toBe(0);
  });

  it("AT_GOAL switches the content goal to MAINTENANCE", async () => {
    const prisma = makePrisma({
      goals: [
        {
          contentType: "PRAYER",
          minimumTarget: 50,
          desiredTarget: 100,
          currentValidCount: 100,
          gapCount: 0,
          priority: 10,
          status: "IN_PROGRESS",
        },
      ],
      hoursSinceLastGrowth: 2,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("AT_GOAL");
    expect(out.movedToMaintenance).toBe(1);
  });

  it("NEW fires when nothing has ever been published", async () => {
    const prisma = makePrisma({
      goals: [
        {
          contentType: "PRAYER",
          minimumTarget: 50,
          desiredTarget: 100,
          currentValidCount: 0,
          gapCount: 50,
          priority: 10,
          status: "NOT_STARTED",
        },
      ],
      hoursSinceLastGrowth: null,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("NEW");
    expect(out.assessments[0].recommendation).toMatch(/kick off/);
  });

  it("GROWING_OK fires when recent growth is healthy", async () => {
    const prisma = makePrisma({
      goals: [
        {
          contentType: "PRAYER",
          minimumTarget: 50,
          desiredTarget: 100,
          currentValidCount: 25,
          gapCount: 25,
          priority: 10,
          status: "IN_PROGRESS",
        },
      ],
      hoursSinceLastGrowth: 2,
      growth24h: 5,
      growth7d: 25,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("GROWING_OK");
  });

  it("emits a recommendation explaining why content is not growing", async () => {
    const prisma = makePrisma({
      goals: [
        {
          contentType: "PRAYER",
          minimumTarget: 50,
          desiredTarget: 100,
          currentValidCount: 1,
          gapCount: 49,
          priority: 10,
          status: "IN_PROGRESS",
        },
      ],
      hoursSinceLastGrowth: 7 * 24 + 6,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].recommendation.length).toBeGreaterThan(10);
  });
});

const goal = {
  contentType: "PRAYER",
  minimumTarget: 50,
  desiredTarget: 100,
  currentValidCount: 5,
  gapCount: 45,
  priority: 10,
  status: "IN_PROGRESS",
};

/**
 * Staleness is measured against WORKER-ACTIVE time: the execution host is the
 * operator's computer and OFF is a designed state, so a week with the lid
 * closed must not file DISCOVERY_FAILED plans for every type.
 */
describe("runGrowthOrchestrator — worker-active staleness", () => {
  it("does not report STUCK_7D when the worker only ran for an hour since the last growth", async () => {
    const prisma = makePrisma({
      goals: [goal],
      hoursSinceLastGrowth: 8 * 24, // 8 days wall-clock
      heartbeatAgeHours: 0, // running now
      firstPassAfterGrowthHoursAgo: 1, // …but switched on an hour ago
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).not.toBe("STUCK_7D");
    expect(out.assessments[0].activeHoursSinceLastGrowth).toBe(1);
    expect(out.repairPlansFiled).toBe(0);
  });

  it("reports WORKER_IDLE when the worker has not run at all since the last growth", async () => {
    const prisma = makePrisma({
      goals: [goal],
      hoursSinceLastGrowth: 3 * 24,
      heartbeatAgeHours: 4 * 24, // last heartbeat predates the last publish
      firstPassAfterGrowthHoursAgo: null,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("WORKER_IDLE");
    expect(out.assessments[0].recommendation).toMatch(/not a pipeline stall/);
    expect(out.repairPlansFiled).toBe(0);
  });

  it("still reports STUCK_7D when the worker ran the whole week without growth", async () => {
    const prisma = makePrisma({
      goals: [goal],
      hoursSinceLastGrowth: 8 * 24,
      heartbeatAgeHours: 0,
      firstPassAfterGrowthHoursAgo: 8 * 24, // first pass right after the growth → active all week
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("STUCK_7D");
    expect(out.repairPlansFiled).toBe(1);
  });

  it("falls back to wall-clock time when liveness cannot be read (fail-open, existing behaviour)", async () => {
    const prisma = makePrisma({ goals: [goal], hoursSinceLastGrowth: 8 * 24 });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.assessments[0].status).toBe("STUCK_7D");
    expect(out.assessments[0].activeHoursSinceLastGrowth).toBeNull();
  });
});

/** Snapshot writes are spaced ≥15 min apart whoever calls the orchestrator. */
describe("runGrowthOrchestrator — snapshot interval", () => {
  it("reuses recent snapshots instead of writing new rows every pass", async () => {
    const prisma = makePrisma({
      goals: [goal],
      hoursSinceLastGrowth: 2,
      latestSnapshotAgeMs: 5 * 60_000,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.snapshotsWritten).toBe(false);
    expect(out.assessments).toHaveLength(1); // assessments are still produced
    expect(
      (prisma as unknown as { adminWorkerGrowthSnapshot: { create: unknown } })
        .adminWorkerGrowthSnapshot.create,
    ).not.toHaveBeenCalled();
  });

  it("writes snapshots once the newest one is older than the interval", async () => {
    const prisma = makePrisma({
      goals: [goal],
      hoursSinceLastGrowth: 2,
      latestSnapshotAgeMs: 20 * 60_000,
    });
    const out = await runGrowthOrchestrator(prisma);
    expect(out.snapshotsWritten).toBe(true);
    expect(
      (prisma as unknown as { adminWorkerGrowthSnapshot: { create: unknown } })
        .adminWorkerGrowthSnapshot.create,
    ).toHaveBeenCalledTimes(1);
  });
});

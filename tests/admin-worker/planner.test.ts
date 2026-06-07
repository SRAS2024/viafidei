/**
 * Planner — proves "Admin Worker creates its own work when goals are
 * unmet" (spec section 24 + acceptance criteria). Uses a mocked
 * Prisma client so it stays in the unit suite.
 */

import { describe, expect, it, vi } from "vitest";

import { planAndEnqueue } from "@/lib/admin-worker/planner";

vi.mock("@/lib/checklist", () => ({
  enqueueBuild: vi.fn(async () => ({})),
}));

function makePrisma(opts: {
  gaps: Array<{ contentType: string; gapCount: number; priority: number }>;
  pendingByType?: Record<string, number>;
  approvedItems?: Array<{ id: string; contentType: string; canonicalName: string }>;
  publishedCounts?: Array<{ contentType: string; _count: number }>;
}) {
  return {
    contentGoal: {
      findMany: vi.fn(async (args?: { where?: { gapCount?: { gt: number } } }) => {
        const where = args?.where;
        const rows = opts.gaps.map((g) => ({
          ...g,
          id: g.contentType,
          minimumTarget: 10,
          desiredTarget: 20,
          currentValidCount: 10 - g.gapCount,
          status: "IN_PROGRESS",
          lastUpdatedAt: new Date(),
          createdAt: new Date(),
        }));
        if (where?.gapCount?.gt !== undefined) {
          return rows.filter((g) => g.gapCount > 0);
        }
        return rows;
      }),
      update: vi.fn(async () => ({})),
    },
    publishedContent: {
      groupBy: vi.fn(async () => opts.publishedCounts ?? []),
    },
    workerBuildJob: {
      count: vi.fn(async ({ where }: { where: { checklistItem: { contentType: string } } }) => {
        return opts.pendingByType?.[where.checklistItem.contentType] ?? 0;
      }),
    },
    checklistItem: {
      findMany: vi.fn(
        async ({ where, take }: { where: { contentType: string }; take?: number }) => {
          const items = (opts.approvedItems ?? []).filter(
            (i) => i.contentType === where.contentType,
          );
          return items.slice(0, take ?? items.length);
        },
      ),
    },
    adminWorkerTask: { create: vi.fn(async () => ({ id: "t1" })) },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
  } as unknown as Parameters<typeof planAndEnqueue>[0];
}

describe("planAndEnqueue", () => {
  it("reports no work when there are no gaps", async () => {
    const prisma = makePrisma({ gaps: [] });
    const out = await planAndEnqueue(prisma);
    expect(out.enqueued).toBe(0);
    expect(out.contentType).toBeNull();
  });

  it("enqueues approved items for the largest content gap", async () => {
    const prisma = makePrisma({
      gaps: [
        { contentType: "PRAYER", gapCount: 5, priority: 10 },
        { contentType: "SAINT", gapCount: 2, priority: 20 },
      ],
      approvedItems: [
        { id: "p1", contentType: "PRAYER", canonicalName: "Our Father" },
        { id: "p2", contentType: "PRAYER", canonicalName: "Hail Mary" },
        { id: "p3", contentType: "PRAYER", canonicalName: "Glory Be" },
      ],
    });
    const out = await planAndEnqueue(prisma, { batchSize: 3 });
    expect(out.contentType).toBe("PRAYER");
    expect(out.enqueued).toBe(3);
  });

  it("does not double-enqueue when pending jobs already cover the gap", async () => {
    const prisma = makePrisma({
      gaps: [{ contentType: "PRAYER", gapCount: 5, priority: 10 }],
      pendingByType: { PRAYER: 5 },
      approvedItems: [{ id: "p1", contentType: "PRAYER", canonicalName: "Our Father" }],
    });
    const out = await planAndEnqueue(prisma);
    expect(out.enqueued).toBe(0);
  });

  it("logs a discovery gap when no SOURCE_VERIFIED items are available", async () => {
    const prisma = makePrisma({
      gaps: [{ contentType: "PRAYER", gapCount: 5, priority: 10 }],
      approvedItems: [],
    });
    const out = await planAndEnqueue(prisma);
    expect(out.enqueued).toBe(0);
    expect(out.reason).toMatch(/no approvable items/);
  });
});

/**
 * Cleanup custodian guarantees:
 *   - reviews the post-publish rollback filed after UNPUBLISHING content are
 *     never aged out to EXPIRED (they are the only open signal for that
 *     hidden content);
 *   - AdminWorkerGrowthSnapshot is trimmed to the newest 30 rows per content
 *     type (the orchestrator wrote 15 rows per run with no retention);
 *   - a client/mock without the snapshot model degrades to "trimmed 0".
 */
import { describe, expect, it, vi } from "vitest";

import { ROLLBACK_REVIEW_ACTIONS, runCleanupPass } from "@/lib/admin-worker/cleanup";

function makePrisma(opts: { snapshotCounts?: Record<string, number> } = {}) {
  const reviewUpdateManyArgs: Array<{ where: Record<string, unknown> }> = [];
  const deleted: string[][] = [];
  const counts = opts.snapshotCounts;
  const prisma = {
    candidateSourceUrl: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => []),
    },
    adminWorkerSourceRead: { updateMany: vi.fn(async () => ({ count: 0 })) },
    humanReviewQueue: {
      updateMany: vi.fn(async (arg: { where: Record<string, unknown> }) => {
        reviewUpdateManyArgs.push(arg);
        return { count: 0 };
      }),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
    ...(counts
      ? {
          adminWorkerGrowthSnapshot: {
            groupBy: vi.fn(async () =>
              Object.entries(counts).map(([contentType, n]) => ({
                contentType,
                _count: { _all: n },
              })),
            ),
            findMany: vi.fn(
              async (arg: { where: { contentType: string }; skip: number; orderBy: unknown }) => {
                const n = counts[arg.where.contentType];
                expect(arg.orderBy).toEqual({ createdAt: "desc" });
                return Array.from({ length: Math.max(0, n - arg.skip) }, (_, i) => ({
                  id: `${arg.where.contentType}-${arg.skip + i}`,
                }));
              },
            ),
            deleteMany: vi.fn(async (arg: { where: { id: { in: string[] } } }) => {
              deleted.push(arg.where.id.in);
              return { count: arg.where.id.in.length };
            }),
          },
        }
      : {}),
  };
  return { prisma, reviewUpdateManyArgs, deleted };
}

describe("runCleanupPass", () => {
  it("never expires rollback / unpublish reviews", async () => {
    const { prisma, reviewUpdateManyArgs } = makePrisma();
    await runCleanupPass(prisma as never);
    expect(reviewUpdateManyArgs).toHaveLength(1);
    const where = reviewUpdateManyArgs[0].where as {
      status: string;
      proposedAction: { notIn: string[] };
    };
    expect(where.status).toBe("PENDING");
    expect(where.proposedAction.notIn).toEqual([...ROLLBACK_REVIEW_ACTIONS]);
    expect(ROLLBACK_REVIEW_ACTIONS).toContain("restore_or_delete_unpublished_content");
    expect(ROLLBACK_REVIEW_ACTIONS).toContain("investigate_post_publish_failure");
  });

  it("keeps only the newest 30 growth snapshots per content type", async () => {
    const { prisma, deleted } = makePrisma({
      snapshotCounts: { SAINT: 45, PRAYER: 30, PARISH: 12 },
    });
    const out = await runCleanupPass(prisma as never);
    // SAINT: 45 - 30 = 15 trimmed; PRAYER exactly at the limit and PARISH below → untouched.
    expect(out.growthSnapshotsTrimmed).toBe(15);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toHaveLength(15);
    expect(deleted[0][0]).toBe("SAINT-30");
  });

  it("degrades to 0 trimmed when the snapshot model is unavailable", async () => {
    const { prisma } = makePrisma();
    const out = await runCleanupPass(prisma as never);
    expect(out.growthSnapshotsTrimmed).toBe(0);
  });
});

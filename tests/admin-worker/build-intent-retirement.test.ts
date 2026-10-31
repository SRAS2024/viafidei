/**
 * Build intents (WorkerBuildJob) have no executor: PACKAGE_BUILD reports idle
 * for them and nothing leases them. The repair helpers used to re-enqueue
 * APPROVED_FOR_BUILD items — a status every published curated, structured and
 * OSM-parish item keeps — minting dead intents for live content. These pin the
 * replacement behaviour: nothing is ever enqueued, open intents for published
 * items are cancelled, and stuck intents for unpublished items are released
 * exactly as before.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

const enqueueBuild = vi.fn(async () => ({ id: "job-new" }));
vi.mock("@/lib/checklist", () => ({ enqueueBuild }));

import { recoverStuckQueue, recreateMissingSourceJobs } from "@/lib/admin-worker/repair";

type Job = { id: string; checklistItemId: string; status: string };

function makePrisma(jobs: Job[], publishedItemIds: string[]) {
  const updates: Array<{ ids: string[]; status: string }> = [];
  const prisma = {
    workerBuildJob: {
      findMany: vi.fn(async (args: { where: { status: unknown } }) => {
        const where = args.where.status as string | { in: string[] };
        const statuses = typeof where === "string" ? [where] : where.in;
        return jobs.filter((j) => statuses.includes(j.status));
      }),
      updateMany: vi.fn(
        async (args: { where: { id: { in: string[] } }; data: { status: string } }) => {
          updates.push({ ids: args.where.id.in, status: args.data.status });
          return { count: args.where.id.in.length };
        },
      ),
      create: vi.fn(async () => ({ id: "should-not-happen" })),
    },
    publishedContent: {
      findMany: vi.fn(async (args: { where: { checklistItemId: { in: string[] } } }) =>
        args.where.checklistItemId.in
          .filter((id) => publishedItemIds.includes(id))
          .map((checklistItemId) => ({ checklistItemId })),
      ),
    },
    checklistItem: { findMany: vi.fn(async () => []) },
  };
  return { prisma: prisma as unknown as Parameters<typeof recreateMissingSourceJobs>[0], updates };
}

describe("recreateMissingSourceJobs (retired as an enqueuer)", () => {
  it("never enqueues an intent, even for approved items without one", async () => {
    const { prisma } = makePrisma([], []);
    const out = await recreateMissingSourceJobs(prisma);
    expect(enqueueBuild).not.toHaveBeenCalled();
    expect(
      (prisma as unknown as { workerBuildJob: { create: ReturnType<typeof vi.fn> } }).workerBuildJob
        .create,
    ).not.toHaveBeenCalled();
    expect(out.succeeded).toBe(true);
    expect(out.reason).toMatch(/no longer enqueued/);
  });

  it("cancels open intents for published items and leaves the rest alone", async () => {
    const { prisma, updates } = makePrisma(
      [
        { id: "j-parish", checklistItemId: "ci-published-parish", status: "pending" },
        { id: "j-saint", checklistItemId: "ci-published-saint", status: "retrying" },
        { id: "j-open", checklistItemId: "ci-unpublished", status: "pending" },
      ],
      ["ci-published-parish", "ci-published-saint"],
    );
    const out = await recreateMissingSourceJobs(prisma);
    expect(updates).toEqual([{ ids: ["j-parish", "j-saint"], status: "cancelled" }]);
    expect(out.reason).toMatch(/cancelled 2/);
    expect(enqueueBuild).not.toHaveBeenCalled();
  });
});

describe("recoverStuckQueue", () => {
  it("cancels stuck intents for published items instead of re-enqueueing them", async () => {
    const { prisma, updates } = makePrisma(
      [
        { id: "j-live", checklistItemId: "ci-live", status: "running" },
        { id: "j-draft", checklistItemId: "ci-draft", status: "running" },
      ],
      ["ci-live"],
    );
    const out = await recoverStuckQueue(prisma);
    expect(updates).toEqual([
      { ids: ["j-live"], status: "cancelled" },
      { ids: ["j-draft"], status: "pending" },
    ]);
    expect(out.reason).toBe("released 1 stuck job(s), cancelled 1");
  });

  it("is a no-op when nothing is stuck", async () => {
    const { prisma, updates } = makePrisma([], []);
    const out = await recoverStuckQueue(prisma);
    expect(out.attempted).toBe(false);
    expect(updates).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { completeGoal } from "@/lib/data/goals";

beforeEach(() => {
  resetPrismaMock();
});

describe("completeGoal — history preservation + milestone uniqueness", () => {
  it("preserves the existing checklist when marking a goal COMPLETED", async () => {
    const checklist = [
      { id: "i1", goalId: "g1", label: "Step one", isCompleted: true, sortOrder: 0 },
      { id: "i2", goalId: "g1", label: "Step two", isCompleted: true, sortOrder: 1 },
    ];
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-A",
      title: "Rosary novena",
      description: "9 days",
      status: "ACTIVE",
      checklist,
    });
    const updatedGoal = {
      id: "g1",
      userId: "user-A",
      title: "Rosary novena",
      status: "COMPLETED",
      completedAt: new Date(),
      checklist,
    };
    // The mock $transaction calls our async function with an empty tx — we
    // need to give it methods that match what completeGoal calls.
    prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
      const tx = {
        goal: {
          update: vi.fn().mockResolvedValue(updatedGoal),
        },
        milestone: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "m1", goalId: "g1", slug: "goal-g1" }),
        },
      };
      return (fn as (t: unknown) => Promise<unknown>)(tx);
    });

    const result = await completeGoal("user-A", "g1", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Checklist entries (history) are still present on the returned goal.
      expect(result.goal.checklist).toEqual(checklist);
      // Completed-at timestamp is set.
      expect(result.goal.completedAt).toBeInstanceOf(Date);
      // Status flipped to COMPLETED, not deleted.
      expect(result.goal.status).toBe("COMPLETED");
    }
  });

  it("creates a milestone only when none exists for this (userId, slug)", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-A",
      title: "Rosary novena",
      checklist: [],
    });
    let milestoneCreateCalls = 0;
    let milestoneFindUniqueArgs: unknown = null;
    prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
      const tx = {
        goal: {
          update: vi.fn().mockResolvedValue({
            id: "g1",
            userId: "user-A",
            title: "Rosary novena",
            status: "COMPLETED",
            completedAt: new Date(),
            checklist: [],
          }),
        },
        milestone: {
          findUnique: vi.fn().mockImplementation((args: unknown) => {
            milestoneFindUniqueArgs = args;
            return Promise.resolve(null); // none exists.
          }),
          create: vi.fn().mockImplementation(() => {
            milestoneCreateCalls += 1;
            return Promise.resolve({ id: "m1", goalId: "g1", slug: "goal-g1" });
          }),
        },
      };
      return (fn as (t: unknown) => Promise<unknown>)(tx);
    });

    const result = await completeGoal("user-A", "g1", true);
    expect(result.ok).toBe(true);
    expect(milestoneCreateCalls).toBe(1);
    // The lookup was keyed on the composite (userId, slug) unique key — this
    // is what prevents a second completion from creating a duplicate milestone
    // for the same goal.
    expect(milestoneFindUniqueArgs).toEqual({
      where: { userId_slug: { userId: "user-A", slug: "goal-g1" } },
    });
  });

  it("returns the existing milestone (no second insert) when completing the same goal twice", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-A",
      title: "Rosary novena",
      checklist: [],
    });
    const existingMilestone = { id: "m-existing", goalId: "g1", slug: "goal-g1" };
    let milestoneCreateCalls = 0;
    prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
      const tx = {
        goal: {
          update: vi.fn().mockResolvedValue({
            id: "g1",
            userId: "user-A",
            status: "COMPLETED",
            completedAt: new Date(),
            checklist: [],
          }),
        },
        milestone: {
          findUnique: vi.fn().mockResolvedValue(existingMilestone),
          create: vi.fn().mockImplementation(() => {
            milestoneCreateCalls += 1;
            return Promise.resolve({});
          }),
        },
      };
      return (fn as (t: unknown) => Promise<unknown>)(tx);
    });

    const result = await completeGoal("user-A", "g1", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Critical: the existing milestone is returned, not re-created.
      expect(result.milestone).toEqual(existingMilestone);
    }
    expect(milestoneCreateCalls).toBe(0);
  });

  it("skips milestone creation when promote=false", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-A",
      checklist: [],
    });
    let milestoneCreateCalls = 0;
    let milestoneFindUniqueCalls = 0;
    prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
      const tx = {
        goal: {
          update: vi.fn().mockResolvedValue({
            id: "g1",
            userId: "user-A",
            status: "COMPLETED",
            completedAt: new Date(),
            checklist: [],
          }),
        },
        milestone: {
          findUnique: vi.fn().mockImplementation(() => {
            milestoneFindUniqueCalls += 1;
            return Promise.resolve(null);
          }),
          create: vi.fn().mockImplementation(() => {
            milestoneCreateCalls += 1;
            return Promise.resolve({});
          }),
        },
      };
      return (fn as (t: unknown) => Promise<unknown>)(tx);
    });

    const result = await completeGoal("user-A", "g1", false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.milestone).toBeNull();
    expect(milestoneCreateCalls).toBe(0);
    expect(milestoneFindUniqueCalls).toBe(0);
  });

  it("returns forbidden without touching the goal when the caller does not own it", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-B",
      checklist: [],
    });
    const result = await completeGoal("user-A", "g1", true);
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    // Critical: no transaction should have been opened.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

/**
 * AdminWorkerRepairPlan helpers — proves durable repair plans coalesce
 * duplicates, lease atomically, and back off exponentially on retry
 * (spec §14).
 */

import { describe, expect, it, vi } from "vitest";

import {
  completePlan,
  countOpenPlansByKind,
  filePlan,
  leaseNextPlan,
} from "@/lib/admin-worker/repair-plans";

function makePrismaMock(initial: {
  findFirst?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  groupBy?: ReturnType<typeof vi.fn>;
}) {
  const table = {
    findFirst: initial.findFirst ?? vi.fn(async () => null),
    create:
      initial.create ??
      vi.fn(async (args: { data: unknown }) => ({ id: "new-id", ...(args.data as object) })),
    findUnique: initial.findUnique ?? vi.fn(async () => null),
    update:
      initial.update ??
      vi.fn(async (args: { data: unknown }) => ({ id: "p1", ...(args.data as object) })),
    groupBy: initial.groupBy ?? vi.fn(async () => []),
  };
  return {
    adminWorkerRepairPlan: table,
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ adminWorkerRepairPlan: table }),
    ),
  } as unknown as Parameters<typeof filePlan>[0];
}

describe("filePlan", () => {
  it("creates a new plan when none exists", async () => {
    const create = vi.fn(async () => ({ id: "created-1" }));
    const prisma = makePrismaMock({ create });
    const res = await filePlan(prisma, {
      kind: "REFETCH_SOURCE",
      failedEntity: "https://example.com/a",
      repairAction: "Re-fetch the page",
    });
    expect(res.id).toBe("created-1");
    expect(create).toHaveBeenCalledOnce();
  });

  it("coalesces with an existing PENDING plan for the same kind+entity", async () => {
    const findFirst = vi.fn(async () => ({ id: "existing-1" }));
    const create = vi.fn();
    const prisma = makePrismaMock({ findFirst, create });
    const res = await filePlan(prisma, {
      kind: "REFETCH_SOURCE",
      failedEntity: "https://example.com/a",
      repairAction: "Re-fetch the page",
    });
    expect(res.id).toBe("existing-1");
    expect(create).not.toHaveBeenCalled();
  });

  it("skips the coalesce lookup when no failedEntity is provided", async () => {
    const findFirst = vi.fn();
    const create = vi.fn(async () => ({ id: "created-2" }));
    const prisma = makePrismaMock({ findFirst, create });
    await filePlan(prisma, {
      kind: "RESTART_PIPELINE",
      repairAction: "Restart pipeline",
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
  });

  it("defaults maxAttempts to 5", async () => {
    const create = vi.fn(async () => ({ id: "x" }));
    const prisma = makePrismaMock({ create });
    await filePlan(prisma, {
      kind: "REFETCH_SOURCE",
      repairAction: "Re-fetch",
    });
    const call = create.mock.calls[0]?.[0] as { data: { maxAttempts: number } };
    expect(call.data.maxAttempts).toBe(5);
  });
});

describe("leaseNextPlan", () => {
  it("returns null when no plan is due", async () => {
    const prisma = makePrismaMock({ findFirst: vi.fn(async () => null) });
    expect(await leaseNextPlan(prisma)).toBeNull();
  });

  it("marks the next due plan RUNNING and increments attempts", async () => {
    const plan = { id: "p1", attempts: 0, maxAttempts: 5 };
    const findFirst = vi.fn(async () => plan);
    const update = vi.fn(async (args: { data: unknown }) => ({
      id: plan.id,
      ...plan,
      ...(args.data as object),
    }));
    const prisma = makePrismaMock({ findFirst, update });
    const leased = await leaseNextPlan(prisma);
    expect(leased?.id).toBe("p1");
    const updArgs = update.mock.calls[0]?.[0] as {
      data: { status: string; attempts: { increment: number } };
    };
    expect(updArgs.data.status).toBe("RUNNING");
    expect(updArgs.data.attempts.increment).toBe(1);
  });
});

describe("completePlan", () => {
  it("marks SUCCEEDED outright", async () => {
    const findUnique = vi.fn(async () => ({ id: "p1", attempts: 1, maxAttempts: 5 }));
    const update = vi.fn(async () => ({}));
    const prisma = makePrismaMock({ findUnique, update });
    await completePlan(prisma, "p1", { status: "SUCCEEDED" });
    const args = update.mock.calls[0]?.[0] as { data: { status: string } };
    expect(args.data.status).toBe("SUCCEEDED");
  });

  it("re-queues with backoff when retry=true and attempts remain", async () => {
    const findUnique = vi.fn(async () => ({ id: "p1", attempts: 1, maxAttempts: 5 }));
    const update = vi.fn(async () => ({}));
    const prisma = makePrismaMock({ findUnique, update });
    await completePlan(prisma, "p1", { status: "FAILED", retry: true });
    const args = update.mock.calls[0]?.[0] as { data: { status: string; nextAttemptAt: Date } };
    expect(args.data.status).toBe("PENDING");
    expect(args.data.nextAttemptAt).toBeInstanceOf(Date);
    expect(args.data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("ABANDONS when attempts are exhausted", async () => {
    const findUnique = vi.fn(async () => ({ id: "p1", attempts: 5, maxAttempts: 5 }));
    const update = vi.fn(async () => ({}));
    const prisma = makePrismaMock({ findUnique, update });
    await completePlan(prisma, "p1", { status: "FAILED" });
    const args = update.mock.calls[0]?.[0] as { data: { status: string } };
    expect(args.data.status).toBe("ABANDONED");
  });

  it("is a no-op when the plan id is unknown", async () => {
    const findUnique = vi.fn(async () => null);
    const update = vi.fn();
    const prisma = makePrismaMock({ findUnique, update });
    await completePlan(prisma, "missing", { status: "SUCCEEDED" });
    expect(update).not.toHaveBeenCalled();
  });

  it("uses exponential backoff (later attempts schedule further out)", async () => {
    const early = { id: "p1", attempts: 1, maxAttempts: 10 };
    const late = { id: "p2", attempts: 4, maxAttempts: 10 };
    const updates: Array<{ data: { nextAttemptAt: Date } }> = [];
    const update = vi.fn(async (args: { data: { nextAttemptAt: Date } }) => {
      updates.push(args);
      return {};
    });
    const findUnique = vi.fn().mockResolvedValueOnce(early).mockResolvedValueOnce(late);
    const prisma = makePrismaMock({ findUnique, update });
    const before = Date.now();
    await completePlan(prisma, "p1", { status: "FAILED", retry: true });
    await completePlan(prisma, "p2", { status: "FAILED", retry: true });
    const delayA = updates[0].data.nextAttemptAt.getTime() - before;
    const delayB = updates[1].data.nextAttemptAt.getTime() - before;
    expect(delayB).toBeGreaterThan(delayA);
  });
});

describe("countOpenPlansByKind", () => {
  it("returns a map of open plan counts keyed by kind", async () => {
    const groupBy = vi.fn(async () => [
      { kind: "REFETCH_SOURCE", _count: 4 },
      { kind: "RESTART_PIPELINE", _count: 1 },
    ]);
    const prisma = makePrismaMock({ groupBy });
    const counts = await countOpenPlansByKind(prisma);
    expect(counts.REFETCH_SOURCE).toBe(4);
    expect(counts.RESTART_PIPELINE).toBe(1);
  });
});

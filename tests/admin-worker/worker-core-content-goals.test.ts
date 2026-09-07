/**
 * Content-goal bookkeeping (audit SI-11, DG-13, LIVE-2):
 *   - seeding never overwrites an operator-edited target;
 *   - the refresh writes only changed rows, in one transaction;
 *   - a MAINTENANCE status survives the refresh while the count is at target.
 */
import { describe, expect, it, vi } from "vitest";

import {
  reconcileStatus,
  refreshContentGoals,
  seedContentGoals,
} from "@/lib/admin-worker/content-goals";

describe("seedContentGoals", () => {
  it("creates missing rows but never rewrites desiredTarget / minimumTarget on existing ones", async () => {
    const upsert = vi.fn(async () => ({}));
    const prisma = { contentGoal: { upsert } } as never;
    await seedContentGoals(prisma);
    expect(upsert).toHaveBeenCalled();
    for (const call of upsert.mock.calls) {
      const args = call[0] as { update: Record<string, unknown>; create: Record<string, unknown> };
      expect(args.update).not.toHaveProperty("desiredTarget");
      expect(args.update).not.toHaveProperty("minimumTarget");
      expect(args.create).toHaveProperty("desiredTarget");
    }
  });
});

function goal(over: Record<string, unknown>) {
  return {
    id: "g",
    contentType: "PRAYER",
    desiredTarget: 100,
    canonicalMax: null,
    currentValidCount: 0,
    gapCount: 100,
    status: "NOT_STARTED",
    ...over,
  };
}

function prismaWith(goals: unknown[], counts: Array<{ contentType: string; _count: number }>) {
  const update = vi.fn((args: unknown) => ({ __op: "update", args }));
  const $transaction = vi.fn(async (ops: unknown[]) => ops);
  return {
    contentGoal: { findMany: vi.fn(async () => goals), update },
    publishedContent: { groupBy: vi.fn(async () => counts) },
    $transaction,
    __update: update,
    __tx: $transaction,
  };
}

describe("refreshContentGoals", () => {
  it("writes only rows whose count/gap/status changed, in a single transaction", async () => {
    const prisma = prismaWith(
      [
        goal({
          id: "same",
          contentType: "PRAYER",
          currentValidCount: 40,
          gapCount: 60,
          status: "IN_PROGRESS",
        }),
        goal({
          id: "moved",
          contentType: "SAINT",
          desiredTarget: 100,
          currentValidCount: 10,
          gapCount: 90,
          status: "IN_PROGRESS",
        }),
      ],
      [
        { contentType: "PRAYER", _count: 40 },
        { contentType: "SAINT", _count: 80 },
      ],
    );
    const out = await refreshContentGoals(prisma as never);
    expect(out).toEqual({ total: 2, changed: 1, unmet: 2 });
    expect(prisma.__update).toHaveBeenCalledTimes(1);
    expect((prisma.__update.mock.calls[0][0] as { where: { id: string } }).where.id).toBe("moved");
    expect(prisma.__tx).toHaveBeenCalledTimes(1);
  });

  it("skips the transaction entirely when nothing changed", async () => {
    const prisma = prismaWith(
      [goal({ currentValidCount: 40, gapCount: 60, status: "IN_PROGRESS" })],
      [{ contentType: "PRAYER", _count: 40 }],
    );
    const out = await refreshContentGoals(prisma as never);
    expect(out.changed).toBe(0);
    expect(prisma.__tx).not.toHaveBeenCalled();
  });

  it("preserves MAINTENANCE while the count is still at/above target", async () => {
    const prisma = prismaWith(
      [goal({ currentValidCount: 120, gapCount: 0, status: "MAINTENANCE" })],
      [{ contentType: "PRAYER", _count: 125 }],
    );
    await refreshContentGoals(prisma as never);
    const data = (prisma.__update.mock.calls[0][0] as { data: { status: string } }).data;
    expect(data.status).toBe("MAINTENANCE");
  });

  it("drops MAINTENANCE once the count falls below target again", async () => {
    expect(reconcileStatus("MAINTENANCE", "NEAR_GOAL")).toBe("NEAR_GOAL");
    expect(reconcileStatus("MAINTENANCE", "TARGET_REACHED")).toBe("MAINTENANCE");
    expect(reconcileStatus("MAINTENANCE", "CANONICAL_COMPLETE")).toBe("MAINTENANCE");
    expect(reconcileStatus("IN_PROGRESS", "TARGET_REACHED")).toBe("TARGET_REACHED");
  });
});

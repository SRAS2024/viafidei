/**
 * A CLOSED content type at its canonical maximum is MET — for good.
 *
 * SACRAMENT is the only closed type (canonicalMax 7). Production showed eight
 * sacraments (audit KB-15): the seven are fixed by the faith, so the worker
 * must never plan for another one, never count the type as unmet, and never
 * pick it as the web-pipeline mission target — however the stored `gapCount`
 * or an operator-raised `desiredTarget` happens to read.
 *
 * Also pins the `$transaction` fallback: the planner / mission-planner fakes
 * are thin per-model objects with no `$transaction`, and a refresh that throws
 * there hides every planner regression behind a TypeError.
 */
import { describe, expect, it, vi } from "vitest";

import {
  effectiveTarget,
  isCanonicallyComplete,
  nextPriorityContentType,
  refreshContentGoals,
} from "@/lib/admin-worker/content-goals";

type GoalRow = {
  id: string;
  contentType: string;
  desiredTarget: number;
  canonicalMax: number | null;
  currentValidCount: number;
  gapCount: number;
  priority: number;
  status: string;
};

function goal(over: Partial<GoalRow> & { contentType: string }): GoalRow {
  return {
    id: `g-${over.contentType}`,
    desiredTarget: 100,
    canonicalMax: null,
    currentValidCount: 0,
    gapCount: 0,
    priority: 10,
    status: "IN_PROGRESS",
    ...over,
  };
}

/** Thin per-model fake WITHOUT `$transaction` — exactly like the planner fakes. */
function makePrisma(goals: GoalRow[], counts: Record<string, number>) {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const prisma = {
    contentGoal: {
      findMany: vi.fn(async (arg?: { where?: { gapCount?: { gt?: number } } }) =>
        arg?.where?.gapCount?.gt != null
          ? goals.filter((g) => g.gapCount > (arg.where!.gapCount!.gt as number))
          : goals,
      ),
      update: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(arg);
        return arg;
      }),
    },
    publishedContent: {
      groupBy: vi.fn(async () =>
        Object.entries(counts).map(([contentType, n]) => ({ contentType, _count: n })),
      ),
    },
    adminWorkerSourceCoverage: { findMany: vi.fn(async () => []) },
    adminWorkerDecision: { findMany: vi.fn(async () => []) },
  };
  return { prisma, updates };
}

describe("effectiveTarget", () => {
  it("clamps an operator-raised target to a closed type's hard maximum", () => {
    expect(effectiveTarget(12, 7)).toBe(7);
    expect(effectiveTarget(7, 7)).toBe(7);
  });

  it("leaves an open type's target alone", () => {
    expect(effectiveTarget(1000, null)).toBe(1000);
    expect(effectiveTarget(1000, 0)).toBe(1000);
  });
});

describe("isCanonicallyComplete", () => {
  it("is true only for a closed type that already holds its full canon", () => {
    expect(isCanonicallyComplete({ canonicalMax: 7, currentValidCount: 7 })).toBe(true);
    // Over-full is still complete: an eighth sacrament is a publish-gate bug to
    // escalate, never a reason to go looking for a ninth.
    expect(isCanonicallyComplete({ canonicalMax: 7, currentValidCount: 8 })).toBe(true);
    expect(isCanonicallyComplete({ canonicalMax: 7, currentValidCount: 6 })).toBe(false);
  });

  it("is false for every open type, at any count", () => {
    expect(isCanonicallyComplete({ canonicalMax: null, currentValidCount: 99999 })).toBe(false);
  });
});

describe("refreshContentGoals — closed types", () => {
  it("a type at its canonical maximum is not unmet, even with a raised target", async () => {
    const { prisma, updates } = makePrisma(
      [
        goal({
          contentType: "SACRAMENT",
          desiredTarget: 12, // operator raised it above the maximum
          canonicalMax: 7,
          currentValidCount: 3,
          gapCount: 4,
        }),
        goal({ contentType: "PRAYER", desiredTarget: 1000, currentValidCount: 10, gapCount: 990 }),
      ],
      { SACRAMENT: 7, PRAYER: 10 },
    );
    const out = await refreshContentGoals(prisma as never);
    expect(out.unmet).toBe(1); // PRAYER only
    const sacrament = updates.find((u) => u.where.id === "g-SACRAMENT");
    expect(sacrament?.data.gapCount).toBe(0);
    expect(sacrament?.data.status).toBe("CANONICAL_COMPLETE");
  });

  it("falls back to sequential writes when the client has no $transaction", async () => {
    const { prisma, updates } = makePrisma(
      [goal({ contentType: "PRAYER", desiredTarget: 1000, currentValidCount: 0, gapCount: 0 })],
      { PRAYER: 25 },
    );
    expect("$transaction" in prisma).toBe(false);
    const out = await refreshContentGoals(prisma as never);
    expect(out.changed).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it("uses $transaction in one batch when the client offers one", async () => {
    const { prisma } = makePrisma(
      [goal({ contentType: "PRAYER", desiredTarget: 1000, currentValidCount: 0, gapCount: 0 })],
      { PRAYER: 25 },
    );
    const $transaction = vi.fn(async (ops: unknown[]) => ops);
    await refreshContentGoals({ ...prisma, $transaction } as never);
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});

describe("nextPriorityContentType — closed types", () => {
  it("never targets a closed type that already holds its full canon", async () => {
    // A stale row: gapCount was written before the target was clamped, so the
    // DB filter (gapCount > 0) still returns SACRAMENT.
    const { prisma } = makePrisma(
      [
        goal({
          contentType: "SACRAMENT",
          desiredTarget: 12,
          canonicalMax: 7,
          currentValidCount: 7,
          gapCount: 5,
          priority: 5,
        }),
        goal({ contentType: "PRAYER", desiredTarget: 1000, currentValidCount: 10, gapCount: 990 }),
      ],
      {},
    );
    const pick = await nextPriorityContentType(prisma as never);
    expect(pick?.contentType).toBe("PRAYER");
  });

  it("still targets a closed type that is genuinely short of its canon", async () => {
    const { prisma } = makePrisma(
      [
        goal({
          contentType: "SACRAMENT",
          desiredTarget: 7,
          canonicalMax: 7,
          currentValidCount: 2,
          gapCount: 5,
          priority: 5,
        }),
      ],
      {},
    );
    const pick = await nextPriorityContentType(prisma as never);
    expect(pick?.contentType).toBe("SACRAMENT");
  });
});

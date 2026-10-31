/**
 * Memory decay (spec §15). Verifies the decay formula, and that the
 * maintenance decay pass only reads and writes what can change: it used to
 * load every AdminWorkerMemory row and issue one UPDATE per row idle over a
 * week on every MAINTENANCE dispatch, including tens of thousands of
 * count-free rows (Wikidata rejection memos, cursors, skip markers).
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { decayMemory, decayedConfidence } from "@/lib/admin-worker/memory";

describe("decayedConfidence — half-life decay (spec §15)", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("returns full confidence when lastUsedAt is now", () => {
    const r = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: now,
      now,
    });
    // 8 successes, 2 failures, Laplace +1/+1 → confidence ~ 9/12 = 0.75
    expect(r.confidence).toBeCloseTo(9 / 12, 2);
    expect(r.ageDays).toBe(0);
  });

  it("halves the effective counts after 30 days (half-life)", () => {
    const last = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const r = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: last,
      now,
    });
    expect(r.effectiveSuccess).toBeCloseTo(4, 1);
    expect(r.effectiveFailure).toBeCloseTo(1, 1);
    expect(r.ageDays).toBe(30);
  });

  it("quarters the counts after 60 days", () => {
    const last = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const r = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: last,
      now,
    });
    expect(r.effectiveSuccess).toBeCloseTo(2, 1);
    expect(r.effectiveFailure).toBeCloseTo(0.5, 1);
  });

  it("drifts confidence toward 0.5 (Laplace neutral) as age grows", () => {
    const fresh = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: now,
      now,
    });
    const oneYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const stale = decayedConfidence({
      successCount: 8,
      failureCount: 2,
      lastUsedAt: oneYear,
      now,
    });
    // Fresh row sits at 0.75; year-old row drifted back toward 0.5.
    expect(fresh.confidence).toBeGreaterThan(stale.confidence);
    expect(stale.confidence).toBeLessThan(0.6);
  });

  it("treats null lastUsedAt as 'now' (no decay yet)", () => {
    const r = decayedConfidence({
      successCount: 5,
      failureCount: 1,
      lastUsedAt: null,
      now,
    });
    expect(r.ageDays).toBe(0);
  });
});

interface MemoryRow {
  id: string;
  memoryKey: string;
  successCount: number;
  failureCount: number;
  lastUsedAt: Date | null;
  confidence: number;
}

type CountFilter = number | { gt: number };
interface MemoryWhere {
  successCount?: CountFilter;
  failureCount?: CountFilter;
  lastUsedAt?: { lt: Date };
  id?: { gt: string };
  OR?: MemoryWhere[];
}

/** An in-memory AdminWorkerMemory that applies the filters decayMemory sends. */
function fakeMemory(rows: MemoryRow[]) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const count = (v: number, f: CountFilter | undefined) =>
    f === undefined || (typeof f === "number" ? v === f : v > f.gt);
  const matches = (r: MemoryRow, w: MemoryWhere): boolean =>
    count(r.successCount, w.successCount) &&
    count(r.failureCount, w.failureCount) &&
    (!w.lastUsedAt || (r.lastUsedAt !== null && r.lastUsedAt < w.lastUsedAt.lt)) &&
    (!w.id || r.id > w.id.gt) &&
    (!w.OR || w.OR.some((o) => matches(r, o)));
  const api = {
    findMany: vi.fn(async ({ where, take }: { where: MemoryWhere; take: number }) =>
      [...table.values()]
        .filter((r) => matches(r, where))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, take)
        .map((r) => ({ ...r })),
    ),
    deleteMany: vi.fn(async ({ where }: { where: MemoryWhere }) => {
      let n = 0;
      for (const [id, r] of table) {
        if (matches(r, where)) {
          table.delete(id);
          n += 1;
        }
      }
      return { count: n };
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      table.delete(where.id);
      return {};
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemoryRow> }) => {
      Object.assign(table.get(where.id) ?? {}, data);
      return {};
    }),
  };
  return { prisma: { adminWorkerMemory: api } as unknown as PrismaClient, table, api };
}

describe("decayMemory — bounded by what can change", () => {
  const now = new Date("2026-10-31T06:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const row = (
    id: string,
    successCount: number,
    failureCount: number,
    lastUsedAt: Date | null,
    confidence = (successCount + 1) / (successCount + failureCount + 2),
  ): MemoryRow => ({
    id,
    memoryKey: `key:${id}`,
    successCount,
    failureCount,
    lastUsedAt,
    confidence,
  });

  it("never reads or rewrites a row without a learning signal", async () => {
    const { prisma, table, api } = fakeMemory([
      row("m1", 0, 0, daysAgo(10), 0.5), // a fresh rejection memo
      row("m2", 0, 0, daysAgo(100), 0.5), // an old one, still inside the prune age
      row("m3", 0, 0, null, 0.5), // a switch / fingerprint row
      row("m4", 8, 2, daysAgo(30)), // a real learning signal, a month idle
    ]);

    const out = await decayMemory(prisma, { now });

    expect(out).toEqual({ decayed: 1, pruned: 0 });
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update.mock.calls[0][0].where.id).toBe("m4");
    expect(table.get("m4")).toMatchObject({ successCount: 4, failureCount: 1 });
    // The count-free rows were never even handed to the decay loop.
    const read = (
      await Promise.all(api.findMany.mock.results.map((r) => r.value))
    ).flat() as Array<{
      id: string;
    }>;
    expect(read.map((r) => r.id)).toEqual(["m4"]);
    expect(table.get("m2")).toMatchObject({ successCount: 0, failureCount: 0, confidence: 0.5 });
  });

  it("prunes count-free rows past the prune age in one statement, as the per-row rule did", async () => {
    const { prisma, table, api } = fakeMemory([
      row("m1", 0, 0, daysAgo(200), 0.5),
      row("m2", 0, 0, daysAgo(181), 0.5),
      row("m3", 0, 0, daysAgo(179), 0.5),
      row("m4", 0, 0, null, 0.5),
    ]);
    const out = await decayMemory(prisma, { now });
    expect(out.pruned).toBe(2);
    expect(api.deleteMany).toHaveBeenCalledTimes(1);
    expect(api.delete).not.toHaveBeenCalled();
    expect([...table.keys()].sort()).toEqual(["m3", "m4"]);
  });

  it("does not rewrite a row whose decayed counts and confidence would not move", async () => {
    const { prisma, api } = fakeMemory([row("m1", 1, 0, daysAgo(10))]);
    // First run: the confidence drifts toward 0.5 and is stored.
    expect((await decayMemory(prisma, { now })).decayed).toBe(1);
    // Second run moments later: nothing would change, so nothing is written.
    expect((await decayMemory(prisma, { now: new Date(now.getTime() + 60_000) })).decayed).toBe(0);
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it("walks every page and still prunes a row whose signal has decayed away", async () => {
    const { prisma, table, api } = fakeMemory([
      row("a1", 8, 2, daysAgo(30)),
      row("a2", 8, 2, daysAgo(30)),
      row("a3", 8, 2, daysAgo(30)),
      row("a4", 8, 2, daysAgo(30)),
      row("a5", 1, 0, daysAgo(400)),
      row("a6", 8, 2, daysAgo(3)), // idle under a week: not decayed yet
    ]);
    const out = await decayMemory(prisma, { now, pageSize: 2 });
    expect(out).toEqual({ decayed: 4, pruned: 1 });
    expect(api.findMany).toHaveBeenCalledTimes(3);
    expect(table.has("a5")).toBe(false);
    expect(table.get("a6")).toMatchObject({ successCount: 8, failureCount: 2 });
  });
});

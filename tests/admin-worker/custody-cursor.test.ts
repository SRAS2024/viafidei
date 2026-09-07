/**
 * Custody pass cursor. The scan used to re-select the same 25 oldest-updated
 * rows every hour forever (it never writes to the rows it inspects). Now it
 * pages through the catalogue by id with a cursor persisted in
 * AdminWorkerMemory and wraps around at the end — and every brain call is
 * taken under the brain mutex.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  detectMissingFor: vi.fn(),
  heldDuringCalls: [] as boolean[],
}));

vi.mock("@/lib/admin-worker/intelligence", () => ({ isBrainEnabled: () => true }));
vi.mock("@/lib/admin-worker/intelligence/service", () => ({
  detectMissingFor: h.detectMissingFor,
}));
vi.mock("@/lib/admin-worker/intelligence/store", () => ({
  recordDeveloperRequests: vi.fn(async () => ({ created: 0, bumped: 0 })),
}));

import { brainMutexState } from "@/lib/admin-worker/brain-mutex";
import { resetCustodyThrottle, runCustodyPass } from "@/lib/admin-worker/custody";

type FindManyArgs = { where: { id?: { gt: string } }; orderBy: unknown; take: number };

function makePrisma(opts: { cursor: string | null; pages: Record<string, string[]> }) {
  const findManyCalls: FindManyArgs[] = [];
  const upserts: Array<{ create: { memoryValue: { afterId: string | null } } }> = [];
  return {
    findManyCalls,
    upserts,
    adminWorkerMemory: {
      findUnique: vi.fn(async () =>
        opts.cursor ? { memoryValue: { afterId: opts.cursor } } : null,
      ),
      upsert: vi.fn(async (arg: (typeof upserts)[number]) => {
        upserts.push(arg);
        return {};
      }),
    },
    publishedContent: {
      findMany: vi.fn(async (arg: FindManyArgs) => {
        findManyCalls.push(arg);
        const key = arg.where.id?.gt ?? "";
        return (opts.pages[key] ?? []).map((id) => ({
          id,
          contentType: "PRAYER",
          title: id,
          slug: id,
          payload: {},
        }));
      }),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  };
}

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

beforeEach(() => {
  resetCustodyThrottle();
  h.heldDuringCalls.length = 0;
  h.detectMissingFor.mockReset().mockImplementation(async () => {
    h.heldDuringCalls.push(brainMutexState().held);
    return { available: true, completeness: 0.9, missing: [] };
  });
});

describe("runCustodyPass cursor", () => {
  it("starts from the beginning when no cursor is stored and persists the last id", async () => {
    const prisma = makePrisma({ cursor: null, pages: { "": ids("a", 25) } });
    const r = await runCustodyPass(prisma as never);
    expect(r.scanned).toBe(25);
    expect(prisma.findManyCalls[0].where.id).toBeUndefined();
    expect(prisma.findManyCalls[0].orderBy).toEqual({ id: "asc" });
    // Full page → cursor advances to the last scanned id.
    expect(prisma.upserts[0].create.memoryValue.afterId).toBe("a24");
  });

  it("continues after the stored cursor instead of re-scanning the same rows", async () => {
    const prisma = makePrisma({ cursor: "a24", pages: { a24: ids("b", 25) } });
    const r = await runCustodyPass(prisma as never);
    expect(r.scanned).toBe(25);
    expect(prisma.findManyCalls[0].where.id).toEqual({ gt: "a24" });
    expect(prisma.upserts[0].create.memoryValue.afterId).toBe("b24");
  });

  it("resets the cursor after a short (final) page so the next pass starts over", async () => {
    const prisma = makePrisma({ cursor: "b24", pages: { b24: ids("c", 3) } });
    const r = await runCustodyPass(prisma as never);
    expect(r.scanned).toBe(3);
    expect(prisma.upserts[0].create.memoryValue.afterId).toBeNull();
  });

  it("wraps to the first page when the cursor is already past the end", async () => {
    const prisma = makePrisma({ cursor: "zzz", pages: { "": ids("a", 25) } });
    const r = await runCustodyPass(prisma as never);
    expect(r.wrapped).toBe(true);
    expect(r.scanned).toBe(25);
    expect(prisma.findManyCalls).toHaveLength(2);
    expect(prisma.findManyCalls[1].where.id).toBeUndefined();
  });

  it("makes every brain call while holding the brain mutex", async () => {
    const prisma = makePrisma({ cursor: null, pages: { "": ids("a", 4) } });
    await runCustodyPass(prisma as never);
    expect(h.heldDuringCalls).toEqual([true, true, true, true]);
    expect(brainMutexState().held).toBe(false);
  });
});

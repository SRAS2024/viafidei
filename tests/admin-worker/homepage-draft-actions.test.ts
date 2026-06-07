/**
 * Homepage Makeover draft review actions — proves the admin
 * preview → edit → publish / discard flow at the data layer:
 *   - reviewable-status gating,
 *   - defensive snapshot parsing,
 *   - non-destructive publish (featured rails only; hero/mission kept),
 *   - discard marks REJECTED,
 *   - terminal drafts are refused.
 */

import { describe, expect, it, vi } from "vitest";

import {
  applyHomepageDraft,
  discardHomepageDraft,
  getHomepageDraft,
  isReviewableDraftStatus,
  readSnapshotBlocks,
  saveHomepageDraftEdits,
} from "@/lib/admin-worker/homepage-designer";

type AnyPrisma = Parameters<typeof applyHomepageDraft>[0];

const sampleSnapshot = [
  {
    blockKey: "featured-prayers",
    blockType: "featured-prayers",
    sortOrder: 0,
    configJson: {
      heading: "Featured Prayers",
      items: [{ slug: "our-father", title: "Our Father" }],
    },
  },
  {
    blockKey: "featured-saints",
    blockType: "featured-saints",
    sortOrder: 1,
    configJson: {
      heading: "Featured Saints",
      items: [{ slug: "st-francis", title: "St. Francis" }],
    },
  },
];

describe("readSnapshotBlocks", () => {
  it("returns [] for non-arrays", () => {
    expect(readSnapshotBlocks(null)).toEqual([]);
    expect(readSnapshotBlocks({})).toEqual([]);
    expect(readSnapshotBlocks("nope")).toEqual([]);
  });

  it("drops malformed entries and keeps well-formed blocks", () => {
    const out = readSnapshotBlocks([
      { blockKey: "a", blockType: "featured-prayers", sortOrder: 3, configJson: { x: 1 } },
      { blockKey: "missing-type" },
      null,
      42,
      { blockType: "no-key" },
    ]);
    expect(out).toEqual([
      { blockKey: "a", blockType: "featured-prayers", sortOrder: 3, configJson: { x: 1 } },
    ]);
  });

  it("defaults sortOrder + configJson when absent", () => {
    const out = readSnapshotBlocks([{ blockKey: "a", blockType: "featured-saints" }]);
    expect(out[0].sortOrder).toBe(0);
    expect(out[0].configJson).toEqual({});
  });
});

describe("isReviewableDraftStatus", () => {
  it("treats PROPOSED + AWAITING_REVIEW as reviewable", () => {
    expect(isReviewableDraftStatus("PROPOSED")).toBe(true);
    expect(isReviewableDraftStatus("AWAITING_REVIEW")).toBe(true);
  });
  it("treats terminal statuses as not reviewable", () => {
    for (const s of ["AUTO_PUBLISHED", "APPROVED", "REJECTED", "EXPIRED"] as const) {
      expect(isReviewableDraftStatus(s)).toBe(false);
    }
  });
});

describe("getHomepageDraft", () => {
  it("delegates to findUnique", async () => {
    const findUnique = vi.fn(async () => ({ id: "d1" }));
    const prisma = { homepageWorkerDraft: { findUnique } } as unknown as AnyPrisma;
    const out = await getHomepageDraft(prisma, "d1");
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "d1" } });
    expect(out).toEqual({ id: "d1" });
  });
});

describe("saveHomepageDraftEdits", () => {
  it("saves featured edits and re-sequences sortOrder for a reviewable draft", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = {
      homepageWorkerDraft: {
        findUnique: vi.fn(async () => ({ id: "d1", status: "AWAITING_REVIEW" })),
        update,
      },
    } as unknown as AnyPrisma;

    const res = await saveHomepageDraftEdits(prisma, "d1", [
      { blockKey: "featured-prayers", blockType: "featured-prayers", sortOrder: 9, configJson: {} },
      { blockKey: "featured-saints", blockType: "featured-saints", sortOrder: 4, configJson: {} },
    ]);

    expect(res).toEqual({ saved: true, status: "AWAITING_REVIEW" });
    const saved = update.mock.calls[0][0].data.proposedSnapshot as Array<{ sortOrder: number }>;
    expect(saved.map((b) => b.sortOrder)).toEqual([0, 1]);
  });

  it("refuses to save a terminal draft", async () => {
    const update = vi.fn();
    const prisma = {
      homepageWorkerDraft: {
        findUnique: vi.fn(async () => ({ id: "d1", status: "APPROVED" })),
        update,
      },
    } as unknown as AnyPrisma;
    const res = await saveHomepageDraftEdits(prisma, "d1", []);
    expect(res.saved).toBe(false);
    expect(res.status).toBe("APPROVED");
    expect(update).not.toHaveBeenCalled();
  });

  it("reports not_found for a missing draft", async () => {
    const prisma = {
      homepageWorkerDraft: { findUnique: vi.fn(async () => null), update: vi.fn() },
    } as unknown as AnyPrisma;
    const res = await saveHomepageDraftEdits(prisma, "missing", []);
    expect(res).toEqual({ saved: false, status: "EXPIRED", reason: "not_found" });
  });
});

describe("discardHomepageDraft", () => {
  it("marks a reviewable draft REJECTED", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = {
      homepageWorkerDraft: {
        findUnique: vi.fn(async () => ({ id: "d1", status: "PROPOSED" })),
        update,
      },
    } as unknown as AnyPrisma;
    const res = await discardHomepageDraft(prisma, "d1");
    expect(res).toEqual({ discarded: true, status: "REJECTED" });
    expect(update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { status: "REJECTED" } });
  });

  it("refuses a terminal draft", async () => {
    const update = vi.fn();
    const prisma = {
      homepageWorkerDraft: {
        findUnique: vi.fn(async () => ({ id: "d1", status: "REJECTED" })),
        update,
      },
    } as unknown as AnyPrisma;
    const res = await discardHomepageDraft(prisma, "d1");
    expect(res.discarded).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("applyHomepageDraft", () => {
  function makeApplyPrisma(opts: {
    draft: { id: string; status: string; proposedSnapshot: unknown } | null;
    page: { id: string; blocks: Array<{ blockType: string; sortOrder: number }> } | null;
  }) {
    let page = opts.page;
    const tx = {
      homePageBlock: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "b",
          ...data,
        })),
      },
      homePage: { update: vi.fn(async () => ({})) },
      homepageWorkerDraft: { update: vi.fn(async () => ({})) },
    };
    const prisma = {
      homepageWorkerDraft: { findUnique: vi.fn(async () => opts.draft) },
      homePage: {
        findUnique: vi.fn(async () => page),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          page = { id: "newpage", blocks: [], ...(data as object) } as typeof page;
          return page;
        }),
      },
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    } as unknown as AnyPrisma;
    return {
      prisma,
      tx,
      getPrismaSpies: () => prisma as unknown as { homePage: { create: ReturnType<typeof vi.fn> } },
    };
  }

  it("publishes featured rails non-destructively after the kept blocks", async () => {
    const { prisma, tx } = makeApplyPrisma({
      draft: { id: "d1", status: "AWAITING_REVIEW", proposedSnapshot: sampleSnapshot },
      page: {
        id: "p1",
        blocks: [
          { blockType: "hero", sortOrder: 0 },
          { blockType: "two-column", sortOrder: 1 },
          { blockType: "featured-prayers", sortOrder: 2 },
        ],
      },
    });

    const res = await applyHomepageDraft(prisma, "d1");

    expect(res).toEqual({ applied: true, status: "APPROVED", blocksWritten: 2 });
    // Old featured blocks are cleared first.
    expect(tx.homePageBlock.deleteMany).toHaveBeenCalledWith({
      where: { pageId: "p1", blockType: { startsWith: "featured-" } },
    });
    // New featured blocks slot in AFTER the max kept sortOrder (1) → 2, 3.
    const createdOrders = tx.homePageBlock.create.mock.calls.map(
      (c) => (c[0] as { data: { sortOrder: number } }).data.sortOrder,
    );
    expect(createdOrders).toEqual([2, 3]);
    // Homepage flips to PUBLISHED, draft to APPROVED.
    expect(tx.homePage.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "PUBLISHED", version: { increment: 1 } },
    });
    expect(tx.homepageWorkerDraft.update.mock.calls[0][0].data.status).toBe("APPROVED");
  });

  it("creates the homepage record when none exists yet", async () => {
    const { prisma } = makeApplyPrisma({
      draft: { id: "d1", status: "PROPOSED", proposedSnapshot: sampleSnapshot },
      page: null,
    });
    const res = await applyHomepageDraft(prisma, "d1");
    expect(res.applied).toBe(true);
    expect(
      (prisma as unknown as { homePage: { create: ReturnType<typeof vi.fn> } }).homePage.create,
    ).toHaveBeenCalled();
  });

  it("ignores non-featured blocks in the proposed snapshot", async () => {
    const { prisma, tx } = makeApplyPrisma({
      draft: {
        id: "d1",
        status: "AWAITING_REVIEW",
        proposedSnapshot: [
          { blockKey: "hero", blockType: "hero", sortOrder: 0, configJson: {} },
          ...sampleSnapshot,
        ],
      },
      page: { id: "p1", blocks: [{ blockType: "hero", sortOrder: 0 }] },
    });
    const res = await applyHomepageDraft(prisma, "d1");
    expect(res.blocksWritten).toBe(2);
    expect(tx.homePageBlock.create).toHaveBeenCalledTimes(2);
  });

  it("refuses a terminal draft", async () => {
    const { prisma, tx } = makeApplyPrisma({
      draft: { id: "d1", status: "APPROVED", proposedSnapshot: sampleSnapshot },
      page: { id: "p1", blocks: [] },
    });
    const res = await applyHomepageDraft(prisma, "d1");
    expect(res.applied).toBe(false);
    expect(res.status).toBe("APPROVED");
    expect(tx.homePageBlock.create).not.toHaveBeenCalled();
  });

  it("reports not_found for a missing draft", async () => {
    const { prisma } = makeApplyPrisma({ draft: null, page: { id: "p1", blocks: [] } });
    const res = await applyHomepageDraft(prisma, "missing");
    expect(res).toEqual({
      applied: false,
      status: "EXPIRED",
      blocksWritten: 0,
      reason: "not_found",
    });
  });
});

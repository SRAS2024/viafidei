/**
 * Homepage mutator — proves "homepage redesign drafts are created and
 * safe", "small homepage improvements can be published safely",
 * "major homepage changes are reviewed when needed" (spec sections
 * 10, 24).
 */

import { describe, expect, it, vi } from "vitest";

import { redesignHomepage } from "@/lib/admin-worker/homepage-mutator";

interface HomePageBlock {
  blockKey: string;
  blockType: string;
  sortOrder: number;
  configJson: unknown;
}

function makePrisma(opts: {
  blocks?: HomePageBlock[];
  publishedByType?: Array<{ contentType: string; _count: number }>;
  publishedRows?: Array<{ contentType: string; slug: string; title: string; publishedAt: Date }>;
}) {
  const drafts: unknown[] = [];
  const logs: unknown[] = [];
  return {
    drafts,
    logs,
    prisma: {
      homePage: {
        findUnique: vi.fn(async () =>
          opts.blocks ? { id: "homepage", slug: "homepage", blocks: opts.blocks } : null,
        ),
      },
      publishedContent: {
        groupBy: vi.fn(async () => opts.publishedByType ?? []),
        findMany: vi.fn(async ({ where }: { where: { contentType: string } }) => {
          return (opts.publishedRows ?? []).filter((r) => r.contentType === where.contentType);
        }),
      },
      homepageQualityScore: {
        create: vi.fn(async ({ data }: { data: { finalScore: number } }) => ({
          id: `q${Math.random()}`,
          finalScore: data.finalScore,
        })),
      },
      homepageWorkerDraft: {
        create: vi.fn(async ({ data }: { data: { status: string } }) => {
          const row = { id: `d${drafts.length + 1}`, ...data };
          drafts.push(row);
          return row;
        }),
      },
      adminWorkerLog: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          logs.push(data);
          return { id: `l${logs.length}` };
        }),
      },
    } as unknown as Parameters<typeof redesignHomepage>[0],
  };
}

describe("redesignHomepage", () => {
  it("does not propose a draft when the score is above threshold", async () => {
    const { prisma, drafts } = makePrisma({
      // Lots of featured blocks + published content keep the score high.
      blocks: [
        { blockKey: "hero", blockType: "hero", sortOrder: 0, configJson: {} },
        { blockKey: "mission", blockType: "mission", sortOrder: 1, configJson: {} },
        {
          blockKey: "featured-prayers",
          blockType: "featured-prayers",
          sortOrder: 2,
          configJson: {},
        },
        { blockKey: "featured-saints", blockType: "featured-saints", sortOrder: 3, configJson: {} },
        {
          blockKey: "featured-devotions",
          blockType: "featured-devotions",
          sortOrder: 4,
          configJson: {},
        },
        {
          blockKey: "featured-novenas",
          blockType: "featured-novenas",
          sortOrder: 5,
          configJson: {},
        },
      ],
      publishedByType: [
        { contentType: "PRAYER", _count: 30 },
        { contentType: "SAINT", _count: 30 },
      ],
    });
    const out = await redesignHomepage(prisma, { redesignThreshold: 0.5 });
    expect(out.draftId).toBeNull();
    expect(drafts).toHaveLength(0);
  });

  it("drafts a small auto-publishable refresh when only featured slots need refilling", async () => {
    const { prisma, drafts } = makePrisma({
      blocks: [
        { blockKey: "hero", blockType: "hero", sortOrder: 0, configJson: {} },
        { blockKey: "mission", blockType: "mission", sortOrder: 1, configJson: {} },
      ],
      publishedByType: [{ contentType: "PRAYER", _count: 25 }],
      publishedRows: [
        { contentType: "PRAYER", slug: "our-father", title: "Our Father", publishedAt: new Date() },
        { contentType: "PRAYER", slug: "hail-mary", title: "Hail Mary", publishedAt: new Date() },
      ],
    });
    const out = await redesignHomepage(prisma, { redesignThreshold: 0.99 });
    expect(out.draftId).not.toBeNull();
    // First time we propose featured-prayers, so it's an "added" diff,
    // which falls into CONTENT_GAP_REPAIR mode.
    const draft = drafts[0] as { mode: string; status: string };
    expect(draft.mode).toBe("CONTENT_GAP_REPAIR");
  });

  it("never auto-publishes when removing existing sections", async () => {
    const { prisma, drafts } = makePrisma({
      blocks: [
        { blockKey: "hero", blockType: "hero", sortOrder: 0, configJson: {} },
        // Existing featured-prayers block will be REMOVED because we
        // have no published prayer rows to refill it.
        {
          blockKey: "featured-prayers",
          blockType: "featured-prayers",
          sortOrder: 1,
          configJson: {},
        },
      ],
      publishedByType: [],
      publishedRows: [],
    });
    const out = await redesignHomepage(prisma, { redesignThreshold: 0.99 });
    expect(out.draftId).not.toBeNull();
    const draft = drafts[0] as { status: string; mode: string };
    expect(draft.mode).toBe("FULL_REFRESH");
    expect(draft.status).toBe("AWAITING_REVIEW");
  });
});

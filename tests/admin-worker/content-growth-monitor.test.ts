/**
 * Spec §17: the content growth execution monitor computes the full
 * per-content-type funnel (candidates → … → public/search/sitemap)
 * and identifies the first stage that dropped to zero (the
 * bottleneck).
 */

import { describe, expect, it, vi } from "vitest";

import { computeContentFunnel } from "@/lib/admin-worker/content-growth-monitor";

function makePrisma(counts: Record<string, number>, opts: { goals?: string[] } = {}) {
  const goals = opts.goals ?? ["PRAYER"];
  // A model whose count() returns the value keyed by a label derived
  // from the where-clause. We map each funnel query to a count via a
  // resolver so a test can dial each stage independently.
  const resolver = (model: string, where: Record<string, unknown> = {}): number => {
    const status = where.status as { in?: string[] } | string | undefined;
    if (model === "candidateSourceUrl") {
      if (status === "PRIORITIZED") return counts.prioritized ?? 0;
      if (typeof status === "object" && status?.in) return counts.fetched ?? 0;
      return counts.discovered ?? 0;
    }
    if (model === "adminWorkerSourceRead") return counts.reads ?? 0;
    if (model === "adminWorkerSourceBlock") return counts.blocks ?? 0;
    if (model === "adminWorkerPackageArtifact") return counts.artifacts ?? 0;
    if (model === "checklistItem") return counts.checklist ?? 0;
    if (model === "checklistCitation") return counts.citations ?? 0;
    if (model === "adminWorkerCrossSourceVerification") return counts.validation ?? 0;
    if (model === "adminWorkerStrictQAResult") return counts.strictQA ?? 0;
    if (model === "contentQualityScore") return counts.quality ?? 0;
    if (model === "publishedContent") return counts.published ?? 0;
    if (model === "postPublishVerification") return counts.postPublish ?? 0;
    return 0;
  };
  const model = (name: string) => ({
    count: vi.fn(async (args: { where?: Record<string, unknown> } = {}) =>
      resolver(name, args.where ?? {}),
    ),
  });
  return {
    contentGoal: {
      findMany: vi.fn(async () => goals.map((contentType) => ({ contentType }))),
    },
    candidateSourceUrl: model("candidateSourceUrl"),
    adminWorkerSourceRead: model("adminWorkerSourceRead"),
    adminWorkerSourceBlock: model("adminWorkerSourceBlock"),
    adminWorkerPackageArtifact: model("adminWorkerPackageArtifact"),
    checklistItem: model("checklistItem"),
    checklistCitation: model("checklistCitation"),
    adminWorkerCrossSourceVerification: model("adminWorkerCrossSourceVerification"),
    adminWorkerStrictQAResult: model("adminWorkerStrictQAResult"),
    contentQualityScore: model("contentQualityScore"),
    publishedContent: model("publishedContent"),
    postPublishVerification: model("postPublishVerification"),
  } as unknown as Parameters<typeof computeContentFunnel>[0];
}

describe("computeContentFunnel (spec §17)", () => {
  it("returns a row per content goal with all funnel stages", async () => {
    const rows = await computeContentFunnel(
      makePrisma(
        {
          discovered: 10,
          prioritized: 8,
          fetched: 6,
          reads: 6,
          blocks: 40,
          artifacts: 5,
          checklist: 5,
          citations: 9,
          validation: 4,
          strictQA: 4,
          quality: 4,
          published: 3,
          postPublish: 3,
        },
        { goals: ["PRAYER", "SAINT"] },
      ),
    );
    expect(rows.length).toBe(2);
    const prayer = rows[0];
    expect(prayer.candidatesDiscovered).toBe(10);
    expect(prayer.publishedItems).toBe(3);
    expect(prayer.publicTabVisible).toBe(true);
    expect(prayer.searchVisible).toBe(true);
    expect(prayer.sitemapVisible).toBe(true);
    expect(prayer.firstEmptyStage).toBeNull(); // flowing all the way
  });

  it("identifies the bottleneck stage when the funnel drops to zero", async () => {
    const rows = await computeContentFunnel(
      makePrisma({
        discovered: 10,
        prioritized: 8,
        fetched: 6,
        reads: 6,
        blocks: 40,
        artifacts: 0, // extraction is the bottleneck
        checklist: 0,
        validation: 0,
        strictQA: 0,
        quality: 0,
        published: 0,
        postPublish: 0,
      }),
    );
    expect(rows[0].firstEmptyStage).toBe("packageArtifactsCreated");
    expect(rows[0].publicTabVisible).toBe(false);
  });

  it("reports no public visibility when nothing is published", async () => {
    const rows = await computeContentFunnel(makePrisma({ discovered: 5, published: 0 }));
    expect(rows[0].publicTabVisible).toBe(false);
    expect(rows[0].searchVisible).toBe(false);
    expect(rows[0].sitemapVisible).toBe(false);
  });
});

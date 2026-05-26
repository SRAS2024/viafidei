/**
 * HomepagePublishOrchestrator (spec §20). Verifies the inspect →
 * mutate → verify → roll-back path.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/homepage-mutator", () => ({
  redesignHomepage: vi.fn(),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import {
  inspectHomepage,
  runHomepagePublishOrchestrator,
} from "@/lib/admin-worker/homepage-publish-orchestrator";

function makePrisma(
  opts: {
    publishedTotal?: number;
    publishedByType?: Array<{ contentType: string; count: number }>;
    recentPublishes30d?: number;
    brokenLinks?: number;
    homepageScore?: { finalScore: number } | null;
    draft?: { id: string; status: string; finalScore: number } | null;
  } = {},
) {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  return {
    updates,
    prisma: {
      publishedContent: {
        groupBy: vi.fn(async () =>
          (opts.publishedByType ?? [{ contentType: "PRAYER", count: 5 }]).map((r) => ({
            contentType: r.contentType,
            _count: r.count,
          })),
        ),
        count: vi.fn(async () => opts.recentPublishes30d ?? 0),
      },
      postPublishVerification: {
        count: vi.fn(async () => opts.brokenLinks ?? 0),
      },
      homepageQualityScore: {
        findFirst: vi.fn(async () => opts.homepageScore ?? null),
      },
      homepageWorkerDraft: {
        findFirst: vi.fn(async () => opts.draft ?? null),
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push(args);
          return { id: args.where.id };
        }),
      },
    } as unknown as Parameters<typeof runHomepagePublishOrchestrator>[0],
  };
}

describe("inspectHomepage — 10-axis inspection (spec §20)", () => {
  it("returns a composite score and one entry per inspection axis", async () => {
    const { prisma } = makePrisma({
      publishedByType: [
        { contentType: "PRAYER", count: 10 },
        { contentType: "SAINT", count: 10 },
        { contentType: "DEVOTION", count: 5 },
      ],
      recentPublishes30d: 8,
      brokenLinks: 0,
    });
    const inspection = await inspectHomepage(prisma);
    expect(inspection.publicContentAvailability.score).toBeGreaterThan(0);
    expect(inspection.contentFreshness.score).toBeGreaterThan(0);
    expect(inspection.featuredItemQuality.score).toBeGreaterThan(0);
    expect(inspection.emptyHomepageSections.score).toBeGreaterThan(0);
    expect(inspection.brokenLinks.score).toBe(1);
    expect(inspection.seasonalRelevance.score).toBeGreaterThan(0);
    expect(inspection.mobileReadiness.score).toBeGreaterThan(0);
    expect(inspection.visualBalance.score).toBeGreaterThan(0);
    expect(inspection.accessibility.score).toBeGreaterThan(0);
    expect(inspection.userNavigationClarity.score).toBeGreaterThan(0);
    expect(inspection.composite).toBeGreaterThan(0);
  });

  it("penalises broken-link signals", async () => {
    const { prisma } = makePrisma({ brokenLinks: 5 });
    const inspection = await inspectHomepage(prisma);
    expect(inspection.brokenLinks.score).toBeLessThan(1);
  });

  it("penalises freshness when nothing has published in 30 days", async () => {
    const { prisma } = makePrisma({ recentPublishes30d: 0 });
    const inspection = await inspectHomepage(prisma);
    expect(inspection.contentFreshness.score).toBe(0);
  });

  it("inspection reasons carry a human-readable string", async () => {
    const { prisma } = makePrisma({ publishedByType: [{ contentType: "PRAYER", count: 1 }] });
    const inspection = await inspectHomepage(prisma);
    expect(inspection.publicContentAvailability.reason.length).toBeGreaterThan(5);
  });
});

describe("runHomepagePublishOrchestrator — mission flow (spec §20)", () => {
  it("skips when the homepage is already healthy (composite >= 0.85)", async () => {
    const { prisma } = makePrisma({
      publishedByType: [
        { contentType: "PRAYER", count: 100 },
        { contentType: "SAINT", count: 100 },
        { contentType: "DEVOTION", count: 100 },
        { contentType: "NOVENA", count: 100 },
        { contentType: "ROSARY", count: 100 },
        { contentType: "APPARITION", count: 100 },
        { contentType: "SACRAMENT", count: 100 },
        { contentType: "CHURCH_DOCUMENT", count: 100 },
      ],
      recentPublishes30d: 100,
      brokenLinks: 0,
      homepageScore: { finalScore: 0.95 },
    });
    const result = await runHomepagePublishOrchestrator(prisma);
    expect(result.kind).toBe("skipped");
    expect(result.reason).toMatch(/healthy/);
  });

  it("delegates to the mutator and returns auto-published when mutator returns AUTO_PUBLISHED", async () => {
    const { prisma } = makePrisma({ publishedByType: [{ contentType: "PRAYER", count: 1 }] });
    const { redesignHomepage } = await import("@/lib/admin-worker/homepage-mutator");
    vi.mocked(redesignHomepage).mockResolvedValueOnce({
      draftId: "draft-1",
      status: "AUTO_PUBLISHED",
      finalScore: 0.7,
      qualityScoreId: "q1",
      sectionsChanged: ["hero"],
      reasonSummary: "test",
    });
    const result = await runHomepagePublishOrchestrator(prisma);
    expect(result.kind).toBe("auto-published");
    expect(result.draftId).toBe("draft-1");
  });

  it("returns review-draft when mutator returns AWAITING_REVIEW", async () => {
    const { prisma } = makePrisma({ publishedByType: [{ contentType: "PRAYER", count: 1 }] });
    const { redesignHomepage } = await import("@/lib/admin-worker/homepage-mutator");
    vi.mocked(redesignHomepage).mockResolvedValueOnce({
      draftId: "draft-2",
      status: "AWAITING_REVIEW",
      finalScore: 0.6,
      qualityScoreId: "q2",
      sectionsChanged: ["featured-prayers", "featured-saints"],
      reasonSummary: "major change",
    });
    const result = await runHomepagePublishOrchestrator(prisma);
    expect(result.kind).toBe("review-draft");
  });

  it("returns skipped when the mutator declines to file a draft", async () => {
    const { prisma } = makePrisma({ publishedByType: [{ contentType: "PRAYER", count: 1 }] });
    const { redesignHomepage } = await import("@/lib/admin-worker/homepage-mutator");
    vi.mocked(redesignHomepage).mockResolvedValueOnce({
      draftId: null,
      status: "no_redesign_needed",
      finalScore: 0.9,
      qualityScoreId: null,
      sectionsChanged: [],
      reasonSummary: "no work needed",
    });
    const result = await runHomepagePublishOrchestrator(prisma);
    expect(result.kind).toBe("skipped");
  });
});

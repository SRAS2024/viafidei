/**
 * PublishOrchestrator (spec §13). Verifies the autonomous publish
 * path: quality gate, slug uniqueness, duplicate handling,
 * idempotence, verifier requirement on sensitive content, and the
 * post-publish side effects (cache / sitemap / search refresh).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({
    kind: "cache_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  flagSitemapRefresh: vi.fn(async () => ({
    kind: "sitemap_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  flagSearchRefresh: vi.fn(async () => ({
    kind: "search_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
}));

vi.mock("@/lib/admin-worker/content-goals", () => ({
  refreshContentGoals: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/public-routes", () => ({
  publicRouteFor: vi.fn(() => ({
    tab: "prayers",
    tabPath: "/prayers",
    slugPath: "/prayers/test",
    cacheTags: [],
  })),
}));

import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

function makePrisma(opts: { existing?: { id: string; isPublished: boolean } | null } = {}) {
  return {
    publishedContent: {
      findFirst: vi.fn(async () => opts.existing ?? null),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: args.where.id,
        isPublished: true,
      })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "new-published-1",
        ...args.data,
      })),
    },
    adminWorkerLog: {
      findFirst: vi.fn(async () => null),
    },
  } as unknown as Parameters<typeof runPublishOrchestrator>[0];
}

const HEALTHY_INPUT = {
  contentType: "PRAYER",
  contentId: "checklist-1",
  title: "Our Father",
  slug: "our-father",
  payload: { prayerText: "Our Father, who art in heaven. Amen." },
  authorityLevel: "VATICAN",
  finalScore: 0.9,
  qaPassed: true,
  hasSourceEvidence: true,
  isDoctrinallySensitive: false,
  confidence: 0.9,
};

describe("runPublishOrchestrator — autonomous publish path (spec §13)", () => {
  it("publishes when every gate passes", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, HEALTHY_INPUT);
    expect(result.kind).toBe("published");
    if (result.kind === "published") {
      expect(result.publishedContentId).toBe("new-published-1");
      expect(result.route).toBe("/prayers/test");
    }
  });

  it("requests cache + sitemap + search refresh after publishing", async () => {
    const prisma = makePrisma();
    await runPublishOrchestrator(prisma, HEALTHY_INPUT);
    const { flagCacheRefresh, flagSitemapRefresh, flagSearchRefresh } =
      await import("@/lib/admin-worker/repair");
    expect(vi.mocked(flagCacheRefresh)).toHaveBeenCalled();
    expect(vi.mocked(flagSitemapRefresh)).toHaveBeenCalled();
    expect(vi.mocked(flagSearchRefresh)).toHaveBeenCalled();
  });

  it("blocks doctrinally sensitive content without a verifier", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY_INPUT,
      isDoctrinallySensitive: true,
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.blockedBy).toBe("verifier");
    }
  });

  it("blocks doctrinally sensitive content when verifier disallows publish", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY_INPUT,
      isDoctrinallySensitive: true,
      verifier: {
        evidence: [],
        hasConflict: false,
        missingRequired: [],
        publishAllowed: false,
        verificationRowIds: [],
        blockingSensitiveFields: ["feastDay"],
        summary: "Feast day mismatch",
      },
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.reason).toMatch(/Feast day/);
    }
  });

  it("publishes doctrinally sensitive content when verifier allows", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY_INPUT,
      isDoctrinallySensitive: true,
      finalScore: 0.97,
      confidence: 0.97,
      verifier: {
        evidence: [],
        hasConflict: false,
        missingRequired: [],
        publishAllowed: true,
        verificationRowIds: ["v1"],
        blockingSensitiveFields: [],
        summary: "All sensitive fields matched.",
      },
    });
    expect(result.kind).toBe("published");
  });

  it("rejects when QA failed", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY_INPUT,
      qaPassed: false,
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.blockedBy).toBe("gate");
    }
  });

  it("returns 'duplicate' when an already-published row exists for (contentType, slug)", async () => {
    const prisma = makePrisma({ existing: { id: "old-1", isPublished: true } });
    const result = await runPublishOrchestrator(prisma, HEALTHY_INPUT);
    expect(result.kind).toBe("duplicate");
    if (result.kind === "duplicate") {
      expect(result.existingId).toBe("old-1");
    }
  });

  it("re-publishes an existing-but-unpublished row instead of failing", async () => {
    const prisma = makePrisma({ existing: { id: "old-1", isPublished: false } });
    const result = await runPublishOrchestrator(prisma, HEALTHY_INPUT);
    expect(result.kind).toBe("published");
    if (result.kind === "published") {
      expect(result.publishedContentId).toBe("old-1");
    }
  });

  it("returns 'review' when score sits between human-review and publish thresholds", async () => {
    const prisma = makePrisma();
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY_INPUT,
      finalScore: 0.65,
      confidence: 0.65,
    });
    expect(result.kind).toBe("review");
  });
});

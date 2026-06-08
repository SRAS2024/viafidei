/**
 * Proves the unified specialist-reviewer panel is wired into the publish gate:
 * when the brain panel returns "block-or-review", the orchestrator routes the
 * item to human review instead of auto-publishing; when it returns "proceed",
 * the publish proceeds. The brain layer is mocked so the gate is exercised
 * deterministically (the real op is covered by the Python phase-4 tests).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({ kind: "cache_failed", attempted: true, succeeded: true })),
  flagSitemapRefresh: vi.fn(async () => ({
    kind: "sitemap_failed",
    attempted: true,
    succeeded: true,
  })),
  flagSearchRefresh: vi.fn(async () => ({
    kind: "search_failed",
    attempted: true,
    succeeded: true,
  })),
}));
vi.mock("@/lib/admin-worker/content-goals", () => ({
  refreshContentGoals: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/logs", () => ({ writeAdminWorkerLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/admin-worker/public-routes", () => ({
  publicRouteFor: vi.fn(() => ({
    tab: "prayers",
    tabPath: "/prayers",
    slugPath: "/prayers/test",
    cacheTags: [],
  })),
}));

// Brain layer: enabled, with controllable specialist-panel output.
const panelState = vi.hoisted(() => ({ decision: "proceed" as string }));
vi.mock("@/lib/admin-worker/intelligence", () => ({
  isBrainEnabled: () => true,
  specialistReviews: vi.fn(async () => ({
    ok: true,
    result: { decision: panelState.decision, blocking_specialists: ["citation"] },
  })),
}));
vi.mock("@/lib/admin-worker/intelligence/service", () => ({
  // Communion screen + dedupe are no-ops here so the specialist gate is isolated.
  screenCommunionRisk: vi.fn(async () => ({
    available: true,
    block: false,
    risk: 0.1,
    verdict: "ok",
    flags: [],
  })),
  checkDuplicate: vi.fn(async () => ({ available: true, isDuplicate: false })),
}));
vi.mock("@/lib/admin-worker/intelligence/store", () => ({
  recordBrainCall: vi.fn(async () => "call-1"),
}));

import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

function makePrisma() {
  return {
    publishedContent: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(async (a: { where: { id: string } }) => ({
        id: a.where.id,
        isPublished: true,
      })),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({
        id: "new-published-1",
        ...a.data,
      })),
    },
    adminWorkerLog: { findFirst: vi.fn(async () => null) },
    contentQualityScore: {
      create: vi.fn(async (a: { data: { finalScore: number } }) => ({
        id: "q-1",
        finalScore: a.data.finalScore,
      })),
    },
    adminWorkerStrictQAResult: {
      findUnique: vi.fn(async () => ({ id: "qa-1", status: "PASSED", finalScore: 0.92 })),
    },
  } as unknown as Parameters<typeof runPublishOrchestrator>[0];
}

const INPUT = {
  contentType: "PRAYER",
  contentId: "checklist-1",
  title: "Our Father",
  slug: "our-father",
  payload: { prayerText: "Our Father, who art in heaven. Amen.", citations: [] },
  authorityLevel: "VATICAN",
  finalScore: 0.9,
  qaPassed: true,
  hasSourceEvidence: true,
  isDoctrinallySensitive: false,
  confidence: 0.9,
};

describe("publish gate — specialist panel wiring", () => {
  it("routes to review when the specialist panel returns block-or-review", async () => {
    panelState.decision = "block-or-review";
    const result = await runPublishOrchestrator(makePrisma(), INPUT);
    expect(result.kind).toBe("review");
    if (result.kind === "review") expect(result.reason).toMatch(/specialist panel/i);
  });

  it("publishes when the specialist panel returns proceed", async () => {
    panelState.decision = "proceed";
    const result = await runPublishOrchestrator(makePrisma(), INPUT);
    expect(result.kind).toBe("published");
  });
});

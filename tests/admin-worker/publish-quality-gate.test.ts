/**
 * Spec §4 + §6: publishing must require a passing ContentQualityScore
 * and refuse any artifact without a passing AdminWorkerStrictQAResult.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSitemapRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSearchRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
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
    slugPath: "/prayers/our-father",
    cacheTags: [],
  })),
}));

import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

function makePrisma(opts: {
  qaStatus?: "PASSED" | "FAILED" | "NEEDS_REPAIR";
  qaMissing?: boolean;
  qaDims?: Partial<{
    completenessScore: number;
    correctnessScore: number;
    formattingScore: number;
    provenanceScore: number;
    validationScore: number;
    duplicateSafetyScore: number;
    publicReadinessScore: number;
  }>;
}) {
  // Real strict-QA rows carry the full dimension set; the full quality
  // model derives the ContentQualityScore from these. Tests drive the
  // gate by lowering a dimension (not by stubbing a returned finalScore,
  // which recordQualityScore now computes itself).
  const dims = {
    completenessScore: 1,
    correctnessScore: 1,
    formattingScore: 1,
    provenanceScore: 1,
    validationScore: 1,
    duplicateSafetyScore: 1,
    publicReadinessScore: 1,
    ...(opts.qaDims ?? {}),
  };
  return {
    publishedContent: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "pub-1" })),
      update: vi.fn(async () => ({ id: "pub-1" })),
    },
    adminWorkerStrictQAResult: {
      findUnique: vi.fn(async () =>
        opts.qaMissing
          ? null
          : {
              id: "qa-1",
              status: opts.qaStatus ?? "PASSED",
              finalScore: opts.qaStatus === "PASSED" ? 0.92 : 0.4,
              blockingReasons: [],
              repairSuggestions: [],
              ...dims,
            },
      ),
    },
    contentQualityScore: {
      create: vi.fn(async () => ({ id: "q-1" })),
    },
  } as unknown as Parameters<typeof runPublishOrchestrator>[0];
}

const HEALTHY = {
  contentType: "PRAYER",
  contentId: "ci-1",
  title: "Our Father",
  slug: "our-father",
  payload: { prayerText: "Our Father, who art in heaven. Amen." },
  authorityLevel: "VATICAN",
  finalScore: 0.92,
  qaPassed: true,
  hasSourceEvidence: true,
  isDoctrinallySensitive: false,
  confidence: 0.92,
};

describe("publish requires a passing strict-QA result (spec §6)", () => {
  it("blocks when strictQAArtifactId is supplied but no row exists", async () => {
    const prisma = makePrisma({ qaMissing: true });
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY,
      strictQAArtifactId: "art-1",
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.blockedBy).toBe("strict-qa");
  });

  it("routes to repair (not review) when strict-QA status is NEEDS_REPAIR (spec §6)", async () => {
    const prisma = makePrisma({ qaStatus: "NEEDS_REPAIR" });
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY,
      strictQAArtifactId: "art-1",
    });
    // Spec §6: needs-repair is a distinct outcome from human review —
    // the package goes to repair first.
    expect(result.kind).toBe("repair");
  });

  it("blocks when strict-QA status is FAILED", async () => {
    const prisma = makePrisma({ qaStatus: "FAILED" });
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY,
      strictQAArtifactId: "art-1",
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.blockedBy).toBe("strict-qa");
  });

  it("publishes when strict-QA status is PASSED and quality score is above threshold", async () => {
    const prisma = makePrisma({ qaStatus: "PASSED" });
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY,
      strictQAArtifactId: "art-1",
    });
    expect(result.kind).toBe("published");
  });
});

describe("publish requires a passing ContentQualityScore (spec §4)", () => {
  it("blocks when the full quality score is missing (no artifact id → not repairable)", async () => {
    // No artifact id → not repairable. When the ContentQualityScore cannot be
    // recorded the full quality score is missing, and publishing must fail
    // closed (spec: publishing must fail if the quality score is missing).
    const prisma = makePrisma({});
    (
      prisma as unknown as { contentQualityScore: { create: ReturnType<typeof vi.fn> } }
    ).contentQualityScore.create.mockRejectedValue(new Error("db unavailable"));
    const result = await runPublishOrchestrator(prisma, { ...HEALTHY });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.blockedBy).toBe("quality-score");
  });

  it("routes to repair when quality is below threshold AND the artifact is repairable (spec §4)", async () => {
    // A repairable artifact whose strict-QA completeness is weak → the
    // full quality score lands below the PRAYER threshold → repair first.
    const prisma = makePrisma({ qaStatus: "PASSED", qaDims: { completenessScore: 0.2 } });
    const result = await runPublishOrchestrator(prisma, {
      ...HEALTHY,
      strictQAArtifactId: "art-1",
    });
    // Spec §4: "Packages below threshold should go to repair first."
    expect(result.kind).toBe("repair");
  });

  it("publishes when ContentQualityScore is at or above threshold", async () => {
    const prisma = makePrisma({});
    const result = await runPublishOrchestrator(prisma, HEALTHY);
    expect(result.kind).toBe("published");
  });
});

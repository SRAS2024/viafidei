/**
 * Spec §5 + §6: publish must derive from stored evidence — not from
 * empty verifier inputs or default quality scores. This proves:
 *
 *   - missing AdminWorkerCrossSourceVerification rows for a sensitive
 *     field route to "repair" (and file VALIDATION_EVIDENCE_MISSING)
 *     instead of "blocked";
 *   - when a strict-QA result exists, ContentQualityScore inputs are
 *     derived from the strict-QA dimensions (not the simplified
 *     fallback inputs).
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
    tab: "saints",
    tabPath: "/saints",
    slugPath: "/saints/test",
    cacheTags: [],
  })),
}));

import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";

function makePrisma(opts: {
  qaRow?: {
    completenessScore: number;
    correctnessScore: number;
    formattingScore: number;
    provenanceScore: number;
    validationScore: number;
    publicReadinessScore: number;
  } | null;
  qualityCapture?: { data: { finalScore: number } } | null;
}) {
  const captured: { qualityScoreInputs: Record<string, unknown> | null } = {
    qualityScoreInputs: null,
  };
  return {
    captured,
    prisma: {
      publishedContent: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "pub-1" })),
        update: vi.fn(async () => ({ id: "pub-1" })),
      },
      contentQualityScore: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          captured.qualityScoreInputs = args.data;
          return { id: "q-1", finalScore: (args.data.finalScore as number) ?? 0.9 };
        }),
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async () =>
          opts.qaRow
            ? {
                id: "qa-1",
                status: "PASSED",
                finalScore: 0.92,
                blockingReasons: [],
                repairSuggestions: [],
                ...opts.qaRow,
              }
            : null,
        ),
      },
      adminWorkerRepairPlan: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "rp-1" })),
      },
    } as unknown as Parameters<typeof runPublishOrchestrator>[0],
  };
}

describe("publish derives ContentQualityScore from strict-QA dimensions (spec §6)", () => {
  it("uses the strict-QA row's dimension scores as quality inputs", async () => {
    const { prisma, captured } = makePrisma({
      qaRow: {
        completenessScore: 0.88,
        correctnessScore: 0.93,
        formattingScore: 0.91,
        provenanceScore: 0.9,
        validationScore: 0.94,
        publicReadinessScore: 0.95,
      },
    });
    const result = await runPublishOrchestrator(prisma, {
      contentType: "PRAYER",
      contentId: "ci-1",
      title: "Our Father",
      slug: "our-father",
      payload: { prayerText: "Amen." } as never,
      authorityLevel: "VATICAN",
      finalScore: 0.92,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: false,
      confidence: 0.92,
      strictQAArtifactId: "art-1",
    });
    expect(result.kind).toBe("published");
    expect(captured.qualityScoreInputs).toMatchObject({
      completenessScore: 0.88,
      correctnessScore: 0.93,
      formattingScore: 0.91,
      sourceEvidenceScore: 0.9, // provenance → sourceEvidence
      validationScore: 0.94,
      renderScore: 0.95, // public readiness → render
    });
  });

  it("falls back to default inputs when no strict-QA artifact id is supplied", async () => {
    // When no strictQAArtifactId is supplied at all (e.g. legacy publish
    // path), the orchestrator skips the strict-QA gate and uses default
    // quality inputs. This proves the fallback path still exists for
    // callers that do not (yet) use the strict-QA pipeline.
    const { prisma, captured } = makePrisma({ qaRow: null });
    const result = await runPublishOrchestrator(prisma, {
      contentType: "PRAYER",
      contentId: "ci-2",
      title: "Hail Mary",
      slug: "hail-mary",
      payload: {} as never,
      authorityLevel: "VATICAN",
      finalScore: 0.9,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: false,
      confidence: 0.9,
      // intentionally no strictQAArtifactId
    });
    expect(result.kind).toBe("published");
    // Default fallback uses 0.8 for formatting (not a strict-QA value).
    expect(captured.qualityScoreInputs).toMatchObject({ formattingScore: 0.8 });
  });

  it("biases sourceEvidence by authority level and validation by verifier evidence strength (spec §6)", async () => {
    const { prisma, captured } = makePrisma({
      qaRow: {
        completenessScore: 1,
        correctnessScore: 1,
        formattingScore: 1,
        provenanceScore: 1,
        validationScore: 1,
        publicReadinessScore: 1,
      },
    });
    await runPublishOrchestrator(prisma, {
      contentType: "PRAYER",
      contentId: "ci-bias",
      title: "Our Father",
      slug: "our-father-bias",
      payload: {} as never,
      // DIOCESAN authority → 0.88 factor on sourceEvidence
      authorityLevel: "DIOCESAN",
      finalScore: 0.92,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: false,
      confidence: 0.92,
      strictQAArtifactId: "art-bias",
    });
    expect((captured.qualityScoreInputs?.sourceEvidenceScore as number).toFixed(2)).toBe("0.88");
  });

  it("blocks when strictQAArtifactId is supplied but no row exists", async () => {
    // Conversely: when a strictQAArtifactId IS supplied but no
    // AdminWorkerStrictQAResult row exists, the orchestrator must
    // refuse to publish (it cannot derive quality inputs from a
    // missing QA result).
    const { prisma } = makePrisma({ qaRow: null });
    const result = await runPublishOrchestrator(prisma, {
      contentType: "PRAYER",
      contentId: "ci-2b",
      title: "Hail Mary",
      slug: "hail-mary-2b",
      payload: {} as never,
      authorityLevel: "VATICAN",
      finalScore: 0.9,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: false,
      confidence: 0.9,
      strictQAArtifactId: "art-missing",
    });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.blockedBy).toBe("strict-qa");
    }
  });
});

describe("publish routes missing validation evidence to repair, not blocked (spec §5)", () => {
  it("returns 'repair' and files VALIDATION_EVIDENCE_MISSING when verifier evidence is missing", async () => {
    const { prisma } = makePrisma({
      qaRow: {
        completenessScore: 1,
        correctnessScore: 0.95,
        formattingScore: 0.9,
        provenanceScore: 0.9,
        validationScore: 0.9,
        publicReadinessScore: 0.95,
      },
    });
    const result = await runPublishOrchestrator(prisma, {
      contentType: "APPARITION",
      contentId: "ci-3",
      title: "Our Lady",
      slug: "our-lady",
      payload: {} as never,
      authorityLevel: "VATICAN",
      finalScore: 0.97,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: true,
      confidence: 0.97,
      strictQAArtifactId: "art-3",
      // Simulate the dispatcher's loadVerifierFromStoredEvidence result
      // when stored evidence is missing for a required validation need.
      verifier: {
        evidence: [],
        hasConflict: false,
        missingRequired: ["approvalStatus"],
        publishAllowed: false,
        verificationRowIds: [],
        blockingSensitiveFields: [],
        summary: "Stored evidence: 1 missing, 0 blocking.",
      },
    });
    expect(result.kind).toBe("repair");
    const create = vi.mocked(
      (prisma as unknown as { adminWorkerRepairPlan: { create: ReturnType<typeof vi.fn> } })
        .adminWorkerRepairPlan.create,
    );
    expect(create).toHaveBeenCalled();
    const plan = create.mock.calls[0][0].data as { kind: string };
    expect(plan.kind).toBe("VALIDATION_EVIDENCE_MISSING");
  });

  it("routes verifier conflict to human review (not blocked)", async () => {
    const { prisma } = makePrisma({
      qaRow: {
        completenessScore: 1,
        correctnessScore: 0.95,
        formattingScore: 0.9,
        provenanceScore: 0.9,
        validationScore: 0.9,
        publicReadinessScore: 0.95,
      },
    });
    const result = await runPublishOrchestrator(prisma, {
      contentType: "APPARITION",
      contentId: "ci-4",
      title: "Our Lady",
      slug: "our-lady-x",
      payload: {} as never,
      authorityLevel: "VATICAN",
      finalScore: 0.97,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: true,
      confidence: 0.97,
      strictQAArtifactId: "art-4",
      verifier: {
        evidence: [],
        hasConflict: true,
        missingRequired: [],
        publishAllowed: false,
        verificationRowIds: ["v-1"],
        blockingSensitiveFields: ["approvalStatus"],
        summary: "Sources conflict on approvalStatus.",
      },
    });
    expect(result.kind).toBe("review");
  });
});

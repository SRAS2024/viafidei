/**
 * Every artifact state has a forward path or a terminal, recorded reason (R2).
 *
 *   - QUALITY_SCORE_FAILED / STRICT_QA_FAILED repairs reset the artifact to
 *     EXTRACTED and reported success, but nothing re-processes an EXTRACTED
 *     artifact whose read already has one: the package stranded with health
 *     reading green. Both scores are deterministic, so the handler now closes
 *     the artifact (REJECTED with a typed reason) and reroutes discovery to
 *     another source — whose read of the same entity can heal it.
 *   - Artifacts the old handler already stranded at EXTRACTED are swept back
 *     to BUILD_READY once, so the corrected gates decide them.
 *   - A strict-QA review-band score parked the artifact with NO reason; it now
 *     records STRICT_QA_REVIEW_BAND and is held (not re-scored weekly).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/memory", () => ({
  rememberFailurePattern: vi.fn(async () => undefined),
  rememberOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "rp" })),
}));
const reroute = vi.fn(async () => ({ succeeded: true }));
vi.mock("@/lib/admin-worker/repair", () => ({
  rerouteToAlternateSource: (...args: unknown[]) => reroute(...(args as [])),
}));

import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";
import { runStrictQA } from "@/lib/admin-worker/dispatcher";
import { STRICT_QA_REVIEW_BAND } from "@/lib/admin-worker/strict-qa";

function scorePlanPrisma(kind: "QUALITY_SCORE_FAILED" | "STRICT_QA_FAILED", status: string) {
  const updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const prisma = {
    adminWorkerRepairPlan: {
      findMany: vi.fn(async () => [
        {
          id: "plan-q",
          kind,
          failedEntity: "art-q",
          repairAction: "Re-extract SAINT/st-x; quality score too low (failed: sourceAuthority).",
          status: "PENDING",
          attempts: 0,
          maxAttempts: 5,
          lastAttemptAt: null,
          nextAttemptAt: null,
          metadata: { contentType: "SAINT", slug: "st-x" },
        },
      ]),
      update: vi.fn(async () => ({})),
    },
    adminWorkerPackageArtifact: {
      findUnique: vi.fn(async () => ({ id: "art-q", contentType: "SAINT", sourceReadId: "sr-q" })),
      updateMany: vi.fn(
        async (arg: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          updates.push(arg);
          const allowed = (arg.where.status as { in: string[] }).in;
          return { count: allowed.includes(status) ? 1 : 0 };
        },
      ),
    },
    adminWorkerSourceRead: {
      findUnique: vi.fn(async () => ({ sourceHost: "www.example-saints.org" })),
    },
  } as unknown as Parameters<typeof runRepairOrchestrator>[0];
  return { prisma, updates };
}

describe("QUALITY_SCORE_FAILED / STRICT_QA_FAILED close the artifact instead of stranding it", () => {
  it("QUALITY_SCORE_FAILED: NEEDS_REPAIR → REJECTED (typed) + discovery rerouted", async () => {
    reroute.mockClear();
    const { prisma, updates } = scorePlanPrisma("QUALITY_SCORE_FAILED", "NEEDS_REPAIR");
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansSucceeded).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe("REJECTED");
    expect(String(updates[0].data.rejectionReason)).toMatch(/^QUALITY_BELOW_THRESHOLD: /);
    // Never the old dead end.
    expect(updates[0].data.status).not.toBe("EXTRACTED");
    expect(reroute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ contentType: "SAINT", failedHost: "www.example-saints.org" }),
    );
  });

  it("STRICT_QA_FAILED carries its own code", async () => {
    const { prisma, updates } = scorePlanPrisma("STRICT_QA_FAILED", "NEEDS_REPAIR");
    await runRepairOrchestrator(prisma);
    expect(String(updates[0].data.rejectionReason)).toMatch(/^STRICT_QA_FAILED: /);
  });

  it("an artifact that already moved on (healed / published) is left alone", async () => {
    reroute.mockClear();
    const { prisma } = scorePlanPrisma("QUALITY_SCORE_FAILED", "CHECKLIST_READY");
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansSucceeded).toBe(1);
    expect(out.results[0].reason).toMatch(/already moved on/);
    expect(reroute).not.toHaveBeenCalled();
  });
});

describe("strict-QA review band records a reason and holds", () => {
  it("parks NEEDS_REVIEW with STRICT_QA_REVIEW_BAND and the score that put it there", async () => {
    const update = vi.fn(async () => ({}));
    const prisma = {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async () => [
          {
            id: "art-band",
            contentType: "APPARITION",
            normalizedTitle: "Our Lady of X",
            normalizedSlug: "our-lady-of-x",
            extractedFields: { apparitionTitle: "Our Lady of X" },
            fieldProvenance: [{ fieldName: "apparitionTitle" }],
            missingFields: [],
            validationNeeds: [],
            formattingMetadata: {},
            // Complete and provenanced, but under the 0.95 doctrinal bar.
            confidenceScore: 0.55,
            status: "BUILD_READY",
            sourceReadId: null,
          },
        ]),
        update,
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: "qa-band" })),
      },
      publishedContent: { count: vi.fn(async () => 0) },
    } as unknown as Parameters<typeof runStrictQA>[0];
    await runStrictQA(prisma, "p1");
    const data = (update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.status).toBe("NEEDS_REVIEW");
    expect(data.gateDiagnosis).toBe(STRICT_QA_REVIEW_BAND);
    expect(String(data.rejectionReason)).toMatch(
      /^STRICT_QA_REVIEW_BAND: finalScore 0\.\d\d below APPARITION threshold/,
    );
  });
});

describe("the drain re-queues artifacts the old quality repair stranded", () => {
  it("sends a QA-passed EXTRACTED artifact with a quality reason back to BUILD_READY", async () => {
    const moved: Array<Record<string, unknown>> = [];
    const prisma = {
      adminWorkerPackageArtifact: {
        findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
          if (where?.status === "EXTRACTED") return [{ id: "art-stranded" }, { id: "art-no-qa" }];
          return [];
        }),
        updateMany: vi.fn(async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
          moved.push({ id: arg.where.id, ...arg.data });
          return { count: 1 };
        }),
        count: vi.fn(async () => 0),
        update: vi.fn(async () => ({})),
      },
      adminWorkerStrictQAResult: {
        findUnique: vi.fn(async ({ where }: { where: { packageArtifactId: string } }) =>
          where.packageArtifactId === "art-stranded" ? { status: "PASSED" } : null,
        ),
      },
      adminWorkerCrossSourceVerification: { groupBy: vi.fn(async () => []) },
      publishedContent: { findMany: vi.fn(async () => []) },
      adminWorkerMemory: { findUnique: vi.fn(async () => null) },
    } as never;
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(prisma, { active: true, driveRounds: 0 });
    expect(r.qualityResetRecovered).toBe(1);
    expect(moved).toEqual([
      { id: "art-stranded", status: "BUILD_READY", rejectionReason: null, gateDiagnosis: null },
    ]);
  });
});

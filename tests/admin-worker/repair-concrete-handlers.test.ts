/**
 * Spec §9: concrete repair handlers must do real work — not just log
 * intent.
 *   - PUBLIC_DISPLAY_FAILED calls verifyPublished() on the live
 *     PublishedContent row.
 *   - VALIDATION_FAILED / VALIDATION_EVIDENCE_MISSING clear the stale
 *     cross-source verification rows for the artifact and reset its
 *     status so the dispatcher re-runs CROSS_SOURCE_VERIFICATION.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSitemapRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  flagSearchRefresh: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  recoverStuckQueue: vi.fn(async () => ({ kind: "ok", attempted: false, succeeded: true })),
  recreateMissingSourceJobs: vi.fn(async () => ({ kind: "ok", attempted: true, succeeded: true })),
  pauseChronicallyFailingSource: vi.fn(async () => ({
    kind: "ok",
    attempted: true,
    succeeded: true,
  })),
}));

vi.mock("@/lib/admin-worker/state", () => ({
  writeHeartbeat: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/memory", () => ({
  rememberFailurePattern: vi.fn(async () => undefined),
  rememberOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/post-publish-probe", () => ({
  verifyPublished: vi.fn(async () => ({
    verificationId: "v-1",
    result: "PASS",
    checks: {},
    publicUrl: "/saints/test",
  })),
}));

import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";

describe("repair-orchestrator concrete handlers (spec §9)", () => {
  it("PUBLIC_DISPLAY_FAILED calls verifyPublished on the live row", async () => {
    const findFirst = vi.fn(async () => ({
      id: "pub-1",
      contentType: "SAINT",
      slug: "st-francis",
      title: "St Francis",
    }));
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "plan-pdf-1",
            kind: "PUBLIC_DISPLAY_FAILED",
            failedEntity: "pub-1",
            repairAction: "verify route",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
            lastAttemptAt: null,
            nextAttemptAt: null,
          },
        ]),
        update: vi.fn(async () => undefined),
      },
      publishedContent: { findFirst },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansSucceeded).toBe(1);
    expect(findFirst).toHaveBeenCalled();
    const { verifyPublished } = await import("@/lib/admin-worker/post-publish-probe");
    expect(vi.mocked(verifyPublished)).toHaveBeenCalled();
  });

  it("PUBLIC_DISPLAY_FAILED fails when no live row matches", async () => {
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "plan-pdf-2",
            kind: "PUBLIC_DISPLAY_FAILED",
            failedEntity: "missing",
            repairAction: "verify route",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
            lastAttemptAt: null,
            nextAttemptAt: null,
          },
        ]),
        update: vi.fn(async () => undefined),
      },
      publishedContent: { findFirst: vi.fn(async () => null) },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansFailed).toBe(1);
    expect(out.results[0].reason).toContain("no live PublishedContent");
  });

  it("VALIDATION_EVIDENCE_MISSING clears stale verification + resets artifact", async () => {
    const deleteMany = vi.fn(async () => ({ count: 3 }));
    const update = vi.fn(async () => undefined);
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "plan-vem-1",
            kind: "VALIDATION_EVIDENCE_MISSING",
            failedEntity: "art-1",
            repairAction: "re-verify",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
            lastAttemptAt: null,
            nextAttemptAt: null,
          },
        ]),
        update: vi.fn(async () => undefined),
      },
      adminWorkerPackageArtifact: {
        findUnique: vi.fn(async () => ({ id: "art-1", status: "PUBLISH_BLOCKED" })),
        update,
      },
      adminWorkerCrossSourceVerification: { deleteMany },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansSucceeded).toBe(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { contentId: "art-1" } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { status: "BUILD_READY" },
    });
  });

  it("VALIDATION_FAILED is also routed through the artifact reset path", async () => {
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    const update = vi.fn(async () => undefined);
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "plan-vf-1",
            kind: "VALIDATION_FAILED",
            failedEntity: "art-2",
            repairAction: "re-verify",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
            lastAttemptAt: null,
            nextAttemptAt: null,
          },
        ]),
        update: vi.fn(async () => undefined),
      },
      adminWorkerPackageArtifact: {
        // already BUILD_READY → reset update should be skipped
        findUnique: vi.fn(async () => ({ id: "art-2", status: "BUILD_READY" })),
        update,
      },
      adminWorkerCrossSourceVerification: { deleteMany },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansSucceeded).toBe(1);
    expect(deleteMany).toHaveBeenCalled();
    // Already BUILD_READY → no status update.
    expect(update).not.toHaveBeenCalled();
  });

  it("VALIDATION_FAILED fails when artifact is missing", async () => {
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "plan-vf-2",
            kind: "VALIDATION_FAILED",
            failedEntity: "art-missing",
            repairAction: "re-verify",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
            lastAttemptAt: null,
            nextAttemptAt: null,
          },
        ]),
        update: vi.fn(async () => undefined),
      },
      adminWorkerPackageArtifact: { findUnique: vi.fn(async () => null) },
      adminWorkerCrossSourceVerification: { deleteMany: vi.fn() },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansFailed).toBe(1);
    expect(out.results[0].reason).toContain("artifact missing");
  });
});

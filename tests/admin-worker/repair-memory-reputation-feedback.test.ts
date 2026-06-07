/**
 * Spec §9: every repair attempt should feed memory; failed repairs
 * with a host as failedEntity should also penalise source reputation.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(async () => ({
    kind: "cache_failed",
    attempted: true,
    succeeded: true,
    reason: "flagged",
  })),
  flagSitemapRefresh: vi.fn(),
  flagSearchRefresh: vi.fn(),
  recoverStuckQueue: vi.fn(),
  pauseChronicallyFailingSource: vi.fn(async () => ({ succeeded: true, reason: "paused" })),
  ensureSourceJobsForGoals: vi.fn(),
  enqueueDiscovery: vi.fn(),
  unlockStaleBuildJobs: vi.fn(),
  retryFailedClassification: vi.fn(),
  retryFailedExtraction: vi.fn(),
  reattemptValidationEvidence: vi.fn(),
  retryFailedFetch: vi.fn(async () => ({ succeeded: false, reason: "host down" })),
  retryFailedRead: vi.fn(),
  retryPublicDisplay: vi.fn(),
  pauseSource: vi.fn(),
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

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(async () => ({
    surfaced: 0,
    rejected: 0,
    hostsSkipped: [],
    strategies: [],
    errors: [],
  })),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";
import { rememberOutcome } from "@/lib/admin-worker/memory";
import { pushReputation } from "@/lib/admin-worker/source-reputation-hooks";

function makePrisma(plans: Array<Record<string, unknown>>) {
  return {
    adminWorkerRepairPlan: {
      findMany: vi.fn(async () => plans),
      update: vi.fn(async () => ({})),
    },
    // Spec §9: CACHE_FAILED handler re-verifies via verifyCacheFreshness
    // which reads the cache_refresh_flagged log row. Return a recent
    // row so the verify passes after a successful flag.
    adminWorkerLog: {
      findFirst: vi.fn(async () => ({
        createdAt: new Date(),
        message: "cache flagged",
        safeMetadata: {},
      })),
    },
    publishedContent: {
      // Cache freshness needs the published row; offline cache-log
      // fallback then confirms freshness so the repair succeeds.
      findFirst: vi.fn(async () => ({ title: "X", payload: {}, contentChecksum: null })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // The orchestrator's leaseNextPlan uses $transaction. Pass back a
      // tx that returns the next plan directly.
      let idx = 0;
      const tx = {
        adminWorkerRepairPlan: {
          findFirst: vi.fn(async () => plans[idx] ?? null),
          update: vi.fn(async () => {
            const p = plans[idx];
            idx += 1;
            return p;
          }),
        },
      };
      return fn(tx);
    }),
  } as unknown as Parameters<typeof runRepairOrchestrator>[0];
}

describe("repair-orchestrator feeds memory + reputation (spec §9)", () => {
  it("records a memory outcome=success on a successful repair", async () => {
    vi.mocked(rememberOutcome).mockClear();
    vi.mocked(pushReputation).mockClear();
    const plan = {
      id: "rp-1",
      kind: "CACHE_FAILED",
      status: "PENDING",
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(Date.now() - 1000),
      failedEntity: "PRAYER:our-father",
      repairAction: "refresh",
      metadata: {},
    };
    const prisma = makePrisma([plan]);
    await runRepairOrchestrator(prisma);
    expect(vi.mocked(rememberOutcome)).toHaveBeenCalled();
    const memoryCall = vi.mocked(rememberOutcome).mock.calls[0][1];
    expect(memoryCall.outcome).toBe("success");
    expect(memoryCall.memoryKey).toContain("CACHE_FAILED");
    // Cache-tag failedEntity is NOT a host — no reputation penalty.
    expect(vi.mocked(pushReputation)).not.toHaveBeenCalled();
  });

  it("records a memory outcome=failure AND penalises reputation when failedEntity is a host", async () => {
    vi.mocked(rememberOutcome).mockClear();
    vi.mocked(pushReputation).mockClear();
    // BUILD_REPEATED_FAILURE returns ok = pauseChronicallyFailingSource.succeeded.
    // Force it to fail so the orchestrator's failure path runs.
    const { pauseChronicallyFailingSource } = await import("@/lib/admin-worker/repair");
    vi.mocked(pauseChronicallyFailingSource).mockResolvedValueOnce({
      succeeded: false,
      reason: "could not pause",
    } as never);
    const plan = {
      id: "rp-2",
      kind: "BUILD_REPEATED_FAILURE",
      status: "PENDING",
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(Date.now() - 1000),
      failedEntity: "broken-source.example",
      repairAction: "pause",
      metadata: {},
    };
    const prisma = makePrisma([plan]);
    await runRepairOrchestrator(prisma);
    expect(vi.mocked(rememberOutcome)).toHaveBeenCalled();
    const memoryCall = vi.mocked(rememberOutcome).mock.calls[0][1];
    expect(memoryCall.outcome).toBe("failure");
    expect(vi.mocked(pushReputation)).toHaveBeenCalledTimes(1);
    const repCall = vi.mocked(pushReputation).mock.calls[0][1];
    expect(repCall.sourceHost).toBe("broken-source.example");
    expect(repCall.stage).toBe("repair");
    expect(repCall.ok).toBe(false);
  });
});

/**
 * Spec §9: "Repeated repair failure should cause fallback source
 * selection." When a repair plan exhausts its retry budget and names
 * a host, the orchestrator pauses that source (so the candidate
 * scorer rotates to a fallback) and records the rotation.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/repair", () => ({
  flagCacheRefresh: vi.fn(),
  flagSitemapRefresh: vi.fn(),
  flagSearchRefresh: vi.fn(),
  recoverStuckQueue: vi.fn(),
  pauseChronicallyFailingSource: vi.fn(async () => ({ succeeded: true, reason: "paused" })),
}));

vi.mock("@/lib/admin-worker/state", () => ({ writeHeartbeat: vi.fn() }));
vi.mock("@/lib/admin-worker/source-reputation", () => ({ recordSourceOutcome: vi.fn() }));
vi.mock("@/lib/admin-worker/memory", () => ({
  rememberFailurePattern: vi.fn(async () => undefined),
  rememberOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";
import { pauseChronicallyFailingSource } from "@/lib/admin-worker/repair";
import { rememberOutcome } from "@/lib/admin-worker/memory";
import { pushReputation } from "@/lib/admin-worker/source-reputation-hooks";

function makePrisma(plans: Array<Record<string, unknown>>) {
  return {
    adminWorkerRepairPlan: {
      findMany: vi.fn(async () => plans),
      update: vi.fn(async () => ({})),
    },
  } as unknown as Parameters<typeof runRepairOrchestrator>[0];
}

describe("repair abandonment triggers fallback source selection (spec §9)", () => {
  it("pauses the host + records rotation when a host plan is abandoned", async () => {
    vi.mocked(pauseChronicallyFailingSource).mockClear();
    vi.mocked(rememberOutcome).mockClear();
    vi.mocked(pushReputation).mockClear();
    const prisma = makePrisma([
      {
        id: "rp-1",
        kind: "FETCH_FAILED",
        status: "PENDING",
        attempts: 5,
        maxAttempts: 5, // exhausted → abandoned
        failedEntity: "broken-source.example",
        repairAction: "retry",
        metadata: {},
      },
    ]);
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansAbandoned).toBe(1);
    expect(vi.mocked(pauseChronicallyFailingSource)).toHaveBeenCalledWith(
      prisma,
      "broken-source.example",
    );
    expect(vi.mocked(rememberOutcome)).toHaveBeenCalled();
    const mem = vi.mocked(rememberOutcome).mock.calls[0][1];
    expect(mem.memoryValue).toMatchObject({ action: "fallback_source_selected" });
    expect(vi.mocked(pushReputation)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ sourceHost: "broken-source.example", stage: "repair", ok: false }),
    );
  });

  it("does NOT trigger fallback selection when the abandoned plan has no host entity", async () => {
    vi.mocked(pauseChronicallyFailingSource).mockClear();
    const prisma = makePrisma([
      {
        id: "rp-2",
        kind: "CACHE_FAILED",
        status: "PENDING",
        attempts: 5,
        maxAttempts: 5,
        failedEntity: "PRAYER:our-father", // cache tag, not a host
        repairAction: "refresh",
        metadata: {},
      },
    ]);
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansAbandoned).toBe(1);
    expect(vi.mocked(pauseChronicallyFailingSource)).not.toHaveBeenCalled();
  });
});

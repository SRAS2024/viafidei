/**
 * Developer Audit includes the live why-no-growth diagnostic
 * (spec §16 + §15). Audit consumers can render the blocker stage
 * + chain walk without opening separate admin pages.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/diagnostics", () => ({
  runAdminWorkerDiagnostics: vi.fn(async () => []),
  summarizeRatings: vi.fn(() => ({ pass: 0, warn: 0, fail: 0 })),
}));

vi.mock("@/lib/admin-worker/passes", () => ({
  listRecentPasses: vi.fn(async () => []),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  listAdminWorkerLogs: vi.fn(async () => []),
}));

vi.mock("@/lib/admin-worker/why-no-growth", () => ({
  diagnoseWhyNoGrowth: vi.fn(async () => ({
    contentType: "PRAYER",
    blocker: "NO_CANDIDATE_URLS",
    blockerExplanation: "No candidate URLs for PRAYER.",
    exactTable: "CandidateSourceUrl",
    exactCount: 0,
    mostRecentFailure: null,
    nextAutomaticRepair: "Run DISCOVERY mission stage.",
    lastWorkerDecision: null,
    nextWorkerDecision: "Run discovery.",
    checks: [
      {
        stage: "NO_CONTENT_GOALS",
        label: "Content goals seeded",
        ok: true,
        count: 11,
        detail: "11 ContentGoal row(s).",
      },
      {
        stage: "NO_CANDIDATE_URLS",
        label: "Candidate URLs",
        ok: false,
        count: 0,
        detail: "0 CandidateSourceUrl row(s).",
      },
    ],
  })),
}));

import { collectDeveloperAuditData } from "@/lib/admin-worker/report-generator";

function makePrisma() {
  return {
    adminWorkerDecision: { findMany: vi.fn(async () => []) },
    adminWorkerPipelineStage: { findMany: vi.fn(async () => []) },
    contentGoal: { findMany: vi.fn(async () => []) },
    adminWorkerGrowthSnapshot: { findMany: vi.fn(async () => []) },
    adminWorkerSourceCoverage: { findMany: vi.fn(async () => []) },
    adminWorkerSourceReputation: { findMany: vi.fn(async () => []) },
    adminWorkerMemory: { findMany: vi.fn(async () => []) },
    adminWorkerRepairPlan: { findMany: vi.fn(async () => []) },
    postPublishVerification: { findMany: vi.fn(async () => []) },
    adminWorkerState: { findUnique: vi.fn(async () => ({ currentBlocker: null })) },
  } as unknown as Parameters<typeof collectDeveloperAuditData>[0];
}

describe("Developer Audit includes whyNoGrowth (spec §16 + §15)", () => {
  it("attaches the live diagnostic snapshot", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_7_DAYS");
    expect(data.whyNoGrowth).toBeTruthy();
    expect(data.whyNoGrowth?.blocker).toBe("NO_CANDIDATE_URLS");
    expect(data.whyNoGrowth?.checks.length).toBeGreaterThan(0);
  });

  it("surfaces the next automatic repair so the audit reader can act on it", async () => {
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_24_HOURS");
    expect(data.whyNoGrowth?.nextAutomaticRepair).toContain("DISCOVERY");
  });

  it("returns null gracefully if the diagnostic throws", async () => {
    const { diagnoseWhyNoGrowth } = await import("@/lib/admin-worker/why-no-growth");
    vi.mocked(diagnoseWhyNoGrowth).mockRejectedValueOnce(new Error("boom"));
    const data = await collectDeveloperAuditData(makePrisma(), "LAST_30_DAYS");
    expect(data.whyNoGrowth).toBeNull();
  });
});

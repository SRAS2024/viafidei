/**
 * Ongoing Repair-orchestrator abandon drivers, fixed so deterministic dead-ends
 * resolve terminally in ONE attempt instead of burning maxAttempts → ABANDONED
 * (the "Repair orchestrator FAIL" rating). Covers:
 *   - DISCOVERY_FAILED: a clean run that surfaced 0 (a saturated type) is normal,
 *     not a failure; only a genuine discovery ERROR is retried.
 *   - CLASSIFY_FAILED: re-classifying the same stored read is deterministic, so
 *     an unusable read resolves terminally (parity with EXTRACT_FAILED).
 *   - VALIDATION_FAILED: an unresolvable artifact target resolves terminally
 *     rather than re-checking a missing id forever.
 */
import { describe, expect, it, vi } from "vitest";

let discoveryResult: { surfaced: number; rejected: number; errors: unknown[] } = {
  surfaced: 0,
  rejected: 0,
  errors: [],
};
let classifyResult: { contentType: string; confidence: number } = {
  contentType: "UNUSABLE",
  confidence: 0.2,
};

vi.mock("@/lib/admin-worker/discovery-orchestrator", () => ({
  runDiscoveryOrchestrator: vi.fn(async () => discoveryResult),
}));
vi.mock("@/lib/admin-worker/classifier", () => ({
  classify: vi.fn(() => classifyResult),
}));
vi.mock("@/lib/admin-worker/memory", () => ({
  rememberFailurePattern: vi.fn(async () => undefined),
  rememberOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";

function makePrisma(
  plan: Record<string, unknown>,
  opts: { read?: Record<string, unknown> | null } = {},
) {
  const planUpdates: Array<{ data: { status?: string } }> = [];
  const artifactUpdates: Array<{ data: { status: string } }> = [];
  const prisma = {
    adminWorkerRepairPlan: {
      findMany: vi.fn(async () => [plan]),
      update: vi.fn(async (arg: { data: { status?: string } }) => {
        planUpdates.push(arg);
        return {};
      }),
    },
    adminWorkerSourceRead: {
      findUnique: vi.fn(async () => opts.read ?? null),
    },
    adminWorkerSourceBlock: { findMany: vi.fn(async () => []) },
    adminWorkerPackageArtifact: {
      findUnique: vi.fn(async () => null),
      updateMany: vi.fn(async (arg: { data: { status: string } }) => {
        artifactUpdates.push(arg);
        return { count: 1 };
      }),
    },
    adminWorkerCrossSourceVerification: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    adminWorkerLog: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
  } as unknown as Parameters<typeof runRepairOrchestrator>[0];
  return { prisma, planUpdates, artifactUpdates };
}

const basePlan = (over: Record<string, unknown>) => ({
  id: "p1",
  repairAction: "x",
  status: "PENDING",
  attempts: 1,
  maxAttempts: 5,
  lastAttemptAt: new Date(),
  nextAttemptAt: null,
  metadata: {},
  ...over,
});

describe("DISCOVERY_FAILED", () => {
  it("resolves terminally (no abandon) when a clean run surfaces 0 for a saturated type", async () => {
    discoveryResult = { surfaced: 0, rejected: 0, errors: [] };
    const { prisma, planUpdates } = makePrisma(
      basePlan({ kind: "DISCOVERY_FAILED", failedEntity: "SAINT" }),
    );
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansAbandoned).toBe(0);
    expect(out.plansSucceeded).toBe(1);
    expect(planUpdates.map((u) => u.data.status)).toContain("SUCCEEDED");
    expect(planUpdates.map((u) => u.data.status)).not.toContain("PENDING");
  });

  it("retries (does not resolve) when discovery genuinely errored", async () => {
    discoveryResult = { surfaced: 0, rejected: 0, errors: ["network down"] };
    const { prisma, planUpdates } = makePrisma(
      basePlan({ kind: "DISCOVERY_FAILED", failedEntity: "SAINT" }),
    );
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansSucceeded).toBe(0);
    expect(out.plansAbandoned).toBe(0); // attempts (1) < max (5) → back to PENDING
    expect(planUpdates.map((u) => u.data.status)).toContain("PENDING");
  });
});

describe("CLASSIFY_FAILED", () => {
  it("resolves terminally (no abandon) when the stored read is deterministically unusable", async () => {
    classifyResult = { contentType: "UNUSABLE", confidence: 0.1 };
    const { prisma, planUpdates, artifactUpdates } = makePrisma(
      basePlan({
        kind: "CLASSIFY_FAILED",
        failedEntity: "shrine.example",
        metadata: { sourceReadId: "read-1" },
      }),
      {
        read: {
          id: "read-1",
          sourceUrl: "https://shrine.example/x",
          sourceHost: "shrine.example",
          extractedTitle: "?",
          extractedText: "garbled",
          extractedHeadings: [],
          detectedContentType: "SAINT",
        },
      },
    );
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansAbandoned).toBe(0);
    expect(out.plansSucceeded).toBe(1);
    expect(planUpdates.map((u) => u.data.status)).toContain("SUCCEEDED");
    // The stuck artifact for this read is terminalized.
    expect(artifactUpdates.some((u) => u.data.status === "REJECTED")).toBe(true);
  });
});

describe("VALIDATION_FAILED", () => {
  it("resolves terminally (no abandon) when the artifact target is unresolvable", async () => {
    // Host-shaped failedEntity so the reconcile sweep leaves it for executePlan,
    // where the missing-artifact branch now closes it terminally.
    const { prisma, planUpdates } = makePrisma(
      basePlan({ kind: "VALIDATION_FAILED", failedEntity: "verify.example" }),
    );
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansAbandoned).toBe(0);
    expect(planUpdates.map((u) => u.data.status)).toContain("SUCCEEDED");
    expect(planUpdates.map((u) => u.data.status)).not.toContain("PENDING");
  });
});

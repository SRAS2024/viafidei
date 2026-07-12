/**
 * EXTRACT_FAILED repair plans must resolve in ONE attempt, never burn maxAttempts
 * toward ABANDONED — the dominant driver of the developer-audit "Repair
 * orchestrator FAIL" rating. Re-extracting the SAME stored read is deterministic:
 * if a required field is missing once it is missing every time, so retrying can
 * only reproduce the gap and abandon. The handler now resolves terminally
 * (ok:true) and drives the stuck artifact to REJECTED so it leaves the funnel.
 */
import { describe, expect, it, vi } from "vitest";

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
// Force the deterministic-incomplete re-extraction path: a package that is
// still missing a required field no matter how many times it is re-extracted.
vi.mock("@/lib/admin-worker/extractors", () => ({
  extractByType: vi.fn(() => ({})),
}));
vi.mock("@/lib/admin-worker/content-builder", () => ({
  buildContentPackage: vi.fn(() => ({
    rejectionReasons: [],
    missingFields: ["feastDay"],
    displayFields: {},
    fieldProvenance: {},
    validationNeeds: [],
    formattingMetadata: {},
    confidenceByPackage: 0.4,
  })),
}));

import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";

interface ArtifactUpdate {
  where: { status: { in: string[] }; OR: Array<Record<string, string>> };
  data: { status: string; rejectionReason?: string };
}

function makePrisma(detectedContentType: string) {
  const planUpdates: Array<{ data: { status?: string } }> = [];
  const artifactUpdates: ArtifactUpdate[] = [];
  const prisma = {
    adminWorkerRepairPlan: {
      findMany: vi.fn(async () => [
        {
          id: "ep1",
          kind: "EXTRACT_FAILED",
          failedEntity: "shrine.example", // a HOST (dispatcher-shaped plan)
          repairAction: "re-extract",
          status: "PENDING",
          attempts: 1, // well below maxAttempts — proves we resolve WITHOUT retrying
          maxAttempts: 5,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          metadata: { sourceReadId: "read-1" },
        },
      ]),
      update: vi.fn(async (arg: { data: { status?: string } }) => {
        planUpdates.push(arg);
        return {};
      }),
    },
    adminWorkerSourceRead: {
      // Only findUnique (no findMany) so the reconcile sweep can't resolve the
      // content type and close the plan before execution — it reaches executePlan.
      findUnique: vi.fn(async () => ({
        id: "read-1",
        sourceUrl: "https://shrine.example/x",
        sourceHost: "shrine.example",
        extractedTitle: "Some Saint",
        extractedText: "…",
        extractedHeadings: [],
        detectedContentType,
      })),
    },
    adminWorkerSourceBlock: { findMany: vi.fn(async () => []) },
    adminWorkerPackageArtifact: {
      updateMany: vi.fn(async (arg: ArtifactUpdate) => {
        artifactUpdates.push(arg);
        return { count: 1 };
      }),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})), findFirst: vi.fn(async () => null) },
  } as unknown as Parameters<typeof runRepairOrchestrator>[0];
  return { prisma, planUpdates, artifactUpdates };
}

describe("EXTRACT_FAILED terminal resolution (Repair orchestrator FAIL fix)", () => {
  it("resolves a deterministically-incomplete extractable read in ONE attempt (no abandon)", async () => {
    const { prisma, planUpdates, artifactUpdates } = makePrisma("SAINT");
    const out = await runRepairOrchestrator(prisma);

    // Resolved terminally, never retried toward abandonment.
    expect(out.plansAbandoned).toBe(0);
    expect(out.plansSucceeded).toBe(1);
    const statuses = planUpdates.map((u) => u.data.status).filter(Boolean);
    expect(statuses).toContain("SUCCEEDED");
    expect(statuses).not.toContain("PENDING"); // not re-queued for another attempt

    // The stuck artifact was driven to terminal REJECTED so it leaves the funnel
    // (host-scoped plans previously left it at EXTRACTED forever).
    expect(artifactUpdates).toHaveLength(1);
    expect(artifactUpdates[0].data.status).toBe("REJECTED");
    expect(artifactUpdates[0].where.status.in).toEqual(
      expect.arrayContaining(["EXTRACTED", "NEEDS_REPAIR"]),
    );
    expect(artifactUpdates[0].where.OR).toEqual(
      expect.arrayContaining([{ sourceReadId: "read-1" }]),
    );
  });

  it("resolves a curated-built type (GUIDE) terminally without web re-extraction", async () => {
    const { prisma, planUpdates, artifactUpdates } = makePrisma("GUIDE");
    const out = await runRepairOrchestrator(prisma);

    expect(out.plansAbandoned).toBe(0);
    expect(out.plansSucceeded).toBe(1);
    expect(planUpdates.map((u) => u.data.status)).toContain("SUCCEEDED");
    // GUIDE short-circuits before re-extraction but still terminalizes the artifact.
    expect(artifactUpdates.some((u) => u.data.status === "REJECTED")).toBe(true);
  });
});

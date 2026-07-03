/**
 * BUILD_READY-drain gate triage. Pins that each stuck-artifact condition maps to
 * the correct blocking gate + routing outcome, so the "15 built, 0 published"
 * stall is explained per-item and each item is routed to a resolution.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { diagnoseArtifactGate, type DrainArtifact } from "@/lib/admin-worker/build-ready-drain";

// The drain drives the real gate handlers; mock them so the bridge test is
// hermetic and asserts only the CHECKLIST_READY → BUILD_READY promotion path.
const runChecklistAndCitationOrchestrator = vi.fn();
vi.mock("@/lib/admin-worker/checklist-citation-orchestrator", () => ({
  runChecklistAndCitationOrchestrator: (...args: unknown[]) =>
    runChecklistAndCitationOrchestrator(...args),
}));
vi.mock("@/lib/admin-worker/dispatcher", () => ({
  runCrossSourceVerification: vi.fn(async () => ({ kind: "idle" })),
  runStrictQA: vi.fn(async () => ({ kind: "idle" })),
  runPersistAndPublish: vi.fn(async () => ({ kind: "idle" })),
}));
vi.mock("@/lib/admin-worker/logs", () => ({ writeAdminWorkerLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/admin-worker/repair-plans", () => ({ filePlan: vi.fn(async () => undefined) }));

function artifact(overrides: Partial<DrainArtifact> = {}): DrainArtifact {
  return {
    id: "a1",
    contentType: "PRAYER",
    normalizedSlug: "test-prayer",
    status: "BUILD_READY",
    missingFields: [],
    validationNeeds: [],
    confidenceScore: 0.9,
    extractedFields: { title: "T", body: "B", sourceUrl: "https://example.org" },
    ...overrides,
  };
}

const ctx = (o: Partial<Parameters<typeof diagnoseArtifactGate>[1]> = {}) => ({
  evidenceCount: 0,
  hasPublishedDuplicate: false,
  confidenceFloor: 0.4,
  ...o,
});

describe("diagnoseArtifactGate", () => {
  it("QA_PASSED → READY_TO_PUBLISH / publish", () => {
    const d = diagnoseArtifactGate(artifact({ status: "QA_PASSED" }), ctx());
    expect(d.gate).toBe("READY_TO_PUBLISH");
    expect(d.outcome).toBe("publish");
  });

  it("published duplicate → DUPLICATE / duplicate (takes priority over QA state)", () => {
    const d = diagnoseArtifactGate(artifact(), ctx({ hasPublishedDuplicate: true }));
    expect(d.gate).toBe("DUPLICATE");
    expect(d.outcome).toBe("duplicate");
  });

  it("missing required fields → MISSING_REQUIRED_FIELDS / repair", () => {
    const d = diagnoseArtifactGate(artifact({ missingFields: ["body"] }), ctx());
    expect(d.gate).toBe("MISSING_REQUIRED_FIELDS");
    expect(d.outcome).toBe("repair");
    expect(d.explanation).toMatch(/body/);
  });

  it("no provenance → MISSING_CITATIONS / repair", () => {
    const d = diagnoseArtifactGate(artifact({ extractedFields: { title: "T", body: "B" } }), ctx());
    expect(d.gate).toBe("MISSING_CITATIONS");
    expect(d.outcome).toBe("repair");
  });

  it("validation needs + no evidence → AWAITING_VERIFICATION / run_verification", () => {
    const d = diagnoseArtifactGate(
      artifact({ validationNeeds: ["feastDay"] }),
      ctx({ evidenceCount: 0 }),
    );
    expect(d.gate).toBe("AWAITING_VERIFICATION");
    expect(d.outcome).toBe("run_verification");
  });

  it("validation needs + evidence gathered but still blocked → VERIFICATION_INCOMPLETE / create_evidence", () => {
    const d = diagnoseArtifactGate(
      artifact({ validationNeeds: ["feastDay"] }),
      ctx({ evidenceCount: 3 }),
    );
    expect(d.gate).toBe("VERIFICATION_INCOMPLETE");
    expect(d.outcome).toBe("create_evidence");
  });

  it("low confidence → LOW_CONFIDENCE / repair", () => {
    const d = diagnoseArtifactGate(
      artifact({ confidenceScore: 0.2 }),
      ctx({ confidenceFloor: 0.4 }),
    );
    expect(d.gate).toBe("LOW_CONFIDENCE");
    expect(d.outcome).toBe("repair");
  });

  it("clean, no blocking gate → AWAITING_QA / run_qa", () => {
    const d = diagnoseArtifactGate(artifact(), ctx());
    expect(d.gate).toBe("AWAITING_QA");
    expect(d.outcome).toBe("run_qa");
  });

  it("VERIFICATION_READY with clean payload → AWAITING_QA / run_qa", () => {
    const d = diagnoseArtifactGate(artifact({ status: "VERIFICATION_READY" }), ctx());
    expect(d.gate).toBe("AWAITING_QA");
    expect(d.outcome).toBe("run_qa");
  });

  it("every outcome is one of the declared routing verbs", () => {
    const outcomes = new Set([
      "publish",
      "run_qa",
      "run_verification",
      "create_evidence",
      "repair",
      "review",
      "duplicate",
      "block",
    ]);
    const cases: DrainArtifact[] = [
      artifact({ status: "QA_PASSED" }),
      artifact({ missingFields: ["x"] }),
      artifact({ validationNeeds: ["y"] }),
      artifact({ confidenceScore: 0 }),
      artifact(),
    ];
    for (const c of cases) {
      expect(outcomes.has(diagnoseArtifactGate(c, ctx()).outcome)).toBe(true);
    }
  });
});

/**
 * The always-on drain must own the CHECKLIST_READY → BUILD_READY bridge, not
 * just BUILD_READY+ artifacts. This is the EXTRACTING_WITHOUT_PUBLISHING fix: a
 * fully-extracted artifact sitting at CHECKLIST_READY (because the brain didn't
 * happen to pick the checklist stage) must still be promoted + driven toward
 * publication by the drain that runs every pass.
 */
describe("runBuildReadyDrain — CHECKLIST_READY bridge", () => {
  beforeEach(() => {
    runChecklistAndCitationOrchestrator.mockReset();
  });

  // Stateful fake prisma: N artifacts at CHECKLIST_READY, none built yet. The
  // bridge mock promotes them (drops the CHECKLIST_READY count to 0), mirroring
  // the real orchestrator's `checklistItemId: null` filter that prevents reloop.
  function fakePrisma(initialChecklistReady: number) {
    let checklistReady = initialChecklistReady;
    const countFor = (where: Record<string, unknown> = {}) => {
      if (where.status === "CHECKLIST_READY") return checklistReady;
      return 0; // no BUILD_READY / VERIFICATION_READY / QA_PASSED work
    };
    runChecklistAndCitationOrchestrator.mockImplementation(async () => {
      const promoted = checklistReady;
      checklistReady = 0;
      return Array.from({ length: promoted }, () => ({ status: "created" as const }));
    });
    return {
      adminWorkerPackageArtifact: {
        findMany: async () => [], // 0 BUILD_READY+ artifacts
        count: async ({ where }: { where?: Record<string, unknown> } = {}) => countFor(where),
        update: async () => undefined,
      },
      adminWorkerCrossSourceVerification: { groupBy: async () => [] },
      publishedContent: { findMany: async () => [] },
    } as never;
  }

  it("bridges CHECKLIST_READY artifacts even with zero BUILD_READY+ backlog", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(fakePrisma(3), { passId: "t", active: true });
    expect(r.ran).toBe(true); // the pre-fix drain returned early (ran=false) here
    expect(r.bridged).toBe(3);
    expect(runChecklistAndCitationOrchestrator).toHaveBeenCalled();
  });

  it("does nothing when neither built nor CHECKLIST_READY artifacts exist", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(fakePrisma(0), { passId: "t", active: true });
    expect(r.ran).toBe(false);
    expect(r.bridged).toBe(0);
    expect(runChecklistAndCitationOrchestrator).not.toHaveBeenCalled();
  });
});

/**
 * BUILD_READY-drain gate triage. Pins that each stuck-artifact condition maps to
 * the correct blocking gate + routing outcome, so the "15 built, 0 published"
 * stall is explained per-item and each item is routed to a resolution.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { diagnoseArtifactGate, type DrainArtifact } from "@/lib/admin-worker/build-ready-drain";
import { runPersistAndPublish } from "@/lib/admin-worker/dispatcher";

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

  it("no provenance anywhere → MISSING_CITATIONS / repair", () => {
    const d = diagnoseArtifactGate(
      artifact({ extractedFields: { title: "T", body: "B" }, fieldProvenance: [] }),
      ctx(),
    );
    expect(d.gate).toBe("MISSING_CITATIONS");
    expect(d.outcome).toBe("repair");
  });

  it("provenance in the fieldProvenance COLUMN counts as citations (the live misdiagnosis fix)", () => {
    // Extraction stores per-field sourcing in fieldProvenance, NOT inside
    // extractedFields (which carries only the display payload). Reading the
    // wrong column misdiagnosed every fully-provenanced artifact as
    // MISSING_CITATIONS → NEEDS_REPAIR → unrepairable plan → abandoned →
    // REJECTED, so nothing ever published.
    const d = diagnoseArtifactGate(
      artifact({
        extractedFields: { title: "T", body: "B" }, // no citations embedded
        fieldProvenance: [
          { fieldName: "body", sourceUrl: "https://vatican.va/x", confidence: 0.9 },
        ],
      }),
      ctx(),
    );
    expect(d.gate).toBe("AWAITING_QA");
    expect(d.outcome).toBe("run_qa");
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

/**
 * Deterministic publish is decoupled from the Python brain: a QA_PASSED artifact
 * must publish even in degraded mode (the fix for the recurring
 * EXTRACTING_WITHOUT_PUBLISHING escalation — build succeeds, nothing publishes).
 * The only carve-out is doctrinally-sensitive content, so the drain passes
 * `allowSensitive = active`.
 */
describe("runBuildReadyDrain — publish is not gated on the brain", () => {
  const mockedPublish = vi.mocked(runPersistAndPublish);
  beforeEach(() => {
    mockedPublish.mockReset();
    mockedPublish.mockResolvedValue({
      stage: "PUBLIC_PUBLISH",
      kind: "advanced",
      published: 1,
    } as never);
  });

  // One QA_PASSED artifact ready to publish; every other stage count is 0.
  function fakePrismaQaPassed() {
    return {
      adminWorkerPackageArtifact: {
        findMany: async () => [
          {
            id: "qa1",
            contentType: "PARISH",
            normalizedSlug: "st-x",
            status: "QA_PASSED",
            missingFields: [],
            validationNeeds: [],
            confidenceScore: 0.9,
            extractedFields: { title: "X", citations: ["https://e.org"] },
          },
        ],
        count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
          where?.status === "QA_PASSED" ? 1 : 0,
        update: async () => undefined,
      },
      adminWorkerCrossSourceVerification: { groupBy: async () => [] },
      publishedContent: { findMany: async () => [] },
    } as never;
  }

  it("publishes QA_PASSED content even when degraded (active=false), sensitive excluded", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(fakePrismaQaPassed(), {
      passId: "t",
      active: false,
      driveRounds: 1,
    });
    expect(mockedPublish).toHaveBeenCalled(); // publish ran despite degraded mode
    expect(r.published).toBeGreaterThanOrEqual(1);
    // 4th arg gates sensitive content on the (absent) brain.
    expect(mockedPublish.mock.calls[0]![3]).toEqual({ allowSensitive: false });
  });

  it("allows sensitive content through when the brain is active", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    await runBuildReadyDrain(fakePrismaQaPassed(), { passId: "t", active: true, driveRounds: 1 });
    expect(mockedPublish.mock.calls[0]![3]).toEqual({ allowSensitive: true });
  });
});

/**
 * The specialist citation gate used to wrongly park fully-provenanced content
 * at NEEDS_REVIEW (0-citation false positive), where nothing recovered it — the
 * "QA-passed but never published" plateau. The drain now recovers those items
 * (PASSED strict-QA + field provenance + the specific citation reason) back to
 * QA_PASSED so the fixed publish path re-publishes them the same pass.
 */
describe("runBuildReadyDrain — recovers citation-misrouted reviews", () => {
  const mockedPublish = vi.mocked(runPersistAndPublish);
  beforeEach(() => {
    mockedPublish.mockReset();
    mockedPublish.mockResolvedValue({
      stage: "PUBLIC_PUBLISH",
      kind: "advanced",
      published: 1,
    } as never);
  });

  // One artifact stranded at NEEDS_REVIEW by the old citation gate. `qaStatus`
  // controls whether it earned a PASSED strict-QA row; `provenance` whether it
  // carries field provenance. Tracks status so the recovery→publish flow is
  // observable through the two findMany call shapes.
  function fakePrismaStranded(opts: { qaStatus: string | null; provenance: boolean }) {
    let status = "NEEDS_REVIEW";
    const fieldProvenance = opts.provenance
      ? [{ field: "prayerText", sourceHost: "vatican.va" }]
      : [];
    return {
      adminWorkerPackageArtifact: {
        findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
          // Recovery query: status === "NEEDS_REVIEW" + citation reason.
          if (where?.status === "NEEDS_REVIEW") {
            return status === "NEEDS_REVIEW"
              ? [
                  {
                    id: "misrouted-1",
                    fieldProvenance,
                    rejectionReason:
                      "specialist panel routed to review (objections: citation, completeness)",
                  },
                ]
              : [];
          }
          // Stuck query: status { in: [...] }.
          const inList = (where?.status as { in?: string[] } | undefined)?.in;
          if (Array.isArray(inList)) {
            return status === "QA_PASSED"
              ? [
                  {
                    id: "misrouted-1",
                    contentType: "PRAYER",
                    normalizedSlug: "our-lady",
                    status,
                    missingFields: [],
                    validationNeeds: [],
                    confidenceScore: 0.9,
                    extractedFields: { prayerText: "…", sourceHost: "vatican.va" },
                    fieldProvenance,
                    sourceReadId: null,
                  },
                ]
              : [];
          }
          return [];
        },
        count: async ({ where }: { where?: Record<string, unknown> } = {}) =>
          where?.status === "QA_PASSED" && status === "QA_PASSED" ? 1 : 0,
        update: async ({ data }: { data?: Record<string, unknown> } = {}) => {
          if (typeof data?.status === "string") status = data.status;
          return undefined;
        },
      },
      adminWorkerStrictQAResult: {
        findUnique: async () => (opts.qaStatus ? { status: opts.qaStatus } : null),
      },
      adminWorkerCrossSourceVerification: { groupBy: async () => [] },
      publishedContent: { findMany: async () => [] },
    } as never;
  }

  it("recovers a QA-passed, provenanced citation-misrouted item and publishes it", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(
      fakePrismaStranded({ qaStatus: "PASSED", provenance: true }),
      {
        passId: "t",
        active: true,
        driveRounds: 1,
      },
    );
    expect(r.recovered).toBe(1);
    expect(mockedPublish).toHaveBeenCalled();
    expect(r.published).toBeGreaterThanOrEqual(1);
  });

  it("does NOT recover an item that never earned a PASSED strict-QA row", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(fakePrismaStranded({ qaStatus: null, provenance: true }), {
      passId: "t",
      active: true,
      driveRounds: 1,
    });
    expect(r.recovered).toBe(0);
  });

  it("does NOT recover an item lacking field provenance (genuinely uncited)", async () => {
    const { runBuildReadyDrain } = await import("@/lib/admin-worker/build-ready-drain");
    const r = await runBuildReadyDrain(
      fakePrismaStranded({ qaStatus: "PASSED", provenance: false }),
      { passId: "t", active: true, driveRounds: 1 },
    );
    expect(r.recovered).toBe(0);
  });
});

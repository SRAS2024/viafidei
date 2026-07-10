/**
 * EXTRACTION duplicate handling — regression for the live pre-publish wedge
 * (developer audit 2026-07-10): artifacts are unique on
 * (contentType, normalizedSlug, packageChecksum) ≈ (type, title), so a second
 * source-read of the SAME entity (mirror URL / re-fetch after a content
 * change) could never create its artifact. The P2002 was silently swallowed,
 * the read never got an artifact, and — as the oldest classified read — it was
 * re-picked on EVERY pass ("Extraction materialised package artifact (?)"
 * every ~15s), wedging the whole extraction stage while nothing published.
 *
 * The fix: detect the duplicate first; CONSUME the redundant read (terminal
 * "DUPLICATE" verdict, so the queue drains past it); HEAL a broken existing
 * artifact in place when the new extraction is complete; and surface any real
 * persistence error loudly instead of faking success.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({ writeAdminWorkerLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/admin-worker/stage-outcomes", () => ({
  recordStageOutcome: vi.fn(async () => undefined),
  toStageOutcome: vi.fn(() => "advanced"),
}));
vi.mock("@/lib/admin-worker/skills", () => ({
  planForDecision: vi.fn(() => ({ executable: true, steps: [] })),
}));
vi.mock("@/lib/admin-worker/memory", () => ({
  recallExtractorMemory: vi.fn(async () => null),
  recordExtractorOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/repair-plans", () => ({ filePlan: vi.fn(async () => ({ id: "rp" })) }));
vi.mock("@/lib/admin-worker/repair", () => ({
  rerouteToAlternateSource: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/schema-integrity", () => ({
  reportQueryError: vi.fn(),
}));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { reportQueryError } from "@/lib/admin-worker/schema-integrity";

// A body the real CHURCH_DOCUMENT extractor turns into a COMPLETE package
// (missing=0) — the production loop URL was exactly this shape.
const BODY = `Populorum Progressio. Encyclical of Pope Paul VI on the development of peoples, 26 March 1967.
On the Development of Peoples. The development of peoples has the Church's close attention, particularly the
development of those peoples who are striving to escape from hunger, misery, endemic diseases and ignorance.
The progressive development of peoples is an object of deep interest and concern to the Church.`;

const READ = {
  id: "read-2",
  sourceUrl: "https://www.vatican.va/holy_father/paul_vi/populorum-mirror.html",
  sourceHost: "www.vatican.va",
  checksum: "chk-2",
  extractedTitle: "Populorum Progressio",
  extractedText: BODY,
  extractedHeadings: ["Populorum Progressio"],
  detectedContentType: "CHURCH_DOCUMENT",
};

function decision() {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "BUILD_CONTENT",
    passType: "CONTENT_GOAL",
    contentType: "CHURCH_DOCUMENT",
    sourceTarget: null,
    expectedResult: "t",
    confidenceScore: 0.9,
    riskScore: 0.1,
    reason: "t",
    fallbackAction: null,
    repairAction: null,
    rulesEvaluated: {},
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: { missionStage: "EXTRACTION", finalScore: 1 },
    rankedAlternatives: [],
    missionStage: "EXTRACTION",
    brainExplanation: "t",
    brainFailure: null,
  } as never;
}

function makePrisma(opts: {
  existing?: { id: string; status: string } | null;
  createError?: { code?: string; message?: string } | null;
}) {
  const artifactUpdate = vi.fn(async (args: unknown) => args);
  const readUpdate = vi.fn(async (args: unknown) => args);
  return {
    prisma: {
      adminWorkerSourceRead: {
        findMany: vi.fn(async () => [READ]),
        update: readUpdate,
      },
      adminWorkerSourceBlock: { findMany: vi.fn(async () => []) },
      candidateSourceUrl: { findFirst: vi.fn(async () => null) },
      adminWorkerPackageArtifact: {
        // No artifact for THIS read id (the poison-loop precondition)…
        findMany: vi.fn(async () => []),
        // …but the unique triple is already owned by another artifact.
        findUnique: vi.fn(async () =>
          opts.existing ? { ...opts.existing, sourceReadId: "read-1", missingFields: [] } : null,
        ),
        create: vi.fn(async () => {
          if (opts.createError)
            throw Object.assign(new Error(opts.createError.message ?? "boom"), opts.createError);
          return { id: "art-new" };
        }),
        update: artifactUpdate,
      },
      adminWorkerLog: { create: vi.fn(async () => ({ id: "l" })) },
    } as never,
    artifactUpdate,
    readUpdate,
  };
}

beforeEach(() => {
  vi.mocked(reportQueryError).mockClear();
});

describe("EXTRACTION duplicate handling (pre-publish wedge fix)", () => {
  it("duplicate of a BROKEN artifact → heals it to CHECKLIST_READY and consumes the read", async () => {
    const { prisma, artifactUpdate, readUpdate } = makePrisma({
      existing: { id: "art-old", status: "NEEDS_REPAIR" },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w",
      passId: "p",
      decision: decision(),
    });
    expect(out.kind).toBe("advanced");
    expect(out.summary).toMatch(/healed artifact art-old/);
    // The redundant read is consumed with the terminal DUPLICATE verdict so it
    // can never wedge the oldest-first queue again.
    expect(readUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "read-2" },
        data: { detectedContentType: "DUPLICATE" },
      }),
    );
    // The broken artifact is healed in place.
    expect(artifactUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-old" },
        data: expect.objectContaining({ status: "CHECKLIST_READY", rejectionReason: null }),
      }),
    );
  });

  it("duplicate of a HEALTHY artifact → read consumed, artifact untouched, truthful 'skipped'", async () => {
    const { prisma, artifactUpdate, readUpdate } = makePrisma({
      existing: { id: "art-live", status: "PUBLISHED" },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w",
      passId: "p",
      decision: decision(),
    });
    expect(out.kind).toBe("skipped");
    expect(out.summary).toMatch(/Duplicate of artifact art-live/);
    expect(readUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { detectedContentType: "DUPLICATE" } }),
    );
    expect(artifactUpdate).not.toHaveBeenCalled();
  });

  it("a REAL persistence failure is loud and reported as failed — never a fake CHECKLIST_READY", async () => {
    const { prisma } = makePrisma({
      existing: null,
      createError: { code: "P2022", message: "column does not exist" },
    });
    const out = await executeMissionStage({
      prisma,
      workerId: "w",
      passId: "p",
      decision: decision(),
    });
    expect(out.kind).toBe("failed");
    expect(out.summary).toMatch(/could not persist/);
    expect(vi.mocked(reportQueryError)).toHaveBeenCalled();
  });

  it("no duplicate → artifact created normally (happy path unchanged)", async () => {
    const { prisma } = makePrisma({ existing: null });
    const out = await executeMissionStage({
      prisma,
      workerId: "w",
      passId: "p",
      decision: decision(),
    });
    expect(out.kind).toBe("advanced");
    expect(out.summary).toMatch(/art-new/);
    expect(out.summary).toMatch(/CHECKLIST_READY/);
  });
});

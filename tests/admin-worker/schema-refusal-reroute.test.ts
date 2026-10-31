/**
 * A schema refusal reroutes discovery only when another source can differ.
 *
 * The extraction stage refuses a package its schema can never accept and
 * reroutes discovery to another source of the type: rerouteToAlternateSource
 * lifts the best unfetched candidate of that type by +1000 on a fetch-priority
 * scale that normally runs 0–1, so SOURCE_FETCH (highest priority first,
 * across all types) reads it next. For five types the gap is the TYPE's — the
 * extractor never reads a field the schema requires (a novena's per-day
 * meditation, a Church document's issuing authority and key themes, a
 * sacrament's theology, the Rosary's and a consecration's own instructions) —
 * so every page of them is refused alike. Each refusal put another page that
 * could only be refused at the head of the global queue, and its refusal
 * boosted the next: a fetch → refuse → boost chain that starved PRAYER and
 * SAINT candidates. These pin, end to end through the real reroute, that a
 * type-wide gap boosts nothing while a page-specific gap still does.
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
vi.mock("@/lib/admin-worker/schema-integrity", () => ({ reportQueryError: vi.fn() }));

import { executeMissionStage } from "@/lib/admin-worker/dispatcher";
import { filePlan } from "@/lib/admin-worker/repair-plans";

// The real CHURCH_DOCUMENT extractor turns this into a COMPLETE package whose
// schema payload is still refused: no extractor reads an issuing authority or
// key themes.
const CHURCH_DOCUMENT_READ = {
  id: "read-doc",
  sourceUrl: "https://www.vatican.va/content/paul-vi/en/encyclicals/populorum.html",
  sourceHost: "www.vatican.va",
  checksum: "chk-doc",
  extractedTitle: "Populorum Progressio",
  extractedText: `Populorum Progressio. Encyclical of Pope Paul VI on the development of peoples, 26 March 1967.
On the Development of Peoples. The development of peoples has the Church's close attention, particularly the
development of those peoples who are striving to escape from hunger, misery, endemic diseases and ignorance.
The progressive development of peoples is an object of deep interest and concern to the Church.`,
  extractedHeadings: ["Populorum Progressio"],
  detectedContentType: "CHURCH_DOCUMENT",
};

// A complete SAINT package whose page title names the saint without an
// honorific, so it states no canonization status: a gap of THIS page —
// another source titled "Saint Francis of Assisi" can fill it.
const SAINT_READ = {
  id: "read-saint",
  sourceUrl: "https://www.example-saints.org/francis-of-assisi",
  sourceHost: "www.example-saints.org",
  checksum: "chk-saint",
  extractedTitle: "Francis of Assisi",
  extractedText:
    "Francis of Assisi was born in 1181 in Assisi, the son of a wealthy cloth merchant, and gave up his inheritance to found the Order of Friars Minor before he died in 1226. His feast day is October 4.",
  extractedHeadings: ["Francis of Assisi"],
  detectedContentType: "SAINT",
};

function decision(contentType: string) {
  return {
    chosenMode: "CONSTANT_FILL",
    chosenPriority: "CONTENT_GOAL",
    chosenTaskType: "BUILD_CONTENT",
    passType: "CONTENT_GOAL",
    contentType,
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

function makePrisma(read: typeof CHURCH_DOCUMENT_READ) {
  const created: Array<Record<string, unknown>> = [];
  const boosted: Array<{ id: string; fetchPriority: number; status: string }> = [];
  const prisma = {
    adminWorkerSourceRead: {
      findMany: vi.fn(async () => [read]),
      update: vi.fn(async () => ({})),
    },
    adminWorkerSourceBlock: { findMany: vi.fn(async () => []) },
    candidateSourceUrl: {
      // The read's own candidate lookup finds nothing; the reroute's lookup
      // finds an unfetched page of the same type on another host.
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) =>
        "predictedContentType" in args.where
          ? {
              id: `alt-${String(args.where.predictedContentType)}`,
              discoveredUrl: "https://alt.example/page",
              sourceHost: "alt.example",
              fetchPriority: 0.6,
            }
          : null,
      ),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: { fetchPriority: number; status: string };
        }) => {
          boosted.push({ id: args.where.id, ...args.data });
          return {};
        },
      ),
    },
    adminWorkerPackageArtifact: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { id: "art-new" };
      }),
      update: vi.fn(async () => ({})),
    },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l" })) },
  } as never;
  return { prisma, created, boosted };
}

beforeEach(() => {
  vi.mocked(filePlan).mockClear();
});

describe("EXTRACTION reroutes discovery only for a page-specific schema gap", () => {
  it("a type-wide gap (CHURCH_DOCUMENT) boosts no other candidate", async () => {
    const { prisma, created, boosted } = makePrisma(CHURCH_DOCUMENT_READ);
    const out = await executeMissionStage({
      prisma,
      workerId: "w",
      passId: "p",
      decision: decision("CHURCH_DOCUMENT"),
    });
    expect(out.kind).toBe("repair-planned");
    expect(created[0].status).toBe("EXTRACTED");
    // The reason says the gap is the type's, not this page's.
    expect(String(created[0].rejectionReason)).toMatch(
      /^SCHEMA_FIELDS_MISSING: CHURCH_DOCUMENT schema refuses this page's fields \(the CHURCH_DOCUMENT extractor never reads issuingAuthority, keyThemes\): /,
    );
    // The artifact still gets its forward path: one re-extraction, then closed.
    expect(vi.mocked(filePlan)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: "EXTRACT_FAILED",
        metadata: expect.objectContaining({ origin: "schema_payload" }),
      }),
    );
    expect(boosted).toEqual([]);
  });

  it("a page-specific gap (a SAINT title with no honorific) still reroutes", async () => {
    const { prisma, created, boosted } = makePrisma(SAINT_READ);
    await executeMissionStage({ prisma, workerId: "w", passId: "p", decision: decision("SAINT") });
    expect(created[0].status).toBe("EXTRACTED");
    expect(String(created[0].rejectionReason)).toMatch(/canonizationStatus/);
    expect(String(created[0].rejectionReason)).not.toMatch(/never reads/);
    expect(boosted).toEqual([{ id: "alt-SAINT", fetchPriority: 1000.6, status: "PRIORITIZED" }]);
  });
});

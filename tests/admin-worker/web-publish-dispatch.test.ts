/**
 * The publish stage builds every web type's schema payload (R1), and the
 * EXTRACT_FAILED repair it files for a refused payload can no longer loop.
 *
 *   - PUBLIC_PUBLISH hands the orchestrator the SAINT schema payload (with the
 *     corroborating page as its second citation), not {saintName, background}.
 *   - A payload with an extraction gap goes to NEEDS_REPAIR with an
 *     EXTRACT_FAILED plan tagged origin "schema_payload".
 *   - That plan's handler heals the artifact only if the re-extracted fields
 *     map. The package was already complete when the payload was refused, so
 *     healing on completeness alone sent it round verify → QA → publish →
 *     refuse → heal forever; now an unmappable artifact is closed terminally.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/repair-plans", () => ({
  filePlan: vi.fn(async () => ({ id: "plan-1" })),
}));
vi.mock("@/lib/admin-worker/source-reputation-hooks", () => ({
  pushReputation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/memory", () => ({
  rememberFailurePattern: vi.fn(async () => undefined),
  rememberOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/publish-orchestrator", () => ({
  runPublishOrchestrator: vi.fn(async () => ({
    kind: "published" as const,
    publishedContentId: "pub-1",
    slug: "st-francis-of-assisi",
    route: "/saints/st-francis-of-assisi",
    reason: "ok",
  })),
}));
const extracted = { fields: {} as Record<string, unknown> };
vi.mock("@/lib/admin-worker/extractors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin-worker/extractors")>()),
  extractByType: vi.fn(() => ({
    fields: extracted.fields,
    missingFields: [],
    confidenceScore: 1,
    sourceEvidence: [
      {
        fieldName: "saintName",
        sourceUrl: "https://www.catholic.org/saints/francis",
        sourceHost: "www.catholic.org",
        snippet: "St. Francis",
        method: "TITLE_REGEX",
        confidence: 0.85,
      },
    ],
    rejectedSections: [],
    formatting: {},
    warnings: [],
    fatalReasons: [],
  })),
}));

import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";
import { runPersistAndPublish } from "@/lib/admin-worker/dispatcher";
import { runPublishOrchestrator } from "@/lib/admin-worker/publish-orchestrator";
import { filePlan } from "@/lib/admin-worker/repair-plans";
import { runRepairOrchestrator } from "@/lib/admin-worker/repair-orchestrator";

const BIO =
  "Francis of Assisi was born in 1181 in Assisi, renounced his inheritance, founded the Friars Minor, and died in 1226 at the Portiuncula.";
const SAINT_FIELDS = {
  saintName: "Saint Francis of Assisi",
  saintType: "saint",
  feastDay: "10-04",
  background: BIO,
};

beforeEach(() => {
  vi.mocked(runPublishOrchestrator).mockClear();
  vi.mocked(filePlan).mockClear();
  vi.mocked(writeAdminWorkerLog).mockClear();
});

function publishPrisma(fields: Record<string, unknown>) {
  const update = vi.fn(async () => ({}));
  const prisma = {
    adminWorkerPackageArtifact: {
      findFirst: vi.fn(async () => ({
        id: "art-saint",
        contentType: "SAINT",
        normalizedTitle: "St. Francis of Assisi",
        normalizedSlug: "st-francis-of-assisi",
        extractedFields: fields,
        fieldProvenance: [{ fieldName: "saintName" }],
        missingFields: [],
        validationNeeds: ["feastDay", "feastMonth", "feastDayNumber"],
        confidenceScore: 0.95,
        status: "QA_PASSED",
        checklistItemId: "ci-1",
        sourceReadId: "sr-1",
      })),
      update,
    },
    adminWorkerSourceRead: {
      findUnique: vi.fn(async () => ({
        sourceHost: "www.catholic.org",
        sourceUrl: "https://www.catholic.org/saints/francis",
      })),
    },
    adminWorkerStrictQAResult: {
      findUnique: vi.fn(async () => ({
        id: "qa-1",
        status: "PASSED",
        finalScore: 0.96,
        blockingReasons: [],
        repairSuggestions: [],
      })),
    },
    adminWorkerCrossSourceVerification: {
      findMany: vi.fn(async () => [
        {
          matchResult: "MATCH",
          validationSourceUrl: "https://www.franciscanmedia.org/saint-of-the-day/francis",
          fieldName: "feastDay",
        },
      ]),
    },
    adminWorkerMemory: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  } as unknown as Parameters<typeof runPersistAndPublish>[0];
  return { prisma, update };
}

describe("PUBLIC_PUBLISH publishes the schema payload", () => {
  it("hands the orchestrator a SAINT payload with two real citations", async () => {
    const { prisma } = publishPrisma(SAINT_FIELDS);
    const out = await runPersistAndPublish(prisma, "w1", "p1");
    expect(out.kind).toBe("advanced");
    const input = vi.mocked(runPublishOrchestrator).mock.calls[0][1];
    expect(input.title).toBe("Saint Francis of Assisi");
    expect(input.slug).toBe("st-francis-of-assisi");
    expect(input.payload).toMatchObject({
      canonicalName: "Saint Francis of Assisi",
      biography: BIO,
      feastMonth: 10,
      feastDayOfMonth: 4,
      canonizationStatus: "canonized",
      citations: [
        "https://www.catholic.org/saints/francis",
        "https://www.franciscanmedia.org/saint-of-the-day/francis",
      ],
    });
    expect(input.payload).not.toHaveProperty("saintName");
  });

  it("an extraction gap goes to NEEDS_REPAIR with a schema_payload EXTRACT_FAILED plan", async () => {
    const { prisma, update } = publishPrisma({ ...SAINT_FIELDS, background: "Too short." });
    const out = await runPersistAndPublish(prisma, "w1", "p1");
    expect(vi.mocked(runPublishOrchestrator)).not.toHaveBeenCalled();
    expect(out.kind).toBe("repair-planned");
    const data = (update.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(data.status).toBe("NEEDS_REPAIR");
    expect(String(data.rejectionReason)).toMatch(/^SCHEMA_FIELDS_MISSING: SAINT schema/);
    expect(vi.mocked(filePlan)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: "EXTRACT_FAILED",
        failedEntity: "art-saint",
        metadata: expect.objectContaining({ origin: "schema_payload", sourceReadId: "sr-1" }),
      }),
    );
    expect(vi.mocked(writeAdminWorkerLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventName: "web_payload_invalid", severity: "WARN" }),
    );
  });
});

describe("EXTRACT_FAILED (origin schema_payload) heals only when the fresh fields map", () => {
  function repairPrisma() {
    const artifactUpdates: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      adminWorkerRepairPlan: {
        findMany: vi.fn(async () => [
          {
            id: "rp-schema",
            kind: "EXTRACT_FAILED",
            failedEntity: "art-saint",
            repairAction: "re-extract",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
            lastAttemptAt: null,
            nextAttemptAt: null,
            metadata: { artifactId: "art-saint", sourceReadId: "sr-1", origin: "schema_payload" },
          },
        ]),
        update: vi.fn(async () => ({})),
      },
      adminWorkerSourceRead: {
        findUnique: vi.fn(async () => ({
          id: "sr-1",
          sourceUrl: "https://www.catholic.org/saints/francis",
          sourceHost: "www.catholic.org",
          extractedTitle: "St. Francis of Assisi",
          extractedText: "…",
          extractedHeadings: [],
          detectedContentType: "SAINT",
        })),
      },
      adminWorkerSourceBlock: { findMany: vi.fn(async () => []) },
      adminWorkerPackageArtifact: {
        findUnique: vi.fn(async () => ({ sourceReadId: "sr-1" })),
        updateMany: vi.fn(async (arg: { data: Record<string, unknown> }) => {
          artifactUpdates.push(arg);
          return { count: 1 };
        }),
      },
    } as unknown as Parameters<typeof runRepairOrchestrator>[0];
    return { prisma, artifactUpdates };
  }

  it("closes an artifact whose re-extracted fields still do not map (no heal loop)", async () => {
    extracted.fields = { ...SAINT_FIELDS, background: "Too short." };
    const { prisma, artifactUpdates } = repairPrisma();
    const out = await runRepairOrchestrator(prisma);
    expect(out.plansSucceeded).toBe(1);
    expect(artifactUpdates).toHaveLength(1);
    expect(artifactUpdates[0].data.status).toBe("REJECTED");
    expect(String(artifactUpdates[0].data.rejectionReason)).toMatch(/SCHEMA_FIELDS_MISSING/);
  });

  it("heals it when the fresh fields map (a citation shortfall is not an extraction gap)", async () => {
    extracted.fields = SAINT_FIELDS;
    const { prisma, artifactUpdates } = repairPrisma();
    await runRepairOrchestrator(prisma);
    expect(artifactUpdates).toHaveLength(1);
    expect(artifactUpdates[0].data.status).toBe("CHECKLIST_READY");
  });
});

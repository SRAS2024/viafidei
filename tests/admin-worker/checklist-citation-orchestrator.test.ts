/**
 * ChecklistAndCitationOrchestrator (user follow-up spec §3 / §9).
 * Confirms package artifacts get materialised into checklist items
 * with citations, and that thin / duplicate / failed cases are
 * handled correctly.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { runChecklistAndCitationOrchestrator } from "@/lib/admin-worker/checklist-citation-orchestrator";

const ARTIFACT_WITH_PROVENANCE = {
  id: "art-1",
  contentType: "PRAYER",
  normalizedTitle: "Our Father",
  normalizedSlug: "our-father",
  packageChecksum: "ck-1",
  extractedFields: { prayerTitle: "Our Father" },
  fieldProvenance: [
    {
      fieldName: "prayerTitle",
      sourceUrl: "https://vatican.va/prayers/our-father",
      sourceHost: "vatican.va",
      confidence: 0.95,
      checksum: "ck-1",
    },
    {
      fieldName: "prayerText",
      sourceUrl: "https://vatican.va/prayers/our-father",
      sourceHost: "vatican.va",
      confidence: 0.9,
      checksum: "ck-1",
    },
  ],
  missingFields: [],
  status: "CHECKLIST_READY",
  checklistItemId: null,
};

function makePrisma(opts: {
  artifacts?: unknown[];
  existing?: { id: string; approvalStatus: string } | null;
  citationsFound?: boolean;
}) {
  return {
    adminWorkerPackageArtifact: {
      findMany: vi.fn(async () => opts.artifacts ?? [ARTIFACT_WITH_PROVENANCE]),
      update: vi.fn(async () => ({})),
    },
    checklistItem: {
      findUnique: vi.fn(async () => opts.existing ?? null),
      create: vi.fn(async () => ({ id: "ci-1" })),
    },
    checklistCitation: {
      findFirst: vi.fn(async () => (opts.citationsFound ? { id: "cit-x" } : null)),
      create: vi.fn(async () => ({ id: "cit-1" })),
    },
  } as unknown as Parameters<typeof runChecklistAndCitationOrchestrator>[0];
}

describe("runChecklistAndCitationOrchestrator (spec §9 follow-on)", () => {
  it("creates a new checklist item when none exists", async () => {
    const prisma = makePrisma({ existing: null });
    const out = await runChecklistAndCitationOrchestrator(prisma);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("created");
    expect(out[0].citationsCreated).toBeGreaterThan(0);
  });

  it("maps a CONSECRATION artifact to the SPIRITUAL_PRACTICE checklist type", async () => {
    // ChecklistItem.contentType is the ChecklistContentType enum (no
    // CONSECRATION / ROSARY value) — the orchestrator must map via
    // toChecklistContentType or the create() fails and the artifact is
    // stranded at CHECKLIST_READY.
    const prisma = makePrisma({
      existing: null,
      artifacts: [
        {
          ...ARTIFACT_WITH_PROVENANCE,
          id: "art-con",
          contentType: "CONSECRATION",
          normalizedSlug: "33-day-consecration",
        },
      ],
    });
    const create = prisma.checklistItem.create as ReturnType<typeof vi.fn>;
    const out = await runChecklistAndCitationOrchestrator(prisma);
    expect(out[0].status).toBe("created");
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data as { contentType: string };
    expect(data.contentType).toBe("SPIRITUAL_PRACTICE");
  });

  it("attaches one citation per provenance entry", async () => {
    const prisma = makePrisma({ existing: null });
    const create = prisma.checklistCitation.create as ReturnType<typeof vi.fn>;
    await runChecklistAndCitationOrchestrator(prisma);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("skips citation creation when one already exists for the same URL", async () => {
    const prisma = makePrisma({ existing: null, citationsFound: true });
    const create = prisma.checklistCitation.create as ReturnType<typeof vi.fn>;
    await runChecklistAndCitationOrchestrator(prisma);
    expect(create).toHaveBeenCalledTimes(0);
  });

  it("returns skipped_insufficient when provenance is empty", async () => {
    const prisma = makePrisma({
      artifacts: [{ ...ARTIFACT_WITH_PROVENANCE, fieldProvenance: [] }],
    });
    const out = await runChecklistAndCitationOrchestrator(prisma);
    expect(out[0].status).toBe("skipped_insufficient");
  });

  it("reuses the existing checklist item when one is already present", async () => {
    const prisma = makePrisma({
      existing: { id: "ci-existing", approvalStatus: "SOURCE_VERIFIED" },
    });
    const create = prisma.checklistItem.create as ReturnType<typeof vi.fn>;
    const out = await runChecklistAndCitationOrchestrator(prisma);
    expect(create).not.toHaveBeenCalled();
    expect(out[0].status).toBe("updated");
    expect(out[0].checklistItemId).toBe("ci-existing");
  });

  it("returns skipped_duplicate when the existing checklist item is already PUBLISHED", async () => {
    const prisma = makePrisma({
      existing: { id: "ci-existing", approvalStatus: "PUBLISHED" },
    });
    const out = await runChecklistAndCitationOrchestrator(prisma);
    expect(out[0].status).toBe("skipped_duplicate");
  });

  it("returns an empty list when no artifacts are CHECKLIST_READY", async () => {
    const prisma = makePrisma({ artifacts: [] });
    const out = await runChecklistAndCitationOrchestrator(prisma);
    expect(out).toEqual([]);
  });

  it("promotes artifact to BUILD_READY after successful materialisation", async () => {
    const prisma = makePrisma({ existing: null });
    const update = prisma.adminWorkerPackageArtifact.update as ReturnType<typeof vi.fn>;
    await runChecklistAndCitationOrchestrator(prisma);
    const buildReadyUpdate = update.mock.calls.find(
      (c) => (c[0] as { data: { status?: string } }).data.status === "BUILD_READY",
    );
    expect(buildReadyUpdate).toBeTruthy();
  });
});

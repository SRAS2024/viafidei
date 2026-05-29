/**
 * Spec §1 follow-up: prove that `readSource()` wires the structured
 * source reader into the active path — parses blocks, persists
 * `AdminWorkerSourceBlock` rows, derives extractor body from blocks
 * (not from `rawBody.slice(0, 20_000)`), and logs block stats.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/source-reads", () => ({
  upsertSourceRead: vi.fn(async () => ({
    id: "sr-1",
    reused: false,
    checksum: "ck-1",
  })),
}));

vi.mock("@/lib/admin-worker/structured-source-reader", () => ({
  parseStructuredBlocks: vi.fn(() => ({
    title: "The Our Father Prayer",
    canonicalUrl: "https://www.vatican.va/prayers/our-father",
    metaDescription: null,
    author: null,
    publisher: null,
    lastUpdated: null,
    mainBodyText: "The Our Father, our Lord's prayer.",
    blocks: [
      {
        blockType: "TITLE",
        blockOrder: 0,
        text: "The Our Father Prayer",
        confidenceScore: 1,
        isRejected: false,
      },
      {
        blockType: "HEADING",
        blockOrder: 1,
        text: "Our Father",
        headingLevel: 1,
        confidenceScore: 0.95,
        isRejected: false,
      },
      {
        blockType: "PRAYER",
        blockOrder: 2,
        text: "Our Father, who art in heaven. Amen.",
        confidenceScore: 0.95,
        isRejected: false,
      },
      {
        blockType: "PARAGRAPH",
        blockOrder: 3,
        text: "This is a well-known Catholic prayer.",
        confidenceScore: 0.85,
        isRejected: false,
      },
    ],
    scriptureReferences: ["Matthew 6:9"],
    rejectedBlocks: [
      {
        blockType: "REJECTED",
        blockOrder: 4,
        text: "Donate now",
        confidenceScore: 0.1,
        isRejected: true,
        rejectionReason: "donation block",
      },
    ],
  })),
  persistStructuredBlocks: vi.fn(async () => ["b-1", "b-2", "b-3", "b-4", "b-5"]),
}));

vi.mock("@/lib/admin-worker/classifier", () => ({
  classify: vi.fn(() => ({
    contentType: "PRAYER",
    confidence: 0.92,
    reasons: ["prayer-block detected"],
  })),
  toChecklistContentType: vi.fn(() => "PRAYER"),
}));

vi.mock("@/lib/admin-worker/extractors", () => ({
  extractByType: vi.fn(() => ({
    fields: { prayerTitle: "Our Father" },
    missingFields: [],
    confidenceScore: 0.9,
    sourceEvidence: [],
    rejectedSections: [],
    formatting: {},
    warnings: [],
    fatalReasons: [],
  })),
}));

vi.mock("@/lib/admin-worker/pipeline-stages", () => ({
  recordStage: vi.fn(async () => ({ id: "stage-1" })),
}));

vi.mock("@/lib/admin-worker/memory", () => ({
  rememberOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { readSource } from "@/lib/admin-worker/source-reader";
import {
  parseStructuredBlocks,
  persistStructuredBlocks,
} from "@/lib/admin-worker/structured-source-reader";
import { extractByType } from "@/lib/admin-worker/extractors";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";

function makePrisma() {
  return {
    adminWorkerSourceRead: { update: vi.fn(async () => ({})) },
  } as unknown as Parameters<typeof readSource>[0];
}

describe("readSource() wires structured-source-reader into the active path (spec §1)", () => {
  it("calls parseStructuredBlocks for every fetched page", async () => {
    vi.mocked(parseStructuredBlocks).mockClear();
    await readSource(makePrisma(), {
      sourceUrl: "https://www.vatican.va/prayers/our-father",
      sourceHost: "www.vatican.va",
      rawBody: "<html><body><h1>Our Father</h1></body></html>",
    });
    expect(vi.mocked(parseStructuredBlocks)).toHaveBeenCalledTimes(1);
  });

  it("persists AdminWorkerSourceBlock rows for new reads", async () => {
    vi.mocked(persistStructuredBlocks).mockClear();
    await readSource(makePrisma(), {
      sourceUrl: "https://www.vatican.va/prayers/our-father",
      sourceHost: "www.vatican.va",
      rawBody: "<html></html>",
    });
    expect(vi.mocked(persistStructuredBlocks)).toHaveBeenCalledTimes(1);
  });

  it("passes structured blocks (not raw body slice) to the extractor", async () => {
    vi.mocked(extractByType).mockClear();
    await readSource(makePrisma(), {
      sourceUrl: "https://www.vatican.va/prayers/our-father",
      sourceHost: "www.vatican.va",
      rawBody: "raw body would have been sliced",
    });
    const call = vi.mocked(extractByType).mock.calls[0];
    expect(call).toBeDefined();
    // The extractor input should include the blocks array.
    const extractorInput = call?.[1];
    expect(Array.isArray(extractorInput?.blocks)).toBe(true);
    expect(extractorInput?.blocks?.some((b) => b.blockType === "PRAYER")).toBe(true);
  });

  it("emits a source_read_complete log with block stats", async () => {
    vi.mocked(writeAdminWorkerLog).mockClear();
    const out = await readSource(makePrisma(), {
      sourceUrl: "https://www.vatican.va/prayers/our-father",
      sourceHost: "www.vatican.va",
      rawBody: "<html></html>",
    });
    expect(out.totalBlocks).toBe(5);
    expect(out.acceptedBlocks).toBe(4);
    expect(out.rejectedBlocks).toBe(1);
    const completeLog = vi
      .mocked(writeAdminWorkerLog)
      .mock.calls.find((c) => c[1]?.eventName === "source_read_complete");
    expect(completeLog).toBeDefined();
    const meta = completeLog?.[1]?.safeMetadata as Record<string, unknown>;
    expect(meta.totalBlocks).toBe(5);
    expect(meta.acceptedBlocks).toBe(4);
    expect(meta.rejectedBlocks).toBe(1);
    expect(meta.contentType).toBe("PRAYER");
  });
});

/**
 * Per-candidate extraction outcome writer (Section 9). Verifies the
 * recorder writes the right DataManagementLog action per outcome
 * kind and that the aggregator reads back the right counts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  recordExtractionOutcome,
  recordExtractionOutcomeBatch,
  getExtractionLegStats,
} from "@/lib/content-qa/extraction-recorder";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.dataManagementLog.create.mockResolvedValue({});
  prismaMock.dataManagementLog.createMany.mockResolvedValue({ count: 0 });
  prismaMock.dataManagementLog.groupBy.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recordExtractionOutcome", () => {
  it("writes EXTRACT_COMPLETE for a complete extraction", async () => {
    await recordExtractionOutcome({
      contentType: "Novena",
      outcome: "extracted_complete",
      sourceHost: "vatican.va",
      candidateRef: "divine-mercy-novena",
    });
    const args = prismaMock.dataManagementLog.create.mock.calls[0][0];
    expect(args.data.action).toBe("EXTRACT_COMPLETE");
    expect(args.data.contentType).toBe("Novena");
    expect(args.data.contentRef).toBe("divine-mercy-novena");
    expect(args.data.reason).toContain("host=vatican.va");
  });

  it("writes EXTRACT_FAILED with the failure reason", async () => {
    await recordExtractionOutcome({
      contentType: "Saint",
      outcome: "failed_extraction",
      failureReason: "could_not_identify_saint_vs_institution",
      sourceHost: "parish.example",
    });
    const args = prismaMock.dataManagementLog.create.mock.calls[0][0];
    expect(args.data.action).toBe("EXTRACT_FAILED");
    expect(args.data.reason).toContain("could_not_identify_saint_vs_institution");
  });

  it("writes EXTRACT_DISCOVERED + EXTRACT_PARTIAL for the other outcomes", async () => {
    await recordExtractionOutcome({ contentType: "Prayer", outcome: "discovered" });
    await recordExtractionOutcome({ contentType: "Prayer", outcome: "extracted_partial" });
    const calls = prismaMock.dataManagementLog.create.mock.calls;
    expect(calls[0][0].data.action).toBe("EXTRACT_DISCOVERED");
    expect(calls[1][0].data.action).toBe("EXTRACT_PARTIAL");
  });

  it("never throws when the write fails", async () => {
    prismaMock.dataManagementLog.create.mockRejectedValue(new Error("db down"));
    await expect(
      recordExtractionOutcome({ contentType: "Prayer", outcome: "discovered" }),
    ).resolves.toBeUndefined();
  });
});

describe("recordExtractionOutcomeBatch", () => {
  it("writes every input through createMany", async () => {
    await recordExtractionOutcomeBatch([
      { contentType: "Prayer", outcome: "extracted_complete" },
      {
        contentType: "Saint",
        outcome: "failed_extraction",
        failureReason: "source_was_event_page",
      },
    ]);
    const args = prismaMock.dataManagementLog.createMany.mock.calls[0][0];
    expect(args.data).toHaveLength(2);
    expect(args.data[0].action).toBe("EXTRACT_COMPLETE");
    expect(args.data[1].action).toBe("EXTRACT_FAILED");
  });

  it("returns silently on empty input", async () => {
    await recordExtractionOutcomeBatch([]);
    expect(prismaMock.dataManagementLog.createMany).not.toHaveBeenCalled();
  });
});

describe("getExtractionLegStats", () => {
  it("rolls up grouped counts into the four buckets", async () => {
    prismaMock.dataManagementLog.groupBy.mockResolvedValueOnce([
      { action: "EXTRACT_DISCOVERED", contentType: "Prayer", _count: { _all: 100 } },
      { action: "EXTRACT_COMPLETE", contentType: "Prayer", _count: { _all: 60 } },
      { action: "EXTRACT_PARTIAL", contentType: "Prayer", _count: { _all: 25 } },
      { action: "EXTRACT_FAILED", contentType: "Prayer", _count: { _all: 15 } },
    ] as unknown as never);
    const stats = await getExtractionLegStats();
    expect(stats.discovered).toBe(100);
    expect(stats.extractedComplete).toBe(60);
    expect(stats.extractedPartial).toBe(25);
    expect(stats.failedExtraction).toBe(15);
    expect(stats.byContentType.Prayer.EXTRACT_COMPLETE).toBe(60);
  });

  it("never throws when the groupBy query fails — returns zeros", async () => {
    prismaMock.dataManagementLog.groupBy.mockRejectedValue(new Error("db down"));
    const stats = await getExtractionLegStats();
    expect(stats.discovered).toBe(0);
    expect(stats.byContentType).toEqual({});
  });
});

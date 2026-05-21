/**
 * Source document summary.
 *
 * Pins section 14: fetched source documents are counted directly
 * from `SourceDocument`, and documents with no build attempt are
 * surfaced (not inferred from `ContentPackageBuildLog`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getSourceDocumentSummary } from "@/lib/data/source-document-summary";

beforeEach(() => {
  resetPrismaMock();
});

describe("getSourceDocumentSummary", () => {
  it("counts source documents directly from the SourceDocument table", async () => {
    prismaMock.sourceDocument.count.mockResolvedValue(12);
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([
      { sourceDocumentId: "d1" },
      { sourceDocumentId: "d2" },
    ]);

    const summary = await getSourceDocumentSummary();

    expect(prismaMock.sourceDocument.count).toHaveBeenCalled();
    expect(summary.sourceDocumentsCreated).toBe(12);
    expect(summary.sourceDocumentsWithBuildAttempts).toBe(2);
    expect(summary.sourceDocumentsWithoutBuildAttempt).toBe(10);
    expect(summary.sourceDocumentsWaitingForBuild).toBe(10);
  });

  it("surfaces a 'build has not started' message when documents have no build attempts", async () => {
    prismaMock.sourceDocument.count.mockResolvedValue(5);
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);

    const summary = await getSourceDocumentSummary();

    expect(summary.sourceDocumentsWithBuildAttempts).toBe(0);
    expect(summary.sourceDocumentsWithoutBuildAttempt).toBe(5);
    expect(summary.summaryMessage).toBe(
      "Source documents exist, but content build has not started.",
    );
  });

  it("surfaces a 'no documents' message when source fetch produced nothing", async () => {
    prismaMock.sourceDocument.count.mockResolvedValue(0);
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);

    const summary = await getSourceDocumentSummary();

    expect(summary.sourceDocumentsCreated).toBe(0);
    expect(summary.summaryMessage).toBe("Source fetch has not produced documents yet.");
  });

  it("records a per-metric error instead of a silent zero when a query fails", async () => {
    prismaMock.sourceDocument.count.mockRejectedValue(new Error("db down"));
    prismaMock.contentPackageBuildLog.groupBy.mockResolvedValue([]);

    const summary = await getSourceDocumentSummary();

    expect(summary.ok).toBe(false);
    expect(summary.sourceDocumentsCreated).toBeNull();
    expect(Object.keys(summary.errors).length).toBeGreaterThan(0);
  });
});

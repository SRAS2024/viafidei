/**
 * Strict queue chain audit log.
 *
 * Each canonical pipeline stage emits a chain event with the URL,
 * sourceDocumentId, and stage-specific metadata. The audit reader
 * can replay the full chain for a single URL so an admin can answer
 * "where did this URL stop?" at a glance.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { recordChainStage, getChainTrace } from "@/lib/ingestion/queue/chain-audit";

beforeEach(() => {
  resetPrismaMock();
});

describe("recordChainStage", () => {
  it("writes a chain.* event with the stage-specific metadata", async () => {
    let capturedEvent: string | undefined;
    let capturedMetadata: Record<string, unknown> | undefined;
    prismaMock.queueAuditLog.create.mockImplementation(
      async ({ data }: { data: { event: string; metadata?: Record<string, unknown> } }) => {
        capturedEvent = data.event;
        capturedMetadata = data.metadata;
        return data;
      },
    );

    await recordChainStage({
      event: "chain.source_fetch_to_build",
      sourceUrl: "https://example.com/page",
      sourceDocumentId: "doc-1",
      metadata: { enqueuedCount: 2 },
    });

    expect(capturedEvent).toBe("chain.source_fetch_to_build");
    expect(capturedMetadata).toMatchObject({
      sourceUrl: "https://example.com/page",
      sourceDocumentId: "doc-1",
      enqueuedCount: 2,
    });
  });
});

describe("getChainTrace", () => {
  it("returns the events for the URL, ordered by createdAt", async () => {
    const now = Date.now();
    prismaMock.queueAuditLog.findMany.mockResolvedValue([
      {
        id: "1",
        event: "chain.source_document_created",
        metadata: { sourceUrl: "https://x.com/a", sourceDocumentId: "doc-a" },
        createdAt: new Date(now - 30_000),
      },
      {
        id: "2",
        event: "chain.source_fetch_to_build",
        metadata: { sourceUrl: "https://x.com/a", sourceDocumentId: "doc-a", enqueuedCount: 1 },
        createdAt: new Date(now - 20_000),
      },
      {
        id: "3",
        event: "chain.persistence_succeeded",
        metadata: { sourceUrl: "https://x.com/a", contentType: "Prayer" },
        createdAt: new Date(now - 10_000),
      },
      {
        id: "4",
        event: "chain.source_document_created",
        metadata: { sourceUrl: "https://x.com/b", sourceDocumentId: "doc-b" },
        createdAt: new Date(now - 5_000),
      },
    ]);

    const trace = await getChainTrace("https://x.com/a");

    expect(trace.sourceDocumentId).toBe("doc-a");
    expect(trace.events).toHaveLength(3);
    expect(trace.events.map((e) => e.event)).toEqual([
      "chain.source_document_created",
      "chain.source_fetch_to_build",
      "chain.persistence_succeeded",
    ]);
    expect(trace.lastStage).toBe("chain.persistence_succeeded");
  });

  it("returns an empty trace when the URL has no chain events", async () => {
    prismaMock.queueAuditLog.findMany.mockResolvedValue([
      {
        id: "1",
        event: "chain.source_document_created",
        metadata: { sourceUrl: "https://other.com/page" },
        createdAt: new Date(),
      },
    ]);

    const trace = await getChainTrace("https://nothing.com/missing");

    expect(trace.events).toEqual([]);
    expect(trace.lastStage).toBeNull();
  });
});

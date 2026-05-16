import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  recordDiscoveredItem,
  markDiscoveredItemStatus,
  leaseDiscoveredItems,
  retryDiscoveredItem,
  getCoverageBySource,
} from "@/lib/data/discovered-items";

beforeEach(() => {
  resetPrismaMock();
});

describe("DiscoveredSourceItem helpers", () => {
  it("recordDiscoveredItem upserts on (sourceId, externalKey)", async () => {
    prismaMock.discoveredSourceItem.upsert.mockResolvedValue({
      id: "d1",
      sourceId: "src1",
      externalKey: "url1",
      adapterKey: "test",
      contentType: "Prayer",
      sourceUrl: "https://example.com/url1",
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
    });
    const id = await recordDiscoveredItem({
      sourceId: "src1",
      adapterKey: "test",
      externalKey: "url1",
      sourceUrl: "https://example.com/url1",
      contentType: "Prayer",
    });
    expect(id).toBe("d1");
    expect(prismaMock.discoveredSourceItem.upsert).toHaveBeenCalled();
  });

  it("markDiscoveredItemStatus updates with processedAt for terminal states", async () => {
    prismaMock.discoveredSourceItem.update.mockResolvedValue({});
    await markDiscoveredItemStatus("d1", "ingested", { contentRef: "prayer-our-father" });
    const call = prismaMock.discoveredSourceItem.update.mock.calls[0][0];
    expect(call.data.status).toBe("ingested");
    expect(call.data.processedAt).toBeInstanceOf(Date);
  });

  it("leaseDiscoveredItems returns pending rows only", async () => {
    prismaMock.discoveredSourceItem.findMany.mockResolvedValue([
      {
        id: "d1",
        externalKey: "k1",
        sourceUrl: null,
        contentType: "Prayer",
        attempts: 0,
        maxAttempts: 5,
        metadata: null,
      },
    ]);
    const items = await leaseDiscoveredItems("src1");
    expect(items).toHaveLength(1);
    const where = prismaMock.discoveredSourceItem.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("pending");
  });

  it("retryDiscoveredItem refuses when attempts ≥ maxAttempts", async () => {
    prismaMock.discoveredSourceItem.findUnique.mockResolvedValue({
      attempts: 5,
      maxAttempts: 5,
    });
    expect(await retryDiscoveredItem("d1")).toBe(false);
  });

  it("retryDiscoveredItem resets status when retries remain", async () => {
    prismaMock.discoveredSourceItem.findUnique.mockResolvedValue({
      attempts: 1,
      maxAttempts: 5,
    });
    prismaMock.discoveredSourceItem.update.mockResolvedValue({});
    expect(await retryDiscoveredItem("d1")).toBe(true);
    expect(prismaMock.discoveredSourceItem.update).toHaveBeenCalled();
  });

  it("getCoverageBySource aggregates by status", async () => {
    prismaMock.discoveredSourceItem.groupBy.mockResolvedValue([
      { status: "ingested", _count: { _all: 10 } },
      { status: "rejected", _count: { _all: 2 } },
      { status: "failed", _count: { _all: 1 } },
    ]);
    const r = await getCoverageBySource("src1");
    expect(r.ingested).toBe(10);
    expect(r.rejected).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.discovered).toBe(13);
  });
});

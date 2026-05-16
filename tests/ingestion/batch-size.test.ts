import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { applyBatchSizeLimit } from "@/lib/ingestion/batch-size";
import type { IngestedItem } from "@/lib/ingestion/types";

beforeEach(() => {
  resetPrismaMock();
});

function fakeItems(n: number): IngestedItem[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: "prayer" as const,
    slug: `prayer-${i}`,
    defaultTitle: `Prayer ${i}`,
    category: "traditional",
    body: "A prayer body that is long enough to pass the minimum validator. ".repeat(2),
  }));
}

describe("batch size enforcement", () => {
  it("truncates the batch when the job has a configured limit", async () => {
    prismaMock.ingestionJob.findUnique.mockResolvedValue({ batchSizeLimit: 50 });
    const items = fakeItems(200);
    const result = await applyBatchSizeLimit("job1", items);
    expect(result.truncated).toBe(true);
    expect(result.cap).toBe(50);
    expect(result.items).toHaveLength(50);
  });

  it("passes the batch through when no limit is set (uses default cap)", async () => {
    prismaMock.ingestionJob.findUnique.mockResolvedValue({ batchSizeLimit: null });
    const items = fakeItems(100);
    const result = await applyBatchSizeLimit("job1", items);
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(100);
  });

  it("passes the batch through when no job is associated", async () => {
    const items = fakeItems(100);
    const result = await applyBatchSizeLimit(null, items);
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(100);
  });

  it("returns the full batch when items below the cap", async () => {
    prismaMock.ingestionJob.findUnique.mockResolvedValue({ batchSizeLimit: 100 });
    const items = fakeItems(25);
    const result = await applyBatchSizeLimit("job1", items);
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(25);
  });

  it("returns empty when items are empty", async () => {
    const result = await applyBatchSizeLimit("job1", []);
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(0);
  });
});

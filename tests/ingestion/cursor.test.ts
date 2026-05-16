import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getCursor, saveCursor, resetCursor } from "@/lib/ingestion/cursor";

beforeEach(() => {
  resetPrismaMock();
});

describe("ingestion cursor", () => {
  it("returns null when no cursor exists for the (adapter, key) pair", async () => {
    prismaMock.ingestionCursor.findUnique.mockResolvedValue(null);
    const result = await getCursor("test-adapter", "page-1");
    expect(result).toBeNull();
  });

  it("upserts when saving a cursor and includes lastFetchedAt", async () => {
    let savedData: Record<string, unknown> | null = null;
    prismaMock.ingestionCursor.upsert.mockImplementation(
      async ({
        create,
        update,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        savedData = create;
        return {
          id: "c1",
          adapterKey: create.adapterKey,
          cursorKey: create.cursorKey,
          sourceId: create.sourceId ?? null,
          contentType: create.contentType ?? null,
          lastPosition: create.lastPosition ?? null,
          lastItemSlug: create.lastItemSlug ?? null,
          lastFetchedAt: create.lastFetchedAt,
          itemsProcessed: create.itemsProcessed ?? 0,
          completed: create.completed ?? false,
          metadata: create.metadata ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    );
    const result = await saveCursor({
      adapterKey: "saints-feed",
      cursorKey: "page-5",
      sourceId: "src1",
      contentType: "Saint",
      lastPosition: "page-5-item-42",
      itemsProcessed: 42,
      metadata: { batchId: "batch-2026-05-16" },
    });
    expect(prismaMock.ingestionCursor.upsert).toHaveBeenCalled();
    expect(savedData).not.toBeNull();
    expect((savedData as Record<string, unknown>).adapterKey).toBe("saints-feed");
    expect((savedData as Record<string, unknown>).cursorKey).toBe("page-5");
    expect(result.lastPosition).toBe("page-5-item-42");
  });

  it("resetCursor removes the row so the next save creates fresh state", async () => {
    prismaMock.ingestionCursor.deleteMany.mockResolvedValue({ count: 1 });
    await resetCursor("saints-feed", "page-5");
    expect(prismaMock.ingestionCursor.deleteMany).toHaveBeenCalledWith({
      where: { adapterKey: "saints-feed", cursorKey: "page-5" },
    });
  });

  it("ingestion remains resumable: a saved cursor is returned on the next getCursor", async () => {
    const savedRow = {
      id: "c1",
      adapterKey: "saints-feed",
      cursorKey: "page-1",
      sourceId: "src1",
      contentType: "Saint",
      lastPosition: "page-1-item-9",
      lastItemSlug: "saint-augustine",
      lastFetchedAt: new Date("2026-05-15T10:00:00Z"),
      itemsProcessed: 9,
      completed: false,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.ingestionCursor.findUnique.mockResolvedValue(savedRow);
    const result = await getCursor("saints-feed", "page-1");
    expect(result).not.toBeNull();
    expect(result?.lastItemSlug).toBe("saint-augustine");
    expect(result?.itemsProcessed).toBe(9);
    expect(result?.completed).toBe(false);
  });
});

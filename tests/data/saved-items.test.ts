/**
 * UserSavedContent — proves the consolidated saved-content data
 * layer respects the publish gate (cannot save unpublished or
 * non-existent content) and the (userId, contentType, contentSlug)
 * unique constraint (duplicate save is a no-op).
 *
 * Replaces the old 5-table UserSavedPrayer/Saint/Apparition/
 * Parish/Devotion tests (those tables were dropped in migration
 * 0025_drop_legacy_system).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { saveItem, unsaveItem, isSaved } from "@/lib/data/saved";

beforeEach(() => {
  resetPrismaMock();
});

describe("saveItem — refuses to save unpublished content", () => {
  it("returns not_found when the slug isn't a published PublishedContent row", async () => {
    prismaMock.publishedContent.findFirst.mockResolvedValue(null);
    const result = await saveItem("prayer", "user-A", "ghost-slug");
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(prismaMock.userSavedContent.create).not.toHaveBeenCalled();
  });

  it("rejects a saint slug that isn't published", async () => {
    prismaMock.publishedContent.findFirst.mockResolvedValue(null);
    expect(await saveItem("saint", "user-A", "ghost")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects an apparition slug that isn't published", async () => {
    prismaMock.publishedContent.findFirst.mockResolvedValue(null);
    expect(await saveItem("apparition", "user-A", "ghost")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects a devotion slug that isn't published", async () => {
    prismaMock.publishedContent.findFirst.mockResolvedValue(null);
    expect(await saveItem("devotion", "user-A", "ghost")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("saveItem — duplicate save protection", () => {
  it("is a no-op when the user already saved the same (type, slug)", async () => {
    prismaMock.publishedContent.findFirst.mockResolvedValue({ id: "pc1" });
    prismaMock.userSavedContent.findUnique.mockResolvedValue({ id: "existing-save" });
    const result = await saveItem("prayer", "user-A", "our-father");
    expect(result).toEqual({ ok: true, created: false });
    expect(prismaMock.userSavedContent.create).not.toHaveBeenCalled();
  });

  it("creates a save when no existing row matches the composite key", async () => {
    prismaMock.publishedContent.findFirst.mockResolvedValue({ id: "pc1" });
    prismaMock.userSavedContent.findUnique.mockResolvedValue(null);
    prismaMock.userSavedContent.create.mockResolvedValue({ id: "new-save" });
    const result = await saveItem("prayer", "user-A", "our-father");
    expect(result).toEqual({ ok: true, created: true });
    expect(prismaMock.userSavedContent.create).toHaveBeenCalledTimes(1);
    const args = prismaMock.userSavedContent.create.mock.calls[0][0] as {
      data: { userId: string; contentType: string; contentSlug: string };
    };
    expect(args.data).toEqual({
      userId: "user-A",
      contentType: "PRAYER",
      contentSlug: "our-father",
    });
  });
});

describe("unsaveItem — only removes the user's own join row", () => {
  it("deletes by (userId, contentType, contentSlug)", async () => {
    prismaMock.userSavedContent.deleteMany.mockResolvedValue({ count: 1 });
    const result = await unsaveItem("saint", "user-A", "teresa");
    expect(result).toEqual({ ok: true, removed: true });
    const args = prismaMock.userSavedContent.deleteMany.mock.calls[0][0] as {
      where: { userId: string; contentType: string; contentSlug: string };
    };
    expect(args.where).toEqual({
      userId: "user-A",
      contentType: "SAINT",
      contentSlug: "teresa",
    });
  });

  it("returns removed=false when no save row existed", async () => {
    prismaMock.userSavedContent.deleteMany.mockResolvedValue({ count: 0 });
    expect(await unsaveItem("prayer", "user-A", "missing")).toEqual({
      ok: true,
      removed: false,
    });
  });
});

describe("isSaved — checks the composite key", () => {
  it("returns true when a matching save exists", async () => {
    prismaMock.userSavedContent.findUnique.mockResolvedValue({ id: "s1" });
    expect(await isSaved("prayer", "user-A", "our-father")).toBe(true);
  });

  it("returns false when no matching save exists", async () => {
    prismaMock.userSavedContent.findUnique.mockResolvedValue(null);
    expect(await isSaved("prayer", "user-A", "ghost")).toBe(false);
  });
});

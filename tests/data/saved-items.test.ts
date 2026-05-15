import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { saveItem, unsaveItem } from "@/lib/data/saved";

beforeEach(() => {
  resetPrismaMock();
});

describe("saveItem — duplicate save protection", () => {
  it("returns not_found when the catalog entity does not exist", async () => {
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    const result = await saveItem("prayer", "user-A", "missing");
    expect(result).toEqual({ ok: false, reason: "not_found" });
    // Critical: must not have attempted to write a save row for a
    // non-existent entity.
    expect(prismaMock.userSavedPrayer.upsert).not.toHaveBeenCalled();
  });

  it("uses upsert on the composite unique key so a second save is a no-op", async () => {
    prismaMock.prayer.findUnique.mockResolvedValue({ id: "p1" });
    prismaMock.userSavedPrayer.upsert.mockResolvedValue({ createdAt: new Date() });
    const result = await saveItem("prayer", "user-A", "p1");
    expect(result.ok).toBe(true);
    expect(prismaMock.userSavedPrayer.upsert).toHaveBeenCalledTimes(1);
    const args = prismaMock.userSavedPrayer.upsert.mock.calls[0][0] as {
      where: { userId_prayerId: { userId: string; prayerId: string } };
    };
    // The composite unique key is what prevents duplicate rows — the database
    // refuses to insert a second row with the same (userId, prayerId).
    expect(args.where.userId_prayerId).toEqual({ userId: "user-A", prayerId: "p1" });
  });

  it("rejects a save against an unknown saint without writing", async () => {
    prismaMock.saint.findUnique.mockResolvedValue(null);
    expect(await saveItem("saint", "user-A", "ghost")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(prismaMock.userSavedSaint.upsert).not.toHaveBeenCalled();
  });

  it("rejects a save against an unknown apparition without writing", async () => {
    prismaMock.marianApparition.findUnique.mockResolvedValue(null);
    expect(await saveItem("apparition", "user-A", "ghost")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(prismaMock.userSavedApparition.upsert).not.toHaveBeenCalled();
  });

  it("rejects a save against an unknown parish without writing", async () => {
    prismaMock.parish.findUnique.mockResolvedValue(null);
    expect(await saveItem("parish", "user-A", "ghost")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(prismaMock.userSavedParish.upsert).not.toHaveBeenCalled();
  });

  it("rejects a save against an unknown devotion without writing", async () => {
    prismaMock.devotion.findUnique.mockResolvedValue(null);
    expect(await saveItem("devotion", "user-A", "ghost")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(prismaMock.userSavedDevotion.upsert).not.toHaveBeenCalled();
  });
});

describe("unsaveItem — only deletes join rows, never the catalog content", () => {
  it("deletes from the prayer join table only, scoped to (userId, prayerId)", async () => {
    prismaMock.userSavedPrayer.deleteMany.mockResolvedValue({ count: 1 });
    const result = await unsaveItem("prayer", "user-A", "p1");
    expect(result).toEqual({ ok: true, removed: true });
    // CRITICAL: deleteMany targets the JOIN table, not the catalog table.
    // The catalog prayer table must never be touched by an unsave.
    expect(prismaMock.userSavedPrayer.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-A", prayerId: "p1" },
    });
    expect(prismaMock.prayer.delete).not.toHaveBeenCalled();
    expect(prismaMock.prayer.deleteMany).not.toHaveBeenCalled();
  });

  it("returns removed=false when the user had not actually saved the item", async () => {
    prismaMock.userSavedPrayer.deleteMany.mockResolvedValue({ count: 0 });
    expect(await unsaveItem("prayer", "user-A", "p1")).toEqual({ ok: true, removed: false });
  });

  it("never touches the catalog saint table when unsaving a saint", async () => {
    prismaMock.userSavedSaint.deleteMany.mockResolvedValue({ count: 1 });
    await unsaveItem("saint", "user-A", "s1");
    expect(prismaMock.userSavedSaint.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.saint.delete).not.toHaveBeenCalled();
    expect(prismaMock.saint.deleteMany).not.toHaveBeenCalled();
  });

  it("never touches the catalog parish table when unsaving a parish", async () => {
    prismaMock.userSavedParish.deleteMany.mockResolvedValue({ count: 1 });
    await unsaveItem("parish", "user-A", "p1");
    expect(prismaMock.userSavedParish.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.parish.delete).not.toHaveBeenCalled();
    expect(prismaMock.parish.deleteMany).not.toHaveBeenCalled();
  });
});

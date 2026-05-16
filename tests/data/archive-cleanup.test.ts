import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  purgeArchivedByArchivedAt,
  markArchived,
  countCurrentlyArchived,
} from "@/lib/data/archive-cleanup";

beforeEach(() => {
  resetPrismaMock();
});

describe("archive cleanup — archivedAt based purge", () => {
  it("does nothing when retention days is zero or negative", async () => {
    const result = await purgeArchivedByArchivedAt(0);
    expect(result.totalDeleted).toBe(0);
    expect(prismaMock.prayer.deleteMany).not.toHaveBeenCalled();
  });

  it("uses the archivedAt column (not updatedAt) for cutoff math", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([]);
    prismaMock.prayer.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.saint.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.marianApparition.findMany.mockResolvedValue([]);
    prismaMock.marianApparition.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.devotion.findMany.mockResolvedValue([]);
    prismaMock.devotion.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.liturgyEntry.findMany.mockResolvedValue([]);
    prismaMock.liturgyEntry.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([]);
    prismaMock.spiritualLifeGuide.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.parish.findMany.mockResolvedValue([]);
    prismaMock.parish.deleteMany.mockResolvedValue({ count: 0 });

    await purgeArchivedByArchivedAt(30);
    // Every call should filter on archivedAt < cutoff.
    const prayerCall = prismaMock.prayer.findMany.mock.calls[0][0];
    expect(prayerCall.where.status).toBe("ARCHIVED");
    expect(prayerCall.where.archivedAt).toBeDefined();
    expect(prayerCall.where.archivedAt.lt).toBeInstanceOf(Date);
  });

  it("writes an ArchiveDeletionLog row per deleted item", async () => {
    const archivedAt = new Date("2026-03-01T00:00:00Z");
    prismaMock.prayer.findMany.mockResolvedValue([
      { id: "p1", slug: "old-prayer", archivedAt },
      { id: "p2", slug: "older-prayer", archivedAt },
    ]);
    prismaMock.prayer.deleteMany.mockResolvedValue({ count: 2 });
    // Stub everything else to empty.
    for (const m of [
      "saint",
      "marianApparition",
      "devotion",
      "liturgyEntry",
      "spiritualLifeGuide",
      "parish",
    ] as const) {
      prismaMock[m].findMany.mockResolvedValue([]);
      prismaMock[m].deleteMany.mockResolvedValue({ count: 0 });
    }
    const result = await purgeArchivedByArchivedAt(30);
    expect(result.totalDeleted).toBeGreaterThanOrEqual(2);
    expect(prismaMock.archiveDeletionLog.createMany).toHaveBeenCalled();
    const call = prismaMock.archiveDeletionLog.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    expect(call.data[0].contentType).toBe("Prayer");
    expect(call.data[0].archivedAt).toEqual(archivedAt);
  });

  it("markArchived sets both status and archivedAt", async () => {
    prismaMock.prayer.update.mockResolvedValue({ id: "p1" });
    await markArchived("Prayer", "p1", "looked like junk");
    const call = prismaMock.prayer.update.mock.calls[0][0];
    expect(call.data.status).toBe("ARCHIVED");
    expect(call.data.archivedAt).toBeInstanceOf(Date);
  });

  it("countCurrentlyArchived returns a map keyed by content type", async () => {
    prismaMock.prayer.count.mockResolvedValue(2);
    prismaMock.saint.count.mockResolvedValue(3);
    prismaMock.marianApparition.count.mockResolvedValue(0);
    prismaMock.devotion.count.mockResolvedValue(1);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(7);
    const result = await countCurrentlyArchived();
    expect(result.Prayer).toBe(2);
    expect(result.Saint).toBe(3);
    expect(result.Parish).toBe(7);
  });
});

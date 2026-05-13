import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listPendingPublishItems, publishAllPending } from "@/lib/data/publish-list";

beforeEach(() => {
  resetPrismaMock();
  // Default empty arrays so findMany returns nothing for unset tables.
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.parish,
    prismaMock.devotion,
    prismaMock.liturgyEntry,
    prismaMock.spiritualLifeGuide,
  ]) {
    m.findMany.mockResolvedValue([]);
    m.updateMany.mockResolvedValue({ count: 0 });
  }
});

describe("listPendingPublishItems", () => {
  it("returns an empty array when nothing is pending", async () => {
    expect(await listPendingPublishItems()).toEqual([]);
  });

  it("queries only DRAFT and REVIEW rows from every content table", async () => {
    await listPendingPublishItems();
    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      const args = m.findMany.mock.calls[0][0];
      expect(args.where.status.in).toEqual(["DRAFT", "REVIEW"]);
    }
  });

  it("joins rows across kinds, sorts newest-first, and stamps the public page URL", async () => {
    const olderUpdate = new Date("2026-05-01T00:00:00Z");
    const newerUpdate = new Date("2026-05-10T00:00:00Z");
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p1",
        slug: "anima-christi",
        defaultTitle: "Anima Christi",
        status: "DRAFT",
        createdAt: olderUpdate,
        updatedAt: olderUpdate,
      },
    ]);
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "s1",
        slug: "francis-of-assisi",
        canonicalName: "Saint Francis of Assisi",
        status: "REVIEW",
        createdAt: newerUpdate,
        updatedAt: newerUpdate,
      },
    ]);

    const rows = await listPendingPublishItems();
    expect(rows).toHaveLength(2);
    // Newer (saint) first.
    expect(rows[0].entityType).toBe("Saint");
    expect(rows[0].page).toBe("/saints/francis-of-assisi");
    expect(rows[1].entityType).toBe("Prayer");
    expect(rows[1].page).toBe("/prayers/anima-christi");
  });
});

describe("publishAllPending", () => {
  it("issues exactly one updateMany per content table, with status=PUBLISHED", async () => {
    await publishAllPending();
    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      expect(m.updateMany).toHaveBeenCalledTimes(1);
      const args = m.updateMany.mock.calls[0][0];
      expect(args.where.status.in).toEqual(["DRAFT", "REVIEW"]);
      expect(args.data.status).toBe("PUBLISHED");
    }
  });

  it("returns the per-table promotion counts", async () => {
    prismaMock.prayer.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.saint.updateMany.mockResolvedValue({ count: 7 });
    prismaMock.parish.updateMany.mockResolvedValue({ count: 11 });

    const result = await publishAllPending();
    expect(result.prayers).toBe(3);
    expect(result.saints).toBe(7);
    expect(result.parishes).toBe(11);
  });

  it("never touches PUBLISHED or ARCHIVED rows", async () => {
    await publishAllPending();
    for (const m of [prismaMock.prayer, prismaMock.saint, prismaMock.parish]) {
      const args = m.updateMany.mock.calls[0][0];
      expect(args.where.status.in).toEqual(["DRAFT", "REVIEW"]);
      expect(args.where.status.in).not.toContain("PUBLISHED");
      expect(args.where.status.in).not.toContain("ARCHIVED");
    }
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { promoteIngestedOrphans } from "@/lib/startup/promote-ingested";

beforeEach(() => {
  resetPrismaMock();
  // Default: zero rows affected per model.
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.parish,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.liturgyEntry,
    prismaMock.spiritualLifeGuide,
  ]) {
    m.updateMany.mockResolvedValue({ count: 0 });
  }
});

describe("promoteIngestedOrphans", () => {
  it("targets only REVIEW rows that came from ingestion (externalSourceKey set)", async () => {
    await promoteIngestedOrphans();

    for (const m of [
      prismaMock.prayer,
      prismaMock.saint,
      prismaMock.parish,
      prismaMock.marianApparition,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      expect(m.updateMany).toHaveBeenCalledTimes(1);
      const args = m.updateMany.mock.calls[0][0];
      expect(args).toEqual({
        where: { status: "REVIEW", externalSourceKey: { not: null } },
        data: { status: "PUBLISHED" },
      });
    }
  });

  it("sums the rows promoted across every content table", async () => {
    prismaMock.prayer.updateMany.mockResolvedValue({ count: 12 });
    prismaMock.saint.updateMany.mockResolvedValue({ count: 7 });
    prismaMock.parish.updateMany.mockResolvedValue({ count: 53 });
    prismaMock.marianApparition.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.devotion.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.liturgyEntry.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.spiritualLifeGuide.updateMany.mockResolvedValue({ count: 4 });

    const result = await promoteIngestedOrphans();
    expect(result).toEqual({
      prayers: 12,
      saints: 7,
      parishes: 53,
      apparitions: 1,
      devotions: 2,
      liturgyEntries: 3,
      guides: 4,
    });
  });

  it("never touches DRAFT or ARCHIVED rows — those are intentional admin state", async () => {
    await promoteIngestedOrphans();
    for (const m of [prismaMock.prayer, prismaMock.saint, prismaMock.parish]) {
      const args = m.updateMany.mock.calls[0][0];
      expect(args.where.status).toBe("REVIEW");
    }
  });

  it("returns zeros when one table errors instead of aborting the migration", async () => {
    prismaMock.parish.updateMany.mockRejectedValue(new Error("connection reset"));
    prismaMock.prayer.updateMany.mockResolvedValue({ count: 5 });

    const result = await promoteIngestedOrphans();
    expect(result.parishes).toBe(0);
    expect(result.prayers).toBe(5);
  });
});

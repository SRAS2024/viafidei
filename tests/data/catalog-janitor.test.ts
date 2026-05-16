import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runCatalogJanitor } from "@/lib/data/catalog-janitor";

beforeEach(() => {
  resetPrismaMock();
});

describe("runCatalogJanitor", () => {
  it("hard-deletes a prayer whose title is a brand landing page", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-bad",
        slug: "catholic-prayers-ewtn",
        defaultTitle: "Catholic Prayers - Prayer to Jesus, Marian, & More | EWTN",
        body: "Devotions Devotions are manifestations of our profound love of God, rooted in worship and service.",
        category: "Marian",
        externalSourceKey: "https://www.ewtn.com/prayers",
      },
    ]);
    prismaMock.prayer.delete.mockResolvedValue({});
    // every other table empty
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.marianApparition.findMany.mockResolvedValue([]);
    prismaMock.devotion.findMany.mockResolvedValue([]);
    prismaMock.liturgyEntry.findMany.mockResolvedValue([]);
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([]);

    const result = await runCatalogJanitor();

    expect(prismaMock.prayer.delete).toHaveBeenCalledWith({ where: { id: "p-bad" } });
    expect(result.totalHardDeleted).toBe(1);
    // The DataManagementLog batch should contain a DELETE row for this prayer.
    const logCall = prismaMock.dataManagementLog.createMany.mock.calls[0]?.[0]?.data as Array<{
      action: string;
      contentRef: string;
    }>;
    expect(logCall).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "DELETE",
          contentRef: "catholic-prayers-ewtn",
        }),
      ]),
    );
  });

  it("repackages a prayer whose title has a brand suffix", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-clean",
        slug: "hail-mary",
        defaultTitle: "Hail Mary | USCCB",
        body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
        category: "Marian",
        externalSourceKey: "https://www.usccb.org/prayers/hail-mary",
      },
    ]);
    prismaMock.prayer.update.mockResolvedValue({});
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.marianApparition.findMany.mockResolvedValue([]);
    prismaMock.devotion.findMany.mockResolvedValue([]);
    prismaMock.liturgyEntry.findMany.mockResolvedValue([]);
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([]);

    const result = await runCatalogJanitor();

    expect(prismaMock.prayer.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.prayer.update.mock.calls[0][0] as {
      where: { id: string };
      data: { defaultTitle: string };
    };
    expect(updateCall.where.id).toBe("p-clean");
    expect(updateCall.data.defaultTitle).toBe("Hail Mary");
    expect(result.totalRepackaged).toBe(1);
    expect(result.totalHardDeleted).toBe(0);
  });

  it("leaves an already-clean prayer untouched", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-clean",
        slug: "hail-mary",
        defaultTitle: "Hail Mary",
        body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
        category: "Marian",
        externalSourceKey: "https://www.usccb.org/prayers/hail-mary",
      },
    ]);
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.marianApparition.findMany.mockResolvedValue([]);
    prismaMock.devotion.findMany.mockResolvedValue([]);
    prismaMock.liturgyEntry.findMany.mockResolvedValue([]);
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([]);

    const result = await runCatalogJanitor();

    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
    expect(prismaMock.prayer.delete).not.toHaveBeenCalled();
    expect(result.totalRepackaged).toBe(0);
    expect(result.totalHardDeleted).toBe(0);
  });

  it("diverts a soft-fail prayer (no prayer-language markers) to REVIEW", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p-soft",
        slug: "weak-prayer",
        defaultTitle: "A short blessing",
        body: "May the holy ones bless this day with all the goodness of heaven and earth, granting hope to every traveler on their road of life.",
        category: "Devotional",
        externalSourceKey: "https://www.usccb.org/prayers/weak",
      },
    ]);
    prismaMock.prayer.update.mockResolvedValue({});
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.marianApparition.findMany.mockResolvedValue([]);
    prismaMock.devotion.findMany.mockResolvedValue([]);
    prismaMock.liturgyEntry.findMany.mockResolvedValue([]);
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([]);

    const result = await runCatalogJanitor();

    expect(result.totalDivertedToReview).toBe(1);
    // The update payload should include status REVIEW
    const updateCall = prismaMock.prayer.update.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(updateCall.data.status).toBe("REVIEW");
  });
});

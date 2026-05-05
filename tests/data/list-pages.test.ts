import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listPublishedPrayers, getPublishedPrayerBySlug } from "@/lib/data/prayers";
import { listPublishedSaints, getPublishedSaintBySlug } from "@/lib/data/saints";
import { listPublishedDevotions, getPublishedDevotionBySlug } from "@/lib/data/devotions";
import { listPublishedApparitions, getPublishedApparitionBySlug } from "@/lib/data/apparitions";
import { listPublishedLiturgyEntries, getPublishedLiturgyBySlug } from "@/lib/data/liturgy";
import {
  listPublishedSpiritualLifeGuides,
  getPublishedSpiritualLifeGuideBySlug,
} from "@/lib/data/spiritual-life";
import { listPublishedParishes, getPublishedParishBySlug } from "@/lib/data/parishes";

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("list pages — only return PUBLISHED rows", () => {
  it("listPublishedPrayers filters by status PUBLISHED", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([]);
    await listPublishedPrayers("en");
    const args = prismaMock.prayer.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: "PUBLISHED" });
  });

  it("listPublishedSaints filters by status PUBLISHED", async () => {
    prismaMock.saint.findMany.mockResolvedValue([]);
    await listPublishedSaints("en");
    expect(prismaMock.saint.findMany.mock.calls[0][0].where).toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("listPublishedDevotions filters by status PUBLISHED", async () => {
    prismaMock.devotion.findMany.mockResolvedValue([]);
    await listPublishedDevotions("en");
    expect(prismaMock.devotion.findMany.mock.calls[0][0].where).toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("listPublishedApparitions filters by status PUBLISHED", async () => {
    prismaMock.marianApparition.findMany.mockResolvedValue([]);
    await listPublishedApparitions("en");
    expect(prismaMock.marianApparition.findMany.mock.calls[0][0].where).toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("listPublishedLiturgyEntries filters by status PUBLISHED", async () => {
    prismaMock.liturgyEntry.findMany.mockResolvedValue([]);
    await listPublishedLiturgyEntries("en");
    expect(prismaMock.liturgyEntry.findMany.mock.calls[0][0].where).toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("listPublishedSpiritualLifeGuides filters by status PUBLISHED", async () => {
    prismaMock.spiritualLifeGuide.findMany.mockResolvedValue([]);
    await listPublishedSpiritualLifeGuides("en");
    expect(prismaMock.spiritualLifeGuide.findMany.mock.calls[0][0].where).toMatchObject({
      status: "PUBLISHED",
    });
  });

  it("listPublishedParishes filters by status PUBLISHED", async () => {
    prismaMock.parish.findMany.mockResolvedValue([]);
    await listPublishedParishes();
    expect(prismaMock.parish.findMany.mock.calls[0][0].where).toMatchObject({
      status: "PUBLISHED",
    });
  });
});

describe("detail pages — look up by slug AND status PUBLISHED", () => {
  it("getPublishedPrayerBySlug filters by both slug and status", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    await getPublishedPrayerBySlug("our-father", "en");
    expect(prismaMock.prayer.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: "our-father",
      status: "PUBLISHED",
    });
  });

  it("getPublishedSaintBySlug filters by both slug and status", async () => {
    prismaMock.saint.findFirst.mockResolvedValue(null);
    await getPublishedSaintBySlug("francis", "en");
    expect(prismaMock.saint.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: "francis",
      status: "PUBLISHED",
    });
  });

  it("getPublishedDevotionBySlug filters by both slug and status", async () => {
    prismaMock.devotion.findFirst.mockResolvedValue(null);
    await getPublishedDevotionBySlug("rosary", "en");
    expect(prismaMock.devotion.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: "rosary",
      status: "PUBLISHED",
    });
  });

  it("getPublishedApparitionBySlug filters by both slug and status", async () => {
    prismaMock.marianApparition.findFirst.mockResolvedValue(null);
    await getPublishedApparitionBySlug("lourdes", "en");
    expect(prismaMock.marianApparition.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: "lourdes",
      status: "PUBLISHED",
    });
  });

  it("getPublishedLiturgyBySlug filters by both slug and status", async () => {
    prismaMock.liturgyEntry.findFirst.mockResolvedValue(null);
    await getPublishedLiturgyBySlug("nicaea", "en");
    expect(prismaMock.liturgyEntry.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: "nicaea",
      status: "PUBLISHED",
    });
  });

  it("getPublishedSpiritualLifeGuideBySlug filters by both slug and status", async () => {
    prismaMock.spiritualLifeGuide.findFirst.mockResolvedValue(null);
    await getPublishedSpiritualLifeGuideBySlug("how-to-pray-the-rosary", "en");
    expect(prismaMock.spiritualLifeGuide.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: "how-to-pray-the-rosary",
      status: "PUBLISHED",
    });
  });

  it("getPublishedParishBySlug filters by both slug and status", async () => {
    prismaMock.parish.findFirst.mockResolvedValue(null);
    await getPublishedParishBySlug("st-mary");
    expect(prismaMock.parish.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: "st-mary",
      status: "PUBLISHED",
    });
  });
});

describe("missing content — returns null instead of throwing", () => {
  it("returns null when slug is not found", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    const result = await getPublishedPrayerBySlug("does-not-exist", "en");
    expect(result).toBeNull();
  });

  it("returns null for an unpublished slug", async () => {
    prismaMock.devotion.findFirst.mockResolvedValue(null);
    const result = await getPublishedDevotionBySlug("draft-only", "en");
    expect(result).toBeNull();
  });
});

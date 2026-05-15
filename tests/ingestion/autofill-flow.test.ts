import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { appConfig } from "@/lib/config";
import { persistItems } from "@/lib/ingestion/persist";
import { sanitize } from "@/lib/ingestion/validate";
import type {
  IngestedApparition,
  IngestedDevotion,
  IngestedGuide,
  IngestedItem,
  IngestedLiturgy,
  IngestedParish,
  IngestedPrayer,
  IngestedSaint,
} from "@/lib/ingestion/types";

beforeEach(() => {
  resetPrismaMock();
});

describe("auto-fill flow — initialStatus", () => {
  it("defaults to PUBLISHED so the public catalog grows without manual review", () => {
    expect(appConfig.ingestion.initialStatus).toBe("PUBLISHED");
  });

  it("creates new prayer rows in PUBLISHED status", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "anima-christi",
      defaultTitle: "Anima Christi",
      category: "ordinary",
      body: "Soul of Christ, sanctify me. Body of Christ, save me.",
      externalSourceKey: "https://www.vatican.va/prayers/anima-christi",
    };
    const result = await persistItems([item], appConfig.ingestion.initialStatus);
    expect(result).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    const args = prismaMock.prayer.create.mock.calls[0][0];
    expect(args.data.status).toBe("PUBLISHED");
  });
});

describe("auto-fill flow — content routes to the right table by kind", () => {
  const corpus: IngestedItem[] = [
    {
      kind: "prayer",
      slug: "our-father",
      defaultTitle: "Our Father",
      category: "ordinary",
      body: "Our Father, who art in heaven, hallowed be thy name.",
      externalSourceKey: "https://www.vatican.va/prayers/our-father",
    } as IngestedPrayer,
    {
      kind: "saint",
      slug: "francis-of-assisi",
      canonicalName: "Saint Francis of Assisi",
      patronages: ["animals"],
      biography: "Born in Assisi in 1181, founder of the Franciscan order.",
      externalSourceKey: "https://www.vatican.va/saints/francis",
    } as IngestedSaint,
    {
      kind: "apparition",
      slug: "lourdes",
      title: "Our Lady of Lourdes",
      approvedStatus: "Approved by the Holy See",
      summary: "Marian apparition at Lourdes, France in 1858.",
      externalSourceKey: "https://www.vatican.va/apparitions/lourdes",
    } as IngestedApparition,
    {
      kind: "parish",
      slug: "st-marys-boston",
      name: "St. Mary's Catholic Church",
      city: "Boston",
      region: "MA",
      country: "USA",
      websiteUrl: "https://stmarysboston.example.org/",
      externalSourceKey: "https://archbalt.org/parishes/st-marys",
    } as IngestedParish,
    {
      kind: "devotion",
      slug: "rosary",
      title: "The Holy Rosary",
      summary: "Meditative recitation of decades centered on the life of Christ.",
      externalSourceKey: "https://www.vatican.va/devotions/rosary",
    } as IngestedDevotion,
    {
      kind: "liturgy",
      slug: "council-of-trent",
      liturgyKind: "COUNCIL_TIMELINE",
      title: "Council of Trent",
      body: "Convoked 1545 in response to the Reformation; codified Tridentine reforms.",
      externalSourceKey: "https://www.vatican.va/history/trent",
    } as IngestedLiturgy,
    {
      kind: "guide",
      slug: "how-to-pray-the-rosary",
      guideKind: "ROSARY",
      title: "How to Pray the Rosary",
      summary: "A step-by-step guide to praying the Holy Rosary in five decades.",
      bodyText: "Begin with the Sign of the Cross.",
      externalSourceKey: "https://www.vatican.va/guides/rosary",
    } as IngestedGuide,
  ];

  it("dispatches each kind exactly to its own Prisma model", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});
    prismaMock.saint.findFirst.mockResolvedValue(null);
    prismaMock.saint.findUnique.mockResolvedValue(null);
    prismaMock.saint.create.mockResolvedValue({});
    prismaMock.marianApparition.findUnique.mockResolvedValue(null);
    prismaMock.marianApparition.create.mockResolvedValue({});
    prismaMock.parish.findUnique.mockResolvedValue(null);
    prismaMock.parish.findFirst.mockResolvedValue(null);
    prismaMock.parish.findMany.mockResolvedValue([]);
    prismaMock.parish.create.mockResolvedValue({});
    prismaMock.devotion.findUnique.mockResolvedValue(null);
    prismaMock.devotion.create.mockResolvedValue({});
    prismaMock.liturgyEntry.findFirst.mockResolvedValue(null);
    prismaMock.liturgyEntry.findUnique.mockResolvedValue(null);
    prismaMock.liturgyEntry.create.mockResolvedValue({});
    prismaMock.spiritualLifeGuide.findFirst.mockResolvedValue(null);
    prismaMock.spiritualLifeGuide.findUnique.mockResolvedValue(null);
    prismaMock.spiritualLifeGuide.create.mockResolvedValue({});

    const result = await persistItems(corpus, appConfig.ingestion.initialStatus);

    expect(result).toMatchObject({ created: 7, updated: 0, skipped: 0 });
    // Every model receives exactly one create.
    expect(prismaMock.prayer.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.saint.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.marianApparition.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.parish.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.devotion.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.liturgyEntry.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.spiritualLifeGuide.create).toHaveBeenCalledTimes(1);
    // Every persisted row is in PUBLISHED status.
    for (const m of [
      prismaMock.prayer.create,
      prismaMock.saint.create,
      prismaMock.marianApparition.create,
      prismaMock.parish.create,
      prismaMock.devotion.create,
      prismaMock.liturgyEntry.create,
      prismaMock.spiritualLifeGuide.create,
    ]) {
      expect(m.mock.calls[0][0].data.status).toBe("PUBLISHED");
    }
  });
});

describe("auto-fill flow — credibility gate", () => {
  it("rejects an item whose externalSourceKey is not from an allowlisted Catholic host", () => {
    const offlist: IngestedPrayer = {
      kind: "prayer",
      slug: "random",
      defaultTitle: "Random Prayer",
      category: "ordinary",
      body: "Plenty of words here to clear the minimum-body-length validator.",
      externalSourceKey: "https://random-blog.example.com/prayer",
    };
    const { valid, rejected } = sanitize([offlist]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/not from a Vatican-approved host/i);
  });

  it("accepts an item whose externalSourceKey IS from an allowlisted Catholic host", () => {
    const valid: IngestedPrayer = {
      kind: "prayer",
      slug: "anima-christi",
      defaultTitle: "Anima Christi",
      category: "ordinary",
      body: "Soul of Christ, sanctify me. Body of Christ, save me.",
      externalSourceKey: "https://www.vatican.va/prayers/anima-christi",
    };
    const result = sanitize([valid]);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects a parish whose name suggests a non-Catholic place of worship", () => {
    const protestant: IngestedParish = {
      kind: "parish",
      slug: "first-baptist-boston",
      name: "First Baptist Church of Boston",
      city: "Boston",
      country: "USA",
      websiteUrl: "https://www.usccb.org/parishes/123", // even on an allowlisted host
      externalSourceKey: "https://www.usccb.org/parishes/123",
    };
    const result = sanitize([protestant]);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/non-Catholic/i);
  });
});

describe("auto-fill flow — quality gate (minimum useful content)", () => {
  it("rejects a saint with too-short biography", () => {
    const stub: IngestedSaint = {
      kind: "saint",
      slug: "x",
      canonicalName: "Saint X",
      patronages: [],
      biography: "Too short.",
    };
    const result = sanitize([stub]);
    expect(result.valid).toHaveLength(0);
  });

  it("rejects a prayer with too-short body", () => {
    const stub: IngestedPrayer = {
      kind: "prayer",
      slug: "x",
      defaultTitle: "X",
      category: "ordinary",
      body: "Short",
    };
    const result = sanitize([stub]);
    expect(result.valid).toHaveLength(0);
  });
});

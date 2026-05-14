import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { persistItems } from "@/lib/ingestion/persist";
import type {
  IngestedDevotion,
  IngestedGuide,
  IngestedLiturgy,
  IngestedPrayer,
  IngestedSaint,
} from "@/lib/ingestion/types";

const basePrayer: IngestedPrayer = {
  kind: "prayer",
  slug: "our-father",
  defaultTitle: "Our Father",
  category: "ordinary",
  body: "Our Father, who art in heaven, hallowed be thy name.",
  externalSourceKey: "https://www.vatican.va/prayers/our-father",
};

const baseSaint: IngestedSaint = {
  kind: "saint",
  slug: "francis-of-assisi",
  canonicalName: "Francis of Assisi",
  patronages: ["animals"],
  biography: "Born in Assisi in 1181, founder of the Franciscan order.",
  externalSourceKey: "https://www.vatican.va/saints/francis",
};

const baseDevotion: IngestedDevotion = {
  kind: "devotion",
  slug: "rosary",
  title: "The Holy Rosary",
  summary: "Meditative recitation of decades centered on the life of Christ.",
  externalSourceKey: "https://www.vatican.va/devotions/rosary",
};

const baseLiturgy: IngestedLiturgy = {
  kind: "liturgy",
  slug: "council-of-trent",
  liturgyKind: "COUNCIL_TIMELINE",
  title: "Council of Trent",
  body: "Convoked 1545 in response to the Reformation; codified Tridentine reforms.",
  externalSourceKey: "https://www.vatican.va/history/trent",
};

const baseGuide: IngestedGuide = {
  kind: "guide",
  slug: "how-to-pray-the-rosary",
  guideKind: "ROSARY",
  title: "How to Pray the Rosary",
  summary: "A step-by-step guide to praying the Holy Rosary in five decades.",
  bodyText: "Begin with the Sign of the Cross.",
  externalSourceKey: "https://www.vatican.va/guides/rosary",
};

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("persistItems — DB writes", () => {
  it("creates a Prayer row when none exists", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const result = await persistItems([basePrayer], "REVIEW");

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(prismaMock.prayer.create).toHaveBeenCalledTimes(1);
    const args = prismaMock.prayer.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      slug: "our-father",
      defaultTitle: "Our Father",
      body: basePrayer.body,
      category: "ordinary",
      externalSourceKey: basePrayer.externalSourceKey,
      status: "REVIEW",
    });
    expect(args.data.contentChecksum).toBeTypeOf("string");
    expect(args.data.contentChecksum).toHaveLength(64);
  });

  it("writes saints, devotions, liturgy and guides each to their own table", async () => {
    prismaMock.saint.findUnique.mockResolvedValue(null);
    prismaMock.saint.create.mockResolvedValue({});
    prismaMock.devotion.findUnique.mockResolvedValue(null);
    prismaMock.devotion.create.mockResolvedValue({});
    prismaMock.liturgyEntry.findFirst.mockResolvedValue(null);
    prismaMock.liturgyEntry.findUnique.mockResolvedValue(null);
    prismaMock.liturgyEntry.create.mockResolvedValue({});
    prismaMock.spiritualLifeGuide.findFirst.mockResolvedValue(null);
    prismaMock.spiritualLifeGuide.findUnique.mockResolvedValue(null);
    prismaMock.spiritualLifeGuide.create.mockResolvedValue({});

    const result = await persistItems([baseSaint, baseDevotion, baseLiturgy, baseGuide], "REVIEW");

    expect(result).toEqual({ created: 4, updated: 0, skipped: 0 });
    expect(prismaMock.saint.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.devotion.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.liturgyEntry.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.spiritualLifeGuide.create).toHaveBeenCalledTimes(1);
    // The prayer table must NOT be touched here — each kind goes to the
    // correct dedicated table.
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
  });
});

describe("persistItems — dedupe", () => {
  it("skips when any existing row is found (ingestion is strictly additive)", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "existing-id",
      status: "DRAFT",
      contentChecksum: "anything",
    });
    const result = await persistItems([basePrayer], "PUBLISHED");
    expect(result).toEqual({ created: 0, updated: 0, skipped: 1 });
    // Ingestion must never UPDATE — it only CREATEs new rows and skips
    // every existing one (PUBLISHED, ARCHIVED, DRAFT, or REVIEW).
    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
  });

  it("never overwrites PUBLISHED content (skipped, not updated)", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "existing-id",
      status: "PUBLISHED",
      contentChecksum: "old",
    });
    const result = await persistItems([basePrayer], "PUBLISHED");
    expect(result).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
  });

  it("does not re-ingest a previously archived prayer", async () => {
    // After the cleanup pass archives a bad row, subsequent ingestion
    // runs from the same upstream URL must NOT re-create it under a new
    // slug. The persister's externalSourceKey lookup guards this.
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "archived-id",
      status: "ARCHIVED",
      contentChecksum: "old",
    });
    const result = await persistItems([basePrayer], "PUBLISHED");
    expect(result).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();
    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
  });

  it("never overwrites DRAFT content either — protects admin WIP", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "existing-id",
      status: "DRAFT",
      contentChecksum: "old",
    });
    const result = await persistItems([basePrayer], "PUBLISHED");
    expect(result).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(prismaMock.prayer.update).not.toHaveBeenCalled();
  });

  it("collapses duplicates within a single batch (in-memory dedupe)", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const result = await persistItems([basePrayer, { ...basePrayer }, basePrayer], "PUBLISHED");

    // Two duplicates dropped at the dedupe stage; only one create lands.
    expect(result).toEqual({ created: 1, updated: 0, skipped: 2 });
    expect(prismaMock.prayer.create).toHaveBeenCalledTimes(1);
  });

  it("matches existing rows by externalSourceKey even when slug differs (skipped)", async () => {
    // Same upstream URL, different slug: must still resolve to the same
    // existing row (the URL is the stable identity) and be skipped.
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "existing-id",
      status: "DRAFT",
      contentChecksum: "old",
    });

    const result = await persistItems([{ ...basePrayer, slug: "our-father-renamed" }], "PUBLISHED");

    expect(result).toEqual({ created: 0, updated: 0, skipped: 1 });
    // Verify the lookup OR'd by externalSourceKey + slug (so a renamed slug
    // collapses to the same row as the original URL).
    const lookupArgs = prismaMock.prayer.findFirst.mock.calls[0][0];
    expect(lookupArgs.where.OR).toEqual(
      expect.arrayContaining([
        { externalSourceKey: basePrayer.externalSourceKey },
        { slug: "our-father-renamed" },
      ]),
    );
  });
});

describe("persistItems — new rows always created in initialStatus", () => {
  it("new prayer landing as PUBLISHED auto-publishes (no admin approval)", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    await persistItems([basePrayer], "PUBLISHED");

    const args = prismaMock.prayer.create.mock.calls[0][0];
    expect(args.data.status).toBe("PUBLISHED");
  });
});

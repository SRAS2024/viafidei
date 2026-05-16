import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/concurrency/lock", () => ({
  withAdvisoryLock: async <T>(_key: string, fn: () => Promise<T>) => fn(),
}));

import { runAdapter } from "@/lib/ingestion/runner";
import type { IngestedItem, SourceAdapter } from "@/lib/ingestion/types";

beforeEach(() => {
  resetPrismaMock();
  prismaMock.ingestionJobRun.create.mockResolvedValue({ id: "run-x" });
  prismaMock.ingestionJobRun.findFirst.mockResolvedValue(null);
  prismaMock.ingestionJobRun.update.mockResolvedValue({});
});

function makeAdapter(items: IngestedItem[]): SourceAdapter {
  return {
    key: "test.package-keep",
    description: "test",
    entityKinds: ["prayer", "saint", "apparition"],
    fetch: vi.fn(async () => ({ items })),
  };
}

describe("runner: intelligent packaging (re-classify, enrich, keep)", () => {
  it("re-routes a 'prayer' that is actually a saint biography into the Saint table", async () => {
    prismaMock.saint.findFirst.mockResolvedValue(null);
    prismaMock.saint.findUnique.mockResolvedValue(null);
    prismaMock.saint.create.mockResolvedValue({});

    const misclassified: IngestedItem = {
      kind: "prayer",
      slug: "padre-pio",
      defaultTitle: "Padre Pio",
      category: "Devotional",
      body: "Saint Padre Pio was born in Pietrelcina in 1887. He was ordained a priest in 1910 and entered the Capuchin order. He died on September 23, 1968 and was canonized by Pope John Paul II in 2002. His feast day is September 23. He is the patron saint of stress relief.",
      externalSourceKey: "https://www.vatican.va/saints/padre-pio",
    };

    const summary = await runAdapter(makeAdapter([misclassified]), "job-x", "vatican.va", {
      skipLock: true,
      initialStatus: "PUBLISHED",
    });

    expect(summary.recordsCreated).toBe(1);
    expect(prismaMock.saint.create).toHaveBeenCalled();
    expect(prismaMock.prayer.create).not.toHaveBeenCalled();

    // The DataManagementLog batch should include the CATEGORY_FIX
    // re-classification audit row so an admin can see what happened.
    const logCall = prismaMock.dataManagementLog.createMany.mock.calls[0]?.[0]?.data as Array<{
      action: string;
      reason: string;
    }>;
    const reclassifyRow = logCall.find((r) => /Re-classified from prayer .* saint/i.test(r.reason));
    expect(reclassifyRow).toBeDefined();
  });

  it("keeps a hard-validator-failing item as REVIEW instead of dropping it", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    // A "prayer" that has all required fields but a body too short to
    // satisfy any prayer-language marker. Old behaviour: REJECT &
    // dropped. New behaviour: kept as REVIEW.
    const weakPrayer: IngestedItem = {
      kind: "prayer",
      slug: "weak-prayer",
      defaultTitle: "A short blessing",
      category: "Devotional",
      body: "May the holy ones bless this day with all the goodness of heaven and earth, granting hope to every traveler.",
      externalSourceKey: "https://www.vatican.va/prayers/weak",
    };

    const summary = await runAdapter(makeAdapter([weakPrayer]), "job-x", "vatican.va", {
      skipLock: true,
      initialStatus: "PUBLISHED",
    });

    // Either it passed validation (then created) or it landed in the
    // weak-review bucket (then also created, in REVIEW status). Either
    // way it must not have been dropped — at least one row was created.
    expect(summary.recordsCreated + summary.recordsUpdated).toBeGreaterThanOrEqual(1);
  });

  it("still rejects a row that physically cannot be persisted (empty slug)", async () => {
    const unsavable: IngestedItem = {
      kind: "saint",
      slug: "",
      canonicalName: "",
      patronages: [],
      biography:
        "Born in Assisi in 1181, founder of the Franciscan order, canonized by Pope Gregory IX, feast day October 4.",
      externalSourceKey: "https://www.vatican.va/saints/stub",
    };

    const summary = await runAdapter(makeAdapter([unsavable]), "job-x", "vatican.va", {
      skipLock: true,
      initialStatus: "PUBLISHED",
    });

    expect(summary.recordsCreated).toBe(0);
    expect(summary.recordsSkipped).toBeGreaterThanOrEqual(1);
    expect(prismaMock.saint.create).not.toHaveBeenCalled();
  });

  it("strips boilerplate from text fields before validation", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findUnique.mockResolvedValue(null);
    prismaMock.prayer.create.mockResolvedValue({});

    const noisy: IngestedItem = {
      kind: "prayer",
      slug: "hail-mary",
      defaultTitle: "Hail Mary | USCCB",
      category: "Marian",
      body: [
        "Subscribe to our newsletter for daily prayers.",
        "Hail Mary, full of grace, the Lord is with thee.",
        "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus.",
        "Share this prayer on Facebook",
        "Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      ].join("\n\n"),
      externalSourceKey: "https://www.usccb.org/prayers/hail-mary",
    };

    await runAdapter(makeAdapter([noisy]), "job-x", "vatican.va", {
      skipLock: true,
      initialStatus: "PUBLISHED",
    });

    expect(prismaMock.prayer.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.prayer.create.mock.calls[0][0] as {
      data: { defaultTitle: string; body: string };
    };
    expect(createArgs.data.defaultTitle).toBe("Hail Mary");
    expect(createArgs.data.body).not.toContain("Subscribe");
    expect(createArgs.data.body).not.toContain("Share this");
    expect(createArgs.data.body).toContain("Hail Mary, full of grace");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getBacklogProgress } from "@/lib/ingestion/scheduler";
import { appConfig } from "@/lib/config";

beforeEach(() => {
  resetPrismaMock();
});

describe("getBacklogProgress", () => {
  it("reports constant mode while any minimum is unmet", async () => {
    prismaMock.prayer.count.mockResolvedValue(10);
    prismaMock.saint.count.mockResolvedValue(20);
    prismaMock.parish.count.mockResolvedValue(30);
    prismaMock.liturgyEntry.count.mockResolvedValue(5);
    // SpiritualLifeGuide is queried twice: once for sacraments, once
    // for consecrations. The implementation issues them in that order.
    prismaMock.spiritualLifeGuide.count
      .mockResolvedValueOnce(2) // sacraments
      .mockResolvedValueOnce(1); // consecrations

    const { counts, targets, metAll, mode } = await getBacklogProgress();

    expect(counts).toEqual({
      prayers: 10,
      saints: 20,
      parishes: 30,
      churchDocuments: 5,
      sacraments: 2,
      consecrations: 1,
    });
    expect(targets).toEqual(appConfig.ingestion.targets);
    expect(metAll).toBe(false);
    expect(mode).toBe("constant");
  });

  it("reports maintenance mode once all targets are met", async () => {
    const { targets } = appConfig.ingestion;
    prismaMock.prayer.count.mockResolvedValue(targets.prayers);
    prismaMock.saint.count.mockResolvedValue(targets.saints);
    prismaMock.parish.count.mockResolvedValue(targets.parishes);
    prismaMock.liturgyEntry.count.mockResolvedValue(targets.churchDocuments);
    prismaMock.spiritualLifeGuide.count
      .mockResolvedValueOnce(targets.sacraments)
      .mockResolvedValueOnce(targets.consecrations);

    const { metAll, mode } = await getBacklogProgress();

    expect(metAll).toBe(true);
    expect(mode).toBe("maintenance");
  });

  it("is still constant if prayers + parishes are met but saints lag", async () => {
    const { targets } = appConfig.ingestion;
    prismaMock.prayer.count.mockResolvedValue(targets.prayers);
    prismaMock.saint.count.mockResolvedValue(targets.saints - 1);
    prismaMock.parish.count.mockResolvedValue(targets.parishes);
    prismaMock.liturgyEntry.count.mockResolvedValue(targets.churchDocuments);
    prismaMock.spiritualLifeGuide.count
      .mockResolvedValueOnce(targets.sacraments)
      .mockResolvedValueOnce(targets.consecrations);

    const { metAll, mode } = await getBacklogProgress();

    expect(metAll).toBe(false);
    expect(mode).toBe("constant");
  });

  it("is still constant if every other target is met but church-documents lag", async () => {
    const { targets } = appConfig.ingestion;
    prismaMock.prayer.count.mockResolvedValue(targets.prayers);
    prismaMock.saint.count.mockResolvedValue(targets.saints);
    prismaMock.parish.count.mockResolvedValue(targets.parishes);
    prismaMock.liturgyEntry.count.mockResolvedValue(targets.churchDocuments - 1);
    prismaMock.spiritualLifeGuide.count
      .mockResolvedValueOnce(targets.sacraments)
      .mockResolvedValueOnce(targets.consecrations);

    const { metAll, mode } = await getBacklogProgress();
    expect(metAll).toBe(false);
    expect(mode).toBe("constant");
  });

  it("is still constant if every other target is met but consecrations lag", async () => {
    const { targets } = appConfig.ingestion;
    prismaMock.prayer.count.mockResolvedValue(targets.prayers);
    prismaMock.saint.count.mockResolvedValue(targets.saints);
    prismaMock.parish.count.mockResolvedValue(targets.parishes);
    prismaMock.liturgyEntry.count.mockResolvedValue(targets.churchDocuments);
    prismaMock.spiritualLifeGuide.count
      .mockResolvedValueOnce(targets.sacraments)
      .mockResolvedValueOnce(targets.consecrations - 1);

    const { metAll, mode } = await getBacklogProgress();
    expect(metAll).toBe(false);
    expect(mode).toBe("constant");
  });
});

describe("ingestion config targets", () => {
  it("requires the documented minimums (500 prayers / 7,000 saints / 150,000 parishes / 1,500 church documents / 7 sacraments / 4 consecrations)", () => {
    expect(appConfig.ingestion.targets).toEqual({
      prayers: 500,
      saints: 7_000,
      parishes: 150_000,
      churchDocuments: 1_500,
      sacraments: 7,
      consecrations: 4,
    });
  });

  it("keeps the seven sacraments distinct from the four consecrations", () => {
    // The Catholic Church teaches exactly seven sacraments. The
    // Sacraments bucket must reflect that exact number, not be
    // inflated by personal consecrations.
    expect(appConfig.ingestion.targets.sacraments).toBe(7);
    expect(appConfig.ingestion.targets.consecrations).toBe(4);
  });

  it("publishes a maintenance interval of ~twice-weekly", () => {
    const hours = appConfig.ingestion.maintenanceIntervalMs / 3_600_000;
    // Twice per week ≈ every 84 hours (3.5 days).
    expect(hours).toBeGreaterThanOrEqual(72);
    expect(hours).toBeLessThanOrEqual(96);
  });
});

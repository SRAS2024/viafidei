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

    const { counts, targets, metAll, mode } = await getBacklogProgress();

    expect(counts).toEqual({ prayers: 10, saints: 20, parishes: 30 });
    expect(targets).toEqual(appConfig.ingestion.targets);
    expect(metAll).toBe(false);
    expect(mode).toBe("constant");
  });

  it("reports maintenance mode once all three targets are met", async () => {
    const { targets } = appConfig.ingestion;
    prismaMock.prayer.count.mockResolvedValue(targets.prayers);
    prismaMock.saint.count.mockResolvedValue(targets.saints);
    prismaMock.parish.count.mockResolvedValue(targets.parishes);

    const { metAll, mode } = await getBacklogProgress();

    expect(metAll).toBe(true);
    expect(mode).toBe("maintenance");
  });

  it("is still constant if prayers + parishes are met but saints lag", async () => {
    const { targets } = appConfig.ingestion;
    prismaMock.prayer.count.mockResolvedValue(targets.prayers);
    prismaMock.saint.count.mockResolvedValue(targets.saints - 1);
    prismaMock.parish.count.mockResolvedValue(targets.parishes);

    const { metAll, mode } = await getBacklogProgress();

    expect(metAll).toBe(false);
    expect(mode).toBe("constant");
  });
});

describe("ingestion config targets", () => {
  it("requires the documented minimums: 300 prayers / 1,000 saints / 20,000 parishes", () => {
    expect(appConfig.ingestion.targets).toEqual({
      prayers: 300,
      saints: 1_000,
      parishes: 20_000,
    });
  });

  it("publishes a maintenance interval of ~twice-weekly", () => {
    const hours = appConfig.ingestion.maintenanceIntervalMs / 3_600_000;
    // Twice per week ≈ every 84 hours (3.5 days).
    expect(hours).toBeGreaterThanOrEqual(72);
    expect(hours).toBeLessThanOrEqual(96);
  });
});

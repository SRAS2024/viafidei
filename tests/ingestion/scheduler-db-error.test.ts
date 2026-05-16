import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getBacklogProgress } from "@/lib/ingestion/scheduler";

beforeEach(() => {
  resetPrismaMock();
});

describe("scheduler — DB error keeps ingestion in CONSTANT mode", () => {
  it("returns constant mode and dbError=true when prisma throws", async () => {
    prismaMock.prayer.count.mockRejectedValue(new Error("connection refused"));
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValue(0);

    const result = await getBacklogProgress();
    expect(result.dbError).toBe(true);
    expect(result.mode).toBe("constant");
    expect(result.metAll).toBe(false);
    expect(result.counts).toBeNull();
    expect(result.errorMessage).toMatch(/connection refused/);
  });

  it("returns constant mode without dbError when counts are below targets", async () => {
    prismaMock.prayer.count.mockResolvedValue(0);
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.parish.count.mockResolvedValue(0);
    prismaMock.liturgyEntry.count.mockResolvedValue(0);
    prismaMock.spiritualLifeGuide.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const result = await getBacklogProgress();
    expect(result.dbError).toBe(false);
    expect(result.mode).toBe("constant");
    expect(result.metAll).toBe(false);
    expect(result.counts).not.toBeNull();
  });
});

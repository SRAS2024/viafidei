/**
 * Daily Liturgy cleanup tests. The "where applicable" pass in the
 * strict QA cleanup deletes structurally incomplete DailyLiturgy rows
 * (missing date, or both readings and saints empty) and writes a
 * RejectedContentLog entry for each.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runStrictContentCleanup } from "@/lib/content-qa/cleanup";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.spiritualLifeGuide,
    prismaMock.liturgyEntry,
    prismaMock.parish,
    prismaMock.dailyLiturgy,
  ]) {
    m.findMany.mockResolvedValue([]);
    m.delete.mockResolvedValue({});
    m.update.mockResolvedValue({});
  }
  prismaMock.rejectedContentLog.createMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("strict cleanup: DailyLiturgy rows", () => {
  it("hard-deletes a DailyLiturgy row that has no readings and no saints", async () => {
    prismaMock.dailyLiturgy.findMany.mockResolvedValue([
      {
        id: "dl1",
        date: new Date("2026-05-16"),
        feastTitle: null,
        readingsJson: null,
        saintsJson: null,
        status: "PUBLISHED",
      },
    ]);
    const summary = await runStrictContentCleanup();
    expect(prismaMock.dailyLiturgy.delete).toHaveBeenCalledWith({ where: { id: "dl1" } });
    expect(prismaMock.rejectedContentLog.createMany).toHaveBeenCalled();
    const logCall = prismaMock.rejectedContentLog.createMany.mock.calls[0][0];
    expect(logCall.data[0].contentType).toBe("Liturgy");
    expect(logCall.data[0].failedContractName).toBe("DailyLiturgyValidation");
    expect(summary.totalHardDeleted).toBeGreaterThanOrEqual(1);
  });

  it("keeps a DailyLiturgy row with valid readings", async () => {
    prismaMock.dailyLiturgy.findMany.mockResolvedValue([
      {
        id: "dl2",
        date: new Date("2026-05-16"),
        feastTitle: "Friday of the Fifth Week of Easter",
        readingsJson: {
          firstReading: { ref: "Acts 15:22-31", text: "..." },
          gospel: { ref: "John 15:12-17", text: "..." },
        },
        saintsJson: [],
        status: "PUBLISHED",
      },
    ]);
    const summary = await runStrictContentCleanup();
    expect(prismaMock.dailyLiturgy.delete).not.toHaveBeenCalled();
    const dlBucket = summary.buckets.find((b) => b.contentType === "DailyLiturgy");
    expect(dlBucket?.flaggedReady).toBe(1);
    expect(dlBucket?.hardDeleted).toBe(0);
  });

  it("keeps a DailyLiturgy row that has saints only (some days have no readings)", async () => {
    prismaMock.dailyLiturgy.findMany.mockResolvedValue([
      {
        id: "dl3",
        date: new Date("2026-05-16"),
        feastTitle: "Saint X",
        readingsJson: null,
        saintsJson: [{ slug: "saint-x", name: "Saint X" }],
        status: "PUBLISHED",
      },
    ]);
    const summary = await runStrictContentCleanup();
    expect(prismaMock.dailyLiturgy.delete).not.toHaveBeenCalled();
    const dlBucket = summary.buckets.find((b) => b.contentType === "DailyLiturgy");
    expect(dlBucket?.flaggedReady).toBe(1);
  });
});

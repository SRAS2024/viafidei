/**
 * Strict content QA cleanup — unit tests for the existing-content audit
 * job. These tests use the prismaMock to verify that:
 *
 *   - Valid PUBLISHED rows are flagged with publicRenderReady + isThresholdEligible.
 *   - Invalid rows are flipped to REVIEW (status, render flags = false).
 *   - Noise rows (livestream / event / bulletin) are hard-deleted with
 *     a RejectedContentLog entry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runStrictContentCleanup } from "@/lib/content-qa/cleanup";

beforeEach(() => {
  resetPrismaMock();
  // Default: empty tables for every catalog kind.
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

describe("runStrictContentCleanup", () => {
  it("flags a valid Prayer row as publicRenderReady = true", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p1",
        slug: "hail-mary",
        defaultTitle: "Hail Mary",
        body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women. Pray for us. Amen.",
        category: "Marian",
        prayerType: "Marian prayer",
        externalSourceKey: "https://www.vatican.va/hail-mary",
        sourceUrl: "https://www.vatican.va/hail-mary",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "abc",
      },
    ]);

    const summary = await runStrictContentCleanup();

    expect(prismaMock.prayer.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.prayer.update.mock.calls[0][0];
    expect(updateCall.data.publicRenderReady).toBe(true);
    expect(updateCall.data.isThresholdEligible).toBe(true);
    expect(updateCall.data.packageValidationStatus).toBe("valid");
    expect(summary.totalFlaggedReady).toBe(1);
    expect(summary.totalHardDeleted).toBe(0);
  });

  it("hard-deletes a Prayer that is actually a livestream and logs the rejection", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p2",
        slug: "livestream-prayer",
        defaultTitle: "Watch Live: Rosary on YouTube",
        body: "Join us live on Facebook every Sunday at 7pm. Watch on YouTube. Click here to register now for the livestream.",
        category: "Daily",
        prayerType: "Traditional Catholic prayer",
        externalSourceKey: "https://www.vatican.va/livestream",
        sourceUrl: "https://www.vatican.va/livestream",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "xyz",
      },
    ]);

    const summary = await runStrictContentCleanup();

    expect(prismaMock.prayer.delete).toHaveBeenCalledWith({ where: { id: "p2" } });
    expect(prismaMock.rejectedContentLog.createMany).toHaveBeenCalled();
    const logCall = prismaMock.rejectedContentLog.createMany.mock.calls[0][0];
    const rejections = logCall.data;
    expect(rejections).toHaveLength(1);
    expect(rejections[0].contentType).toBe("Prayer");
    expect(rejections[0].decision).toBe("delete");
    expect(summary.totalHardDeleted).toBe(1);
  });

  it("removes deleted items from public view by setting publicRenderReady = false on bad rows", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p3",
        slug: "missing-prayer-type",
        defaultTitle: "No Type",
        body: "Lord, hear my prayer. Amen.",
        category: "",
        prayerType: null,
        externalSourceKey: "https://www.vatican.va/no-type",
        sourceUrl: "https://www.vatican.va/no-type",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "qqq",
      },
    ]);

    await runStrictContentCleanup();

    expect(prismaMock.prayer.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.prayer.update.mock.calls[0][0];
    expect(updateCall.data.publicRenderReady).toBe(false);
    expect(updateCall.data.isThresholdEligible).toBe(false);
    expect(updateCall.data.packageValidationStatus).toBe("invalid");
    // Status should be flipped to REVIEW so it stops showing publicly.
    expect(updateCall.data.status).toBe("REVIEW");
  });

  it("logs each deletion with content type, source, and reason", async () => {
    prismaMock.saint.findMany.mockResolvedValue([
      {
        id: "s1",
        slug: "saint-mary-parish",
        canonicalName: "Saint Mary Parish",
        biography: "Office hours: Mon-Fri 9-5. Mass schedule: Sunday 8am, 10am, 12pm.",
        patronages: [],
        feastDay: null,
        feastMonth: null,
        feastDayOfMonth: null,
        officialPrayer: null,
        externalSourceKey: "https://www.vatican.va/parish",
        sourceUrl: "https://www.vatican.va/parish",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "ck",
      },
    ]);

    await runStrictContentCleanup();

    expect(prismaMock.saint.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    const logCall = prismaMock.rejectedContentLog.createMany.mock.calls[0][0];
    expect(logCall.data[0].contentType).toBe("Saint");
    expect(logCall.data[0].sourceUrl).toContain("vatican.va");
    expect(logCall.data[0].rejectionReason).toMatch(/institution|parish|wrong/i);
  });
});

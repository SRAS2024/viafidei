/**
 * Cleanup tests for Novena and History rows in addition to the base
 * cleanup tests in cleanup.test.ts. Verifies that the strict QA
 * pipeline removes invalid Novena (Devotion subtype) and History
 * (LiturgyEntry with historyType) rows from public view and logs each
 * deletion to RejectedContentLog.
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

describe("strict cleanup: Novena rows", () => {
  it("hard-deletes a Novena that is actually an event announcement", async () => {
    prismaMock.devotion.findMany.mockResolvedValue([
      {
        id: "n1",
        slug: "novena-event-2026",
        title: "Annual Divine Mercy Novena Event 2026",
        summary: "Join us for our novena event. Register now! Tickets available.",
        practiceText: "",
        durationMinutes: null,
        devotionType: "Novena",
        subtype: "Novena",
        background: "Annual fundraiser event. Click here to RSVP.",
        practiceInstructions: "Sign up at the door.",
        packageMetadata: null,
        externalSourceKey: "https://www.thedivinemercy.org/event",
        sourceUrl: "https://www.thedivinemercy.org/event",
        sourceHost: "thedivinemercy.org",
        status: "PUBLISHED",
        contentChecksum: "n1",
      },
    ]);
    const summary = await runStrictContentCleanup();
    expect(prismaMock.devotion.delete).toHaveBeenCalledWith({ where: { id: "n1" } });
    expect(prismaMock.rejectedContentLog.createMany).toHaveBeenCalled();
    expect(summary.totalHardDeleted).toBeGreaterThanOrEqual(1);
  });
});

describe("strict cleanup: History rows", () => {
  it("hard-deletes a parish event row that was misclassified as History", async () => {
    prismaMock.liturgyEntry.findMany.mockResolvedValue([
      {
        id: "h1",
        slug: "parish-fundraiser",
        title: "Parish Fundraiser",
        kind: "COUNCIL_TIMELINE",
        body: "Annual parish fundraiser event. Conference registration available. Join us.",
        summary: "Fundraiser.",
        historyType: "Council",
        dateOrEra: "2026",
        packageMetadata: null,
        externalSourceKey: "https://www.vatican.va/x",
        sourceUrl: "https://www.vatican.va/x",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "h1",
      },
    ]);
    const summary = await runStrictContentCleanup();
    expect(prismaMock.liturgyEntry.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
    const logCall = prismaMock.rejectedContentLog.createMany.mock.calls[0][0];
    expect(logCall.data[0].contentType).toBe("History");
    expect(summary.totalHardDeleted).toBeGreaterThanOrEqual(1);
  });

  it("flips publicRenderReady = false on a History row that lacks summary", async () => {
    prismaMock.liturgyEntry.findMany.mockResolvedValue([
      {
        id: "h2",
        slug: "council-of-trent",
        title: "Council of Trent",
        kind: "COUNCIL_TIMELINE",
        body: "The Council of Trent ran from 1545-1563. It was an ecumenical council convened by Pope Paul III.",
        summary: "",
        historyType: "Council",
        dateOrEra: "1545-1563",
        packageMetadata: null,
        externalSourceKey: "https://www.vatican.va/trent",
        sourceUrl: "https://www.vatican.va/trent",
        sourceHost: "vatican.va",
        status: "PUBLISHED",
        contentChecksum: "h2",
      },
    ]);
    await runStrictContentCleanup();
    expect(prismaMock.liturgyEntry.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.liturgyEntry.update.mock.calls[0][0];
    expect(updateCall.data.publicRenderReady).toBe(false);
    expect(updateCall.data.status).toBe("REVIEW");
  });
});

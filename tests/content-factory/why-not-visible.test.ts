/**
 * Why-not-visible diagnostics tests.
 *
 * Verifies the join + filter logic returns expected suggestions for
 * the common non-public-row causes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listNonPublicRows } from "@/lib/data/why-not-visible";

beforeEach(() => {
  resetPrismaMock();
});

describe("listNonPublicRows", () => {
  it("returns a row with 'no automatic action' when the row is ARCHIVED", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p1",
        slug: "p1",
        defaultTitle: "Old prayer",
        sourceUrl: "https://vatican.va/p1",
        sourceHost: "vatican.va",
        status: "ARCHIVED",
        publicRenderReady: false,
        isThresholdEligible: false,
        packageValidationStatus: "valid",
        packageValidationErrors: [],
        archivedAt: new Date("2024-01-01"),
        updatedAt: new Date(),
      },
    ]);
    // All other content-type queries are empty.
    for (const m of [
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.findMany.mockResolvedValue([]);
    }
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        host: "vatican.va",
        canIngestPrayers: true,
        canIngestSaints: false,
        canIngestApparitions: false,
        canIngestParishes: false,
        canIngestDevotions: false,
        canIngestNovenas: false,
        canIngestSacraments: false,
        canIngestRosaryGuides: false,
        canIngestConsecrations: false,
        canIngestSpiritualGuides: false,
        canIngestLiturgy: false,
        canIngestHistory: false,
        canProvideScriptureText: false,
      },
    ]);

    const rows = await listNonPublicRows({ filter: "all", limit: 20 });
    expect(rows.length).toBe(1);
    expect(rows[0].contentType).toBe("Prayer");
    expect(rows[0].suggestedNextAction).toMatch(/archive/i);
  });

  it("suggests refetch when builder missed required fields", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p2",
        slug: "p2",
        defaultTitle: "Bad prayer",
        sourceUrl: "https://vatican.va/p2",
        sourceHost: "vatican.va",
        status: "DRAFT",
        publicRenderReady: false,
        isThresholdEligible: false,
        packageValidationStatus: null,
        packageValidationErrors: [],
        archivedAt: null,
        updatedAt: new Date(),
      },
    ]);
    for (const m of [
      prismaMock.saint,
      prismaMock.marianApparition,
      prismaMock.parish,
      prismaMock.devotion,
      prismaMock.liturgyEntry,
      prismaMock.spiritualLifeGuide,
    ]) {
      m.findMany.mockResolvedValue([]);
    }
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([
      {
        sourceUrl: "https://vatican.va/p2",
        buildStatus: "build_failed_missing_required_fields",
        createdAt: new Date(),
        missingFieldsJson: ["prayerText", "prayerName"],
      },
    ]);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        host: "vatican.va",
        canIngestPrayers: true,
        canIngestSaints: false,
        canIngestApparitions: false,
        canIngestParishes: false,
        canIngestDevotions: false,
        canIngestNovenas: false,
        canIngestSacraments: false,
        canIngestRosaryGuides: false,
        canIngestConsecrations: false,
        canIngestSpiritualGuides: false,
        canIngestLiturgy: false,
        canIngestHistory: false,
        canProvideScriptureText: false,
      },
    ]);

    const rows = await listNonPublicRows({ filter: "all", limit: 20 });
    expect(rows[0].suggestedNextAction).toMatch(/refetch|prayerText/i);
    expect(rows[0].missingFields).toContain("prayerText");
  });
});

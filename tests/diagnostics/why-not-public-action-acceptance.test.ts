/**
 * "Why not public" automatic next action acceptance (spec §22, §23).
 *
 * Spec rule: the page should show, for every non-public row, the
 * "automatic next action" the operator can expect the system to
 * take. We exercise listNonPublicRows() and pin that every
 * returned row carries a non-empty suggestedNextAction string.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listNonPublicRows } from "@/lib/data/why-not-visible";

beforeEach(() => {
  resetPrismaMock();
});

describe("Why not public: automatic next action (spec §22)", () => {
  it("every row that is returned carries a suggestedNextAction string", async () => {
    // Set up some rows that look non-public.
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        id: "p1",
        slug: "x",
        defaultTitle: "Test Prayer",
        sourceUrl: "https://x/y",
        sourceHost: "x",
        status: "REVIEW",
        publicRenderReady: false,
        isThresholdEligible: false,
        packageValidationStatus: "invalid",
        packageValidationErrorsJson: null,
        translations: [],
      },
    ]);
    // Everything else returns empty.
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
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue(null);
    prismaMock.contentPackageBuildLog.findMany.mockResolvedValue([]);
    prismaMock.rejectedContentLog.findFirst.mockResolvedValue(null);
    prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
    prismaMock.ingestionSource.findUnique.mockResolvedValue(null);
    prismaMock.ingestionSource.findMany.mockResolvedValue([]);
    const rows = await listNonPublicRows({ filter: "all", limit: 50 });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row.suggestedNextAction).toBe("string");
      expect(row.suggestedNextAction.length).toBeGreaterThan(0);
    }
  });
});

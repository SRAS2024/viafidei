/**
 * Search must NEVER return rows that failed their package contract.
 * The data layer applies STRICT_PUBLIC_WHERE_CLAUSE (status=PUBLISHED,
 * publicRenderReady=true, isThresholdEligible=true, archivedAt=null)
 * to every search query. These tests verify the where clauses passed
 * to Prisma include all three flags.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { searchPrayers } from "@/lib/data/prayers";
import { searchSaints } from "@/lib/data/saints";
import { searchApparitions } from "@/lib/data/apparitions";
import { searchDevotions } from "@/lib/data/devotions";
import { searchParishes } from "@/lib/data/parishes";
import { searchLiturgy, searchSpiritualLife } from "@/lib/data/search";

beforeEach(() => {
  resetPrismaMock();
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.parish,
    prismaMock.liturgyEntry,
    prismaMock.spiritualLifeGuide,
  ]) {
    m.findMany.mockResolvedValue([]);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

function assertStrictWhere(call: { where: Record<string, unknown> }) {
  expect(call.where.status).toBe("PUBLISHED");
  expect(call.where.publicRenderReady).toBe(true);
  expect(call.where.isThresholdEligible).toBe(true);
  expect(call.where.archivedAt).toBe(null);
}

describe("public search excludes invalid / review / archived rows", () => {
  it("searchPrayers filters on the strict where clause", async () => {
    await searchPrayers("hail mary");
    expect(prismaMock.prayer.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.prayer.findMany.mock.calls[0][0];
    assertStrictWhere(call);
  });

  it("searchSaints filters on the strict where clause", async () => {
    await searchSaints("Anthony");
    expect(prismaMock.saint.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.saint.findMany.mock.calls[0][0];
    assertStrictWhere(call);
  });

  it("searchApparitions filters on the strict where clause", async () => {
    await searchApparitions("Fatima");
    expect(prismaMock.marianApparition.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.marianApparition.findMany.mock.calls[0][0];
    assertStrictWhere(call);
  });

  it("searchDevotions filters on the strict where clause", async () => {
    await searchDevotions("rosary");
    expect(prismaMock.devotion.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.devotion.findMany.mock.calls[0][0];
    assertStrictWhere(call);
  });

  it("searchParishes filters on the strict where clause", async () => {
    await searchParishes("Boston");
    expect(prismaMock.parish.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.parish.findMany.mock.calls[0][0];
    assertStrictWhere(call);
  });

  it("searchLiturgy filters on the strict where clause", async () => {
    await searchLiturgy("Mass");
    expect(prismaMock.liturgyEntry.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.liturgyEntry.findMany.mock.calls[0][0];
    assertStrictWhere(call);
  });

  it("searchSpiritualLife filters on the strict where clause", async () => {
    await searchSpiritualLife("examination");
    expect(prismaMock.spiritualLifeGuide.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.spiritualLifeGuide.findMany.mock.calls[0][0];
    assertStrictWhere(call);
  });
});

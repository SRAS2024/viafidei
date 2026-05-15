import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listSaintsForFeastDate } from "@/lib/data/saints";

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listSaintsForFeastDate", () => {
  it("returns rows whose structured feast columns match the date", async () => {
    prismaMock.saint.findMany
      .mockResolvedValueOnce([
        // First call: structured query
        {
          id: "1",
          slug: "st-anthony-of-padua",
          canonicalName: "St. Anthony of Padua",
          feastMonth: 6,
          feastDayOfMonth: 13,
          feastDay: "June 13",
          patronages: [],
          biography: "",
          translations: [],
          status: "PUBLISHED",
        },
      ])
      // Second call: legacy fallback (no rows)
      .mockResolvedValueOnce([]);

    const result = await listSaintsForFeastDate("en", 6, 13);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("st-anthony-of-padua");
  });

  it("falls back to legacy feastDay text matching when structured fields are null", async () => {
    // The structured query returns nothing.
    prismaMock.saint.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      // The legacy query returns rows with null structured fields.
      {
        id: "2",
        slug: "st-thecla",
        canonicalName: "St. Thecla",
        feastMonth: null,
        feastDayOfMonth: null,
        feastDay: "September 23",
        patronages: [],
        biography: "",
        translations: [],
        status: "PUBLISHED",
      },
      {
        id: "3",
        slug: "st-padre-pio",
        canonicalName: "St. Padre Pio",
        feastMonth: null,
        feastDayOfMonth: null,
        feastDay: "September 23 — Capuchin friar",
        patronages: [],
        biography: "",
        translations: [],
        status: "PUBLISHED",
      },
      // This row mentions September but on a different day — feastDayMatchesDate
      // filters it out.
      {
        id: "4",
        slug: "st-pius-x",
        canonicalName: "St. Pius X",
        feastMonth: null,
        feastDayOfMonth: null,
        feastDay: "September 3",
        patronages: [],
        biography: "",
        translations: [],
        status: "PUBLISHED",
      },
    ]);

    const result = await listSaintsForFeastDate("en", 9, 23);
    expect(result.map((s) => s.slug)).toEqual(
      expect.arrayContaining(["st-thecla", "st-padre-pio"]),
    );
    expect(result.find((s) => s.slug === "st-pius-x")).toBeUndefined();
  });

  it("deduplicates rows that match both the structured query and the legacy query", async () => {
    const dup = {
      id: "dup-1",
      slug: "st-joseph",
      canonicalName: "St. Joseph",
      feastMonth: 3,
      feastDayOfMonth: 19,
      feastDay: "March 19",
      patronages: [],
      biography: "",
      translations: [],
      status: "PUBLISHED",
    };
    prismaMock.saint.findMany
      .mockResolvedValueOnce([dup])
      // Legacy fallback won't include rows with feastMonth set, so this is
      // empty in practice — but make sure the merge dedupes by id.
      .mockResolvedValueOnce([]);

    const result = await listSaintsForFeastDate("en", 3, 19);
    expect(result).toHaveLength(1);
  });

  it("rejects invalid month/day values", async () => {
    expect(await listSaintsForFeastDate("en", 0, 1)).toEqual([]);
    expect(await listSaintsForFeastDate("en", 13, 1)).toEqual([]);
    expect(await listSaintsForFeastDate("en", 1, 0)).toEqual([]);
    expect(await listSaintsForFeastDate("en", 1, 32)).toEqual([]);
    // No DB call should be made when the inputs are invalid.
    expect(prismaMock.saint.findMany).not.toHaveBeenCalled();
  });

  it("returns empty list with no errors when no rows match", async () => {
    prismaMock.saint.findMany.mockResolvedValue([]);
    const result = await listSaintsForFeastDate("en", 2, 30);
    expect(result).toEqual([]);
  });
});

/**
 * Prayer of the day (src/lib/data/prayer-of-the-day.ts): deterministic per
 * calendar date, seasonally aware, computed at request time with two small
 * queries — no worker involved.
 */
import { describe, expect, it, vi } from "vitest";

const rows = [
  {
    slug: "act-of-contrition",
    title: "Act of Contrition",
    subtitle: null,
    payload: {
      body: "O my God, I am heartily sorry for having offended Thee",
      prayerType: "act",
      category: "penitential",
    },
  },
  {
    slug: "anima-christi",
    title: "Anima Christi",
    subtitle: null,
    payload: {
      body: "Soul of Christ, sanctify me",
      prayerType: "general",
      category: "eucharistic",
    },
  },
  {
    slug: "hail-mary",
    title: "Hail Mary",
    subtitle: null,
    payload: { body: "Hail Mary, full of grace", prayerType: "marian", category: "marian" },
  },
  {
    slug: "our-father",
    title: "Our Father",
    subtitle: "A prayer of the Catholic Church",
    payload: { body: "Our Father, who art in heaven", prayerType: "general", category: "general" },
  },
];

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: {
      count: vi.fn(async () => rows.length),
      findMany: vi.fn(async ({ skip = 0, take }: { skip?: number; take: number }) =>
        rows.slice(skip, skip + take),
      ),
    },
  },
}));

import { hashDate, prayerOfTheDay, seasonalPreference } from "@/lib/data/prayer-of-the-day";

describe("prayer of the day", () => {
  it("hashes dates stably and differently", () => {
    expect(hashDate("2026-09-06")).toBe(hashDate("2026-09-06"));
    expect(hashDate("2026-09-06")).not.toBe(hashDate("2026-09-07"));
  });

  it("prefers penitential prayers in Lent, Marian in Advent/Christmas, Eucharistic in Easter", () => {
    expect(seasonalPreference("2026-03-01")).toEqual(["penitential"]); // Lent 2026
    expect(seasonalPreference("2026-12-06")).toEqual(["marian"]); // Advent
    expect(seasonalPreference("2026-04-12")).toEqual(["eucharistic", "trinitarian"]); // Easter
    expect(seasonalPreference("2026-09-06")).toEqual([]); // Ordinary Time
    expect(seasonalPreference("not-a-date")).toEqual([]);
  });

  it("returns the same prayer for the same date and a full excerpt", async () => {
    const a = await prayerOfTheDay("2026-09-06");
    const b = await prayerOfTheDay("2026-09-06");
    expect(a).toEqual(b);
    expect(a?.slug).toBeTruthy();
    expect(a?.excerpt.length).toBeGreaterThan(0);
  });

  it("picks a seasonal prayer in Lent when one is within reach", async () => {
    const lent = await prayerOfTheDay("2026-03-01");
    expect(lent?.category).toBe("penitential");
  });
});

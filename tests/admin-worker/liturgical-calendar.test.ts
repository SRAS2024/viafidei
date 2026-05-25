/**
 * Liturgical calendar engine — proves Easter math + seasonal
 * relevance scoring are deterministic.
 */

import { describe, expect, it } from "vitest";

import {
  computeLiturgicalContext,
  gregorianEaster,
  seasonalRelevance,
} from "@/lib/admin-worker/liturgical-calendar";

describe("gregorianEaster", () => {
  it("matches known Easter dates", () => {
    // Sanity checks from public ecclesiastical tables.
    expect(gregorianEaster(2024).toISOString().slice(0, 10)).toBe("2024-03-31");
    expect(gregorianEaster(2025).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(gregorianEaster(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(gregorianEaster(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
  });
});

describe("computeLiturgicalContext", () => {
  it("marks Easter Sunday correctly", () => {
    const easter = gregorianEaster(2026);
    const ctx = computeLiturgicalContext(easter);
    expect(ctx.isEaster).toBe(true);
    expect(ctx.season).toBe("EASTER");
  });

  it("marks Christmas correctly", () => {
    const ctx = computeLiturgicalContext(new Date(Date.UTC(2026, 11, 25)));
    expect(ctx.isChristmas).toBe(true);
    expect(ctx.season).toBe("CHRISTMAS");
  });

  it("marks Ash Wednesday's season as LENT", () => {
    // 2026 Ash Wednesday = Easter (Apr 5) - 46 days = Feb 18.
    const ctx = computeLiturgicalContext(new Date(Date.UTC(2026, 1, 20)));
    expect(ctx.season).toBe("LENT");
  });

  it("marks early December (after first Sunday of Advent) as ADVENT", () => {
    const ctx = computeLiturgicalContext(new Date(Date.UTC(2026, 11, 5)));
    expect(ctx.season).toBe("ADVENT");
  });

  it("returns ORDINARY_TIME mid-summer", () => {
    const ctx = computeLiturgicalContext(new Date(Date.UTC(2026, 6, 15)));
    expect(ctx.season).toBe("ORDINARY_TIME");
  });

  it("flags Marian months (May, October)", () => {
    expect(computeLiturgicalContext(new Date(Date.UTC(2026, 4, 15))).inMarianMonth).toBe(true);
    expect(computeLiturgicalContext(new Date(Date.UTC(2026, 9, 15))).inMarianMonth).toBe(true);
    expect(computeLiturgicalContext(new Date(Date.UTC(2026, 6, 15))).inMarianMonth).toBe(false);
  });
});

describe("seasonalRelevance", () => {
  it("returns 1 on Easter and Christmas", () => {
    expect(seasonalRelevance(gregorianEaster(2026))).toBeCloseTo(1, 5);
    expect(seasonalRelevance(new Date(Date.UTC(2026, 11, 25)))).toBeCloseTo(1, 5);
  });

  it("is highest in major seasons and lower in Ordinary Time", () => {
    const lent = seasonalRelevance(new Date(Date.UTC(2026, 2, 1)));
    const ordinary = seasonalRelevance(new Date(Date.UTC(2026, 6, 15)));
    expect(lent).toBeGreaterThan(ordinary);
  });

  it("always returns a number in [0, 1]", () => {
    for (let month = 0; month < 12; month++) {
      const v = seasonalRelevance(new Date(Date.UTC(2026, month, 15)));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

import { describe, expect, it } from "vitest";

import { formatMiles, haversineMiles } from "@/lib/content-shared/geo";

describe("haversineMiles", () => {
  it("is zero for the same point", () => {
    expect(haversineMiles(40, -74, 40, -74)).toBe(0);
  });

  it("approximates a known distance (NYC ↔ LA ≈ 2450 mi)", () => {
    const miles = haversineMiles(40.7128, -74.006, 34.0522, -118.2437);
    expect(miles).toBeGreaterThan(2400);
    expect(miles).toBeLessThan(2500);
  });

  it("ranks a nearer point as smaller", () => {
    const here = { lat: 41.9, lon: 12.45 }; // Rome
    const near = haversineMiles(here.lat, here.lon, 41.902, 12.453); // ~Vatican
    const far = haversineMiles(here.lat, here.lon, 48.8566, 2.3522); // Paris
    expect(near).toBeLessThan(far);
  });
});

describe("formatMiles", () => {
  it("shows one decimal under 10 miles", () => {
    expect(formatMiles(0.42)).toBe("0.4 mi");
    expect(formatMiles(9.2)).toBe("9.2 mi");
  });

  it("rounds and groups thousands at 10 miles and above", () => {
    expect(formatMiles(12.3)).toBe("12 mi");
    expect(formatMiles(1340)).toBe("1,340 mi");
  });
});

import { describe, expect, it } from "vitest";
import { inferTierFromHost, routeByTier, tierLabel } from "@/lib/ingestion/source-tier";

describe("source tier classification", () => {
  it("vatican.va → tier 1", () => {
    expect(inferTierFromHost("www.vatican.va")).toBe(1);
    expect(inferTierFromHost("vatican.va")).toBe(1);
    expect(inferTierFromHost("press.vatican.va")).toBe(1);
  });

  it("usccb.org → tier 1", () => {
    expect(inferTierFromHost("usccb.org")).toBe(1);
    expect(inferTierFromHost("www.usccb.org")).toBe(1);
  });

  it("catholic.com / newadvent.org → tier 2", () => {
    expect(inferTierFromHost("catholic.com")).toBe(2);
    expect(inferTierFromHost("www.newadvent.org")).toBe(2);
    expect(inferTierFromHost("ewtn.com")).toBe(2);
  });

  it("unknown / random → tier 3", () => {
    expect(inferTierFromHost("example.com")).toBe(3);
    expect(inferTierFromHost("some-random-blog.net")).toBe(3);
  });

  it("tierLabel produces a readable string", () => {
    expect(tierLabel(1)).toMatch(/Tier 1/);
    expect(tierLabel(2)).toMatch(/Tier 2/);
    expect(tierLabel(3)).toMatch(/Tier 3/);
    expect(tierLabel(null)).toMatch(/unknown/);
  });
});

describe("source tier routing", () => {
  it("tier 1: high confidence → PUBLISHED", () => {
    expect(routeByTier(1, { confidence: 0.7 }).status).toBe("PUBLISHED");
  });

  it("tier 1: low confidence → REVIEW", () => {
    expect(routeByTier(1, { confidence: 0.2 }).status).toBe("REVIEW");
  });

  it("tier 2: 0.8 confidence → PUBLISHED, 0.7 → REVIEW", () => {
    expect(routeByTier(2, { confidence: 0.85 }).status).toBe("PUBLISHED");
    expect(routeByTier(2, { confidence: 0.7 }).status).toBe("REVIEW");
  });

  it("tier 3: anything below 0.95 → REVIEW", () => {
    expect(routeByTier(3, { confidence: 0.9 }).status).toBe("REVIEW");
    expect(routeByTier(3, { confidence: 0.97 }).status).toBe("PUBLISHED");
  });

  it("theologicalReviewFlag forces REVIEW regardless of tier", () => {
    expect(routeByTier(1, { confidence: 1.0, theologicalReviewFlag: true }).status).toBe("REVIEW");
  });

  it("soft-failed routing always returns REVIEW", () => {
    expect(routeByTier(1, { confidence: 1.0, softFailed: true }).status).toBe("REVIEW");
  });
});

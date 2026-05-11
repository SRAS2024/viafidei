import { describe, expect, it } from "vitest";
import { looksLikeLocationQuery } from "@/lib/data/external-parishes";

describe("looksLikeLocationQuery", () => {
  it("recognizes US ZIP codes", () => {
    expect(looksLikeLocationQuery("94103")).toBe(true);
    expect(looksLikeLocationQuery("10001-1234")).toBe(true);
  });

  it("recognizes UK and Canadian postcodes", () => {
    expect(looksLikeLocationQuery("SW1A 1AA")).toBe(true);
    expect(looksLikeLocationQuery("M5V 3L9")).toBe(true);
  });

  it('recognizes "City, ST" patterns', () => {
    expect(looksLikeLocationQuery("Boston, MA")).toBe(true);
    expect(looksLikeLocationQuery("Saint Louis, Missouri")).toBe(true);
    expect(looksLikeLocationQuery("Los Angeles, CA")).toBe(true);
  });

  it("recognizes lat,lon pairs", () => {
    expect(looksLikeLocationQuery("40.7128,-74.0060")).toBe(true);
    expect(looksLikeLocationQuery("48.8566, 2.3522")).toBe(true);
  });

  it("rejects plain parish-name searches", () => {
    expect(looksLikeLocationQuery("Saint Patrick")).toBe(false);
    expect(looksLikeLocationQuery("Notre Dame")).toBe(false);
    expect(looksLikeLocationQuery("Sacred Heart Parish")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(looksLikeLocationQuery("")).toBe(false);
    expect(looksLikeLocationQuery("  ")).toBe(false);
  });
});

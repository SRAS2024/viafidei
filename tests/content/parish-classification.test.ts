/**
 * Parish classification filters: Parish, Cathedral, Basilica, Shrine. Each is
 * distinct from an ordinary parish.
 */

import { describe, expect, it } from "vitest";

import {
  classifyParish,
  resolveParishFilter,
  parishMatchesFilter,
  PARISH_FILTERS,
} from "@/lib/content-shared/parish";

describe("classifyParish", () => {
  it("classifies cathedrals distinctly", () => {
    expect(classifyParish("cathedral")).toBe("cathedral");
  });
  it("classifies major + minor basilicas as basilica", () => {
    expect(classifyParish("major-basilica")).toBe("basilica");
    expect(classifyParish("minor-basilica")).toBe("basilica");
  });
  it("classifies shrines as their own classification", () => {
    expect(classifyParish("shrine")).toBe("shrine");
  });
  it("treats ordinary parishes / unknown as parish", () => {
    expect(classifyParish("parish")).toBe("parish");
    expect(classifyParish(undefined)).toBe("parish");
  });
});

describe("parish filter behavior", () => {
  it("exposes all required filters in order (Parish, Cathedral, Basilica, Shrine)", () => {
    const keys = PARISH_FILTERS.map((f) => f.key);
    expect(keys).toEqual(["all", "parish", "cathedral", "basilica", "shrine"]);
  });

  it("a classification filter excludes other classifications", () => {
    expect(parishMatchesFilter("cathedral", "cathedral")).toBe(true);
    expect(parishMatchesFilter("parish", "cathedral")).toBe(false);
    expect(parishMatchesFilter("minor-basilica", "basilica")).toBe(true);
    expect(parishMatchesFilter("cathedral", "basilica")).toBe(false);
    // Shrine is its own bucket — not lumped into Parishes.
    expect(parishMatchesFilter("shrine", "shrine")).toBe(true);
    expect(parishMatchesFilter("shrine", "parish")).toBe(false);
    expect(parishMatchesFilter("parish", "shrine")).toBe(false);
  });

  it("'all' matches every classification", () => {
    for (const d of ["parish", "cathedral", "major-basilica", "shrine"]) {
      expect(parishMatchesFilter(d, "all")).toBe(true);
    }
  });

  it("resolves shrine and falls back to 'all' for an unknown filter", () => {
    expect(resolveParishFilter("shrine")).toBe("shrine");
    expect(resolveParishFilter("garbage")).toBe("all");
  });
});

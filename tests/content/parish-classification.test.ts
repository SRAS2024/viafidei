/**
 * Parish classification filters: Parish, Cathedral, Basilica. Cathedrals and
 * basilicas must be distinct from ordinary parishes.
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
  it("treats ordinary parishes / shrines / unknown as parish", () => {
    expect(classifyParish("parish")).toBe("parish");
    expect(classifyParish("shrine")).toBe("parish");
    expect(classifyParish(undefined)).toBe("parish");
  });
});

describe("parish filter behavior", () => {
  it("exposes all required filters", () => {
    const keys = PARISH_FILTERS.map((f) => f.key);
    for (const k of ["all", "parish", "cathedral", "basilica"]) expect(keys).toContain(k);
  });

  it("a classification filter excludes other classifications", () => {
    expect(parishMatchesFilter("cathedral", "cathedral")).toBe(true);
    expect(parishMatchesFilter("parish", "cathedral")).toBe(false);
    expect(parishMatchesFilter("minor-basilica", "basilica")).toBe(true);
    expect(parishMatchesFilter("cathedral", "basilica")).toBe(false);
  });

  it("'all' matches every classification", () => {
    for (const d of ["parish", "cathedral", "major-basilica", "shrine"]) {
      expect(parishMatchesFilter(d, "all")).toBe(true);
    }
  });

  it("falls back to 'all' for an unknown filter", () => {
    expect(resolveParishFilter("garbage")).toBe("all");
  });
});

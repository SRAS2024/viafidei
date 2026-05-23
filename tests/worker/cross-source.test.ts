/**
 * Tests for cross-source reconciliation.
 */

import { describe, it, expect } from "vitest";

import { reconcileField, reconcileFields } from "@/lib/worker/build/cross-source";

describe("reconcileField", () => {
  it("picks the highest authority when sources disagree", () => {
    const result = reconcileField("title", [
      {
        value: "Wrong Answer",
        authorityLevel: "COMMUNITY",
        sourceUrl: "https://community.example.com",
        sourceHost: "community.example.com",
      },
      {
        value: "Correct Vatican Answer",
        authorityLevel: "VATICAN",
        sourceUrl: "https://www.vatican.va/",
        sourceHost: "vatican.va",
      },
    ]);
    expect(result?.value).toBe("Correct Vatican Answer");
  });

  it("raises confidence when same-tier sources agree", () => {
    const result = reconcileField("title", [
      {
        value: "Agreed",
        authorityLevel: "USCCB",
        sourceUrl: "https://www.usccb.org/a",
        sourceHost: "usccb.org",
      },
      {
        value: "Agreed",
        authorityLevel: "USCCB",
        sourceUrl: "https://www.usccb.org/b",
        sourceHost: "usccb.org",
      },
    ]);
    expect(result?.value).toBe("Agreed");
    expect(result?.confidence).toBeGreaterThan(0.8);
    expect(result?.needsHumanReview).toBe(false);
  });

  it("flags conflicts at the same authority level", () => {
    const result = reconcileField("feastDay", [
      {
        value: "06-29",
        authorityLevel: "VATICAN",
        sourceUrl: "https://www.vatican.va/a",
        sourceHost: "vatican.va",
      },
      {
        value: "06-30",
        authorityLevel: "VATICAN",
        sourceUrl: "https://www.vatican.va/b",
        sourceHost: "vatican.va",
      },
    ]);
    expect(result?.needsHumanReview).toBe(true);
    expect(result?.warnings.some((w) => w.includes("conflicting"))).toBe(true);
  });

  it("returns null for empty candidate list", () => {
    expect(reconcileField("title", [])).toBeNull();
  });
});

describe("reconcileFields", () => {
  it("reconciles multiple fields and aggregates confidence", () => {
    const result = reconcileFields({
      title: [
        {
          value: "Our Father",
          authorityLevel: "VATICAN",
          sourceUrl: "https://www.vatican.va/",
          sourceHost: "vatican.va",
        },
      ],
      category: [
        {
          value: "general",
          authorityLevel: "USCCB",
          sourceUrl: "https://www.usccb.org/",
          sourceHost: "usccb.org",
        },
      ],
    });
    expect(result.values.title).toBe("Our Father");
    expect(result.values.category).toBe("general");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.needsHumanReview).toBe(false);
  });
});

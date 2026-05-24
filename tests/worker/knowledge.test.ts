/**
 * Tests that the curated knowledge base is well-formed and validates against
 * the strict content schemas. If any entry fails to validate it means a
 * developer bug — the curated content is the worker's ground truth.
 */

import { describe, it, expect } from "vitest";

import {
  ALL_CURATED_ENTRIES,
  curatedKnowledgeByType,
  curatedKnowledgeSize,
  findCuratedEntry,
} from "@/lib/worker";
import { validatePayload } from "@/lib/worker/schemas";

describe("curated knowledge base", () => {
  it("contains many entries", () => {
    expect(curatedKnowledgeSize()).toBeGreaterThan(40);
  });

  it("covers all 11 content types with at least one entry each", () => {
    const counts = curatedKnowledgeByType();
    const types = [
      "PRAYER",
      "DEVOTION",
      "SAINT",
      "MARIAN_TITLE",
      "APPARITION",
      "NOVENA",
      "SACRAMENT",
      "GUIDE",
      "CHURCH_DOCUMENT",
      "LITURGICAL",
      "SPIRITUAL_PRACTICE",
    ] as const;
    for (const t of types) {
      expect(counts[t] ?? 0).toBeGreaterThan(0);
    }
  });

  it("every entry validates against its content schema", () => {
    for (const entry of ALL_CURATED_ENTRIES) {
      const result = validatePayload(entry.contentType, entry.payload);
      if (!result.ok) {
        // Surface the first error so the test report is useful.
        throw new Error(
          `Curated entry ${entry.contentType}:${entry.slug} failed validation: ${result.errors.join("; ")}`,
        );
      }
      expect(result.ok).toBe(true);
    }
  });

  it("every entry has a non-empty citation list", () => {
    for (const entry of ALL_CURATED_ENTRIES) {
      expect(entry.citations.length).toBeGreaterThan(0);
    }
  });

  it("findCuratedEntry locates the seven sacraments", () => {
    const slugs = [
      "baptism",
      "confirmation",
      "eucharist",
      "reconciliation",
      "anointing-of-the-sick",
      "holy-orders",
      "matrimony",
    ];
    for (const slug of slugs) {
      const entry = findCuratedEntry("SACRAMENT", slug);
      expect(entry, `missing sacrament ${slug}`).toBeDefined();
      expect(entry!.authorityLevel).toBe("CATECHISM");
    }
  });

  it("findCuratedEntry locates Our Father and Hail Mary", () => {
    expect(findCuratedEntry("PRAYER", "our-father")).toBeDefined();
    expect(findCuratedEntry("PRAYER", "hail-mary")).toBeDefined();
  });

  it("returns undefined for an unknown slug", () => {
    expect(findCuratedEntry("PRAYER", "nonexistent-prayer-slug")).toBeUndefined();
  });
});

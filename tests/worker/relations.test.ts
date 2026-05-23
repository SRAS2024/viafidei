/**
 * Tests for content-relation extraction (saint→feast day, devotion→prayer, ...).
 */

import { describe, it, expect } from "vitest";

import { extractRelationCandidates } from "@/lib/worker/relations";

describe("extractRelationCandidates", () => {
  it("maps SAINT → LITURGICAL via feastDaySlug", () => {
    const candidates = extractRelationCandidates({
      fromItemId: "ci-1",
      fromType: "SAINT",
      payload: { feastDaySlug: "feast-of-saint-joseph" },
    });
    expect(candidates.some((c) => c.relationType === "HAS_FEAST_DAY")).toBe(true);
  });

  it("maps DEVOTION → PRAYER via relatedPrayers list", () => {
    const candidates = extractRelationCandidates({
      fromItemId: "ci-1",
      fromType: "DEVOTION",
      payload: {
        relatedPrayers: ["hail-mary", "our-father"],
      },
    });
    const prayerRels = candidates.filter((c) => c.toType === "PRAYER");
    expect(prayerRels.length).toBe(2);
    expect(prayerRels.every((r) => r.relationType === "USES_PRAYER")).toBe(true);
  });

  it("maps MARIAN_TITLE → APPARITION", () => {
    const candidates = extractRelationCandidates({
      fromItemId: "ci-1",
      fromType: "MARIAN_TITLE",
      payload: { associatedApparitionSlug: "apparition-our-lady-of-guadalupe" },
    });
    expect(candidates.some((c) => c.relationType === "LINKED_TO_APPARITION")).toBe(true);
  });

  it("maps GUIDE → SACRAMENT", () => {
    const candidates = extractRelationCandidates({
      fromItemId: "ci-1",
      fromType: "GUIDE",
      payload: { sacramentKey: "reconciliation" },
    });
    expect(candidates.some((c) => c.relationType === "COVERS_SACRAMENT")).toBe(true);
  });

  it("emits no relations when payload has nothing to relate", () => {
    const candidates = extractRelationCandidates({
      fromItemId: "ci-1",
      fromType: "PRAYER",
      payload: { body: "Just text." },
    });
    expect(candidates).toHaveLength(0);
  });
});

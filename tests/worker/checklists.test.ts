/**
 * Tests that every master checklist is well-formed.
 */

import { describe, it, expect } from "vitest";

import { MASTER_CHECKLISTS, totalChecklistItems } from "@/lib/worker/checklists";
import { canonicalizeSlug } from "@/lib/worker/slugs";

describe("master checklists", () => {
  it("covers every content type", () => {
    expect(Object.keys(MASTER_CHECKLISTS)).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });

  it("seeds dozens of items", () => {
    expect(totalChecklistItems()).toBeGreaterThan(100);
  });

  it("uses canonical slugs for every item", () => {
    for (const [contentType, items] of Object.entries(MASTER_CHECKLISTS)) {
      for (const item of items) {
        const canonical = canonicalizeSlug(item.canonicalSlug);
        expect(canonical).toBe(item.canonicalSlug);
        expect(item.canonicalName.length).toBeGreaterThan(0);
        expect(item.canonicalSlug.length).toBeGreaterThan(0);
      }
      expect(items.length).toBeGreaterThan(0);
      expect(contentType.length).toBeGreaterThan(0);
    }
  });

  it("never repeats slugs within a content type", () => {
    for (const [contentType, items] of Object.entries(MASTER_CHECKLISTS)) {
      const slugs = items.map((i) => i.canonicalSlug);
      const dedup = new Set(slugs);
      expect(dedup.size, `Duplicate slugs in ${contentType}`).toBe(slugs.length);
    }
  });

  it("seeds the seven sacraments and no extras", () => {
    const slugs = MASTER_CHECKLISTS.SACRAMENT.map((s) => s.canonicalSlug).sort();
    expect(slugs).toEqual(
      [
        "anointing-of-the-sick",
        "baptism",
        "confirmation",
        "eucharist",
        "holy-orders",
        "matrimony",
        "reconciliation",
      ].sort(),
    );
  });
});

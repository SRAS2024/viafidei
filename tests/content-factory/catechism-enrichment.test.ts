/**
 * Catechism enrichment tests (spec §10).
 */

import { describe, expect, it } from "vitest";
import {
  CATECHISM_REFERENCES_BY_SACRAMENT,
  RELATED_PRAYER_HINTS_BY_SACRAMENT,
  catechismReferencesFor,
  enrichSacramentCatechism,
} from "@/lib/content-factory/enrich/catechism-references";
import type { ContentPackage } from "@/lib/content-factory/types";

function sacramentPackage(key: string): ContentPackage {
  return {
    contentType: "Sacrament",
    slug: key,
    title: key,
    sourceUrl: `https://vatican.va/sacrament/${key}`,
    sourceHost: "vatican.va",
    payload: { sacramentKey: key },
    provenance: {},
  };
}

describe("CATECHISM_REFERENCES_BY_SACRAMENT", () => {
  it("has references for every spec sacrament", () => {
    for (const key of [
      "baptism",
      "eucharist",
      "confirmation",
      "reconciliation",
      "anointing_of_the_sick",
      "holy_orders",
      "matrimony",
    ]) {
      const refs = CATECHISM_REFERENCES_BY_SACRAMENT[key];
      expect(refs).toBeDefined();
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) {
        expect(r.paragraph).toMatch(/^\d+$/);
        expect(r.topic.length).toBeGreaterThan(0);
      }
    }
  });

  it("has related-prayer hints for every spec sacrament", () => {
    for (const key of [
      "baptism",
      "eucharist",
      "confirmation",
      "reconciliation",
      "anointing_of_the_sick",
      "holy_orders",
      "matrimony",
    ]) {
      expect(RELATED_PRAYER_HINTS_BY_SACRAMENT[key]).toBeDefined();
    }
  });
});

describe("catechismReferencesFor()", () => {
  it("returns refs for a known sacrament", () => {
    const refs = catechismReferencesFor("baptism");
    expect(refs.length).toBeGreaterThan(0);
  });

  it("returns an empty array for an unknown sacrament", () => {
    expect(catechismReferencesFor("not_a_sacrament")).toEqual([]);
  });
});

describe("enrichSacramentCatechism()", () => {
  it("fills catechismReferences on a sacrament package missing the field", () => {
    const pkg = sacramentPackage("baptism");
    const result = enrichSacramentCatechism(pkg);
    expect(result.filled).toBe(true);
    expect(result.references.length).toBeGreaterThan(0);
    expect((pkg.payload as { catechismReferences: unknown[] }).catechismReferences.length).toBe(
      result.references.length,
    );
  });

  it("does NOT overwrite a sacrament package that already has references", () => {
    const pkg = sacramentPackage("eucharist");
    (pkg.payload as Record<string, unknown>).catechismReferences = [
      { paragraph: "EXISTING", topic: "kept" },
    ];
    const result = enrichSacramentCatechism(pkg);
    expect(result.filled).toBe(false);
  });

  it("skips non-sacrament packages", () => {
    const pkg: ContentPackage = {
      contentType: "Prayer",
      slug: "x",
      title: "x",
      sourceUrl: "https://x",
      sourceHost: "x",
      payload: {},
      provenance: {},
    };
    expect(enrichSacramentCatechism(pkg).filled).toBe(false);
  });

  it("skips when the sacramentKey is unknown", () => {
    const pkg = sacramentPackage("bogus");
    expect(enrichSacramentCatechism(pkg).filled).toBe(false);
  });
});

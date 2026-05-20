/**
 * Sacrament enrich-step coverage acceptance (spec §10, §23).
 *
 * Spec §10: "Add Catechism reference enrichment. Add related prayer
 * enrichment when available." This test pins that enrichPackage()
 * runs both Sacrament enrichers in the right order, so every
 * persisted sacrament package carries:
 *
 *   - sacramentGroup        ← canonical 7-sacrament map
 *   - catechismReferences   ← Catechism reference table
 *   - relatedPrayerSlugs    ← related-prayer hints
 *
 * If a future refactor drops either enricher, the assertion below
 * fails before the change ships.
 */

import { describe, expect, it } from "vitest";
import { enrichPackage } from "@/lib/content-factory/enrich";
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

describe("Sacrament enrich step coverage (spec §10)", () => {
  for (const key of [
    "baptism",
    "eucharist",
    "confirmation",
    "reconciliation",
    "anointing_of_the_sick",
    "holy_orders",
    "matrimony",
  ]) {
    it(`${key} package gets group + Catechism refs + related prayers`, () => {
      const pkg = sacramentPackage(key);
      enrichPackage(pkg, "1.0.0");
      const p = pkg.payload as Record<string, unknown>;
      expect(p.sacramentGroup, `${key}: sacramentGroup not enriched`).toBeDefined();
      const refs = p.catechismReferences as unknown[];
      expect(refs?.length ?? 0).toBeGreaterThan(0);
      const prayers = p.relatedPrayerSlugs as unknown[];
      expect(prayers?.length ?? 0).toBeGreaterThan(0);
    });
  }

  it("non-sacrament packages do NOT receive sacrament-only enrichment fields", () => {
    const pkg: ContentPackage = {
      contentType: "Prayer",
      slug: "x",
      title: "Some prayer",
      sourceUrl: "https://x",
      sourceHost: "x",
      payload: {},
      provenance: {},
    };
    enrichPackage(pkg, "1.0.0");
    expect((pkg.payload as Record<string, unknown>).catechismReferences).toBeUndefined();
    expect((pkg.payload as Record<string, unknown>).relatedPrayerSlugs).toBeUndefined();
    expect((pkg.payload as Record<string, unknown>).sacramentGroup).toBeUndefined();
  });
});

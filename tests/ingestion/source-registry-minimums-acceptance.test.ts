/**
 * Production source registry minimums acceptance (spec §1, §4, §24).
 *
 * Spec §4 names the recommended minimum number of factory-ready
 * sources per content type:
 *
 *   Prayer ≥5, Saint ≥5, Devotion ≥4, Novena ≥4, Sacrament ≥3,
 *   Rosary ≥3, Consecration ≥3, Liturgy ≥3, History ≥5, Parish ≥3,
 *   Marian Apparition ≥3.
 *
 * This test pins that the curated PRODUCTION_SOURCE_REGISTRY itself
 * meets every spec minimum — a fresh deployment seeded from the
 * registry has enough sources per content type to clear the
 * minimums even before an operator adds anything.
 *
 * Adding a new content type without adding sources to the registry
 * (or reducing the registry below a minimum) will fail this test
 * BEFORE the change ships.
 */

import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SOURCE_REGISTRY,
  groupSourcesByContentType,
} from "@/lib/ingestion/sources/production-source-registry";

const SPEC_MINIMUMS: Record<string, number> = {
  Prayer: 5,
  Saint: 5,
  Devotion: 4,
  Novena: 4,
  Sacrament: 3,
  Rosary: 3,
  Consecration: 3,
  Liturgy: 3,
  History: 5,
  Parish: 3,
  MarianApparition: 3,
};

describe("Spec §4 minimums met by the curated registry", () => {
  const groups = groupSourcesByContentType();
  for (const [contentType, minimum] of Object.entries(SPEC_MINIMUMS)) {
    it(`${contentType} has ≥${minimum} factory-ready sources in the registry`, () => {
      const count = groups[contentType]?.length ?? 0;
      expect(
        count,
        `${contentType}: registry has ${count} source(s), needs at least ${minimum}`,
      ).toBeGreaterThanOrEqual(minimum);
    });
  }

  it("every spec content type has at least one validation source", () => {
    const validationByType = new Map<string, number>();
    for (const e of PRODUCTION_SOURCE_REGISTRY) {
      // primary_content_source AND validation_source both qualify
      // as validators (a primary source can also validate other
      // candidates).
      if (e.role !== "primary_content_source" && e.role !== "validation_source") {
        continue;
      }
      for (const ct of e.supportedContentTypes) {
        validationByType.set(ct, (validationByType.get(ct) ?? 0) + 1);
      }
    }
    for (const ct of Object.keys(SPEC_MINIMUMS)) {
      const count = validationByType.get(ct) ?? 0;
      expect(count, `${ct}: registry has no validation-capable source`).toBeGreaterThan(0);
    }
  });
});

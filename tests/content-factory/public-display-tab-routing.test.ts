/**
 * Public display + tab routing acceptance (spec §18, §24).
 *
 * Pins:
 *   - The content-type → tab map covers every spec-listed content
 *     type (no missing entries that would cause a package to land
 *     in the wrong tab or get hidden entirely).
 *   - The map agrees with the diagnostics module so the admin
 *     tab-diagnostics page and the cache revalidation tags name
 *     the same tabs.
 */

import { describe, expect, it } from "vitest";
import { CONTENT_TYPE_TO_TAB } from "@/lib/cache/tags";
import { TAB_KEYS } from "@/lib/diagnostics/tab-diagnostics";

describe("Public display tab routing (spec §18, §24)", () => {
  it("Every value of CONTENT_TYPE_TO_TAB is a known tab", () => {
    const valid = new Set<string>([...TAB_KEYS, "rosary", "consecrations"]);
    for (const [contentType, tab] of Object.entries(CONTENT_TYPE_TO_TAB)) {
      expect(valid.has(tab as string), `${contentType} → ${tab} not in valid tab set`).toBe(true);
    }
  });

  it("Every spec content type has a tab mapping", () => {
    const want = [
      "Prayer",
      "Saint",
      "MarianApparition",
      "Parish",
      "Devotion",
      "Novena",
      "Sacrament",
      "Rosary",
      "Consecration",
      "Liturgy",
      "History",
    ];
    for (const ct of want) {
      expect(
        CONTENT_TYPE_TO_TAB[ct as keyof typeof CONTENT_TYPE_TO_TAB],
        `${ct} missing from CONTENT_TYPE_TO_TAB`,
      ).toBeDefined();
    }
  });
});

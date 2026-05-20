/**
 * Content-appears-on-correct-tab acceptance (spec §23, §24).
 *
 * Spec criteria pinned here:
 *   - "Content appears on the correct tab"
 *   - "Every public package appears under the correct tab"
 *
 * We exercise the package_created revalidation and confirm the
 * emitted tags include the *exact* tab the spec content type
 * routes to (Prayer → prayers, Saint → saints, ...).
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCacheRevalidationLog,
  getCacheRevalidationLog,
  revalidateForRow,
} from "@/lib/cache/revalidate";
import { CONTENT_TYPE_TO_TAB, tabTag } from "@/lib/cache/tags";

beforeEach(() => {
  clearCacheRevalidationLog();
});

const CASES = [
  { contentType: "Prayer", expectedTab: "prayers" },
  { contentType: "Saint", expectedTab: "saints" },
  { contentType: "MarianApparition", expectedTab: "apparitions" },
  { contentType: "Parish", expectedTab: "parishes" },
  { contentType: "Devotion", expectedTab: "devotions" },
  { contentType: "Novena", expectedTab: "novenas" },
  { contentType: "Sacrament", expectedTab: "sacraments" },
  { contentType: "Rosary", expectedTab: "rosary" },
  { contentType: "Consecration", expectedTab: "consecrations" },
  { contentType: "Liturgy", expectedTab: "liturgy" },
  { contentType: "History", expectedTab: "history" },
] as const;

describe("Content appears on the correct tab (spec §23, §24)", () => {
  for (const c of CASES) {
    it(`${c.contentType} persistence revalidates the ${c.expectedTab} tab`, async () => {
      await revalidateForRow({
        reason: "package_created",
        contentType: c.contentType,
        slug: "test-slug",
      });
      const log = getCacheRevalidationLog();
      expect(log[0].tags).toContain(tabTag(c.expectedTab));
    });
  }

  it("CONTENT_TYPE_TO_TAB and the revalidation cascade agree on every spec content type", () => {
    for (const c of CASES) {
      expect(CONTENT_TYPE_TO_TAB[c.contentType as keyof typeof CONTENT_TYPE_TO_TAB]).toBe(
        c.expectedTab,
      );
    }
  });
});

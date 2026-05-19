/**
 * Per-slug cache-tag presence acceptance (spec §19).
 *
 * Spec rule: "Use cache tags by content slug." Per-slug pages must
 * import the `tagsForSlug` + `withCacheTags` helpers so the
 * factory's revalidate-by-slug helper actually invalidates the
 * cached body when the underlying row changes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(process.cwd(), "src", "app");

const REQUIRED_SLUG_TABS = ["prayers", "saints", "devotions"];

describe("Per-slug cache-tag usage (spec §19)", () => {
  for (const tab of REQUIRED_SLUG_TABS) {
    it(`/${tab}/[slug]/page.tsx imports tagsForSlug + withCacheTags`, () => {
      const p = join(APP_ROOT, tab, "[slug]", "page.tsx");
      const body = readFileSync(p, "utf8");
      expect(body.includes("tagsForSlug"), `${tab}/[slug] missing tagsForSlug`).toBe(true);
      expect(body.includes("withCacheTags"), `${tab}/[slug] missing withCacheTags`).toBe(true);
    });
  }
});

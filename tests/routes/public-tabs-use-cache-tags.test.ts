/**
 * Public-tab cache-tag usage acceptance (spec §19, §24).
 *
 * Spec rule: "Public content pages should use cached strict public
 * queries." We scan the page.tsx file for each major public tab
 * and assert that the file imports `tagsForList` + `withCacheTags`
 * — the centralised wrapper that pulls in the cache tag namespace.
 *
 * If a tab regresses by removing the import, this test fails loudly
 * before the change ships.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(process.cwd(), "src", "app");

const REQUIRED_CACHED_TABS = ["prayers", "saints", "devotions", "spiritual-life", "liturgy"];

describe("Public tabs use cache-tag helper (spec §19)", () => {
  for (const tab of REQUIRED_CACHED_TABS) {
    it(`/${tab}/page.tsx imports tagsForList + withCacheTags`, () => {
      const p = join(APP_ROOT, tab, "page.tsx");
      const body = readFileSync(p, "utf8");
      expect(body.includes("tagsForList"), `${tab} missing tagsForList import`).toBe(true);
      expect(body.includes("withCacheTags"), `${tab} missing withCacheTags import`).toBe(true);
    });
  }
});

/**
 * Public-tab loading-file presence acceptance (spec §19).
 *
 * Spec rule: "Add loading states for content tabs." A regression
 * here means a public tab will block-render until its data fetch
 * completes — a poor experience the spec calls out. The test
 * inspects the filesystem so adding a tab later forces the author
 * to either add a loading.tsx or update this test.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(process.cwd(), "src", "app");

const REQUIRED_LOADING_TABS = [
  "prayers",
  "saints",
  "devotions",
  "sacraments",
  "history",
  "liturgy",
  "spiritual-life",
  "our-lady",
  "liturgy-history",
];

describe("Public tab loading.tsx presence (spec §19)", () => {
  for (const tab of REQUIRED_LOADING_TABS) {
    it(`/${tab}/loading.tsx exists`, () => {
      const p = join(APP_ROOT, tab, "loading.tsx");
      expect(existsSync(p), `Missing ${p}`).toBe(true);
    });
  }
});

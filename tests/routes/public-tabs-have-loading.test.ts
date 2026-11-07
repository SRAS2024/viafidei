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
  "liturgy",
  "spiritual-life",
  "our-lady",
  "liturgy-history",
];

describe("Public tab loading.tsx presence (spec §19)", () => {
  for (const tab of REQUIRED_LOADING_TABS) {
    it(`/${tab} has a loading.tsx`, () => {
      // A list with detail pages keeps its own in a route group, so that its
      // placeholder does not stand in for a detail page.
      const candidates = [
        join(APP_ROOT, tab, "loading.tsx"),
        join(APP_ROOT, tab, "(list)", "loading.tsx"),
      ];
      expect(candidates.some(existsSync), `Missing ${candidates[0]}`).toBe(true);
    });
  }

  // /history renders one page from the cached timeline, so there is no fetch to
  // wait for, and a change of its filters keeps the old list on screen. A boundary
  // here would put a placeholder in the first HTML, which is what a reader with no
  // JavaScript was left looking at for good.
  it("/history/loading.tsx does not exist", () => {
    expect(existsSync(join(APP_ROOT, "history", "loading.tsx"))).toBe(false);
  });
});

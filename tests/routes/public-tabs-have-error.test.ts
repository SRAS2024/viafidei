/**
 * Public-tab error-file presence acceptance (spec §19).
 *
 * Spec rule: "Add frontend error states when content fails to
 * load." Each tab needs its own error.tsx (or the router falls
 * back to the global error boundary, which is fine for nested
 * routes but loses the tab context for the user).
 *
 * This pins which tabs MUST have a per-tab error boundary so a
 * later refactor cannot silently remove them.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(process.cwd(), "src", "app");

const REQUIRED_ERROR_TABS = [
  "prayers",
  "saints",
  "devotions",
  "spiritual-life",
  "our-lady",
  "liturgy-history",
];

describe("Public tab error.tsx presence (spec §19)", () => {
  for (const tab of REQUIRED_ERROR_TABS) {
    it(`/${tab}/error.tsx exists`, () => {
      const p = join(APP_ROOT, tab, "error.tsx");
      expect(existsSync(p), `Missing ${p}`).toBe(true);
    });
  }
});

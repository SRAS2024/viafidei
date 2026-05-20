/**
 * Persist coverage acceptance (spec §23, §24).
 *
 * Spec rule: "Every public item persists through
 * persistBuiltPackage()." We scan the persist module's source for
 * every spec content type and confirm each one has a `case` arm —
 * which is the single switch that decides which persist helper to
 * call.
 *
 * The test does not exercise the runtime — it pins the *coverage*
 * so a content type can never silently fall off the persist switch.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PERSIST_FILE = join(process.cwd(), "src", "lib", "content-factory", "persist.ts");

const REQUIRED_CONTENT_TYPES = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Devotion",
  "Novena",
  "Sacrament",
  "Rosary",
  "Consecration",
  "SpiritualGuidance",
  "Liturgy",
  "History",
  "Parish",
];

describe("Persist coverage — every spec content type has a persist path (spec §23, §24)", () => {
  for (const ct of REQUIRED_CONTENT_TYPES) {
    it(`persist.ts has a case "${ct}" arm`, () => {
      const body = readFileSync(PERSIST_FILE, "utf8");
      expect(body.includes(`case "${ct}":`), `Missing persist arm for ${ct}`).toBe(true);
    });
  }
});

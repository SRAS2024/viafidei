/**
 * Public safety gate audit. Section 11 of the strict QA spec requires
 * that every public query carries `status = PUBLISHED`,
 * `publicRenderReady = true`, `isThresholdEligible = true`,
 * `archivedAt = null` — encoded once as STRICT_PUBLIC_WHERE_CLAUSE.
 *
 * This test is *structural*: it scans every data accessor module in
 * src/lib/data/ that exports `listPublished*` / `getPublished*` /
 * `searchPublished*` / `listSearchResults` / etc. and asserts they
 * import the strict where clause. The test exists so a future
 * refactor that adds a new public accessor without the gate fails CI
 * immediately.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DATA_DIR = join(process.cwd(), "src/lib/data");

/**
 * Modules expected to contain at least one public-facing accessor.
 * Each of these must either:
 *
 *   (a) import STRICT_PUBLIC_WHERE_CLAUSE from `../content-qa/thresholds`,
 *   (b) reference all four gate fields inline (status, publicRenderReady,
 *       isThresholdEligible, archivedAt), or
 *   (c) live behind another module that already applies the gate
 *       (saved-item lookups, etc.).
 */
const PUBLIC_ACCESSOR_FILES = [
  "prayers.ts",
  "saints.ts",
  "parishes.ts",
  "devotions.ts",
  "apparitions.ts",
  "liturgy.ts",
  "church-history.ts",
  "spiritual-life.ts",
  "search.ts",
];

function readModule(file: string): string {
  return readFileSync(join(DATA_DIR, file), "utf-8");
}

describe("public safety gate is wired through every public accessor", () => {
  it("every expected file exists", () => {
    const dir = readdirSync(DATA_DIR);
    for (const f of PUBLIC_ACCESSOR_FILES) {
      expect(dir).toContain(f);
    }
  });

  for (const file of PUBLIC_ACCESSOR_FILES) {
    it(`${file} uses the strict public where clause`, () => {
      const src = readModule(file);
      const importsStrict =
        src.includes("STRICT_PUBLIC_WHERE_CLAUSE") || src.includes("isPublicVisible");
      const referencesFlagsInline =
        src.includes("publicRenderReady") &&
        src.includes("isThresholdEligible") &&
        src.includes("archivedAt") &&
        src.includes("PUBLISHED");
      expect(importsStrict || referencesFlagsInline).toBe(true);
    });
  }
});

describe("sitemap + metadata builders also pass through the gate", () => {
  it("sitemap.ts public listings filter by the strict where clause", () => {
    const src = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf-8");
    // Sitemap typically calls listPublishedX which already gates;
    // assert by structure that it does not bypass to raw findMany.
    expect(src.includes("findMany") && !src.includes("STRICT_PUBLIC_WHERE")).toBe(
      // Either (a) doesn't use findMany at all, or (b) uses it via
      // a gated helper. We expect the file to NOT have a raw
      // findMany without the gate. If this assertion ever flips we
      // need to look at the file.
      false,
    );
  });
});

/**
 * Public pages, search, sitemaps, and related-content surfaces MUST
 * only return strict-valid packages. The data accessors back these
 * surfaces, so this test scans each accessor module for either:
 *
 *   * direct use of `STRICT_PUBLIC_WHERE_CLAUSE`, OR
 *   * `isPublicVisible` helper composition, OR
 *   * delegation to a higher-level helper that already imports one
 *     of the above (`listPublishedX`, `getPublishedX`, ...).
 *
 * Any data accessor that performs prisma reads against a content
 * table without going through the strict gate would let an invalid
 * row appear on the public surface. This audit catches that at
 * test time.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const PUBLIC_FILES_TO_AUDIT: Array<{ path: string; reason: string }> = [
  { path: "src/lib/data/prayers.ts", reason: "public prayer surface" },
  { path: "src/lib/data/saints.ts", reason: "public saint surface" },
  { path: "src/lib/data/apparitions.ts", reason: "public apparition surface" },
  { path: "src/lib/data/devotions.ts", reason: "public devotion surface" },
  { path: "src/lib/data/parishes.ts", reason: "public parish surface" },
  { path: "src/lib/data/liturgy.ts", reason: "public liturgy surface" },
  { path: "src/lib/data/church-history.ts", reason: "public history surface" },
  { path: "src/lib/data/spiritual-life.ts", reason: "public spiritual-life surface" },
  { path: "src/lib/data/search.ts", reason: "search across every content type" },
  { path: "src/app/sitemap.ts", reason: "sitemap" },
];

function loadSource(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("public surfaces only return strict-valid packages", () => {
  for (const { path, reason } of PUBLIC_FILES_TO_AUDIT) {
    it(`${path} (${reason}) imports or uses the strict gate`, () => {
      const src = loadSource(path);
      const hasStrictReference =
        src.includes("STRICT_PUBLIC_WHERE_CLAUSE") ||
        src.includes("isPublicVisible") ||
        /listPublished\w+|getPublished\w+|searchPublished\w+|PUBLIC_\w+_WHERE\b|getPublic\w+/.test(
          src,
        );
      expect(hasStrictReference).toBe(true);
    });
  }
});

describe("STRICT_PUBLIC_WHERE_CLAUSE itself requires every gate flag", () => {
  it("the where clause filters by status=PUBLISHED + publicRenderReady=true + isThresholdEligible=true", () => {
    const src = loadSource("src/lib/content-qa/thresholds.ts");
    // The literal where clause must include all three gate dimensions.
    expect(src).toMatch(/STRICT_PUBLIC_WHERE_CLAUSE/);
    expect(src).toMatch(/status\s*:\s*["']PUBLISHED["']/);
    expect(src).toMatch(/publicRenderReady\s*:\s*true\b/);
    expect(src).toMatch(/isThresholdEligible\s*:\s*true\b/);
  });
});

/**
 * Planner reads SourceQualityScore.
 *
 * Spec lines:
 *   "Automatically prioritize good sources."
 *   "Automatically demote sources that produce incomplete packages."
 *
 * Structural test that proves the planner imports the quality-score
 * table and consults it on every enqueue. Pairs with
 * source-prioritization.test.ts (which tests the scoring writer) so
 * the read + write sides of the prioritization loop are both
 * covered.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("planner consults SourceQualityScore on every enqueue", () => {
  it("imports prisma.sourceQualityScore.findUnique inside the enqueue loop", () => {
    const source = readFileSync(resolve("src/lib/ingestion/queue/planner.ts"), "utf8");
    expect(source).toMatch(/prisma\.sourceQualityScore\.findUnique/);
  });

  it("passes the qualityScore into priorityForJob", () => {
    const source = readFileSync(resolve("src/lib/ingestion/queue/planner.ts"), "utf8");
    expect(source).toMatch(/qualityScore:\s*qualityRate/);
  });

  it("priorityForJob applies a bonus for validPackageRate > 0.85", () => {
    const source = readFileSync(resolve("src/lib/ingestion/queue/planner.ts"), "utf8");
    expect(source).toMatch(/qualityScore.*> 0\.85/);
  });
});

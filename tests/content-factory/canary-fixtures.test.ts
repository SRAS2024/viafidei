/**
 * Canary fixtures — proves that the bundled known-good fixtures
 * successfully build through the real builder code. A regression
 * in the builder breaks the canary BEFORE production traffic does.
 */

import { describe, expect, it } from "vitest";
import { runCanaryBuilds, getCanaryFixtures } from "@/lib/content-factory";

describe("canary builds", () => {
  it("ships at least one fixture per critical content type", () => {
    const fixtures = getCanaryFixtures();
    const types = new Set(fixtures.map((f) => f.contentType));
    // The user's spec requires baseline coverage for at least these
    // primary content types. Additional types are optional.
    expect(types.has("Prayer")).toBe(true);
    expect(types.has("Saint")).toBe(true);
  });

  it("every canary fixture builds a complete package", () => {
    const report = runCanaryBuilds();
    const failing = report.results.filter((r) => !r.passed);
    if (failing.length > 0) {
      const detail = failing
        .map(
          (f) =>
            `${f.contentType}/${f.fixtureName}: ${f.outcome}${f.failureReason ? ` — ${f.failureReason}` : ""}`,
        )
        .join("\n");
      throw new Error(`Canary build failure:\n${detail}`);
    }
    expect(report.factoryHealthy).toBe(true);
  });
});

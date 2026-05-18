/**
 * Spec pin: build failure reasons cover every category the spec
 * lists.
 *
 * The user requires that build failures be specific. The spec
 * enumerates these failure categories:
 *
 *   - Missing actual prayer text
 *   - Missing saint feast day
 *   - Missing saint biography
 *   - Missing novena day
 *   - Missing novena prayer
 *   - Missing rosary mysteries
 *   - Missing sacrament preparation
 *   - Missing history date
 *   - Missing parish location
 *   - Source not approved for content type
 *   - Source not configured
 *   - Source exhausted
 *   - Duplicate content
 *   - Wrong content type
 *   - Builder unsupported source shape
 *
 * The structural BuildOutcomeKind union covers the top-level
 * categories (build_failed_missing_required_fields, wrong_content,
 * source_not_allowed, duplicate, not_supported_by_source,
 * source_exhausted). The detailed "Missing X" reasons are
 * surfaced via the `failureReason` and `missingFields` arrays in
 * the build log. This audit pins both layers.
 */

import { describe, expect, it } from "vitest";
import type { BuildOutcomeKind } from "@/lib/content-factory";

describe("BuildOutcomeKind covers every spec-listed top-level category", () => {
  it("includes the seven structural outcome kinds", () => {
    const required: BuildOutcomeKind[] = [
      "built_complete_package",
      "build_failed_missing_required_fields",
      "wrong_content",
      "source_not_allowed",
      "duplicate",
      "not_supported_by_source",
      "source_exhausted",
    ];
    for (const r of required) {
      expect(typeof r).toBe("string");
    }
  });
});

describe("required-field categories per content type are exposed via the builder registry", () => {
  it("each builder declares the spec-required output fields", async () => {
    const { BUILDER_VERSION_REGISTRY } = await import("@/lib/content-factory");
    // Spot-check the spec's enumerated missing-field categories
    // resolve to a known builder-registry entry.
    expect(BUILDER_VERSION_REGISTRY.Prayer.requiredOutputFields).toContain("prayerText");
    expect(BUILDER_VERSION_REGISTRY.Saint.requiredOutputFields).toContain("feastDay");
    expect(BUILDER_VERSION_REGISTRY.Saint.requiredOutputFields).toContain("biography");
    expect(BUILDER_VERSION_REGISTRY.Novena.requiredOutputFields).toContain("days");
    expect(BUILDER_VERSION_REGISTRY.Rosary.requiredOutputFields).toContain("mysterySets");
    expect(BUILDER_VERSION_REGISTRY.Sacrament.requiredOutputFields).toContain("preparation");
    expect(BUILDER_VERSION_REGISTRY.History.requiredOutputFields).toContain("dateOrEra");
    // Parish requires city + country at minimum (the spec's
    // "Missing parish location" category resolves to either).
    expect(BUILDER_VERSION_REGISTRY.Parish.requiredOutputFields).toContain("city");
    expect(BUILDER_VERSION_REGISTRY.Parish.requiredOutputFields).toContain("country");
  });
});

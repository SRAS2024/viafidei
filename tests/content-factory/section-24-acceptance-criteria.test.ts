/**
 * Spec §24 acceptance criteria — single regression suite.
 *
 * This file collects every §24 criterion that can be exercised in
 * unit-test form into one pinned suite. The intent is not to
 * duplicate the existing coverage (each of these is also pinned by
 * one of the focused tests) but to give an operator one file they
 * can run to confirm every §24 invariant in a single Vitest tick.
 */

import { describe, expect, it } from "vitest";
import {
  SOURCE_PLAN_CONTENT_TYPES,
  SOURCE_PLAN_MINIMUMS,
} from "@/lib/ingestion/sources/source-plan";
import { SOURCE_ROLES } from "@/lib/ingestion/sources/roles";
import { CROSS_SOURCE_RULES, EVIDENCE_TYPES } from "@/lib/content-factory/cross-source-validation";
import { STALL_TAXONOMY } from "@/lib/diagnostics/growth-stall-taxonomy";
import { CONTENT_TYPE_TO_TAB } from "@/lib/cache/tags";
import { SACRAMENT_KEYS } from "@/lib/content-qa/sacrament-normalize";
import { BASELINE_SEED_FIXTURES } from "@/lib/content-factory/baseline-seed";

describe("Spec §24 acceptance criteria", () => {
  it("every major content type has a configured source minimum", () => {
    for (const ct of [
      "Prayer",
      "Saint",
      "Devotion",
      "Novena",
      "Sacrament",
      "Rosary",
      "Consecration",
      "Liturgy",
      "History",
      "Parish",
      "MarianApparition",
    ]) {
      expect(
        SOURCE_PLAN_MINIMUMS[ct as keyof typeof SOURCE_PLAN_MINIMUMS],
        `${ct} missing from SOURCE_PLAN_MINIMUMS`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("every major content type can map to a public tab", () => {
    for (const ct of SOURCE_PLAN_CONTENT_TYPES) {
      expect(CONTENT_TYPE_TO_TAB[ct as keyof typeof CONTENT_TYPE_TO_TAB]).toBeDefined();
    }
  });

  it("every spec source role exists", () => {
    expect(SOURCE_ROLES).toEqual([
      "primary_content_source",
      "validation_source",
      "enrichment_source",
      "discovery_only_source",
      "rejected_source",
    ]);
  });

  it("every spec evidence type exists", () => {
    for (const t of [
      "exact_text_match",
      "title_match",
      "feast_day_match",
      "patronage_match",
      "prayer_text_match",
      "sacrament_identity_match",
      "scripture_reference_match",
      "history_date_match",
      "apparition_approval_status_match",
      "parish_identity_match",
    ]) {
      expect(EVIDENCE_TYPES).toContain(t as never);
    }
  });

  it("every spec cross-source rule per content type exists", () => {
    for (const ct of [
      "Prayer",
      "Saint",
      "Novena",
      "Sacrament",
      "History",
      "MarianApparition",
      "Parish",
    ]) {
      expect(
        CROSS_SOURCE_RULES[ct as keyof typeof CROSS_SOURCE_RULES],
        `${ct} missing from CROSS_SOURCE_RULES`,
      ).toBeDefined();
      expect(CROSS_SOURCE_RULES[ct as keyof typeof CROSS_SOURCE_RULES].length).toBeGreaterThan(0);
    }
  });

  it("every spec stall reason exists with an automatic next action", () => {
    for (const id of [
      "no_configured_sources",
      "no_discovery",
      "no_fetch",
      "fetch_without_build",
      "build_without_qa_pass",
      "qa_pass_without_persistence",
      "persistence_without_public_display",
      "public_display_without_search",
      "public_display_without_sitemap",
      "public_content_without_threshold_movement",
      "high_duplicate_saturation",
      "high_wrong_content_rate",
      "validation_evidence_missing",
    ]) {
      const entry = STALL_TAXONOMY.find((e) => e.id === id);
      expect(entry, `${id} missing from STALL_TAXONOMY`).toBeDefined();
      expect(entry?.automaticNextAction.length).toBeGreaterThan(0);
    }
  });

  it("sacraments remain a seven-item system", () => {
    expect(SACRAMENT_KEYS.length).toBe(7);
    expect((SACRAMENT_KEYS as readonly string[]).includes("confession")).toBe(false);
  });

  it("baseline seeder covers every spec-listed baseline content type", () => {
    const types = new Set(BASELINE_SEED_FIXTURES.map((f) => f.contentType));
    for (const ct of ["Prayer", "Saint", "Devotion", "Sacrament", "Liturgy", "History"]) {
      expect(types.has(ct as never), `${ct} missing from baseline seeder`).toBe(true);
    }
  });
});

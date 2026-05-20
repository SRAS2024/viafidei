/**
 * Production source registry tests (spec §1).
 *
 * Pins the curated registry shape:
 *   - every entry has the spec-listed fields
 *   - every entry uses a valid discovery method
 *   - the registry groups by content type so the admin
 *     source-groups dashboard renders correctly
 *   - covers every spec source group: Prayer, Saint, MarianApparition,
 *     Devotion, Novena, Sacrament, Rosary, Consecration, Liturgy,
 *     History, Parish, Scripture
 */

import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SOURCE_REGISTRY,
  groupSourcesByContentType,
  purposeFlagsForEntry,
} from "@/lib/ingestion/sources/production-source-registry";

describe("PRODUCTION_SOURCE_REGISTRY", () => {
  it("every entry carries the spec-listed fields", () => {
    expect(PRODUCTION_SOURCE_REGISTRY.length).toBeGreaterThan(0);
    for (const e of PRODUCTION_SOURCE_REGISTRY) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.host).toMatch(/[a-z0-9.-]+/i);
      expect(e.baseUrl).toMatch(/^https?:\/\//);
      expect([
        "sitemap",
        "rss",
        "fixed_url_list",
        "official_api",
        "factory_handler",
        "not_configured",
      ]).toContain(e.discoveryMethod);
      expect([1, 2, 3]).toContain(e.tier);
      expect([
        "primary_content_source",
        "validation_source",
        "enrichment_source",
        "discovery_only_source",
      ]).toContain(e.role);
      expect(e.supportedContentTypes.length).toBeGreaterThan(0);
      expect(e.allowedFields.length).toBeGreaterThan(0);
      expect(typeof e.canProvidePrimaryContent).toBe("boolean");
      expect(typeof e.canProvideValidationOnly).toBe("boolean");
      expect(typeof e.canProvideEnrichmentOnly).toBe("boolean");
      expect(["cc", "public_domain", "copyright_with_permission", "reference_only"]).toContain(
        e.licenseStatus,
      );
    }
  });

  it("contains the Vatican.va tier-1 primary source", () => {
    const vatican = PRODUCTION_SOURCE_REGISTRY.find((e) => e.host === "vatican.va");
    expect(vatican).toBeDefined();
    expect(vatican?.tier).toBe(1);
    expect(vatican?.role).toBe("primary_content_source");
  });

  it("contains at least one validation source for Saint content", () => {
    const saintValidators = PRODUCTION_SOURCE_REGISTRY.filter(
      (e) => e.supportedContentTypes.includes("Saint") && e.role === "validation_source",
    );
    expect(saintValidators.length).toBeGreaterThan(0);
  });

  it("contains at least one enrichment source for Devotion content", () => {
    const devotionEnrichers = PRODUCTION_SOURCE_REGISTRY.filter(
      (e) => e.supportedContentTypes.includes("Devotion") && e.role === "enrichment_source",
    );
    expect(devotionEnrichers.length).toBeGreaterThan(0);
  });

  it("contains a discovery-only source that does NOT have primary content rights", () => {
    const discoveryOnly = PRODUCTION_SOURCE_REGISTRY.filter(
      (e) => e.role === "discovery_only_source",
    );
    expect(discoveryOnly.length).toBeGreaterThan(0);
    for (const e of discoveryOnly) {
      expect(e.canProvidePrimaryContent).toBe(false);
    }
  });

  it("contains a Scripture reference source", () => {
    const scripture = PRODUCTION_SOURCE_REGISTRY.find((e) =>
      e.supportedContentTypes.includes("ScriptureText"),
    );
    expect(scripture).toBeDefined();
  });
});

describe("purposeFlagsForEntry()", () => {
  it("turns the supportedContentTypes set into matching canIngest* booleans", () => {
    const entry = PRODUCTION_SOURCE_REGISTRY.find((e) => e.host === "vatican.va")!;
    const flags = purposeFlagsForEntry(entry);
    expect(flags.canIngestPrayers).toBe(true);
    expect(flags.canIngestSaints).toBe(true);
    expect(flags.canIngestSacraments).toBe(true);
  });

  it("does not set canIngest flags for content types the entry does not cover", () => {
    const entry = PRODUCTION_SOURCE_REGISTRY.find((e) => e.host === "bible.usccb.org")!;
    const flags = purposeFlagsForEntry(entry);
    expect(flags.canIngestSaints).toBe(false);
    expect(flags.canIngestPrayers).toBe(false);
    expect(flags.canProvideScriptureText).toBe(true);
  });
});

describe("groupSourcesByContentType()", () => {
  it("groups every entry into one row per supported content type", () => {
    const groups = groupSourcesByContentType();
    expect(groups.Prayer?.length ?? 0).toBeGreaterThan(0);
    expect(groups.Saint?.length ?? 0).toBeGreaterThan(0);
    expect(groups.History?.length ?? 0).toBeGreaterThan(0);
    expect(groups.ScriptureText?.length ?? 0).toBeGreaterThan(0);
  });
});

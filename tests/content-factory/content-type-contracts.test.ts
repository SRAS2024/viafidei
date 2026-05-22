/**
 * Centralized content-type contracts (spec #13).
 *
 * Builder-registry, persistence, strict QA, and diagnostics all read
 * the same field list from this module. Adding a new content type
 * means adding ONE entry — no separate hard-coded lists.
 */

import { describe, expect, it } from "vitest";
import {
  getContentTypeContract,
  getRequiredFields,
  getDeterministicFields,
  getPublicRenderRequiredFields,
  listContentTypeContracts,
} from "@/lib/content-factory/content-type-contracts";
import { BUILDER_VERSION_REGISTRY } from "@/lib/content-factory";

describe("content-type contracts", () => {
  it("exports a contract for every supported content type", () => {
    const contracts = listContentTypeContracts();
    const types = contracts.map((c) => c.contentType).sort();
    expect(types).toEqual(
      [
        "Consecration",
        "Devotion",
        "History",
        "Liturgy",
        "MarianApparition",
        "Novena",
        "Parish",
        "Prayer",
        "Rosary",
        "Sacrament",
        "Saint",
        "SpiritualGuidance",
      ].sort(),
    );
  });

  it("contracts and BUILDER_VERSION_REGISTRY agree on required fields", () => {
    // Spec #13: builder-registry must read its requiredOutputFields
    // from the contract, NOT from a hand-maintained per-type list.
    for (const contract of listContentTypeContracts()) {
      const registry = BUILDER_VERSION_REGISTRY[contract.contentType];
      expect(registry).toBeTruthy();
      expect(registry.requiredOutputFields).toEqual(contract.requiredFields);
      expect(registry.requiredSourcePurpose).toBe(contract.requiredSourcePurpose);
    }
  });

  it("provides apparition-specific required fields (apparitionName + location + country + approvalStatus + background + summary)", () => {
    const fields = getRequiredFields("MarianApparition");
    expect(fields).toContain("apparitionName");
    expect(fields).toContain("location");
    expect(fields).toContain("country");
    expect(fields).toContain("approvalStatus");
    expect(fields).toContain("background");
    expect(fields).toContain("summary");
  });

  it("provides consecration-specific required fields including dailyStructure + dailyPrayers + finalConsecrationPrayer", () => {
    const fields = getRequiredFields("Consecration");
    expect(fields).toContain("consecrationName");
    expect(fields).toContain("background");
    expect(fields).toContain("dailyStructure");
    expect(fields).toContain("dailyPrayers");
    expect(fields).toContain("finalConsecrationPrayer");
  });

  it("provides sacrament-specific required fields (sacramentKey + sacramentName + sacramentGroup + explanation + preparation + participation)", () => {
    const fields = getRequiredFields("Sacrament");
    expect(fields).toContain("sacramentKey");
    expect(fields).toContain("sacramentName");
    expect(fields).toContain("sacramentGroup");
    expect(fields).toContain("explanation");
    expect(fields).toContain("preparation");
    expect(fields).toContain("participation");
  });

  it("marks deterministic fields per content type", () => {
    expect(getDeterministicFields("Sacrament")).toContain("sacramentKey");
    expect(getDeterministicFields("Sacrament")).toContain("sacramentGroup");
    expect(getDeterministicFields("Saint")).toContain("slug");
    expect(getDeterministicFields("Prayer")).toContain("slug");
  });

  it("exposes public-render required fields separately from builder fields", () => {
    // The public-render requirements are usually a subset of the
    // builder requirements — strict gate verifies the SUBSET on the
    // persisted row before flipping publicRenderReady=true.
    const liturgyBuild = getRequiredFields("Liturgy");
    const liturgyRender = getPublicRenderRequiredFields("Liturgy");
    for (const f of liturgyRender) {
      expect(liturgyBuild).toContain(f);
    }
  });

  it("maps each content type to a Prisma persistence target", () => {
    expect(getContentTypeContract("Novena").persistenceTarget).toBe("Devotion");
    expect(getContentTypeContract("Sacrament").persistenceTarget).toBe("SpiritualLifeGuide");
    expect(getContentTypeContract("Rosary").persistenceTarget).toBe("SpiritualLifeGuide");
    expect(getContentTypeContract("Consecration").persistenceTarget).toBe("SpiritualLifeGuide");
    expect(getContentTypeContract("History").persistenceTarget).toBe("LiturgyEntry");
    expect(getContentTypeContract("Liturgy").persistenceTarget).toBe("LiturgyEntry");
  });
});

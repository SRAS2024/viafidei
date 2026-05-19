/**
 * Source-role tests.
 *
 * The factory pipeline gates work by role:
 *   - only primary_content_source may originate body fields
 *   - primary + validation may validate
 *   - primary + enrichment may enrich
 *   - rejected_source is excluded from every job
 *
 * Promotion / demotion uses rolling SourceQualityScore counters.
 */

import { describe, expect, it } from "vitest";
import {
  SOURCE_ROLES,
  canProvidePrimaryContent,
  canValidate,
  canEnrich,
  isFactoryEligible,
  isSourceRole,
  decideRoleTransition,
} from "@/lib/ingestion/sources/roles";

describe("SOURCE_ROLES constant", () => {
  it("includes every spec-listed source role", () => {
    expect(SOURCE_ROLES).toEqual([
      "primary_content_source",
      "validation_source",
      "enrichment_source",
      "discovery_only_source",
      "rejected_source",
    ]);
  });

  it("isSourceRole() narrows correctly", () => {
    expect(isSourceRole("primary_content_source")).toBe(true);
    expect(isSourceRole("validation_source")).toBe(true);
    expect(isSourceRole("not_a_role")).toBe(false);
  });
});

describe("role capability helpers", () => {
  it("only primary_content_source may provide primary content", () => {
    expect(canProvidePrimaryContent("primary_content_source")).toBe(true);
    expect(canProvidePrimaryContent("validation_source")).toBe(false);
    expect(canProvidePrimaryContent("enrichment_source")).toBe(false);
    expect(canProvidePrimaryContent("discovery_only_source")).toBe(false);
    expect(canProvidePrimaryContent("rejected_source")).toBe(false);
  });

  it("primary + validation roles may validate", () => {
    expect(canValidate("primary_content_source")).toBe(true);
    expect(canValidate("validation_source")).toBe(true);
    expect(canValidate("enrichment_source")).toBe(false);
    expect(canValidate("discovery_only_source")).toBe(false);
    expect(canValidate("rejected_source")).toBe(false);
  });

  it("primary + enrichment roles may enrich", () => {
    expect(canEnrich("primary_content_source")).toBe(true);
    expect(canEnrich("enrichment_source")).toBe(true);
    expect(canEnrich("validation_source")).toBe(false);
    expect(canEnrich("discovery_only_source")).toBe(false);
    expect(canEnrich("rejected_source")).toBe(false);
  });

  it("every role except rejected is factory-eligible", () => {
    expect(isFactoryEligible("primary_content_source")).toBe(true);
    expect(isFactoryEligible("validation_source")).toBe(true);
    expect(isFactoryEligible("enrichment_source")).toBe(true);
    expect(isFactoryEligible("discovery_only_source")).toBe(true);
    expect(isFactoryEligible("rejected_source")).toBe(false);
  });
});

describe("decideRoleTransition()", () => {
  it("does nothing when fewer than 10 attempts have been made", () => {
    const t = decideRoleTransition("discovery_only_source", {
      buildAttempts: 5,
      buildSuccesses: 5,
      qaPasses: 5,
      qaFailures: 0,
      wrongContent: 0,
      duplicates: 0,
    });
    expect(t).toBeNull();
  });

  it("promotes a discovery_only_source with strong stats to validation_source", () => {
    const t = decideRoleTransition("discovery_only_source", {
      buildAttempts: 20,
      buildSuccesses: 18,
      qaPasses: 15,
      qaFailures: 5,
      wrongContent: 0,
      duplicates: 0,
    });
    expect(t).not.toBeNull();
    expect(t?.toRole).toBe("validation_source");
  });

  it("promotes a validation_source with sustained quality to primary_content_source", () => {
    const t = decideRoleTransition("validation_source", {
      buildAttempts: 40,
      buildSuccesses: 35,
      qaPasses: 32,
      qaFailures: 8,
      wrongContent: 0,
      duplicates: 0,
    });
    expect(t).not.toBeNull();
    expect(t?.toRole).toBe("primary_content_source");
  });

  it("demotes a primary_content_source that goes bad", () => {
    const t = decideRoleTransition("primary_content_source", {
      buildAttempts: 30,
      buildSuccesses: 5,
      qaPasses: 4,
      qaFailures: 26,
      wrongContent: 7, // ≥ 0.2
      duplicates: 0,
    });
    expect(t).not.toBeNull();
    expect(t?.toRole).toBe("validation_source");
  });

  it("rejects any source with very high wrong-content rate", () => {
    const t = decideRoleTransition("validation_source", {
      buildAttempts: 20,
      buildSuccesses: 5,
      qaPasses: 2,
      qaFailures: 18,
      wrongContent: 12, // 60%
      duplicates: 0,
    });
    expect(t).not.toBeNull();
    expect(t?.toRole).toBe("rejected_source");
  });

  it("never auto-promotes a rejected source", () => {
    const t = decideRoleTransition("rejected_source", {
      buildAttempts: 100,
      buildSuccesses: 100,
      qaPasses: 100,
      qaFailures: 0,
      wrongContent: 0,
      duplicates: 0,
    });
    expect(t).toBeNull();
  });
});

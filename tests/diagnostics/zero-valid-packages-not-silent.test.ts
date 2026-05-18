/**
 * Regression: when source documents exist but no valid public
 * packages exist, the diagnostics surface the exact reason.
 *
 * The spec is clear: "If raw source documents exist and valid
 * packages are zero, diagnostics must show the exact reason." This
 * is the catch-all that prevents the system from being in a
 * "fetched a lot, published nothing" state silently.
 *
 * The audit drives the content-growth dashboard with a fixture that
 * has source documents but zero public packages and confirms the
 * stall reason is filled.
 */

import { describe, expect, it } from "vitest";
import {
  classifyStallReason,
  automaticNextActionForReason,
} from "@/lib/data/content-growth-dashboard";

describe("zero valid packages cannot happen silently", () => {
  it("source docs present but builds=0 → stall reason fires", () => {
    const reason = classifyStallReason({
      sourceDocumentsFetched: 50,
      buildAttempts: 0,
      completePackagesBuilt: 0,
      qaPassCount: 0,
      persistedPackageCount: 0,
      publicPackageCount: 0,
      thresholdEligibleCount: 0,
      buildFailureCount: 0,
      growthRate24h: 0,
    });
    expect(reason).toBe("source_docs_exist_but_no_builds");
    expect(automaticNextActionForReason(reason)).toBe("enqueue_content_build");
  });

  it("builds present but completePackages=0 → stall reason fires", () => {
    const reason = classifyStallReason({
      sourceDocumentsFetched: 50,
      buildAttempts: 50,
      completePackagesBuilt: 0,
      qaPassCount: 0,
      persistedPackageCount: 0,
      publicPackageCount: 0,
      thresholdEligibleCount: 0,
      buildFailureCount: 50,
      growthRate24h: 0,
    });
    expect(reason).toBe("builds_attempted_but_none_complete");
    expect(automaticNextActionForReason(reason)).toBe("rebuild_failed_packages_with_new_builder");
  });

  it("complete packages present but qaPass=0 → stall reason fires", () => {
    const reason = classifyStallReason({
      sourceDocumentsFetched: 50,
      buildAttempts: 50,
      completePackagesBuilt: 30,
      qaPassCount: 0,
      persistedPackageCount: 0,
      publicPackageCount: 0,
      thresholdEligibleCount: 0,
      buildFailureCount: 20,
      growthRate24h: 0,
    });
    expect(reason).toBe("builds_complete_but_qa_never_passed");
  });

  it("persisted but public=0 → stall reason fires (public gate failed)", () => {
    const reason = classifyStallReason({
      sourceDocumentsFetched: 50,
      buildAttempts: 50,
      completePackagesBuilt: 30,
      qaPassCount: 30,
      persistedPackageCount: 30,
      publicPackageCount: 0,
      thresholdEligibleCount: 0,
      buildFailureCount: 20,
      growthRate24h: 0,
    });
    expect(reason).toBe("persisted_but_public_gate_failed");
    expect(automaticNextActionForReason(reason)).toBe("run_strict_revalidation");
  });

  it("a healthy pipeline returns an empty stall reason", () => {
    expect(
      classifyStallReason({
        sourceDocumentsFetched: 100,
        buildAttempts: 90,
        completePackagesBuilt: 80,
        qaPassCount: 75,
        persistedPackageCount: 75,
        publicPackageCount: 75,
        thresholdEligibleCount: 75,
        buildFailureCount: 10,
        growthRate24h: 5,
      }),
    ).toBe("");
  });

  it("every produced stall reason has a matching automatic next action", () => {
    const fixtures = [
      {
        sourceDocumentsFetched: 0,
        buildAttempts: 0,
        completePackagesBuilt: 0,
        qaPassCount: 0,
        persistedPackageCount: 0,
        publicPackageCount: 0,
        thresholdEligibleCount: 0,
        buildFailureCount: 0,
        growthRate24h: 0,
      },
      {
        sourceDocumentsFetched: 50,
        buildAttempts: 0,
        completePackagesBuilt: 0,
        qaPassCount: 0,
        persistedPackageCount: 0,
        publicPackageCount: 0,
        thresholdEligibleCount: 0,
        buildFailureCount: 0,
        growthRate24h: 0,
      },
      {
        sourceDocumentsFetched: 50,
        buildAttempts: 50,
        completePackagesBuilt: 30,
        qaPassCount: 30,
        persistedPackageCount: 30,
        publicPackageCount: 0,
        thresholdEligibleCount: 0,
        buildFailureCount: 20,
        growthRate24h: 0,
      },
    ];
    for (const f of fixtures) {
      const reason = classifyStallReason(f);
      if (reason === "") continue;
      const action = automaticNextActionForReason(reason);
      expect(action.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Post-publish verification aggregation + rollback decision. Spec
 * sections 15 + 16: a single failed sub-check must drive `result` to
 * FAIL, and a clear public-page failure must drive rollback to
 * unpublish-and-delete (ambiguous failures go to review).
 */

import { describe, expect, it } from "vitest";

import { aggregateResult, rollbackPlan } from "@/lib/admin-worker/post-publish";

const baseChecks = {
  contentType: "PRAYER",
  contentId: "p1",
  slug: "our-father",
  publicPageCheck: "PASS" as const,
  tabPlacementCheck: "PASS" as const,
  searchCheck: "PASS" as const,
  sitemapCheck: "PASS" as const,
  cacheCheck: "PASS" as const,
};

describe("aggregateResult", () => {
  it("PASS when every sub-check passes", () => {
    expect(aggregateResult(baseChecks)).toBe("PASS");
  });
  it("FAIL when any sub-check fails", () => {
    expect(aggregateResult({ ...baseChecks, searchCheck: "FAIL" })).toBe("FAIL");
  });
  it("WARN when there are non-FAIL but non-PASS checks", () => {
    expect(aggregateResult({ ...baseChecks, searchCheck: "WARN" })).toBe("WARN");
    expect(aggregateResult({ ...baseChecks, sitemapCheck: "PENDING" })).toBe("WARN");
  });
});

describe("rollbackPlan", () => {
  it("does not roll back on PASS", () => {
    expect(rollbackPlan(baseChecks)).toBe("no_rollback");
  });
  it("rolls back and deletes when the public page fails", () => {
    expect(rollbackPlan({ ...baseChecks, publicPageCheck: "FAIL" })).toBe("unpublish_and_delete");
  });
  it("rolls back and reviews on ambiguous failure (search miss)", () => {
    expect(rollbackPlan({ ...baseChecks, searchCheck: "FAIL" })).toBe("unpublish_and_review");
  });
});

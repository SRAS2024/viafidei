/**
 * Rule engine completeness — proves every spec section 4 rule
 * category has at least one registered rule visible in admin.
 */

import { describe, expect, it } from "vitest";

import { listRules, type RuleCategory } from "@/lib/admin-worker";

const REQUIRED_CATEGORIES: RuleCategory[] = [
  "source_selection",
  "content_extraction",
  "content_type_classification",
  "content_package_formatting",
  "catholic_correctness",
  "cross_source_validation",
  "publish",
  "deletion",
  "homepage_design",
  "security",
  "report",
];

describe("Rule engine completeness", () => {
  it.each(REQUIRED_CATEGORIES)("has at least one rule in category %s", (category) => {
    expect(listRules(category).length).toBeGreaterThan(0);
  });

  it("content_extraction.minimum_body_length passes a long body", () => {
    const rule = listRules("content_extraction")[0];
    expect(rule.evaluate({ bodyLength: 200 }).pass).toBe(true);
    expect(rule.evaluate({ bodyLength: 10 }).pass).toBe(false);
  });

  it("content_package_formatting.no_html_leak catches a stray tag", () => {
    const rule = listRules("content_package_formatting").find((r) => r.id.includes("no_html_leak"));
    expect(rule).toBeDefined();
    expect(rule!.evaluate({ body: "Plain text body." }).pass).toBe(true);
    expect(rule!.evaluate({ body: "Some <p>HTML</p> body." }).pass).toBe(false);
  });

  it("cross_source_validation.minimum_distinct_sources requires ≥2 sources", () => {
    const rule = listRules("cross_source_validation").find((r) =>
      r.id.includes("minimum_distinct"),
    );
    expect(rule!.evaluate({ distinctSourceCount: 1 }).pass).toBe(false);
    expect(rule!.evaluate({ distinctSourceCount: 2 }).pass).toBe(true);
  });

  it("report.must_redact_secrets fails when a secret leaks", () => {
    const rule = listRules("report").find((r) => r.id.includes("redact_secrets"));
    expect(rule!.evaluate({ rendered: "all clean here" }).pass).toBe(true);
    expect(rule!.evaluate({ rendered: "password=hunter2 leaked" }).pass).toBe(false);
  });
});

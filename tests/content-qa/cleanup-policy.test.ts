/**
 * Cleanup policy resolution tests. Verifies that the env override
 * takes precedence over the hardcoded default in
 * `appConfig.contentQA`, and that the resulting policy carries every
 * expected field.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
  delete process.env.CONTENT_QA_DELETE_ALL_INVALID;
  delete process.env.CONTENT_QA_SCAN_ALL_CATALOG_ROWS;
});

describe("resolveCleanupPolicy", () => {
  it("defaults to deleteAllInvalid=true and mode=all_catalog_rows", async () => {
    const { resolveCleanupPolicy } = await import("@/lib/content-qa/cleanup-policy");
    const policy = resolveCleanupPolicy();
    expect(policy.deleteAllInvalid).toBe(true);
    expect(policy.mode).toBe("all_catalog_rows");
  });

  it("env CONTENT_QA_DELETE_ALL_INVALID=false reverts to legacy policy", async () => {
    process.env.CONTENT_QA_DELETE_ALL_INVALID = "false";
    const { resolveCleanupPolicy } = await import("@/lib/content-qa/cleanup-policy");
    const policy = resolveCleanupPolicy();
    expect(policy.deleteAllInvalid).toBe(false);
  });

  it("env CONTENT_QA_SCAN_ALL_CATALOG_ROWS=false reverts to public_only mode", async () => {
    process.env.CONTENT_QA_SCAN_ALL_CATALOG_ROWS = "false";
    const { resolveCleanupPolicy } = await import("@/lib/content-qa/cleanup-policy");
    const policy = resolveCleanupPolicy();
    expect(policy.mode).toBe("public_only");
  });

  it("env CONTENT_QA_DELETE_ALL_INVALID=0 also works (numeric)", async () => {
    process.env.CONTENT_QA_DELETE_ALL_INVALID = "0";
    const { resolveCleanupPolicy } = await import("@/lib/content-qa/cleanup-policy");
    const policy = resolveCleanupPolicy();
    expect(policy.deleteAllInvalid).toBe(false);
  });

  it("describeCleanupPolicy renders a human-readable label", async () => {
    const { resolveCleanupPolicy, describeCleanupPolicy } =
      await import("@/lib/content-qa/cleanup-policy");
    const policy = resolveCleanupPolicy();
    const label = describeCleanupPolicy(policy);
    expect(label).toContain("All catalog rows");
    expect(label).toContain("Delete all invalid");
  });

  it("policy carries the package contract version + stale window", async () => {
    const { resolveCleanupPolicy } = await import("@/lib/content-qa/cleanup-policy");
    const policy = resolveCleanupPolicy();
    expect(policy.packageContractVersion).toBeTruthy();
    expect(policy.staleAfterMs).toBeGreaterThan(0);
  });
});

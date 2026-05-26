/**
 * Report generator — secret redaction + period math.
 *
 * Spec section 12:
 *   - Redact passwords, API keys, session secrets, tokens, cookies,
 *     authorization headers, full database URLs, private env var
 *     values.
 *   - DO NOT redact useful debugging data like worker ID, source host,
 *     content type, job kind, timestamps, route paths, diagnostic
 *     status, failure category.
 */

import { describe, expect, it } from "vitest";

import {
  isLastDayOfMonth,
  lastDayOfMonth,
  periodToSince,
  redactSecrets,
  DEVELOPER_AUDIT_SECTIONS,
} from "@/lib/admin-worker/report-generator";

describe("redactSecrets", () => {
  it("redacts password fields by name", () => {
    expect(redactSecrets({ password: "hunter2", ok: "fine" })).toEqual({
      password: "[REDACTED]",
      ok: "fine",
    });
  });

  it("redacts api_key and apikey by name", () => {
    expect(redactSecrets({ api_key: "sk_xxx" })).toEqual({ api_key: "[REDACTED]" });
    expect(redactSecrets({ APIKEY: "x" })).toEqual({ APIKEY: "[REDACTED]" });
  });

  it("redacts session_secret, token, cookie, authorization, database_url", () => {
    expect(redactSecrets({ session_secret: "x" })).toEqual({ session_secret: "[REDACTED]" });
    expect(redactSecrets({ token: "x" })).toEqual({ token: "[REDACTED]" });
    expect(redactSecrets({ cookie: "x" })).toEqual({ cookie: "[REDACTED]" });
    expect(redactSecrets({ authorization: "x" })).toEqual({ authorization: "[REDACTED]" });
    expect(redactSecrets({ DATABASE_URL: "x" })).toEqual({ DATABASE_URL: "[REDACTED]" });
  });

  it("KEEPS useful debugging fields", () => {
    expect(
      redactSecrets({
        workerId: "admin-1",
        sourceHost: "www.vatican.va",
        contentType: "PRAYER",
        jobKind: "build",
        timestamp: "2025-05-24T00:00:00Z",
        route: "/api/admin/admin-worker/run",
        status: "pass",
        failureCategory: "fetch_failed",
      }),
    ).toEqual({
      workerId: "admin-1",
      sourceHost: "www.vatican.va",
      contentType: "PRAYER",
      jobKind: "build",
      timestamp: "2025-05-24T00:00:00Z",
      route: "/api/admin/admin-worker/run",
      status: "pass",
      failureCategory: "fetch_failed",
    });
  });

  it("recurses into nested objects", () => {
    expect(redactSecrets({ user: { name: "Alice", password: "x" } })).toEqual({
      user: { name: "Alice", password: "[REDACTED]" },
    });
  });

  it("recurses into arrays", () => {
    expect(redactSecrets([{ token: "x" }, { sourceHost: "ok" }])).toEqual([
      { token: "[REDACTED]" },
      { sourceHost: "ok" },
    ]);
  });
});

describe("periodToSince", () => {
  it("returns a date roughly 24 hours ago for LAST_24_HOURS", () => {
    const since = periodToSince("LAST_24_HOURS");
    const expected = Date.now() - 24 * 60 * 60 * 1000;
    expect(Math.abs(since.getTime() - expected)).toBeLessThan(5_000);
  });

  it("returns a date roughly 30 days ago for LAST_30_DAYS", () => {
    const since = periodToSince("LAST_30_DAYS");
    const expected = Date.now() - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(since.getTime() - expected)).toBeLessThan(5_000);
  });
});

describe("Developer Audit section list (spec §19)", () => {
  it("includes every spec-required section the auditor needs", () => {
    // Spec §19 requires: table of contents, executive summary, brain
    // decisions, mission plans, pipeline stage history, content goal
    // progress, discovery logs, fetch logs, source read logs,
    // classification logs, extraction logs, verification logs,
    // QA logs, publishing logs, post-publish verification logs,
    // search/sitemap logs, cache logs, repair logs, security logs,
    // homepage logs, source reputation changes, memory changes,
    // current blockers, recommended repairs.
    const required = [
      "Table of Contents",
      "Executive Summary",
      "Diagnostics Results",
      "Admin Worker Brain Decisions",
      "Mission Plans",
      "Pipeline Stage History",
      "Content Goal Progress",
      "Discovery Logs",
      "Fetch Logs",
      "Source Read Logs",
      "Classification Logs",
      "Extraction Logs",
      "Verification Logs",
      "QA Logs",
      "Publishing Logs",
      "Post-Publish Verification Logs",
      "Search and Sitemap Logs",
      "Cache Logs",
      "Repair Logs",
      "Security Logs",
      "Homepage Logs",
      "Source Reputation Changes",
      "Memory Changes",
      "Current Blockers",
      "Recommended Repairs",
    ];
    for (const section of required) {
      expect(DEVELOPER_AUDIT_SECTIONS).toContain(section);
    }
  });

  it("keeps the legacy sections so existing PDF generators still work", () => {
    expect(DEVELOPER_AUDIT_SECTIONS).toContain("Diagnostics Results");
    expect(DEVELOPER_AUDIT_SECTIONS).toContain("Worker Logs");
    expect(DEVELOPER_AUDIT_SECTIONS).toContain("Security Logs");
    expect(DEVELOPER_AUDIT_SECTIONS).toContain("Recommended Repairs");
  });
});

describe("Last day of month helpers", () => {
  it("recognises Feb 28 in a non-leap year as the last day", () => {
    expect(isLastDayOfMonth(new Date(2023, 1, 28))).toBe(true);
  });
  it("recognises Feb 29 in a leap year as the last day", () => {
    expect(isLastDayOfMonth(new Date(2024, 1, 29))).toBe(true);
    expect(isLastDayOfMonth(new Date(2024, 1, 28))).toBe(false);
  });
  it("recognises Jan 31 as the last day of January", () => {
    expect(isLastDayOfMonth(new Date(2025, 0, 31))).toBe(true);
    expect(isLastDayOfMonth(new Date(2025, 0, 30))).toBe(false);
  });
  it("lastDayOfMonth handles Feb correctly", () => {
    expect(lastDayOfMonth(2024, 1).getDate()).toBe(29);
    expect(lastDayOfMonth(2023, 1).getDate()).toBe(28);
  });
});

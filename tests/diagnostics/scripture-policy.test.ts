/**
 * Spec #14 — Scripture policy diagnostics surface the approved
 * translations / sources / licenses for the admin diagnostics page.
 * The report is read-only and contains operational checks.
 */

import { describe, expect, it } from "vitest";
import { getScripturePolicyReport } from "@/lib/diagnostics/scripture-policy";

describe("getScripturePolicyReport", () => {
  it("returns the app's policy translation", () => {
    const report = getScripturePolicyReport();
    expect(report.appPolicyTranslation).toBe("NABRE");
  });

  it("returns at least one approved translation / source / license", () => {
    const report = getScripturePolicyReport();
    expect(report.approvedTranslations.length).toBeGreaterThan(0);
    expect(report.approvedSources.length).toBeGreaterThan(0);
    expect(report.approvedLicenses.length).toBeGreaterThan(0);
  });

  it("all operational checks pass with the current configuration", () => {
    const report = getScripturePolicyReport();
    const failing = report.checks.filter((c) => c.severity !== "pass");
    expect(failing).toEqual([]);
  });

  it("exposes the contract metadata", () => {
    const report = getScripturePolicyReport();
    expect(report.contract.name).toBe("ScriptureBlockPackage");
    expect(report.contract.version).toBeTruthy();
  });
});

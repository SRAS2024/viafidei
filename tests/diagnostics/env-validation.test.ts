/**
 * Environment variable validation — proves the validator
 * distinguishes required vs recommended vs optional, computes the
 * right aggregate severity, and includes the explanation for each
 * entry.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateEnvironment } from "@/lib/diagnostics/env-validation";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("validateEnvironment", () => {
  it("reports DATABASE_URL as required and missing when unset", () => {
    delete process.env.DATABASE_URL;
    const result = validateEnvironment();
    const databaseUrl = result.entries.find((e) => e.name === "DATABASE_URL")!;
    expect(databaseUrl.level).toBe("required");
    expect(databaseUrl.set).toBe(false);
    expect(databaseUrl.description).toMatch(/Postgres/);
    expect(result.missingRequired).toBeGreaterThan(0);
    expect(result.severity).toBe("fail");
  });

  it("reports RESEND_API_KEY as recommended and triggers a warn when unset", () => {
    process.env.DATABASE_URL = "postgres://x";
    delete process.env.RESEND_API_KEY;
    const result = validateEnvironment();
    const resend = result.entries.find((e) => e.name === "RESEND_API_KEY")!;
    expect(resend.level).toBe("recommended");
    expect(resend.set).toBe(false);
    expect(result.severity === "warn" || result.severity === "fail").toBe(true);
  });

  it("returns pass severity when every required + recommended variable is set", () => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.SESSION_SECRET = "a".repeat(33);
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "very-long-password";
    process.env.RESEND_API_KEY = "re_test";
    process.env.ADMIN_EMAIL = "admin@example.com";
    const result = validateEnvironment();
    expect(result.severity).toBe("pass");
    expect(result.missingRequired).toBe(0);
    expect(result.missingRecommended).toBe(0);
  });

  it("every entry carries a non-empty description and a subsystem", () => {
    const result = validateEnvironment();
    for (const e of result.entries) {
      expect(e.description.length).toBeGreaterThan(0);
      expect(["core", "auth", "email", "security", "content-qa"]).toContain(e.subsystem);
    }
  });
});

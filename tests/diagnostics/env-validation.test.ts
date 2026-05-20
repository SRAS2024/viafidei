/**
 * Environment variable validation — proves the validator
 * distinguishes required vs recommended vs optional, computes the
 * right aggregate severity, and includes the explanation for each
 * entry.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateEnvironment, getEnvSubsystemDiagnostics } from "@/lib/diagnostics/env-validation";

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

describe("getEnvSubsystemDiagnostics", () => {
  it("reports one row for every spec-listed subsystem", () => {
    const { rows } = getEnvSubsystemDiagnostics();
    expect(rows.map((r) => r.subsystem).sort()).toEqual([
      "adminEmail",
      "appUrl",
      "cron",
      "database",
      "email",
      "queue",
      "security",
      "sourceConfig",
      "worker",
    ]);
  });

  it("marks worker, cron, queue, appUrl and sourceConfig as config-driven", () => {
    const { rows } = getEnvSubsystemDiagnostics();
    for (const subsystem of ["worker", "cron", "queue", "appUrl", "sourceConfig"] as const) {
      const row = rows.find((r) => r.subsystem === subsystem)!;
      expect(row.configDriven).toBe(true);
      expect(row.envVars).toEqual([]);
      expect(row.status).toBe("pass");
    }
  });

  it("fails when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    const { rows, severity } = getEnvSubsystemDiagnostics();
    const database = rows.find((r) => r.subsystem === "database")!;
    expect(database.status).toBe("fail");
    expect(severity).toBe("fail");
  });

  it("warns (does not fail) when only RESEND_API_KEY is missing", () => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.SESSION_SECRET = "a".repeat(33);
    process.env.ADMIN_EMAIL = "admin@example.com";
    delete process.env.RESEND_API_KEY;
    const { rows, severity } = getEnvSubsystemDiagnostics();
    expect(rows.find((r) => r.subsystem === "email")!.status).toBe("warn");
    expect(severity).toBe("warn");
  });
});

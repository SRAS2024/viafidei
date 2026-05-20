/**
 * Environment variable validation.
 *
 * The admin diagnostics page surfaces missing required environment
 * variables BEFORE they cause silent failures (ingestion that never
 * runs, security emails that never send, admin reports that never
 * generate).
 *
 * The validator distinguishes:
 *
 *   - `required`  — must be set or the app cannot run in production.
 *   - `recommended` — strongly suggested but the app degrades
 *                     gracefully (e.g. emails are skipped without
 *                     RESEND_API_KEY).
 *   - `optional`  — informational only.
 *
 * Each entry carries a human-readable explanation of what breaks if
 * the variable is unset and what feature it enables.
 */

import { appConfig } from "../config";

export type EnvVarLevel = "required" | "recommended" | "optional";

export type EnvVarEntry = {
  name: string;
  level: EnvVarLevel;
  set: boolean;
  /** What breaks when this variable is unset. */
  description: string;
  /** Which subsystem the variable enables — used for the admin badge. */
  subsystem: "core" | "auth" | "email" | "security" | "content-qa";
};

export type EnvValidationResult = {
  entries: EnvVarEntry[];
  /** Count of required variables that are unset. Always 0 in a healthy environment. */
  missingRequired: number;
  /** Count of recommended variables that are unset. */
  missingRecommended: number;
  /** Aggregated severity: pass if no required missing; warn if recommended missing; fail otherwise. */
  severity: "pass" | "warn" | "fail";
};

function isSet(name: string): boolean {
  const v = process.env[name];
  return v !== undefined && v.trim().length > 0;
}

export function validateEnvironment(): EnvValidationResult {
  const isProduction = process.env.NODE_ENV === "production";
  const entries: EnvVarEntry[] = [
    {
      name: "DATABASE_URL",
      level: "required",
      set: isSet("DATABASE_URL"),
      description: "Postgres connection string. Required for every database operation.",
      subsystem: "core",
    },
    {
      name: "SESSION_SECRET",
      level: isProduction ? "required" : "recommended",
      set: isSet("SESSION_SECRET"),
      description:
        "Session signing secret. In production, missing SESSION_SECRET prevents auth cookies from being signed.",
      subsystem: "auth",
    },
    {
      name: "ADMIN_USERNAME",
      level: isProduction ? "required" : "recommended",
      set: isSet("ADMIN_USERNAME"),
      description: "Administrator account username. Required for admin login in production.",
      subsystem: "auth",
    },
    {
      name: "ADMIN_PASSWORD",
      level: isProduction ? "required" : "recommended",
      set: isSet("ADMIN_PASSWORD"),
      description:
        "Administrator account password (≥12 chars). Required for admin login in production.",
      subsystem: "auth",
    },
    {
      name: "RESEND_API_KEY",
      level: "recommended",
      set: isSet("RESEND_API_KEY"),
      description:
        "Resend API key. Without it, transactional email (welcome, password reset, verification) is silently disabled.",
      subsystem: "email",
    },
    {
      name: "ADMIN_EMAIL",
      level: "recommended",
      set: isSet("ADMIN_EMAIL"),
      description:
        "Operational admin recipient. Without it, biweekly reports / security breach alerts / critical-failure pages are logged but not delivered.",
      subsystem: "email",
    },
    {
      name: "CONTENT_QA_DELETE_ALL_INVALID",
      level: "optional",
      set: isSet("CONTENT_QA_DELETE_ALL_INVALID"),
      description:
        "Override for the strict-cleanup delete policy. Production should leave this unset (= delete-all-invalid=true).",
      subsystem: "content-qa",
    },
    {
      name: "CONTENT_QA_SCAN_ALL_CATALOG_ROWS",
      level: "optional",
      set: isSet("CONTENT_QA_SCAN_ALL_CATALOG_ROWS"),
      description:
        "Override for the strict-cleanup scan scope. Default is `true` (scan every status). Set to `false` for the legacy public-only sweep.",
      subsystem: "content-qa",
    },
  ];
  const missingRequired = entries.filter((e) => e.level === "required" && !e.set).length;
  const missingRecommended = entries.filter((e) => e.level === "recommended" && !e.set).length;
  const severity: EnvValidationResult["severity"] =
    missingRequired > 0 ? "fail" : missingRecommended > 0 ? "warn" : "pass";
  return { entries, missingRequired, missingRecommended, severity };
}

/**
 * Per-subsystem environment diagnostics.
 *
 * Reports one row per operational subsystem the spec calls out —
 * database, email, worker, cron, queue, app URL, admin email,
 * security signing keys, and source-configuration keys.
 *
 * By design (see `appConfig`) the only environment variables this
 * deployment needs are DATABASE_URL, SESSION_SECRET, ADMIN_USERNAME,
 * ADMIN_PASSWORD, RESEND_API_KEY and ADMIN_EMAIL. The worker, cron,
 * queue, app URL and source registry are configured in code, so
 * their rows are reported as `configDriven` — an honest "no
 * environment variable required" rather than a fake missing-var
 * warning.
 */
export type EnvSubsystem =
  | "database"
  | "email"
  | "worker"
  | "cron"
  | "queue"
  | "appUrl"
  | "adminEmail"
  | "security"
  | "sourceConfig";

export type EnvSubsystemRow = {
  subsystem: EnvSubsystem;
  label: string;
  /** Environment variables this subsystem reads (empty when config-driven). */
  envVars: Array<{ name: string; set: boolean; level: EnvVarLevel }>;
  /** True when the subsystem is satisfied by `appConfig` and needs no env var. */
  configDriven: boolean;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type EnvSubsystemDiagnostics = {
  rows: EnvSubsystemRow[];
  severity: "pass" | "warn" | "fail";
};

export function getEnvSubsystemDiagnostics(): EnvSubsystemDiagnostics {
  const isProduction = process.env.NODE_ENV === "production";
  const envVar = (name: string, level: EnvVarLevel) => ({ name, set: isSet(name), level });
  const rows: EnvSubsystemRow[] = [];

  const databaseUrl = envVar("DATABASE_URL", "required");
  rows.push({
    subsystem: "database",
    label: "Database",
    envVars: [databaseUrl],
    configDriven: false,
    status: databaseUrl.set ? "pass" : "fail",
    detail: databaseUrl.set
      ? "DATABASE_URL is set."
      : "DATABASE_URL is missing — no database operation can run.",
  });

  const resendKey = envVar("RESEND_API_KEY", "recommended");
  rows.push({
    subsystem: "email",
    label: "Email delivery",
    envVars: [resendKey],
    configDriven: false,
    status: resendKey.set ? "pass" : "warn",
    detail: resendKey.set
      ? "RESEND_API_KEY is set — transactional email is enabled."
      : "RESEND_API_KEY is unset — transactional email is silently disabled.",
  });

  const adminEmail = envVar("ADMIN_EMAIL", "recommended");
  rows.push({
    subsystem: "adminEmail",
    label: "Admin email recipient",
    envVars: [adminEmail],
    configDriven: false,
    status: adminEmail.set ? "pass" : "warn",
    detail: adminEmail.set
      ? "ADMIN_EMAIL is set — operational reports and alerts are delivered."
      : "ADMIN_EMAIL is unset — reports and breach alerts are logged but not delivered.",
  });

  const sessionSecret = envVar("SESSION_SECRET", isProduction ? "required" : "recommended");
  rows.push({
    subsystem: "security",
    label: "Security signing keys",
    envVars: [sessionSecret],
    configDriven: false,
    status: sessionSecret.set ? "pass" : isProduction ? "fail" : "warn",
    detail: sessionSecret.set
      ? "SESSION_SECRET is set — session cookies and security HMAC fingerprints are signed."
      : "SESSION_SECRET is unset — auth cookies and security fingerprints cannot be signed.",
  });

  rows.push({
    subsystem: "worker",
    label: "Worker",
    envVars: [],
    configDriven: true,
    status: "pass",
    detail:
      "Worker lease, concurrency and heartbeat settings come from appConfig.ingestion.queue — no environment variable required.",
  });
  rows.push({
    subsystem: "cron",
    label: "Cron / scheduler",
    envVars: [],
    configDriven: true,
    status: "pass",
    detail:
      "Scheduler cadence comes from appConfig.ingestion.intervalMs / maintenanceIntervalMs — no environment variable required.",
  });
  rows.push({
    subsystem: "queue",
    label: "Durable queue",
    envVars: [],
    configDriven: true,
    status: "pass",
    detail:
      "Queue worker knobs (maxAttempts, lease) come from appConfig.ingestion.queue — no environment variable required.",
  });
  rows.push({
    subsystem: "appUrl",
    label: "App URL",
    envVars: [],
    configDriven: true,
    status: "pass",
    detail: `App URL is appConfig.appUrl (${appConfig.appUrl}) — no environment variable required.`,
  });
  rows.push({
    subsystem: "sourceConfig",
    label: "Source configuration keys",
    envVars: [],
    configDriven: true,
    status: "pass",
    detail:
      "Production sources are configured in the source registry; no source requires an API key or environment variable.",
  });

  const severity: EnvSubsystemDiagnostics["severity"] = rows.some((r) => r.status === "fail")
    ? "fail"
    : rows.some((r) => r.status === "warn")
      ? "warn"
      : "pass";
  return { rows, severity };
}

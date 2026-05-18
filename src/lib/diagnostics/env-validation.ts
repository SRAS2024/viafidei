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

/**
 * Scripture policy diagnostics (spec #14).
 *
 * Exposes the active scripture policy + license enforcement state
 * for the admin diagnostics page. Read-only — does not mutate any
 * source or content row.
 */

import {
  APPROVED_BIBLE_TRANSLATIONS,
  APPROVED_SCRIPTURE_SOURCES,
  APPROVED_LICENSE_STATUSES,
  APP_BIBLE_TRANSLATION_POLICY,
  scriptureContractMeta,
} from "../content-qa/contracts/scripture";

export type ScripturePolicyReport = {
  generatedAt: Date;
  appPolicyTranslation: string;
  approvedTranslations: ReadonlyArray<string>;
  approvedSources: ReadonlyArray<string>;
  approvedLicenses: ReadonlyArray<string>;
  contract: typeof scriptureContractMeta;
  /** Operational checks the admin should see at a glance. */
  checks: ReadonlyArray<{
    id: string;
    label: string;
    severity: "pass" | "warn" | "fail";
    summary: string;
  }>;
};

export function getScripturePolicyReport(): ScripturePolicyReport {
  const checks: Array<{
    id: string;
    label: string;
    severity: "pass" | "warn" | "fail";
    summary: string;
  }> = [];

  checks.push({
    id: "policy_translation_in_approved_list",
    label: "Policy translation is in the approved set",
    severity: (APPROVED_BIBLE_TRANSLATIONS as readonly string[]).includes(
      APP_BIBLE_TRANSLATION_POLICY,
    )
      ? "pass"
      : "fail",
    summary: `App policy uses ${APP_BIBLE_TRANSLATION_POLICY}`,
  });

  checks.push({
    id: "approved_translations_nonempty",
    label: "At least one approved Catholic Bible translation is configured",
    severity: APPROVED_BIBLE_TRANSLATIONS.length > 0 ? "pass" : "fail",
    summary: `${APPROVED_BIBLE_TRANSLATIONS.length} translation(s) approved`,
  });

  checks.push({
    id: "approved_sources_nonempty",
    label: "At least one approved scripture source host is configured",
    severity: APPROVED_SCRIPTURE_SOURCES.length > 0 ? "pass" : "fail",
    summary: `${APPROVED_SCRIPTURE_SOURCES.length} approved source host(s)`,
  });

  checks.push({
    id: "approved_licenses_nonempty",
    label: "At least one approved license status is configured",
    severity: APPROVED_LICENSE_STATUSES.length > 0 ? "pass" : "fail",
    summary: `${APPROVED_LICENSE_STATUSES.length} approved license status(es)`,
  });

  return {
    generatedAt: new Date(),
    appPolicyTranslation: APP_BIBLE_TRANSLATION_POLICY,
    approvedTranslations: [...APPROVED_BIBLE_TRANSLATIONS],
    approvedSources: [...APPROVED_SCRIPTURE_SOURCES],
    approvedLicenses: [...APPROVED_LICENSE_STATUSES],
    contract: scriptureContractMeta,
    checks,
  };
}

/**
 * Content-type intelligence profiles (spec: "add content type intelligence
 * profiles ... across all content types").
 *
 * One unified, declarative profile per content type — the single source of
 * truth for required/optional/forbidden fields, validation + source
 * authority requirements, extraction strategy, QA + quality thresholds,
 * and publishing / repair / rollback / human-review rules. Field sets and
 * thresholds are sourced from the existing authoritative maps
 * (REQUIRED_FIELDS, the quality thresholds) so there is no drift, and the
 * doctrinal set drives cross-source validation + the stricter gate.
 *
 * These profiles influence discovery, classification, extraction,
 * verification, strict QA, quality scoring, publishing, repair,
 * diagnostics, and reporting wherever a per-type rule is needed.
 */

import { REQUIRED_FIELDS } from "./content-builder";
import { thresholdFor } from "./quality";

/** Doctrinally-sensitive types require cross-source verifier sign-off and
 *  the stricter 0.95 quality threshold. */
export const DOCTRINALLY_SENSITIVE_TYPES: ReadonlySet<string> = new Set([
  "APPARITION",
  "SACRAMENT",
  "CHURCH_DOCUMENT",
]);

/** Fields the cross-source verifier must confirm before publish. */
const VALIDATION_REQUIREMENTS: Record<string, string[]> = {
  SAINT: ["feastDay", "feastMonth", "feastDayNumber"],
  APPARITION: ["approvalStatus", "apparitionDate"],
  CHURCH_DOCUMENT: ["dateOrEra"],
  SACRAMENT: ["sacramentKey"],
  NOVENA: ["duration"],
  ROSARY: ["mysterySets"],
};

/** Public route prefix per content type (null when not publicly routed). */
const ROUTE_PREFIX: Record<string, string> = {
  PRAYER: "/prayers",
  SAINT: "/saints",
  DEVOTION: "/devotions",
  NOVENA: "/novenas",
  ROSARY: "/devotions",
  CONSECRATION: "/devotions",
  SACRAMENT: "/sacraments",
  CHURCH_DOCUMENT: "/church-documents",
  LITURGICAL: "/liturgy",
  PARISH: "/parishes",
  POPE: "/popes",
  DOCTOR: "/doctors",
  RITE: "/rites",
  APPARITION: "/our-lady",
};

/** Junk / placeholder content patterns no published item may contain. */
const FORBIDDEN_CONTENT_PATTERNS: readonly string[] = [
  "lorem ipsum",
  "coming soon",
  "tbd",
  "to be determined",
  "under construction",
];

export interface ContentTypeProfile {
  contentType: string;
  requiredFields: string[];
  validationRequirements: string[];
  forbiddenContentPatterns: readonly string[];
  /** Doctrinally sensitive → cross-source verifier required before publish. */
  doctrinallySensitive: boolean;
  requiresCrossSourceValidation: boolean;
  /** Minimum acceptable source authority (advisory; surfaced in diagnostics). */
  minSourceAuthority: string;
  qaThreshold: number;
  qualityThreshold: number;
  /** Recommended extraction strategy key (the per-type extractor). */
  extractionStrategy: string;
  /** Public route prefix (null when the type is not publicly routed). */
  publicRoutePrefix: string | null;
  publishingRule: "auto_when_confident" | "review_required";
  repairRule: "rerun_failed_stage" | "rerun_with_verifier";
  rollbackRule: "unpublish_then_review" | "unpublish_then_delete_if_broken";
  humanReviewRule: "on_conflict_only" | "on_any_uncertainty";
}

const KNOWN_TYPES = Object.keys(REQUIRED_FIELDS);

function buildProfile(contentType: string): ContentTypeProfile {
  const sensitive = DOCTRINALLY_SENSITIVE_TYPES.has(contentType);
  return {
    contentType,
    requiredFields: REQUIRED_FIELDS[contentType] ?? [],
    validationRequirements: VALIDATION_REQUIREMENTS[contentType] ?? [],
    forbiddenContentPatterns: FORBIDDEN_CONTENT_PATTERNS,
    doctrinallySensitive: sensitive,
    requiresCrossSourceValidation:
      sensitive || (VALIDATION_REQUIREMENTS[contentType]?.length ?? 0) > 0,
    minSourceAuthority: sensitive ? "USCCB" : "TRUSTED_PUBLISHER",
    qaThreshold: sensitive ? 0.95 : 0.85,
    qualityThreshold: thresholdFor(contentType),
    extractionStrategy: `${contentType}Extractor`,
    publicRoutePrefix: ROUTE_PREFIX[contentType] ?? null,
    publishingRule: sensitive ? "review_required" : "auto_when_confident",
    repairRule: sensitive ? "rerun_with_verifier" : "rerun_failed_stage",
    rollbackRule: "unpublish_then_review",
    humanReviewRule: sensitive ? "on_any_uncertainty" : "on_conflict_only",
  };
}

const PROFILES: Record<string, ContentTypeProfile> = Object.fromEntries(
  KNOWN_TYPES.map((t) => [t, buildProfile(t)]),
);

/** The profile for a content type (falls back to a safe default profile). */
export function getContentTypeProfile(contentType: string): ContentTypeProfile {
  return PROFILES[contentType] ?? buildProfile(contentType);
}

/** Every known content-type profile (for diagnostics / reporting). */
export function allContentTypeProfiles(): ContentTypeProfile[] {
  return KNOWN_TYPES.map((t) => PROFILES[t]);
}

/** Single source of truth for doctrinal sensitivity across the worker. */
export function isDoctrinallySensitive(contentType: string): boolean {
  return DOCTRINALLY_SENSITIVE_TYPES.has(contentType);
}

export function requiredFieldsFor(contentType: string): string[] {
  return getContentTypeProfile(contentType).requiredFields;
}

export function validationRequirementsFor(contentType: string): string[] {
  return getContentTypeProfile(contentType).validationRequirements;
}

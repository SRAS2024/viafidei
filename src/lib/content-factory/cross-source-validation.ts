/**
 * Cross-source validation layer.
 *
 * Sits between the builder and strict QA. The factory may pull a
 * prayer, saint profile, novena, devotion, or history item from a
 * wider discovery source only if the important fields can be
 * validated against an approved primary source or a trusted
 * validation source. A package passes only when every required field
 * is either:
 *
 *   1. directly sourced from an approved primary source, OR
 *   2. validated by a second approved source (`pass` evidence), OR
 *   3. filled by a deterministic internal rule (slug normaliser,
 *      sacrament group mapper, ISO date parser, ...), OR
 *   4. filled by approved enrichment with provenance.
 *
 * The wider goal: increase volume by adding more good sources and
 * better validation evidence, NOT by lowering QA standards.
 */

import type { SourceRole } from "../ingestion/sources/roles";
import type { ContentPackage } from "./types";

/**
 * Evidence types — the kind of match that produced a piece of
 * validation evidence. Strings are persisted in
 * ContentValidationEvidence.evidenceType.
 */
export const EVIDENCE_TYPES = [
  "exact_text_match",
  "title_match",
  "feast_day_match",
  "patronage_match",
  "prayer_text_match",
  "sacrament_identity_match",
  "scripture_reference_match",
  "history_date_match",
  "apparition_approval_status_match",
  "parish_identity_match",
  "deterministic_rule",
  "approved_enrichment",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export function isEvidenceType(value: string): value is EvidenceType {
  return (EVIDENCE_TYPES as readonly string[]).includes(value);
}

export type ValidationDecision = "pass" | "fail" | "insufficient_evidence";

/**
 * Cross-source rules per content type — which fields must be
 * validated against a second approved source before strict QA may
 * publish the package.
 *
 * The list maps to the spec one-to-one. Adding a content type here
 * is the *only* thing required to make the cross-source validator
 * enforce its rules.
 */
export const CROSS_SOURCE_RULES = {
  Prayer: ["title", "prayerText", "prayerType"],
  Saint: ["title", "feastDay", "biographyIdentity"],
  Novena: ["title", "days", "dailyPrayers"],
  Sacrament: ["sacramentKey", "sacramentGroup", "explanation"],
  History: ["historyCategory", "dateOrEra", "authority", "eventIdentity"],
  MarianApparition: ["title", "location", "approvalStatus"],
  Parish: ["title", "city", "country"],
  Devotion: ["title", "practice"],
  Consecration: ["title", "structure"],
  Liturgy: ["title", "liturgyType"],
  Rosary: ["title", "structure"],
  SpiritualGuidance: ["title"],
} as const;

export type CrossSourceContentType = keyof typeof CROSS_SOURCE_RULES;

/**
 * Optional fields — validation is requested if available but the
 * package does not fail when no evidence is found for them. These
 * are spec-listed "when available" fields per content type.
 */
export const CROSS_SOURCE_OPTIONAL = {
  Saint: ["patronage"],
  Sacrament: ["catechismReferences"],
  Parish: ["website", "diocese"],
  History: ["institution"],
  MarianApparition: ["backgroundIdentity"],
} as const;

/**
 * One row of evidence produced by the validator for a single field.
 */
export type EvidenceRecord = {
  fieldName: string;
  evidenceType: EvidenceType;
  sourceUrl: string;
  sourceHost: string;
  validationDecision: ValidationDecision;
  matchConfidence: number;
  matchedValue?: string | null;
  evidenceChecksum?: string | null;
  reason?: string;
};

export type CrossSourceValidationResult = {
  contentType: string;
  contractName: "cross_source_validation";
  decision: "pass" | "fail";
  /** Required fields that did not get `pass` evidence. */
  missingEvidenceFields: ReadonlyArray<string>;
  /** Full evidence list — also persisted to ContentValidationEvidence. */
  evidence: ReadonlyArray<EvidenceRecord>;
  reason: string;
};

/**
 * Inputs the cross-source validator needs to make its decision.
 */
export type CrossSourceValidationInput = {
  pkg: ContentPackage;
  /** Role of the source that produced the package. */
  primarySourceRole: SourceRole;
  /**
   * Pre-collected evidence from approved validation sources. The
   * factory orchestrator collects these by running validation
   * lookups against each approved validator's discovery feed. The
   * validator does not perform HTTP itself — it only decides whether
   * the evidence is sufficient. This keeps the validator pure and
   * easy to test.
   */
  collectedEvidence: ReadonlyArray<EvidenceRecord>;
};

/**
 * Decide whether a package has enough cross-source evidence to
 * proceed to strict QA.
 *
 * The rule:
 *   - If the package's primary source is `primary_content_source`,
 *     every required field is satisfied by the primary source by
 *     default. We still collect evidence (it strengthens provenance)
 *     but missing evidence does not fail the package.
 *   - If the primary source is `validation_source`,
 *     `enrichment_source`, or `discovery_only_source`, every
 *     required field in CROSS_SOURCE_RULES[contentType] MUST have a
 *     `pass` row in `collectedEvidence`. Missing evidence fails the
 *     package with `validation_evidence_missing`.
 */
export function validateCrossSource(
  input: CrossSourceValidationInput,
): CrossSourceValidationResult {
  const contentType = input.pkg.contentType as CrossSourceContentType;
  const requiredFields = CROSS_SOURCE_RULES[contentType] ?? [];

  if (input.primarySourceRole === "rejected_source") {
    return {
      contentType,
      contractName: "cross_source_validation",
      decision: "fail",
      missingEvidenceFields: [...requiredFields],
      evidence: input.collectedEvidence,
      reason: "Primary source is rejected — cross-source validation cannot proceed.",
    };
  }

  // A primary content source clears every required field by default.
  // We still surface the evidence rows it generated so admin can see
  // the trace.
  if (input.primarySourceRole === "primary_content_source") {
    return {
      contentType,
      contractName: "cross_source_validation",
      decision: "pass",
      missingEvidenceFields: [],
      evidence: input.collectedEvidence,
      reason:
        "Primary source is an approved primary_content_source — required fields are originated by an approved source.",
    };
  }

  const passSet = new Set(
    input.collectedEvidence
      .filter((e) => e.validationDecision === "pass" && e.matchConfidence >= 0.6)
      .map((e) => e.fieldName),
  );

  // Deterministic rules and approved enrichment fill required fields
  // even when no external validator agrees — they are first-class
  // ways to satisfy a field per the spec rule list.
  for (const e of input.collectedEvidence) {
    if (
      e.validationDecision === "pass" &&
      (e.evidenceType === "deterministic_rule" || e.evidenceType === "approved_enrichment")
    ) {
      passSet.add(e.fieldName);
    }
  }

  const missing = requiredFields.filter((f) => !passSet.has(f));
  if (missing.length === 0) {
    return {
      contentType,
      contractName: "cross_source_validation",
      decision: "pass",
      missingEvidenceFields: [],
      evidence: input.collectedEvidence,
      reason: `Cross-source evidence found for every required field (${requiredFields.length} fields).`,
    };
  }

  return {
    contentType,
    contractName: "cross_source_validation",
    decision: "fail",
    missingEvidenceFields: missing,
    evidence: input.collectedEvidence,
    reason: `validation_evidence_missing for ${missing.join(", ")}`,
  };
}

/**
 * Deterministic content quality scoring (spec §12). Produces a
 * ContentQualityScore row per built package. The publishing gate
 * uses `finalScore` to decide whether to auto-publish.
 *
 * Ten sub-scores (spec §12):
 *   - completeness       (required fields present?)
 *   - correctness        (schema validation pass?)
 *   - formatting         (well-formed paragraphs, no markup leaks?)
 *   - sourceAuthority    (sources are TRUSTED / approved authority?)
 *   - fieldProvenance    (every field traced to a source?)
 *   - validationEvidence (cross-source verification passed?)
 *   - duplicateSafety    (no slug / payload collisions)
 *   - publicRenderingReadiness (public template renders cleanly?)
 *   - doctrinalSensitivity (extra rigor for sensitive content?)
 *   - packageConsistency (no field-vs-field contradictions)
 *
 * Final score is a weighted geometric mean — a zero in any one
 * dimension drives the final score to zero, which is intentional.
 *
 * Per-content-type thresholds are stricter for doctrinally-sensitive
 * types (Marian apparitions, Church history, sacraments, scripture).
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Per-content-type minimum finalScore required to auto-publish.
 * Doctrinally-sensitive types use the stricter 0.95 threshold per
 * CONFIDENCE_THRESHOLDS.publishDoctrinal (spec §12 + §11).
 */
export const QUALITY_THRESHOLDS: Record<string, number> = {
  PRAYER: 0.8,
  SAINT: 0.85,
  APPARITION: 0.95, // doctrinally-sensitive
  NOVENA: 0.85,
  DEVOTION: 0.8,
  ROSARY: 0.85,
  CONSECRATION: 0.85,
  SACRAMENT: 0.95, // doctrinally-sensitive
  CHURCH_DOCUMENT: 0.95, // doctrinally-sensitive
  LITURGICAL: 0.85,
  PARISH: 0.75,
  // Default for any unknown content type.
  DEFAULT: 0.8,
};

/**
 * Backwards-compatible input shape (six sub-scores) — see
 * computeFinalScore() for the legacy path.
 */
export interface QualityInputs {
  contentType: string;
  contentId: string;
  completenessScore: number;
  correctnessScore: number;
  formattingScore: number;
  sourceEvidenceScore: number;
  validationScore: number;
  renderScore: number;
}

/**
 * Spec §12 full input shape. Optional dimensions default to 1.0 so
 * existing callers keep working — the gate still refuses to publish
 * when any explicit sub-score is zero.
 */
export interface QualityInputsV2 {
  contentType: string;
  contentId: string;
  completenessScore: number;
  correctnessScore: number;
  formattingScore: number;
  sourceAuthorityScore?: number;
  fieldProvenanceScore?: number;
  validationEvidenceScore?: number;
  duplicateSafetyScore?: number;
  publicRenderingScore?: number;
  doctrinalSensitivityScore?: number;
  packageConsistencyScore?: number;
}

export function computeFinalScore(
  inputs: Omit<QualityInputs, "contentType" | "contentId">,
): number {
  const dims = [
    inputs.completenessScore,
    inputs.correctnessScore,
    inputs.formattingScore,
    inputs.sourceEvidenceScore,
    inputs.validationScore,
    inputs.renderScore,
  ];
  // Hard "any-zero fails everything" gate. A missing critical dimension
  // must drive the final score to zero so the publish gate refuses.
  if (dims.some((d) => d <= 0)) return 0;

  const weights = {
    completeness: 0.25,
    correctness: 0.25,
    formatting: 0.1,
    sourceEvidence: 0.2,
    validation: 0.15,
    render: 0.05,
  };
  // Weighted geometric mean over the strictly-positive sub-scores.
  const log =
    weights.completeness * Math.log(inputs.completenessScore) +
    weights.correctness * Math.log(inputs.correctnessScore) +
    weights.formatting * Math.log(inputs.formattingScore) +
    weights.sourceEvidence * Math.log(inputs.sourceEvidenceScore) +
    weights.validation * Math.log(inputs.validationScore) +
    weights.render * Math.log(inputs.renderScore);
  const score = Math.exp(log);
  return Math.max(0, Math.min(1, score));
}

/**
 * Spec §12 ten-dimension scorer. Each missing-required-field
 * scenario drives a sub-score to zero; the geometric mean then
 * surfaces zero so the publish gate refuses.
 *
 * Dimensions get weights summing to 1.0:
 *   completeness 0.18    correctness 0.18    formatting 0.06
 *   sourceAuthority 0.10 fieldProvenance 0.10  validationEvidence 0.12
 *   duplicateSafety 0.06  publicRendering 0.06  doctrinalSensitivity 0.08
 *   packageConsistency 0.06
 */
export function computeFinalScoreV2(
  inputs: Omit<QualityInputsV2, "contentType" | "contentId">,
): number {
  const d = {
    completeness: inputs.completenessScore,
    correctness: inputs.correctnessScore,
    formatting: inputs.formattingScore,
    sourceAuthority: inputs.sourceAuthorityScore ?? 1,
    fieldProvenance: inputs.fieldProvenanceScore ?? 1,
    validationEvidence: inputs.validationEvidenceScore ?? 1,
    duplicateSafety: inputs.duplicateSafetyScore ?? 1,
    publicRendering: inputs.publicRenderingScore ?? 1,
    doctrinalSensitivity: inputs.doctrinalSensitivityScore ?? 1,
    packageConsistency: inputs.packageConsistencyScore ?? 1,
  };
  if (Object.values(d).some((v) => v <= 0)) return 0;

  const w = {
    completeness: 0.18,
    correctness: 0.18,
    formatting: 0.06,
    sourceAuthority: 0.1,
    fieldProvenance: 0.1,
    validationEvidence: 0.12,
    duplicateSafety: 0.06,
    publicRendering: 0.06,
    doctrinalSensitivity: 0.08,
    packageConsistency: 0.06,
  };
  const log =
    w.completeness * Math.log(d.completeness) +
    w.correctness * Math.log(d.correctness) +
    w.formatting * Math.log(d.formatting) +
    w.sourceAuthority * Math.log(d.sourceAuthority) +
    w.fieldProvenance * Math.log(d.fieldProvenance) +
    w.validationEvidence * Math.log(d.validationEvidence) +
    w.duplicateSafety * Math.log(d.duplicateSafety) +
    w.publicRendering * Math.log(d.publicRendering) +
    w.doctrinalSensitivity * Math.log(d.doctrinalSensitivity) +
    w.packageConsistency * Math.log(d.packageConsistency);
  return Math.max(0, Math.min(1, Math.exp(log)));
}

/**
 * Return the threshold for the given content type (spec §12).
 * Sensitive content (apparition, sacrament, Church history) uses the
 * 0.95 doctrinal threshold; everything else uses 0.8 by default.
 */
export function thresholdFor(contentType: string): number {
  return QUALITY_THRESHOLDS[contentType] ?? QUALITY_THRESHOLDS.DEFAULT;
}

/**
 * Identify the missing quality dimensions for an audit-friendly
 * "exactly what went wrong" report (spec §12: rejection should be
 * logged with exact missing dimensions).
 */
export function missingDimensions(inputs: QualityInputsV2): string[] {
  const out: string[] = [];
  if (inputs.completenessScore <= 0) out.push("completeness");
  if (inputs.correctnessScore <= 0) out.push("correctness");
  if (inputs.formattingScore <= 0) out.push("formatting");
  if ((inputs.sourceAuthorityScore ?? 1) <= 0) out.push("sourceAuthority");
  if ((inputs.fieldProvenanceScore ?? 1) <= 0) out.push("fieldProvenance");
  if ((inputs.validationEvidenceScore ?? 1) <= 0) out.push("validationEvidence");
  if ((inputs.duplicateSafetyScore ?? 1) <= 0) out.push("duplicateSafety");
  if ((inputs.publicRenderingScore ?? 1) <= 0) out.push("publicRendering");
  if ((inputs.doctrinalSensitivityScore ?? 1) <= 0) out.push("doctrinalSensitivity");
  if ((inputs.packageConsistencyScore ?? 1) <= 0) out.push("packageConsistency");
  return out;
}

export async function recordQualityScore(
  prisma: PrismaClient,
  inputs: QualityInputs,
): Promise<{ id: string; finalScore: number }> {
  const finalScore = computeFinalScore(inputs);
  const row = await prisma.contentQualityScore.create({
    data: { ...inputs, finalScore },
    select: { id: true, finalScore: true },
  });
  return row;
}

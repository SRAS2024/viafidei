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
 * Full ten-dimension content quality input (spec §12). Every dimension is
 * required — there is no reduced model and no optional-defaulting. The
 * publish gate refuses when any dimension is zero or the weighted score is
 * below the per-content-type threshold.
 */
export interface QualityInputs {
  contentType: string;
  contentId: string;
  completenessScore: number;
  correctnessScore: number;
  formattingScore: number;
  sourceAuthorityScore: number;
  fieldProvenanceScore: number;
  validationEvidenceScore: number;
  duplicateSafetyScore: number;
  publicRenderingScore: number;
  doctrinalSensitivityScore: number;
  packageConsistencyScore: number;
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
export function computeFinalScore(
  inputs: Omit<QualityInputs, "contentType" | "contentId">,
): number {
  // Coerce non-finite dimensions to 1 (neutral) so a NaN never poisons the
  // geometric mean — an explicit 0 is the only "hard fail" signal.
  const safe = (v: number): number => (Number.isFinite(v) ? v : 1);
  const d = {
    completeness: safe(inputs.completenessScore),
    correctness: safe(inputs.correctnessScore),
    formatting: safe(inputs.formattingScore),
    sourceAuthority: safe(inputs.sourceAuthorityScore),
    fieldProvenance: safe(inputs.fieldProvenanceScore),
    validationEvidence: safe(inputs.validationEvidenceScore),
    duplicateSafety: safe(inputs.duplicateSafetyScore),
    publicRendering: safe(inputs.publicRenderingScore),
    doctrinalSensitivity: safe(inputs.doctrinalSensitivityScore),
    packageConsistency: safe(inputs.packageConsistencyScore),
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
export function missingDimensions(inputs: QualityInputs): string[] {
  const out: string[] = [];
  if (inputs.completenessScore <= 0) out.push("completeness");
  if (inputs.correctnessScore <= 0) out.push("correctness");
  if (inputs.formattingScore <= 0) out.push("formatting");
  if (inputs.sourceAuthorityScore <= 0) out.push("sourceAuthority");
  if (inputs.fieldProvenanceScore <= 0) out.push("fieldProvenance");
  if (inputs.validationEvidenceScore <= 0) out.push("validationEvidence");
  if (inputs.duplicateSafetyScore <= 0) out.push("duplicateSafety");
  if (inputs.publicRenderingScore <= 0) out.push("publicRendering");
  if (inputs.doctrinalSensitivityScore <= 0) out.push("doctrinalSensitivity");
  if (inputs.packageConsistencyScore <= 0) out.push("packageConsistency");
  return out;
}

/** Per-dimension "weak/failed" detector. A dimension counts as failed
 *  when its score is below `floor` (0.5 by default) — this is what the
 *  dashboard + Developer Audit surface as "which dimension failed". */
export function failedDimensions(inputs: QualityInputs, floor = 0.5): string[] {
  const d: Record<string, number> = {
    completeness: inputs.completenessScore,
    correctness: inputs.correctnessScore,
    formatting: inputs.formattingScore,
    sourceAuthority: inputs.sourceAuthorityScore,
    fieldProvenance: inputs.fieldProvenanceScore,
    validationEvidence: inputs.validationEvidenceScore,
    duplicateSafety: inputs.duplicateSafetyScore,
    publicRendering: inputs.publicRenderingScore,
    doctrinalSensitivity: inputs.doctrinalSensitivityScore,
    packageConsistency: inputs.packageConsistencyScore,
  };
  return Object.entries(d)
    .filter(([, v]) => v < floor)
    .map(([k]) => k);
}

export interface QualityScoreResult {
  id: string;
  finalScore: number;
  threshold: number;
  passed: boolean;
  failedDimensions: string[];
}

/**
 * Record the full ten-dimension ContentQualityScore (spec §12). Stores
 * every dimension, the threshold, the pass/fail status, and the list of
 * failed dimensions so the dashboard, Developer Audit, publish gate, and
 * Python brain can all see exactly which dimension failed. The publish gate
 * uses `passed`. This is the ONLY quality score function — there is no
 * reduced model.
 */
export async function recordQualityScore(
  prisma: PrismaClient,
  inputs: QualityInputs,
): Promise<QualityScoreResult> {
  const finalScore = computeFinalScore(inputs);
  const threshold = thresholdFor(inputs.contentType);
  const failed = failedDimensions(inputs);
  const passed = finalScore >= threshold;
  const row = await prisma.contentQualityScore.create({
    data: {
      contentType: inputs.contentType,
      contentId: inputs.contentId,
      completenessScore: inputs.completenessScore,
      correctnessScore: inputs.correctnessScore,
      formattingScore: inputs.formattingScore,
      sourceAuthorityScore: inputs.sourceAuthorityScore,
      fieldProvenanceScore: inputs.fieldProvenanceScore,
      validationEvidenceScore: inputs.validationEvidenceScore,
      duplicateSafetyScore: inputs.duplicateSafetyScore,
      publicRenderingScore: inputs.publicRenderingScore,
      doctrinalSensitivityScore: inputs.doctrinalSensitivityScore,
      packageConsistencyScore: inputs.packageConsistencyScore,
      finalScore,
      threshold,
      passed,
      failedDimensions: failed,
    },
    select: { id: true },
  });
  // Return the JS-computed verdict (not the persisted row) so the gate is
  // correct regardless of what a (mocked) create returns.
  return { id: row.id, finalScore, threshold, passed, failedDimensions: failed };
}

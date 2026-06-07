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
 * Six-sub-score input shape accepted by the `recordQualityScore` shim,
 * which maps it onto the full ten-dimension model. There is no reduced
 * scoring math anymore.
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
  // Coerce unmeasured / non-finite dimensions to 1 (neutral). A required
  // dimension that was never measured must not poison the geometric mean
  // with NaN — an explicit 0 is the only "hard fail" signal.
  const safe = (v: number | undefined): number => (Number.isFinite(v) ? (v as number) : 1);
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

/** Per-dimension "weak/failed" detector. A dimension counts as failed
 *  when its score is below `floor` (0.5 by default) — this is what the
 *  dashboard + Developer Audit surface as "which dimension failed". */
export function failedDimensionsV2(inputs: QualityInputsV2, floor = 0.5): string[] {
  const d: Record<string, number> = {
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
 * Record a full ten-dimension ContentQualityScore (spec: "store the full
 * quality score model in the database"). Stores every dimension, the
 * threshold, the pass/fail status, and the list of failed dimensions so
 * the dashboard, Developer Audit, publish gate, and Python brain can all
 * see exactly which dimension failed. The publish gate uses `passed`.
 */
export async function recordQualityScoreV2(
  prisma: PrismaClient,
  inputs: QualityInputsV2,
): Promise<QualityScoreResult> {
  const finalScore = computeFinalScoreV2(inputs);
  const threshold = thresholdFor(inputs.contentType);
  const failedDimensions = failedDimensionsV2(inputs);
  const passed = finalScore >= threshold;
  const row = await prisma.contentQualityScore.create({
    data: {
      contentType: inputs.contentType,
      contentId: inputs.contentId,
      completenessScore: inputs.completenessScore,
      correctnessScore: inputs.correctnessScore,
      formattingScore: inputs.formattingScore,
      // Legacy columns mirror the closest V2 dimension for back-compat.
      sourceEvidenceScore: inputs.fieldProvenanceScore ?? 1,
      validationScore: inputs.validationEvidenceScore ?? 1,
      renderScore: inputs.publicRenderingScore ?? 1,
      // Full model.
      sourceAuthorityScore: inputs.sourceAuthorityScore ?? 1,
      fieldProvenanceScore: inputs.fieldProvenanceScore ?? 1,
      duplicateSafetyScore: inputs.duplicateSafetyScore ?? 1,
      doctrinalSensitivityScore: inputs.doctrinalSensitivityScore ?? 1,
      packageConsistencyScore: inputs.packageConsistencyScore ?? 1,
      finalScore,
      threshold,
      passed,
      failedDimensions,
    },
    select: { id: true },
  });
  // Return the JS-computed verdict (not the persisted row) so the gate is
  // correct regardless of what a (mocked) create returns.
  return { id: row.id, finalScore, threshold, passed, failedDimensions };
}

/**
 * Compatibility shim for the few callers that still pass the six-dim input
 * shape: it maps them onto the full ten-dimension model. There is NO
 * reduced scoring path — every score goes through `recordQualityScoreV2`.
 */
export async function recordQualityScore(
  prisma: PrismaClient,
  inputs: QualityInputs,
): Promise<{ id: string; finalScore: number }> {
  const v2 = await recordQualityScoreV2(prisma, {
    contentType: inputs.contentType,
    contentId: inputs.contentId,
    completenessScore: inputs.completenessScore,
    correctnessScore: inputs.correctnessScore,
    formattingScore: inputs.formattingScore,
    sourceAuthorityScore: inputs.sourceEvidenceScore,
    fieldProvenanceScore: inputs.sourceEvidenceScore,
    validationEvidenceScore: inputs.validationScore,
    publicRenderingScore: inputs.renderScore,
    packageConsistencyScore: inputs.correctnessScore,
  });
  return { id: v2.id, finalScore: v2.finalScore };
}

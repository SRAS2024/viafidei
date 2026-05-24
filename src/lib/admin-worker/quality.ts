/**
 * Deterministic content quality scoring. Produces a ContentQualityScore
 * row per built package. The publishing gate uses `finalScore` to
 * decide whether to auto-publish.
 *
 * Six sub-scores:
 *   - completeness    (required fields present?)
 *   - correctness     (schema validation pass?)
 *   - formatting      (well-formed paragraphs, no markup leaks?)
 *   - sourceEvidence  (provenance + citations attached?)
 *   - validation      (cross-source verification passed?)
 *   - render          (public template rendered cleanly?)
 *
 * Final score is a weighted geometric mean — a zero in any one
 * dimension drives the final score to zero, which is intentional.
 */

import type { PrismaClient } from "@prisma/client";

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

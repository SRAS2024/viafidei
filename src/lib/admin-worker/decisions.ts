/**
 * Decision log. Every major Admin Worker decision (mode selection,
 * task generation, publish gate, deletion gate, homepage redesign)
 * writes one row here so the operator can audit "why did the worker
 * do that?" without re-running the cycle.
 *
 * The decisions are deterministic — given the same `rulesEvaluated`
 * payload the engine always picks the same `chosenAction`.
 *
 * The brain also writes the ranked alternatives it considered so the
 * admin UI can show "why this and not that" — see brain.ts for the
 * scoring engine that produces them.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export interface RecordDecisionInput {
  passId?: string;
  taskId?: string;
  decisionType: string;
  inputSummary: string;
  rulesEvaluated?: Prisma.InputJsonValue;
  chosenAction: string;
  confidence: number;
  reason?: string;
  fallbackAction?: string;
  /** Ranked candidate actions the brain considered (highest score first). */
  rankedAlternatives?: Prisma.InputJsonValue;
  /** Readable summary of why the brain chose the action it did. */
  brainExplanation?: string;
  /** Non-null when the brain could not find any safe action to take. */
  brainFailure?: string;
  /** The brain's risk estimate for the chosen action (0..1). */
  riskScore?: number;
  /** One-line description of what success looks like for the chosen action. */
  expectedResult?: string;
  /** The content type the action targets, if any. */
  contentType?: string;
  /** The pipeline mission stage the action advances, if any. */
  missionStage?: string;
}

export async function recordDecision(
  prisma: PrismaClient,
  input: RecordDecisionInput,
): Promise<{ id: string }> {
  return prisma.adminWorkerDecision.create({
    data: {
      passId: input.passId,
      taskId: input.taskId,
      decisionType: input.decisionType,
      inputSummary: input.inputSummary,
      rulesEvaluated: input.rulesEvaluated,
      chosenAction: input.chosenAction,
      confidence: input.confidence,
      reason: input.reason,
      fallbackAction: input.fallbackAction,
      rankedAlternatives: input.rankedAlternatives,
      brainExplanation: input.brainExplanation,
      brainFailure: input.brainFailure,
      riskScore: input.riskScore ?? 0,
      expectedResult: input.expectedResult,
      contentType: input.contentType,
      missionStage: input.missionStage,
    },
    select: { id: true },
  });
}

/**
 * Confidence helpers. These are the deterministic thresholds the
 * publishing gate, deletion gate, and homepage gate use. They are
 * exported here so tests can assert against them without re-deriving.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum overall quality score required to publish automatically. */
  publish: 0.8,
  /** Stricter threshold for doctrinally sensitive content (scripture,
   *  papal acts, dogmatic definitions, sacraments). */
  publishDoctrinal: 0.95,
  /** Minimum confidence to delete content without human review. */
  delete: 0.9,
  /** Minimum confidence to auto-publish a homepage change. */
  homepageAutoPublish: 0.85,
  /** Below this, route to human review. */
  humanReview: 0.5,
} as const;

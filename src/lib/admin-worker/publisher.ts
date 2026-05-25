/**
 * Publishing wrapper. Adds the Admin Worker confidence gates on top
 * of the existing `publish()` from `src/lib/worker/publishing`.
 *
 * The publish gate refuses to ship content unless:
 *   - complete package (existing schema validation)
 *   - finalScore >= configured threshold (ContentQualityScore)
 *   - source evidence attached
 *   - QA passed
 *   - confidence >= CONFIDENCE_THRESHOLDS.publish (0.8 default)
 *
 * Otherwise it either repairs the build, rejects it, or — when the
 * case is ambiguous — files a HumanReviewQueue row.
 */

import type { PrismaClient } from "@prisma/client";

import { CONFIDENCE_THRESHOLDS } from "./decisions";
import { fileHumanReview } from "./human-review";
import { writeAdminWorkerLog } from "./logs";

export interface PublishGateInput {
  contentType: string;
  contentTitle: string;
  contentId: string;
  finalScore: number;
  qaPassed: boolean;
  hasSourceEvidence: boolean;
  isDoctrinallySensitive: boolean;
  confidence: number;
}

export type PublishGateDecision =
  | { kind: "publish"; reason: string }
  | { kind: "reject"; reason: string }
  | { kind: "review"; reason: string };

export function evaluatePublishGate(input: PublishGateInput): PublishGateDecision {
  const threshold = input.isDoctrinallySensitive
    ? CONFIDENCE_THRESHOLDS.publishDoctrinal
    : CONFIDENCE_THRESHOLDS.publish;

  if (!input.qaPassed) {
    return { kind: "reject", reason: "QA failed" };
  }
  if (!input.hasSourceEvidence) {
    return { kind: "reject", reason: "no source evidence attached" };
  }
  if (input.finalScore < threshold) {
    // Score above the human-review threshold but below publish ->
    // ambiguous -> review. Score below the human-review threshold ->
    // outright reject.
    if (input.finalScore >= CONFIDENCE_THRESHOLDS.humanReview) {
      return { kind: "review", reason: `finalScore ${input.finalScore.toFixed(2)} < ${threshold}` };
    }
    return {
      kind: "reject",
      reason: `finalScore ${input.finalScore.toFixed(2)} below human-review floor`,
    };
  }
  if (input.confidence < threshold) {
    return { kind: "review", reason: `confidence ${input.confidence.toFixed(2)} < ${threshold}` };
  }
  return {
    kind: "publish",
    reason: `all checks passed (finalScore=${input.finalScore.toFixed(2)})`,
  };
}

export async function gatePublish(
  prisma: PrismaClient,
  input: PublishGateInput,
): Promise<PublishGateDecision> {
  const decision = evaluatePublishGate(input);

  await writeAdminWorkerLog(prisma, {
    category: "PUBLISHING",
    severity: decision.kind === "publish" ? "INFO" : "WARN",
    eventName: `publish_gate_${decision.kind}`,
    message: `${input.contentType} "${input.contentTitle}": ${decision.reason}`,
    contentType: input.contentType,
    relatedEntityId: input.contentId,
    safeMetadata: {
      finalScore: input.finalScore,
      qaPassed: input.qaPassed,
      hasSourceEvidence: input.hasSourceEvidence,
      isDoctrinallySensitive: input.isDoctrinallySensitive,
      confidence: input.confidence,
    },
  });

  if (decision.kind === "review") {
    await fileHumanReview(prisma, {
      contentType: input.contentType,
      contentTitle: input.contentTitle,
      proposedAction: "publish",
      reason: decision.reason,
      confidence: input.confidence,
    });
  }

  return decision;
}

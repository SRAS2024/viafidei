/**
 * Action-score persistence + explanation (spec §5-8).
 *
 * The brain ranks every possible next action before choosing one. This
 * module persists the *entire* ranked list to AdminWorkerActionScore
 * (one row per action, not only the selected one — spec §6) and builds
 * the structured explanation the command center / Developer Audit surface
 * (spec §8): why the worker chose the current action, why it rejected the
 * alternatives, what it expects to happen, what it will do if the action
 * fails, and what it learned from the last pass.
 */

import type { PrismaClient } from "@prisma/client";

import type { BrainAction, BrainDecision } from "./brain";

/**
 * Persist one AdminWorkerActionScore row per ranked action. The chosen
 * action is marked `selected = true`; every other row carries a
 * `rejectedReason` so the audit view can answer "why not that one?".
 * Best-effort — a failed write never breaks a pass.
 */
export async function persistActionScores(
  prisma: PrismaClient,
  decision: BrainDecision,
  opts: { decisionId?: string; passId?: string } = {},
): Promise<number> {
  const chosen = decision.chosenAction;
  const rows = decision.rankedAlternatives.map((action, index) => ({
    decisionId: opts.decisionId ?? null,
    passId: opts.passId ?? null,
    rankIndex: index,
    selected: action === chosen,
    actionType: String(action.actionType),
    missionStage: action.missionStage,
    targetContentType: action.contentType,
    targetSource: action.sourceTarget,
    targetCandidate: action.candidateUrl,
    expectedOutput: action.expectedOutput,
    actionScore: action.finalScore,
    confidenceScore: action.confidenceScore,
    riskScore: action.riskScore,
    sourceScore: action.sourceScore,
    repairScore: action.repairScore,
    urgencyScore: action.urgencyScore,
    qualityExpectation: action.qualityExpectation,
    safe: action.safe,
    reason: action.reasonSummary,
    // Spec: persist the fallback action the brain planned for each
    // considered action (what it would do if this action failed).
    fallbackAction: action.fallbackAction,
    // Spec §7.14: rejected reason if not selected. A safe but lower-
    // scoring alternative still gets a reason so the operator sees the
    // ranking logic, not a blank.
    rejectedReason:
      action === chosen
        ? null
        : (action.rejectionReason ?? `Lower score (${action.finalScore.toFixed(1)}).`),
  }));

  if (rows.length === 0) return 0;
  const result = await prisma.adminWorkerActionScore
    .createMany({ data: rows })
    .catch(() => ({ count: 0 }));
  return result.count;
}

export interface ActionExplanation {
  /** Spec §8.1 */
  whyChosen: string;
  /** Spec §8.2 */
  whyRejectedAlternatives: Array<{ action: string; missionStage: string; reason: string }>;
  /** Spec §8.3 */
  whatItExpects: string;
  /** Spec §8.4 */
  whatIfItFails: string;
  /** Spec §8.5 */
  whatItLearnedLastPass: string[];
}

/**
 * Build the structured explanation for a decision (spec §8). The
 * "what it learned from the last pass" line is supplied by the caller
 * (it requires a DB read) — see explainCurrentAction() for the wired-up
 * version.
 */
export function buildActionExplanation(
  decision: BrainDecision,
  learnedLastPass: string[] = [],
): ActionExplanation {
  const chosen = decision.chosenAction;
  const rejected = decision.rankedAlternatives
    .filter((a) => a !== chosen)
    .slice(0, 6)
    .map((a: BrainAction) => ({
      action: String(a.actionType),
      missionStage: a.missionStage,
      reason: a.rejectionReason ?? `Lower score (${a.finalScore.toFixed(1)}).`,
    }));

  return {
    whyChosen: `${chosen.missionStage} chosen (score ${chosen.finalScore.toFixed(1)}, urgency ${chosen.urgencyScore.toFixed(1)}, risk ${chosen.riskScore.toFixed(2)}, confidence ${chosen.confidenceScore.toFixed(2)}): ${chosen.reasonSummary}`,
    whyRejectedAlternatives: rejected,
    whatItExpects: chosen.expectedOutput,
    whatIfItFails: chosen.fallbackAction
      ? `Fall back to "${chosen.fallbackAction}" and re-rank on the next pass; ${chosen.stopCondition ? `stop condition: ${chosen.stopCondition}.` : "the brain rotates away from a repeatedly-failing stage via action fatigue."}`
      : "Re-rank on the next pass; the brain rotates away from a repeatedly-failing stage via action fatigue.",
    whatItLearnedLastPass: learnedLastPass,
  };
}

/**
 * Wired-up explanation: reads the most recent persisted action scores +
 * recent memory rows to answer "what did the worker learn from the last
 * pass" (spec §8.5), then composes the full ActionExplanation.
 */
export async function explainCurrentAction(
  prisma: PrismaClient,
): Promise<(ActionExplanation & { recordedAt: Date | null }) | null> {
  const latest = await prisma.adminWorkerActionScore
    .findFirst({ where: { selected: true }, orderBy: { createdAt: "desc" } })
    .catch(() => null);
  if (!latest) return null;

  const [rejected, learned] = await Promise.all([
    prisma.adminWorkerActionScore
      .findMany({
        where: { decisionId: latest.decisionId, selected: false },
        orderBy: { rankIndex: "asc" },
        take: 6,
      })
      .catch(() => []),
    prisma.adminWorkerMemory
      .findMany({
        orderBy: [{ lastUsedAt: "desc" }],
        take: 5,
        select: {
          memoryType: true,
          memoryKey: true,
          confidence: true,
          successCount: true,
          failureCount: true,
        },
      })
      .catch(() => []),
  ]);

  return {
    recordedAt: latest.createdAt,
    whyChosen: `${latest.missionStage} chosen (score ${latest.actionScore.toFixed(1)}, urgency ${latest.urgencyScore.toFixed(1)}, risk ${latest.riskScore.toFixed(2)}, confidence ${latest.confidenceScore.toFixed(2)}): ${latest.reason ?? "—"}`,
    whyRejectedAlternatives: rejected.map((r) => ({
      action: r.actionType,
      missionStage: r.missionStage,
      reason: r.rejectedReason ?? "lower score",
    })),
    whatItExpects: latest.expectedOutput,
    whatIfItFails:
      "Re-rank on the next pass; action fatigue lowers the score of a stage that keeps failing so the brain rotates to the next best strategy.",
    whatItLearnedLastPass: learned.map(
      (m) =>
        `${m.memoryType} · ${m.memoryKey.slice(0, 48)} → confidence ${m.confidence.toFixed(2)} (${m.successCount}✓/${m.failureCount}✕)`,
    ),
  };
}

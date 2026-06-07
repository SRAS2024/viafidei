/**
 * Final-brain selector: the Python intelligence brain is the FINAL action
 * selector for the Admin Worker. TypeScript samples world state and
 * generates + sub-scores candidate actions; this module asks the Python
 * brain to choose the final action, validates the strict decision contract,
 * and enforces the TypeScript safety gate before the action is executed.
 *
 * There is NO fallback to a legacy TypeScript final brain. If the Python
 * brain is unavailable, returns an invalid shape, or picks a disallowed /
 * unsafe action, this returns `null` so the worker enters safe degraded
 * mode (PYTHON_BRAIN_UNAVAILABLE): diagnostics, security defense,
 * reporting, and repair only — never autonomous content publishing.
 */

import type { PrismaClient } from "@prisma/client";

import type { BrainAction, BrainDecision, FinalActionSelector } from "./brain";
import { BrainFinalDecisionSchema } from "./intelligence/contracts";
import { isBrainEnabled, selectAction, type FinalActionCandidate } from "./intelligence";
import { recordBrainCall } from "./intelligence/store";
import { summarizeStageReliability } from "./stage-outcomes";
import { allContentTypeProfiles } from "./content-type-profiles";
import { writeAdminWorkerLog } from "./logs";

/** Compact content-type profiles the Python brain uses in its decision. */
function compactProfiles() {
  return allContentTypeProfiles().map((p) => ({
    contentType: p.contentType,
    doctrinallySensitive: p.doctrinallySensitive,
    requiresCrossSourceValidation: p.requiresCrossSourceValidation,
    qualityThreshold: p.qualityThreshold,
    minSourceAuthority: p.minSourceAuthority,
  }));
}

function toCandidate(a: BrainAction): FinalActionCandidate {
  return {
    missionStage: a.missionStage,
    actionType: a.actionType,
    contentType: a.contentType,
    sourceTarget: a.sourceTarget,
    candidateUrl: a.candidateUrl,
    expectedOutput: a.expectedOutput,
    finalScore: a.finalScore,
    confidenceScore: a.confidenceScore,
    riskScore: a.riskScore,
    urgencyScore: a.urgencyScore,
    sourceScore: a.sourceScore,
    qualityExpectation: a.qualityExpectation,
    repairScore: a.repairScore,
    fallbackAction: a.fallbackAction,
    stopCondition: a.stopCondition,
    safe: a.safe,
    rejectionReason: a.rejectionReason,
  };
}

async function logBrainEvent(
  prisma: PrismaClient,
  passId: string | undefined,
  eventName: string,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await writeAdminWorkerLog(prisma, {
    passId: passId ?? null,
    category: "WORKER_PASS",
    severity: "WARN",
    eventName,
    message,
    safeMetadata: { ...metadata, finalBrain: "python" },
  }).catch(() => undefined);
}

/**
 * Build the FinalActionSelector the loop hands to `runBrain`. It calls the
 * Python brain's `select_action` op, validates the response, and returns
 * the matching candidate (or null → safe degraded mode).
 */
export function pythonFinalSelector(prisma: PrismaClient): FinalActionSelector {
  return async ({ world, decision, passId }) => {
    // Brain disabled / unavailable → degraded mode (no legacy brain).
    if (!isBrainEnabled()) {
      await logBrainEvent(
        prisma,
        passId,
        "python_brain_unavailable",
        "Python brain disabled — entering safe degraded mode (PYTHON_BRAIN_UNAVAILABLE).",
      );
      return null;
    }

    const stageOutcomes = await summarizeStageReliability(prisma, { sinceHours: 48 }).catch(
      () => [],
    );
    const actionHistory = await prisma.adminWorkerDecision
      .findMany({
        where: { decisionType: "brain_pass" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { missionStage: true, contentType: true },
      })
      .then((rows) =>
        // oldest-first so the Python brain's recency weighting is correct
        rows
          .reverse()
          .map((r) => ({ missionStage: r.missionStage ?? "UNKNOWN", contentType: r.contentType })),
      )
      .catch(() => [] as Array<{ missionStage: string; contentType: string | null }>);

    const env = await selectAction({
      candidates: decision.rankedAlternatives.map(toCandidate),
      world: {
        isPaused: world.isPaused,
        healthDegraded: world.failedBuildJobs > world.pendingBuildJobs,
        securityThreat: world.recentSecurityBreaches24h > 0,
        contentGoalGap: world.contentGoalGap,
        contentGoalContentType: world.contentGoalContentType,
      },
      stageOutcomes: stageOutcomes as unknown as Array<Record<string, unknown>>,
      actionHistory,
      sourceReputation: world.topSourceReputation,
      contentTypeProfiles: compactProfiles(),
    }).catch(() => null);

    await recordBrainCall(prisma, "select_action", env, { passId: passId ?? null }).catch(
      () => undefined,
    );

    // Brain call failed / timed out / unavailable → degraded mode.
    if (!env || !env.ok || env.result == null) {
      await logBrainEvent(
        prisma,
        passId,
        "python_brain_unavailable",
        "Python brain returned no usable decision — safe degraded mode (PYTHON_BRAIN_UNAVAILABLE).",
        { error: env?.error ?? "no envelope" },
      );
      return null;
    }

    // Strict schema validation — an invalid shape is rejected (no silent
    // fallback to a legacy brain).
    const parsed = BrainFinalDecisionSchema.safeParse(env.result);
    if (!parsed.success) {
      await logBrainEvent(
        prisma,
        passId,
        "python_brain_invalid_decision",
        "Python brain returned an invalid decision shape — rejected; safe degraded mode.",
        { issues: parsed.error.issues.slice(0, 6).map((i) => i.path.join(".") + ": " + i.message) },
      );
      return null;
    }

    // TypeScript safety gate: the selected action MUST be one of the
    // candidates TS generated, and that candidate must be safe. Anything
    // else is rejected (the Python brain cannot invent or force an unsafe
    // action past the executor).
    const match = decision.rankedAlternatives.find(
      (a) => a.missionStage === parsed.data.missionStage,
    );
    if (!match) {
      await logBrainEvent(
        prisma,
        passId,
        "python_brain_rejected_action",
        `Python selected ${parsed.data.missionStage} which is not an allowed candidate — rejected; safe degraded mode.`,
        { selected: parsed.data.missionStage },
      );
      return null;
    }
    if (!match.safe) {
      await logBrainEvent(
        prisma,
        passId,
        "python_brain_rejected_action",
        `Python selected unsafe action ${parsed.data.missionStage} — rejected by safety gate; safe degraded mode.`,
        { selected: parsed.data.missionStage },
      );
      return null;
    }

    // Approved: the Python brain is the final brain; the matching, safe
    // candidate becomes the chosen action the executor runs.
    const chosen: BrainAction = {
      ...match,
      reasonSummary: parsed.data.reasoning || match.reasonSummary,
      fallbackAction: parsed.data.fallbackAction ?? match.fallbackAction,
    };
    return { chosen, source: "python", failure: null };
  };
}

/** True when a decision was made by the Python final brain. */
export function isPythonFinalDecision(decision: BrainDecision): boolean {
  return decision.finalBrain === "python";
}

export const PYTHON_BRAIN_UNAVAILABLE = "PYTHON_BRAIN_UNAVAILABLE" as const;

/** Whether a world state permits a given (already-safe) world to run the
 *  full autonomous pipeline. Degraded mode disables content publishing. */
export function isDegraded(decision: BrainDecision): boolean {
  return decision.finalBrain === "degraded";
}

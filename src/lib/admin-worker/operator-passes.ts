/**
 * Operator-forced (and autonomously-schedulable) single-stage passes.
 *
 * The autonomous loop lets the brain PICK a stage each pass — so pressing the
 * operator "Run diagnostics" / "Run source discovery" / … buttons and routing
 * through `runOnePass` did NOT reliably run the requested work: the brain might
 * score a different stage higher and run that instead. That is confusing
 * ("I clicked diagnostics, why did it fetch a source?") and it means the
 * operator can't actually drive a specific stage on demand.
 *
 * This module gives every operator button a deterministic, forced dispatch:
 * it builds a minimal `BrainDecision` pinned to the requested `missionStage`
 * and runs it through the SAME `executeMissionStage` dispatcher and the SAME
 * pass lifecycle (`startPass`/`completePass`) as an autonomous pass — so the
 * operator pass shows up correctly in Recent Passes with its real pass type,
 * records a stage-outcome ledger row, and is fully liveness-safe (a throw can
 * never leave the pass RUNNING).
 *
 * Because it is a plain function that forces one stage, the same forced-stage
 * dispatch is what the worker already SELF-RUNS autonomously every loop, not
 * only when a human clicks a button. None of the forced stages (reporting /
 * security / repair / homepage / discovery) create new public `PublishedContent`,
 * so they never introduce a new autonomous content-publishing path. (HOMEPAGE_WORK
 * can flip a homepage draft live, but that only reorders already-published
 * content and is itself verification-gated + rollback-protected — the same
 * behaviour as the autonomous loop's homepage stage.)
 */

import type { PrismaClient } from "@prisma/client";

import type { BrainAction, BrainDecision, BrainMissionStage } from "./brain";
import type {
  AdminWorkerMode,
  AdminWorkerPassType,
  AdminWorkerPriority,
  AdminWorkerTaskType,
} from "@prisma/client";
import { completePass, startPass } from "./passes";
import { executeMissionStage, type DispatchOutcome } from "./dispatcher";
import { writeAdminWorkerLog } from "./logs";

/** The operator-facing pass names (the buttons on the Command Center). */
export type OperatorPassType =
  | "diagnostics"
  | "content_goal"
  | "source_discovery"
  | "homepage"
  | "source_repair"
  | "report"
  | "cleanup"
  | "security";

interface StageMapping {
  stage: BrainMissionStage;
  passType: AdminWorkerPassType;
  mode: AdminWorkerMode;
  priority: AdminWorkerPriority;
  taskType: AdminWorkerTaskType;
  label: string;
}

/**
 * The operator passes that map to a single forced dispatcher stage. `cleanup`
 * (its own dedicated `runCleanupPass`) and `content_goal` (the full autonomous
 * pipeline via `runOnePass`) are intentionally NOT here — they are handled by
 * their own entry points because their work is broader than one stage.
 */
const FORCED_STAGE: Partial<Record<OperatorPassType, StageMapping>> = {
  diagnostics: {
    stage: "REPORTING",
    passType: "DIAGNOSTICS",
    mode: "DIAGNOSTICS",
    priority: "DIAGNOSTICS",
    taskType: "DIAGNOSTICS",
    label: "diagnostics",
  },
  report: {
    stage: "REPORTING",
    passType: "REPORT",
    mode: "REPORTING",
    priority: "DIAGNOSTICS",
    taskType: "REPORT",
    label: "report generation",
  },
  security: {
    stage: "SECURITY_DEFENSE",
    passType: "SECURITY",
    mode: "SECURITY_DEFENSE",
    priority: "SECURITY_THREAT",
    taskType: "SECURITY_DEFENSE",
    label: "security defense",
  },
  source_repair: {
    stage: "REPAIR",
    passType: "SOURCE_REPAIR",
    mode: "REPAIR",
    priority: "SOURCE_REPAIR",
    taskType: "REPAIR",
    label: "source repair",
  },
  homepage: {
    stage: "HOMEPAGE_WORK",
    passType: "HOMEPAGE",
    mode: "HOMEPAGE",
    priority: "HOMEPAGE",
    taskType: "UPDATE_HOMEPAGE",
    label: "homepage",
  },
  source_discovery: {
    stage: "DISCOVERY",
    passType: "AUTONOMOUS",
    mode: "CONSTANT_FILL",
    priority: "CONTENT_GOAL",
    taskType: "DISCOVER_SOURCE",
    label: "source discovery",
  },
};

/** Operator passes that map to a single forced stage (excludes cleanup/content_goal). */
export const FORCED_OPERATOR_PASSES = Object.keys(FORCED_STAGE) as OperatorPassType[];

/**
 * Build a minimal, fully-typed BrainDecision pinned to a specific stage. This
 * is NOT a brain decision — it is an explicit operator/scheduler instruction —
 * so `finalBrain` is "candidate" (no Python selection was made) and the scores
 * are neutral. The dispatcher only reads `missionStage`, `contentType`,
 * `chosenAction`, and `finalBrain`, so a lean object is sufficient.
 */
function forcedDecision(m: StageMapping, source: "operator" | "scheduler"): BrainDecision {
  const action: BrainAction = {
    actionType: m.taskType,
    missionStage: m.stage,
    mode: m.mode,
    priority: m.priority,
    passType: m.passType,
    contentType: null,
    sourceTarget: null,
    candidateUrl: null,
    expectedOutput: `${source}-forced ${m.label}`,
    confidenceScore: 1,
    riskScore: 0,
    qualityExpectation: 1,
    urgencyScore: 1,
    sourceScore: 0,
    repairScore: m.stage === "REPAIR" ? 1 : 0,
    finalScore: 1,
    fallbackAction: "maintenance",
    stopCondition: null,
    reasonSummary: `${source === "operator" ? "Operator" : "Scheduler"} requested ${m.label}; stage forced to ${m.stage}.`,
    rulesEvaluated: { forced: true, source },
    safe: true,
    rejectionReason: null,
  };
  return {
    chosenMode: m.mode,
    chosenPriority: m.priority,
    chosenTaskType: m.taskType,
    passType: m.passType,
    contentType: null,
    sourceTarget: null,
    expectedResult: action.expectedOutput,
    confidenceScore: 1,
    riskScore: 0,
    reason: action.reasonSummary,
    fallbackAction: "maintenance",
    repairAction: m.stage === "REPAIR" ? "run source repair" : null,
    rulesEvaluated: { forced: true, source },
    memoryUsed: {},
    sourceReputationUsed: [],
    chosenAction: action,
    rankedAlternatives: [action],
    missionStage: m.stage,
    brainExplanation: `Forced ${m.label} (${source}).`,
    brainFailure: null,
    finalBrain: "candidate",
  };
}

export interface OperatorPassResult {
  ok: boolean;
  passType: OperatorPassType;
  stage: BrainMissionStage;
  outcome: DispatchOutcome | null;
  error?: string;
}

/**
 * Run one operator/scheduler-forced single-stage pass through the real
 * dispatcher + pass lifecycle. Liveness-safe: the pass row always reaches a
 * terminal status even if the dispatcher throws.
 */
export async function runOperatorPass(
  prisma: PrismaClient,
  passType: OperatorPassType,
  opts: { workerId?: string; source?: "operator" | "scheduler" } = {},
): Promise<OperatorPassResult> {
  const mapping = FORCED_STAGE[passType];
  if (!mapping) {
    return { ok: false, passType, stage: "MAINTENANCE", outcome: null, error: "no forced stage" };
  }
  const source = opts.source ?? "operator";
  const workerId = opts.workerId ?? `operator-${process.pid}`;
  const decision = forcedDecision(mapping, source);

  const pass = await startPass(prisma, { passType: mapping.passType });
  let completed = false;
  let outcome: DispatchOutcome | null = null;
  try {
    await writeAdminWorkerLog(prisma, {
      passId: pass.id,
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "operator_pass_forced",
      message: `${source === "operator" ? "Operator" : "Scheduler"}-forced ${mapping.label}: dispatching stage ${mapping.stage}.`,
      safeMetadata: { passType, stage: mapping.stage, source },
    }).catch(() => undefined);

    outcome = await executeMissionStage({ prisma, workerId, passId: pass.id, decision });
    const failed = outcome.kind === "failed";
    await completePass(prisma, {
      passId: pass.id,
      status: failed ? "FAILED" : "SUCCEEDED",
      tasksPlanned: 1,
      tasksCompleted: failed ? 0 : 1,
      tasksFailed: failed ? 1 : 0,
      contentBuilt: outcome.built ?? 0,
      contentPublished: outcome.published ?? 0,
      homepageActions: mapping.stage === "HOMEPAGE_WORK" ? 1 : 0,
      securityActions: mapping.stage === "SECURITY_DEFENSE" ? 1 : 0,
      summary: `${mapping.label}: ${outcome.summary}`,
    });
    completed = true;
    return { ok: !failed, passType, stage: mapping.stage, outcome };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Set `completed` only on a successful write so the `finally` retries the
    // close if this write fails.
    if (!completed) {
      try {
        await completePass(prisma, {
          passId: pass.id,
          status: "FAILED",
          tasksFailed: 1,
          errorMessage: message,
          summary: `${mapping.label} failed: ${message.slice(0, 200)}`,
        });
        completed = true;
      } catch {
        // leave completed=false — the finally backstop retries the close
      }
    }
    return { ok: false, passType, stage: mapping.stage, outcome, error: message };
  } finally {
    if (!completed) {
      await completePass(prisma, {
        passId: pass.id,
        status: "FAILED",
        tasksFailed: 1,
        errorMessage: "operator pass did not reach a terminal status",
        summary: `${mapping.label} failed: unexpected error path`,
      }).catch(() => undefined);
    }
  }
}

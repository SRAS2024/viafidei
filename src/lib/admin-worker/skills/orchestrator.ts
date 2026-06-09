/**
 * Skill orchestrator — the dispatcher's skill-execution path. Given a brain
 * decision it asks the Skill Planner for a certified plan, then runs each step
 * through the executor (preflight → execute → verify → ledger → feedback) with
 * the Prisma-backed runtime deps, stopping safely on the first failure. If the
 * plan is not executable (a required skill is missing/uncertified), it does not
 * pretend — it returns blocked and the missing skill is developer-requested.
 */

import type { PrismaClient } from "@prisma/client";

import { planForDecision, type SkillPlan } from "./planner";
import { executeCertifiedSkill } from "./executor";
import { getSkill } from "./registry";
import { ensureSkillsRegistered } from "./bootstrap";
import { makeSkillRuntimeDeps } from "./store";
import type { SkillContext } from "./types";

export interface SkillOrchestrationInput {
  missionStage: string;
  contentType?: string | null;
  contentSubtype?: string | null;
  intendedSkill?: string | null;
  passId?: string | null;
  decisionId?: string | null;
  taskId?: string | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  brainActive: boolean;
  mode?: string | null;
  /** Shared input for every skill in the plan (URL, package fields, slug, …). */
  input?: Record<string, unknown>;
}

export interface SkillOrchestrationResult {
  plan: SkillPlan;
  executed: Array<{ skill: string; outcome: string; ledgerId: string | null }>;
  succeeded: boolean;
  stoppedAt: string | null;
  blocked: boolean;
}

export async function runSkillPlan(
  prisma: PrismaClient,
  input: SkillOrchestrationInput,
): Promise<SkillOrchestrationResult> {
  ensureSkillsRegistered();
  const plan = planForDecision({
    missionStage: input.missionStage,
    contentType: input.contentType,
    contentSubtype: input.contentSubtype,
    intendedSkill: input.intendedSkill,
  });

  // Certified-skills-only: a non-executable plan is not attempted; the missing
  // skills are reported (the capability refresh + executor file the requests).
  if (!plan.executable) {
    return { plan, executed: [], succeeded: false, stoppedAt: null, blocked: true };
  }

  const deps = makeSkillRuntimeDeps(prisma);
  const executed: SkillOrchestrationResult["executed"] = [];

  for (const step of plan.steps) {
    const skill = getSkill(step.skillName);
    if (!skill) {
      return { plan, executed, succeeded: false, stoppedAt: step.skillName, blocked: true };
    }
    const ctx: SkillContext = {
      prisma,
      passId: input.passId ?? null,
      decisionId: input.decisionId ?? null,
      taskId: input.taskId ?? null,
      contentType: input.contentType ?? null,
      contentSubtype: input.contentSubtype ?? null,
      targetEntityType: input.targetEntityType ?? null,
      targetEntityId: input.targetEntityId ?? null,
      input: input.input ?? {},
      brainActive: input.brainActive,
      mode: input.mode ?? null,
    };
    const run = await executeCertifiedSkill(skill, ctx, deps);
    executed.push({ skill: step.skillName, outcome: run.outcome, ledgerId: run.ledgerId });

    // Stop safely on the first non-success (the executor already routed it to
    // repair / rollback / human review / developer request and recorded it).
    if (run.outcome !== "SUCCEEDED" && run.outcome !== "SKIPPED_IDEMPOTENT") {
      return {
        plan,
        executed,
        succeeded: false,
        stoppedAt: step.skillName,
        blocked: run.outcome === "BLOCKED" || run.outcome === "CIRCUIT_OPEN",
      };
    }
  }

  return { plan, executed, succeeded: true, stoppedAt: null, blocked: false };
}

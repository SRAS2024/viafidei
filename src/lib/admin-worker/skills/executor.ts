/**
 * Skill executor — the single path through which the worker performs real
 * autonomous work. Lifecycle: preflight -> execute -> verify -> ledger record
 * -> outcome learning, with a bounded retry loop and failure routing (repair /
 * human review / developer request / circuit breaker). A skill is never
 * "successful" until verification passes; medium+ risk failures roll back.
 */

import { createHash } from "node:crypto";

import type {
  CertifiedSkill,
  FailureClass,
  PreflightDecision,
  RollbackResult,
  RollbackStatus,
  SkillContext,
  SkillExecutionResult,
  SkillRunResult,
  SkillRuntimeDeps,
  VerificationDecision,
  VerificationResult,
} from "./types";
import { runPreflight } from "./preflight";
import { runVerification } from "./verification";
import { runRollback } from "./rollback";

/** No-op deps: the core runtime is fully exercisable without a database. */
export function noopSkillDeps(): SkillRuntimeDeps {
  return {
    recordExecution: async () => null,
    isIdempotentDone: async () => false,
    isCircuitOpen: async () => false,
    onOutcome: async () => undefined,
    fileDeveloperRequest: async () => undefined,
    fileRepairPlan: async () => undefined,
  };
}

export function hashInput(input: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(input ?? {}))
    .digest("hex")
    .slice(0, 32);
}

export async function executeCertifiedSkill<O>(
  skill: CertifiedSkill<O>,
  ctx: SkillContext,
  deps: SkillRuntimeDeps,
): Promise<SkillRunResult<O>> {
  const start = Date.now();
  const idempotencyKey = skill.idempotencyKey(ctx);
  const inputHash = hashInput(ctx.input);

  let attempts = 0;
  let failureClass: FailureClass | null = null;
  let execution: SkillExecutionResult<O> = { status: "FAILED", failureReason: "not executed" };
  let verification: VerificationResult | null = null;
  let rollback: RollbackResult | null = null;

  const preflight = await runPreflight(skill, { ...ctx, attempt: 1 }, deps);

  const finish = async (
    outcome: SkillRunResult<O>["outcome"],
    verificationStatus: VerificationDecision | "NOT_RUN",
    rollbackStatus: RollbackStatus | "NOT_RUN",
  ): Promise<SkillRunResult<O>> => {
    const durationMs = Date.now() - start;
    const ledgerId = await deps
      .recordExecution({
        passId: ctx.passId ?? null,
        decisionId: ctx.decisionId ?? null,
        taskId: ctx.taskId ?? null,
        skillName: skill.name,
        skillVersion: skill.version,
        contentType: ctx.contentType ?? null,
        contentSubtype: ctx.contentSubtype ?? null,
        targetEntityType: ctx.targetEntityType ?? execution.outputEntityType ?? null,
        targetEntityId: ctx.targetEntityId ?? execution.outputEntityId ?? null,
        inputHash,
        idempotencyKey,
        preflightStatus: preflight.decision,
        executionStatus: execution.status,
        verificationStatus,
        rollbackStatus,
        riskLevel: skill.riskLevel,
        safeToAutoExecute: preflight.decision === "PROCEED" && !skill.humanReviewRequired,
        humanReviewRequired: skill.humanReviewRequired,
        attemptCount: attempts,
        durationMs,
        failureReason: execution.failureReason ?? verification?.reason ?? null,
        brainOpUsed: execution.brainOpUsed ?? null,
        outputEntityType: execution.outputEntityType ?? null,
        outputEntityId: execution.outputEntityId ?? null,
      })
      .catch(() => null);

    const run: SkillRunResult<O> = {
      skillName: skill.name,
      skillVersion: skill.version,
      preflight,
      execution,
      verification,
      rollback,
      attempts,
      durationMs,
      failureClass,
      ledgerId,
      outcome,
    };
    await deps
      .onOutcome(skill as CertifiedSkill, ctx, run as SkillRunResult)
      .catch(() => undefined);
    return run;
  };

  // Preflight terminals.
  if (preflight.decision === "SKIP_IDEMPOTENT") {
    execution = { status: "SKIPPED", failureReason: null };
    return finish("SKIPPED_IDEMPOTENT", "NOT_RUN", "NOT_RUN");
  }
  if (preflight.decision === "HUMAN_REVIEW") {
    execution = {
      status: "HUMAN_REVIEW",
      failureReason: preflight.reason ?? "human review required",
    };
    return finish("HUMAN_REVIEW", "NOT_RUN", "NOT_RUN");
  }
  if (preflight.decision === "BLOCK") {
    execution = { status: "BLOCKED", failureReason: preflight.reason ?? "preflight blocked" };
    const circuitOpen = preflight.checks.some((c) => c.name === "circuit_breaker" && !c.passed);
    return finish(circuitOpen ? "CIRCUIT_OPEN" : "BLOCKED", "NOT_RUN", "NOT_RUN");
  }

  // PROCEED — bounded retry loop.
  const max = Math.max(1, skill.retryPolicy.maxAttempts);
  let exhausted = false;
  for (let i = 1; i <= max; i += 1) {
    attempts = i;
    try {
      execution = await skill.execute({ ...ctx, attempt: i });
    } catch (err) {
      failureClass = skill.failureClassifier(err, ctx);
      execution = {
        status: "FAILED",
        failureReason: err instanceof Error ? err.message : String(err),
      };
    }

    if (execution.status === "SUCCEEDED") {
      verification = await runVerification(skill, ctx, execution);
      if (verification.decision === "PROCEED") {
        return finish("SUCCEEDED", "PROCEED", "NOT_RUN");
      }
      if (verification.decision === "RETRY" && i < max) continue;
      if (verification.decision === "ROLLBACK") {
        rollback = await runRollback(skill, ctx, execution);
        execution = { ...execution, status: "FAILED" };
        return finish("ROLLED_BACK", "ROLLBACK", rollback.status);
      }
      if (verification.decision === "REPAIR") {
        await deps
          .fileRepairPlan(
            skill as CertifiedSkill,
            ctx,
            verification.reason ?? "verification repair",
          )
          .catch(() => undefined);
        execution = { ...execution, status: "FAILED" };
        return finish("REPAIR_FILED", "REPAIR", "NOT_RUN");
      }
      if (verification.decision === "HUMAN_REVIEW") {
        return finish("HUMAN_REVIEW", "HUMAN_REVIEW", "NOT_RUN");
      }
      // FAILED verification: retry if attempts remain, else route as a failure.
      execution = {
        ...execution,
        status: "FAILED",
        failureReason: verification.reason ?? "verification failed",
      };
      if (i < max) continue;
      exhausted = true;
      break;
    }

    // Execution did not succeed.
    if (!failureClass) failureClass = skill.failureClassifier(execution.failureReason, ctx);
    if (skill.retryPolicy.retryableClasses.includes(failureClass) && i < max) continue;
    exhausted = true;
    break;
  }
  void exhausted;

  // Failure routing after exhausting attempts / non-retryable failure.
  const fc = failureClass ?? "NON_RETRYABLE";
  const p = skill.retryPolicy;
  const vStatus: VerificationDecision | "NOT_RUN" = verification ? "FAILED" : "NOT_RUN";

  if (fc === "CIRCUIT_BREAK" || (p.circuitBreakAfter != null && attempts >= p.circuitBreakAfter)) {
    return finish("CIRCUIT_OPEN", vStatus, "NOT_RUN");
  }
  if (
    fc === "NEEDS_HUMAN_REVIEW" ||
    (p.routeToHumanReviewAfter != null && attempts >= p.routeToHumanReviewAfter)
  ) {
    return finish("HUMAN_REVIEW", vStatus, "NOT_RUN");
  }
  if (
    fc === "NEEDS_DEVELOPER" ||
    (p.developerRequestAfter != null && attempts >= p.developerRequestAfter)
  ) {
    await deps
      .fileDeveloperRequest({
        skillName: skill.name,
        reason: execution.failureReason ?? "repeated skill failure",
        contentType: ctx.contentType ?? null,
        contentSubtype: ctx.contentSubtype ?? null,
      })
      .catch(() => undefined);
    return finish("DEVELOPER_REQUEST", vStatus, "NOT_RUN");
  }
  if (fc === "NEEDS_REPAIR" || (p.routeToRepairAfter != null && attempts >= p.routeToRepairAfter)) {
    await deps
      .fileRepairPlan(skill as CertifiedSkill, ctx, execution.failureReason ?? "repeated failure")
      .catch(() => undefined);
    return finish("REPAIR_FILED", vStatus, "NOT_RUN");
  }
  void (preflight.decision satisfies PreflightDecision);
  return finish("FAILED", vStatus, "NOT_RUN");
}

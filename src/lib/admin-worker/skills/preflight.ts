/**
 * Skill preflight — runs before every execution. If preflight fails, the skill
 * does not execute. Covers the spec's checklist: brain reachable when required,
 * worker paused, skill allowed in the current mode, target valid, content type
 * + subtype supported, source approved, duplicate risk, human review required,
 * required rows + citations present, rollback possible, idempotency already
 * completed, circuit breaker open, and safe-to-auto-execute.
 */

import type {
  CertifiedSkill,
  CheckResult,
  PreflightResult,
  SkillContext,
  SkillRuntimeDeps,
} from "./types";
import { requiresRollback } from "./rollback";

function supportsType(list: readonly string[], value?: string | null): boolean {
  if (!value) return true; // type-agnostic call
  return list.includes("*") || list.includes(value);
}

export async function runPreflight<O>(
  skill: CertifiedSkill<O>,
  ctx: SkillContext,
  deps: SkillRuntimeDeps,
): Promise<PreflightResult> {
  const checks: CheckResult[] = [];
  const block = (name: string, detail: string): PreflightResult => {
    checks.push({ name, passed: false, detail });
    return { ok: false, decision: "BLOCK", checks, reason: detail };
  };

  // 14. circuit breaker
  if (await deps.isCircuitOpen(skill.name).catch(() => false)) {
    return block("circuit_breaker", `${skill.name} circuit is open (too many recent failures)`);
  }
  checks.push({ name: "circuit_breaker", passed: true });

  // 13. idempotency
  const key = skill.idempotencyKey(ctx);
  if (await deps.isIdempotentDone(skill.name, key).catch(() => false)) {
    checks.push({ name: "idempotency", passed: true, detail: "already completed" });
    return { ok: true, decision: "SKIP_IDEMPOTENT", checks, reason: "idempotency key complete" };
  }
  checks.push({ name: "idempotency", passed: true });

  // 1 + 3. brain reachable when required / allowed in current mode
  if (!ctx.brainActive && !skill.allowedInSafeDegradedMode) {
    return block(
      "brain_required",
      `${skill.name} requires PYTHON_FINAL_BRAIN_ACTIVE; worker is in safe degraded mode`,
    );
  }
  checks.push({ name: "brain_required", passed: true });

  // 2. worker paused (only security defense runs while paused)
  if (ctx.mode === "PAUSED" && skill.category !== "SECURITY") {
    return block("worker_paused", "worker is paused; only security defense runs");
  }
  checks.push({ name: "worker_paused", passed: true });

  // 5. content type supported
  if (!supportsType(skill.contentTypes, ctx.contentType)) {
    return block("content_type_supported", `${skill.name} does not support ${ctx.contentType}`);
  }
  checks.push({ name: "content_type_supported", passed: true });

  // 6. content subtype supported
  if (
    ctx.contentSubtype &&
    skill.contentSubtypes.length > 0 &&
    !supportsType(skill.contentSubtypes, ctx.contentSubtype)
  ) {
    return block(
      "content_subtype_supported",
      `${skill.name} does not support subtype ${ctx.contentSubtype}`,
    );
  }
  checks.push({ name: "content_subtype_supported", passed: true });

  // 12. rollback possible for medium+ risk
  if (requiresRollback(skill) && !skill.rollback) {
    return block(
      "rollback_possible",
      `${skill.name} is ${skill.riskLevel}-risk but has no rollback`,
    );
  }
  checks.push({ name: "rollback_possible", passed: true });

  // 4,7,8,10,11. skill-specific preflight (target valid, source approved,
  // duplicate risk, required rows + citations present)
  if (skill.preflightExtra) {
    const extra = await skill.preflightExtra(ctx).catch(
      (err): PreflightResult => ({
        ok: false,
        decision: "BLOCK",
        checks: [{ name: "preflight_extra_threw", passed: false, detail: String(err) }],
        reason: "skill preflight threw",
      }),
    );
    if (extra) {
      checks.push(...extra.checks);
      if (!extra.ok) {
        return { ok: false, decision: extra.decision, checks, reason: extra.reason };
      }
    }
  }

  // 9 + 15. human review required / safe to auto-execute
  if (skill.humanReviewRequired) {
    checks.push({ name: "human_review_required", passed: true, detail: "routes to review" });
    return { ok: true, decision: "HUMAN_REVIEW", checks, reason: "skill requires human review" };
  }
  checks.push({ name: "safe_to_auto_execute", passed: true });

  return { ok: true, decision: "PROCEED", checks };
}

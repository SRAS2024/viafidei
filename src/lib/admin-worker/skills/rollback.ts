/**
 * Skill rollback / repair. Every medium- or high-risk skill must define a
 * rollback (unpublish, restore previous public state, remove invalid citation,
 * revert homepage draft, mark for review, reopen repair plan, restore previous
 * title/subtitle/sections, …). If rollback is not possible, the skill declares
 * that up front and stricter preflight applies.
 */

import type { CertifiedSkill, RollbackResult, SkillContext, SkillExecutionResult } from "./types";

/**
 * Run rollback for a skill whose verification told us to undo the effect.
 * - No rollback fn on a low-risk skill -> NOT_NEEDED.
 * - No rollback fn on a medium/high/critical skill -> NOT_POSSIBLE (a bug the
 *   registry self-test catches, but fail safe here too).
 */
export async function runRollback<O>(
  skill: CertifiedSkill<O>,
  ctx: SkillContext,
  result: SkillExecutionResult<O>,
): Promise<RollbackResult> {
  if (!skill.rollback) {
    return skill.riskLevel === "low"
      ? { status: "NOT_NEEDED", detail: "low-risk skill: no rollback defined" }
      : {
          status: "NOT_POSSIBLE",
          detail: `${skill.name} has no rollback for ${skill.riskLevel} risk`,
        };
  }
  try {
    return await skill.rollback(ctx, result);
  } catch (err) {
    return {
      status: "FAILED",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Registry self-test predicate: every medium+ risk skill must define rollback. */
export function requiresRollback(skill: Pick<CertifiedSkill, "riskLevel">): boolean {
  return skill.riskLevel !== "low";
}

/**
 * Skill verification helpers. A skill is NOT successful until its verification
 * function proves the intended effect actually happened (row changed, page
 * loaded, citation attached, proof passed, blocker removed, …) and that no bad
 * side-effect was introduced. Verification returns the next disposition:
 * proceed, retry, repair, rollback, or human review.
 */

import type {
  CertifiedSkill,
  CheckResult,
  SkillContext,
  SkillExecutionResult,
  VerificationDecision,
  VerificationResult,
} from "./types";

export function check(name: string, passed: boolean, detail?: string): CheckResult {
  return { name, passed, detail };
}

/**
 * Decide a verification outcome from a set of checks. All pass -> PROCEED;
 * otherwise the caller-supplied failure decision (default RETRY) with the
 * failing check names as the reason.
 */
export function decideFromChecks(
  checks: CheckResult[],
  onFail: VerificationDecision = "RETRY",
): VerificationResult {
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) {
    return { ok: true, decision: "PROCEED", checks };
  }
  return {
    ok: false,
    decision: onFail,
    checks,
    reason: `failed: ${failed.map((c) => c.name).join(", ")}`,
  };
}

/** Run a skill's verify function, normalizing throws into a FAILED result. */
export async function runVerification<O>(
  skill: CertifiedSkill<O>,
  ctx: SkillContext,
  result: SkillExecutionResult<O>,
): Promise<VerificationResult> {
  try {
    return await skill.verify(ctx, result);
  } catch (err) {
    return {
      ok: false,
      decision: "FAILED",
      checks: [check("verify_threw", false, err instanceof Error ? err.message : String(err))],
      reason: "verification function threw",
    };
  }
}

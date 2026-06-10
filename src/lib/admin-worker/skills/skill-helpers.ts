/**
 * Shared helper for operational skills that wrap a single real worker function
 * (homepage, reporting, security, maintenance, repair). The `run` callback does
 * the real work and returns whether it succeeded; the helper wires the standard
 * certified-skill lifecycle (execute → verify) and defaults around it.
 */

import { check, decideFromChecks } from "./verification";
import type {
  CertifiedSkill,
  FailureClass,
  RetryPolicy,
  SkillCategory,
  SkillContext,
  SkillRiskLevel,
  VerificationDecision,
} from "./types";

export interface OpRunResult {
  ok: boolean;
  detail?: string;
  outputEntityType?: string | null;
  outputEntityId?: string | null;
}

export interface OpSkillDef {
  name: string;
  purpose: string;
  category: SkillCategory;
  riskLevel?: SkillRiskLevel;
  allowedInSafeDegradedMode?: boolean;
  humanReviewRequired?: boolean;
  contentTypes?: readonly string[];
  inputs?: readonly string[];
  outputs?: readonly string[];
  preconditions?: readonly string[];
  requiredPermissions?: readonly string[];
  brainOps?: readonly string[];
  safetyGates?: readonly string[];
  successMetrics?: readonly string[];
  retryPolicy?: RetryPolicy;
  failureClassifier?: (error: unknown, ctx: SkillContext) => FailureClass;
  onVerifyFail?: VerificationDecision;
  idem?: (ctx: SkillContext) => string;
  run: (ctx: SkillContext) => Promise<OpRunResult>;
  rollback?: CertifiedSkill["rollback"];
}

const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 2,
  backoff: "linear",
  retryableClasses: ["RETRYABLE"],
  routeToRepairAfter: 2,
  developerRequestAfter: 4,
  circuitBreakAfter: 8,
};

export function makeOpSkill(def: OpSkillDef): CertifiedSkill {
  return {
    name: def.name,
    purpose: def.purpose,
    category: def.category,
    version: "1",
    contentTypes: def.contentTypes ?? ["*"],
    contentSubtypes: [],
    inputs: def.inputs ?? [],
    outputs: def.outputs ?? ["ok", "detail"],
    preconditions: def.preconditions ?? [],
    requiredPermissions: def.requiredPermissions ?? [],
    riskLevel: def.riskLevel ?? "low",
    idempotencyKey:
      def.idem ?? ((ctx) => `${def.name}:${String(ctx.passId ?? ctx.targetEntityId ?? "")}`),
    brainOps: def.brainOps ?? [],
    safetyGates: def.safetyGates ?? [def.name],
    humanReviewRequired: def.humanReviewRequired ?? false,
    allowedInSafeDegradedMode: def.allowedInSafeDegradedMode ?? false,
    failureClassifier: def.failureClassifier ?? (() => "NEEDS_REPAIR"),
    retryPolicy: def.retryPolicy ?? DEFAULT_RETRY,
    successMetrics: def.successMetrics ?? ["ok"],
    testsRequired: [`${def.category.toLowerCase()}: ${def.name}`],
    rollback: def.rollback,
    execute: async (ctx) => {
      const r = await def.run(ctx);
      return {
        status: r.ok ? "SUCCEEDED" : "FAILED",
        output: r,
        outputEntityType: r.outputEntityType ?? null,
        outputEntityId: r.outputEntityId ?? null,
        failureReason: r.ok ? null : (r.detail ?? `${def.name} failed`),
      };
    },
    verify: async (_ctx, result) => {
      const r = result.output as OpRunResult | undefined;
      return decideFromChecks(
        [check(def.name, r?.ok === true, r?.detail)],
        def.onVerifyFail ?? "REPAIR",
      );
    },
  };
}

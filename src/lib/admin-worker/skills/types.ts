/**
 * Certified Admin Skill Runtime — core contracts.
 *
 * Every real Admin Worker task is represented as a CertifiedSkill: a typed,
 * executable, verifiable, reversible unit of work that wraps the worker's real
 * pipeline functions (fetch, extract, verify, strict-QA, publish, repair,
 * homepage, reporting, security, maintenance). The dispatcher becomes a skill
 * ORCHESTRATOR: the Python final brain selects an action, TypeScript validates
 * safety, the Skill Planner maps the action to certified skills, and the Skill
 * Executor runs preflight -> execute -> verify -> ledger -> learning.
 *
 * Hard rule (enforced by the planner + a proof test): the Admin Worker may only
 * perform autonomous operational work through certified skills. If no certified
 * skill exists for a selected action, the worker files a developer request — it
 * does not pretend it can do the task.
 *
 * TypeScript stays the safe execution body; Python stays the final brain;
 * Postgres owns the durable skill-execution ledger + capability matrix.
 */

import type { PrismaClient } from "@prisma/client";

export type SkillRiskLevel = "low" | "medium" | "high" | "critical";

export type SkillCategory =
  | "SOURCE"
  | "EXTRACTION"
  | "VERIFICATION"
  | "PUBLISHING"
  | "REPAIR"
  | "HOMEPAGE"
  | "REPORTING"
  | "SECURITY"
  | "MAINTENANCE";

/** Coverage status for a capability / content type / content subtype. */
export type CoverageStatus =
  | "CERTIFIED"
  | "PARTIAL"
  | "MISSING"
  | "BLOCKED"
  | "REQUIRES_HUMAN_REVIEW"
  | "REQUIRES_DEVELOPER_WORK";

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export type PreflightDecision = "PROCEED" | "BLOCK" | "HUMAN_REVIEW" | "SKIP_IDEMPOTENT";

export interface PreflightResult {
  ok: boolean;
  decision: PreflightDecision;
  checks: CheckResult[];
  reason?: string;
}

export type ExecutionStatus = "SUCCEEDED" | "FAILED" | "SKIPPED" | "BLOCKED" | "HUMAN_REVIEW";

export interface SkillExecutionResult<O = unknown> {
  status: ExecutionStatus;
  output?: O;
  outputEntityType?: string | null;
  outputEntityId?: string | null;
  failureReason?: string | null;
  brainOpUsed?: string | null;
  evidence?: Record<string, unknown>;
}

export type VerificationDecision =
  | "PROCEED"
  | "RETRY"
  | "REPAIR"
  | "ROLLBACK"
  | "HUMAN_REVIEW"
  | "FAILED";

export interface VerificationResult {
  ok: boolean;
  decision: VerificationDecision;
  checks: CheckResult[];
  reason?: string;
}

export type RollbackStatus = "ROLLED_BACK" | "NOT_NEEDED" | "NOT_POSSIBLE" | "FAILED";

export interface RollbackResult {
  status: RollbackStatus;
  detail?: string;
}

/** How a thrown/returned failure should be routed. */
export type FailureClass =
  | "RETRYABLE"
  | "NON_RETRYABLE"
  | "NEEDS_REPAIR"
  | "NEEDS_HUMAN_REVIEW"
  | "NEEDS_DEVELOPER"
  | "CIRCUIT_BREAK";

export interface RetryPolicy {
  maxAttempts: number;
  backoff: "none" | "linear" | "exponential";
  /** Failure classes that may be retried. */
  retryableClasses: readonly FailureClass[];
  /** After N failed attempts, file a repair plan. */
  routeToRepairAfter?: number;
  /** After N failed attempts, route to human review. */
  routeToHumanReviewAfter?: number;
  /** After N failed attempts, file a missing-capability developer request. */
  developerRequestAfter?: number;
  /** After N failed attempts (across passes), trip the skill's circuit breaker. */
  circuitBreakAfter?: number;
}

export interface SkillContext {
  prisma: PrismaClient;
  passId?: string | null;
  decisionId?: string | null;
  taskId?: string | null;
  contentType?: string | null;
  contentSubtype?: string | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  /** Skill-specific input payload. */
  input: Record<string, unknown>;
  /** True only when the Python final brain is active (vs safe degraded mode). */
  brainActive: boolean;
  /** Current worker mode, for mode-allowed preflight. */
  mode?: string | null;
  /** 1-based attempt number within the executor's retry loop. */
  attempt?: number;
}

/**
 * A certified skill — the 21 attributes the spec requires, all real:
 * name, purpose, content types + subtypes supported, inputs, outputs,
 * preconditions, required permissions, risk level, idempotency key, execution,
 * verification, rollback/repair, retry policy, failure classifier, success
 * metrics, tests required, brain ops used, safety gates required, and whether
 * human review is required.
 */
export interface CertifiedSkill<O = unknown> {
  name: string; // 1
  purpose: string; // 2
  category: SkillCategory;
  version: string;
  contentTypes: readonly string[]; // 3  ("*" = type-agnostic)
  contentSubtypes: readonly string[]; // 4 ("*" = subtype-agnostic, [] = n/a)
  inputs: readonly string[]; // 5
  outputs: readonly string[]; // 6
  preconditions: readonly string[]; // 7
  requiredPermissions: readonly string[]; // 8
  riskLevel: SkillRiskLevel; // 9
  idempotencyKey: (ctx: SkillContext) => string; // 10
  execute: (ctx: SkillContext) => Promise<SkillExecutionResult<O>>; // 11
  verify: (ctx: SkillContext, result: SkillExecutionResult<O>) => Promise<VerificationResult>; // 12
  rollback?: (ctx: SkillContext, result: SkillExecutionResult<O>) => Promise<RollbackResult>; // 13
  retryPolicy: RetryPolicy; // 14
  failureClassifier: (error: unknown, ctx: SkillContext) => FailureClass; // 15
  successMetrics: readonly string[]; // 16
  testsRequired: readonly string[]; // 17
  brainOps: readonly string[]; // 18
  safetyGates: readonly string[]; // 19
  humanReviewRequired: boolean; // 20
  /** Sensitive Catholic categories require a passing proof packet to publish. */
  requiresProofPacket?: boolean;
  /** Whether this skill is permitted to run in safe degraded mode. */
  allowedInSafeDegradedMode: boolean;
  /** Optional skill-specific preflight (target valid, rows present, …). */
  preflightExtra?: (ctx: SkillContext) => Promise<PreflightResult | null>;
}

/**
 * Durable side-effects the executor needs, injected so the core runtime is
 * unit-testable without a database. Batch "ledger" supplies Prisma-backed deps;
 * tests pass no-op deps.
 */
export interface SkillRuntimeDeps {
  /** Persist one skill-execution ledger row; returns its id (or null). */
  recordExecution(row: SkillExecutionLedgerInput): Promise<string | null>;
  /** Has this idempotency key already completed successfully + verified? */
  isIdempotentDone(skillName: string, idempotencyKey: string): Promise<boolean>;
  /** Is this skill's circuit breaker open (too many recent failures)? */
  isCircuitOpen(skillName: string): Promise<boolean>;
  /** Learning + bookkeeping after an execution (memory, reputation, coverage…). */
  onOutcome(skill: CertifiedSkill, ctx: SkillContext, run: SkillRunResult): Promise<void>;
  /** File a developer request for a missing/insufficient capability. */
  fileDeveloperRequest(input: MissingSkillRequest): Promise<void>;
  /** File a repair plan for a recoverable failure. */
  fileRepairPlan(skill: CertifiedSkill, ctx: SkillContext, reason: string): Promise<void>;
}

export interface SkillExecutionLedgerInput {
  passId?: string | null;
  decisionId?: string | null;
  taskId?: string | null;
  skillName: string;
  skillVersion: string;
  contentType?: string | null;
  contentSubtype?: string | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  inputHash: string;
  idempotencyKey: string;
  preflightStatus: PreflightDecision;
  executionStatus: ExecutionStatus;
  verificationStatus: VerificationDecision | "NOT_RUN";
  rollbackStatus: RollbackStatus | "NOT_RUN";
  riskLevel: SkillRiskLevel;
  safeToAutoExecute: boolean;
  humanReviewRequired: boolean;
  attemptCount: number;
  durationMs: number;
  failureReason?: string | null;
  brainOpUsed?: string | null;
  outputEntityType?: string | null;
  outputEntityId?: string | null;
}

export interface MissingSkillRequest {
  skillName: string;
  reason: string;
  contentType?: string | null;
  contentSubtype?: string | null;
  mission?: string | null;
  evidence?: string;
}

/** The executor's overall outcome for one skill run. */
export interface SkillRunResult<O = unknown> {
  skillName: string;
  skillVersion: string;
  preflight: PreflightResult;
  execution: SkillExecutionResult<O>;
  verification: VerificationResult | null;
  rollback: RollbackResult | null;
  attempts: number;
  durationMs: number;
  failureClass: FailureClass | null;
  ledgerId: string | null;
  /** Terminal disposition of the run. */
  outcome:
    | "SUCCEEDED"
    | "BLOCKED"
    | "SKIPPED_IDEMPOTENT"
    | "HUMAN_REVIEW"
    | "REPAIR_FILED"
    | "ROLLED_BACK"
    | "FAILED"
    | "CIRCUIT_OPEN"
    | "DEVELOPER_REQUEST";
}

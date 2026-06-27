/**
 * Autonomy + policy engine (spec: "Add permission levels for autonomy" +
 * "Add a policy engine"). Policy decisions live in TypeScript; Python only
 * supplies the scores. Given a proposed action plus the brain's confidence /
 * risk / communion-risk / duplicate findings, this returns one of:
 *   auto      — safe to execute without review
 *   draft     — do it but leave unpublished / pending
 *   escalate  — file for human review
 *   block     — refuse outright
 *
 * The worker's current authority is bounded by an autonomy level
 * (ADMIN_WORKER_AUTONOMY); an action above the current level always escalates.
 */

import type { RiskLevel } from "./intelligence";

export const AUTONOMY_LEVELS = [
  "DISCOVER_ONLY",
  "DRAFT_ONLY",
  "STORE_SAFE",
  "CONNECT_RECORDS",
  "PUBLISH_SAFE",
  "FULL",
] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export type WorkerAction =
  | "discover"
  | "draft"
  | "store"
  | "connect"
  | "publish"
  | "improvement_task"
  | "developer_request"
  | "code_patch"
  | "schema_change";

// The minimum autonomy level at which each action may run automatically.
const ACTION_MIN_LEVEL: Record<WorkerAction, AutonomyLevel> = {
  discover: "DISCOVER_ONLY",
  developer_request: "DISCOVER_ONLY",
  improvement_task: "DISCOVER_ONLY",
  draft: "DRAFT_ONLY",
  store: "STORE_SAFE",
  connect: "CONNECT_RECORDS",
  publish: "PUBLISH_SAFE",
  // High-impact actions always require the highest level + review.
  code_patch: "FULL",
  schema_change: "FULL",
};

export const CONFIDENCE_FLOOR = 0.62;
export const AUTO_CONFIDENCE = 0.75;
export const COMMUNION_BLOCK = 0.6;

export interface PolicyInput {
  action: WorkerAction;
  confidence: number;
  riskLevel: RiskLevel;
  safeToAutoExecute?: boolean;
  communionRisk?: number;
  duplicate?: boolean;
  currentLevel?: AutonomyLevel;
}

export type PolicyDecisionKind = "auto" | "draft" | "escalate" | "block";

export interface PolicyDecision {
  decision: PolicyDecisionKind;
  reason: string;
}

function levelIndex(level: AutonomyLevel): number {
  return AUTONOMY_LEVELS.indexOf(level);
}

/** The worker's current authority level (env-configurable; default PUBLISH_SAFE). */
export function currentAutonomyLevel(): AutonomyLevel {
  const raw = (process.env.ADMIN_WORKER_AUTONOMY ?? "").toUpperCase();
  return (AUTONOMY_LEVELS as readonly string[]).includes(raw)
    ? (raw as AutonomyLevel)
    : "PUBLISH_SAFE";
}

/**
 * Whether the worker must defer uncertain decisions to a human.
 *
 * Default **false**: the worker is fully independent and NEVER parks work in the
 * human-review queue. For every situation that would otherwise need a human it
 * makes its own terminal decision — publish when the evidence clears the bar,
 * otherwise SKIP (never publish unverified, never delete on uncertainty) and
 * revisit autonomously once better evidence or a capability is available. The
 * human-review UI still exists (a human *may* review), but the worker never
 * depends on it, so the queue never blocks growth.
 *
 * Set `ADMIN_WORKER_REQUIRE_HUMAN_REVIEW=1` (or `true`/`on`/`yes`) to restore the
 * human-gated behaviour, where uncertain items are queued for a person.
 */
export function requireHumanReview(): boolean {
  const v = (process.env.ADMIN_WORKER_REQUIRE_HUMAN_REVIEW ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

function isHighRisk(level: RiskLevel): boolean {
  return level === "high" || level === "critical";
}

/**
 * Decide what may happen with a proposed action. Pure + deterministic so the
 * executor and tests can reason about it.
 */
export function evaluateAutonomy(input: PolicyInput): PolicyDecision {
  const current = input.currentLevel ?? currentAutonomyLevel();

  // Hard blocks first — these never auto-execute regardless of level.
  if (input.duplicate) {
    return { decision: "block", reason: "duplicate detected" };
  }
  if ((input.communionRisk ?? 0) >= COMMUNION_BLOCK) {
    return {
      decision: "escalate",
      reason: `communion risk ${(input.communionRisk ?? 0).toFixed(2)} — verify before publishing`,
    };
  }

  // Action must be permitted at the current autonomy level.
  const required = ACTION_MIN_LEVEL[input.action];
  if (levelIndex(required) > levelIndex(current)) {
    return {
      decision: "escalate",
      reason: `action '${input.action}' requires ${required} but autonomy is ${current}`,
    };
  }

  // Risk + confidence gates.
  if (isHighRisk(input.riskLevel)) {
    return { decision: "escalate", reason: `risk level ${input.riskLevel}` };
  }
  if (input.confidence < CONFIDENCE_FLOOR) {
    return {
      decision: "escalate",
      reason: `confidence ${input.confidence.toFixed(2)} below floor ${CONFIDENCE_FLOOR}`,
    };
  }

  if (
    input.safeToAutoExecute &&
    input.confidence >= AUTO_CONFIDENCE &&
    (input.riskLevel === "none" || input.riskLevel === "low")
  ) {
    return { decision: "auto", reason: "high confidence + low risk + permitted" };
  }

  // Permitted but not confident/safe enough to auto-run: draft it.
  return { decision: "draft", reason: "permitted but not safe-to-auto; drafting for review" };
}

/**
 * Governance decision layer (spec bullet 2).
 *
 * Turns a `SelfAssessment` into ONE decision from the operator's vocabulary:
 * continue · retry · skip · pause · escalate · changeStrategy. Pure and
 * deterministic (no IO) so it is fully unit-testable; the loop-level pipeline
 * governor (`governor.ts`) still handles the in-pass forced-stage drain, and
 * this layer sits above it deciding the higher-order response to the worker's
 * overall state + recent history.
 *
 * `escalate` is reserved for SERIOUS conditions — any ERROR-severity warning,
 * or a "no value / wasting resources" warning (extracting-without-publishing,
 * no-value, burning-storage). The escalation engine (`escalation.ts`)
 * deduplicates escalations so the same issue emails the admin at most once.
 * `recommendPause` is advice the loop honours only when explicitly enabled
 * (auto-pause is destructive), so the layer CAN choose to pause without
 * surprising the operator by default.
 */

import type { SelfAssessment, WarningKind, WorkerWarning } from "./self-assessment";

export type GovernanceKind =
  | "continue"
  | "retry"
  | "skip"
  | "pause"
  | "escalate"
  | "changeStrategy";

export interface EscalationPayload {
  kind: WarningKind | "GENERIC";
  severity: "WARN" | "ERROR";
  detail: string;
  signals: string[];
  contentType: string | null;
}

export interface GovernanceDecision {
  kind: GovernanceKind;
  reason: string;
  /** True when this warrants paging the human admin (an email escalation). */
  escalate: boolean;
  escalation?: EscalationPayload;
  /** Governance judges a pause warranted; loop honours only when enabled. */
  recommendPause: boolean;
}

/** Kinds that are serious enough to escalate even at WARN severity. */
const ESCALATE_AT_WARN: ReadonlySet<WarningKind> = new Set([
  "EXTRACTING_WITHOUT_PUBLISHING",
  "NO_VALUE",
  "BURNING_STORAGE",
]);

/** Tie-break order when several warnings are present (most-serious first). */
const KIND_PRIORITY: WarningKind[] = [
  "NO_VALUE",
  "EXTRACTING_WITHOUT_PUBLISHING",
  "BURNING_STORAGE",
  "LOOPING",
  "PUBLISHING_LOW_QUALITY",
  "REPEATED_TYPE_FAILURE",
];

/** The non-escalation response each warning maps to. */
const KIND_ACTION: Record<WarningKind, GovernanceKind> = {
  LOOPING: "changeStrategy",
  EXTRACTING_WITHOUT_PUBLISHING: "changeStrategy",
  BURNING_STORAGE: "changeStrategy",
  REPEATED_TYPE_FAILURE: "skip",
  PUBLISHING_LOW_QUALITY: "retry",
  NO_VALUE: "changeStrategy",
};

function pickPrimary(warnings: WorkerWarning[]): WorkerWarning | null {
  if (warnings.length === 0) return null;
  return [...warnings].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "ERROR" ? -1 : 1;
    return KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind);
  })[0];
}

/**
 * Decide the higher-order governance action for the current worker state.
 * Deterministic; safe to call every check.
 */
export function decideGovernance(self: SelfAssessment): GovernanceDecision {
  if (self.paused) {
    return {
      kind: "continue",
      reason: "Worker is paused by the operator; nothing to govern.",
      escalate: false,
      recommendPause: false,
    };
  }
  if (!self.workerLive) {
    return {
      kind: "continue",
      reason:
        "Worker process is offline; liveness is handled by the reaper/banner, not governance.",
      escalate: false,
      recommendPause: false,
    };
  }

  const primary = pickPrimary(self.warnings);
  if (!primary) {
    return {
      kind: "continue",
      reason: self.productive
        ? `Productive: ${self.publishedDelta} item(s) published in the last ${self.windowHours}h.`
        : "No warnings detected.",
      escalate: false,
      recommendPause: false,
    };
  }

  const escalate = primary.severity === "ERROR" || ESCALATE_AT_WARN.has(primary.kind);
  const recommendPause =
    (primary.kind === "PUBLISHING_LOW_QUALITY" || primary.kind === "BURNING_STORAGE") &&
    primary.severity === "ERROR";

  const escalation: EscalationPayload = {
    kind: primary.kind,
    severity: primary.severity,
    detail: primary.detail,
    signals: primary.signals,
    contentType: primary.contentType,
  };

  if (escalate) {
    return {
      kind: "escalate",
      reason: `Escalate (${primary.severity}) — ${primary.detail}`,
      escalate: true,
      escalation,
      recommendPause,
    };
  }

  return {
    kind: KIND_ACTION[primary.kind],
    reason: `${KIND_ACTION[primary.kind]} — ${primary.detail}`,
    escalate: false,
    escalation,
    recommendPause,
  };
}

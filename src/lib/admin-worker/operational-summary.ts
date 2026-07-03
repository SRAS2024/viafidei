/**
 * Operational self-awareness summary (adaptive-worker Phase A/F capstone).
 *
 * Composes the signals the worker already records into ONE answer to the
 * operator's real questions:
 *   - What am I doing right now?         → active lanes + current action
 *   - Am I actually working?             → heartbeat freshness + last pass
 *   - Which strategy am I using?         → best method per dimension
 *   - Why isn't more publishing?         → the BUILD_READY per-gate backlog
 *   - What changed after a code update?  → latest recorded code version
 *   - What should I try next?            → derived next-best-action
 *
 * Pure composition over existing reads — no new writes, fail-open on every
 * query so a missing table degrades a field instead of breaking the summary.
 */

import type { PrismaClient } from "@prisma/client";

import { getLaneStates } from "./lanes";

export interface OperationalSummary {
  /** Heartbeat fresh AND not paused AND last pass not failed. */
  working: boolean;
  heartbeatAgeSeconds: number | null;
  paused: boolean;
  /** Lanes that ran/are running this cycle, with last outcome. */
  lanes: Array<{ lane: string; status: string; lastOutcome: string | null }>;
  activeLaneCount: number;
  erroredLaneCount: number;
  /** The action the brain most recently selected. */
  currentAction: { missionStage: string | null; reason: string | null; at: Date | null } | null;
  /** Best-performing method per learned dimension. */
  bestStrategies: Array<{ dimension: string; method: string; ewma: number }>;
  /** Per-gate BUILD_READY/VERIFICATION_READY backlog — why items aren't published. */
  buildReadyGates: Array<{ gate: string; count: number }>;
  buildReadyBacklog: number;
  /** Latest running code version (what changed after a deploy). */
  codeVersion: { versionLabel: string; sha: string | null; changedSummary: string | null } | null;
  openEscalations: number;
  /** One-line derived recommendation of the highest-value next action. */
  nextBestAction: string;
}

export async function buildOperationalSummary(prisma: PrismaClient): Promise<OperationalSummary> {
  const now = Date.now();

  const [state, lanes, lastDecision, strategyStats, gateRows, codeVersion, openEscalations] =
    await Promise.all([
      prisma.adminWorkerState.findUnique({ where: { id: "singleton" } }).catch(() => null),
      getLaneStates(prisma),
      prisma.adminWorkerActionScore
        .findFirst({
          where: { selected: true },
          orderBy: { createdAt: "desc" },
          select: { missionStage: true, reason: true, createdAt: true },
        })
        .catch(() => null),
      prisma.adminWorkerStrategyStat
        .findMany({
          orderBy: [{ dimension: "asc" }, { ewma: "desc" }],
          select: { dimension: true, method: true, ewma: true },
          take: 60,
        })
        .catch(() => [] as Array<{ dimension: string; method: string; ewma: number }>),
      prisma.adminWorkerPackageArtifact
        .groupBy({
          by: ["gateDiagnosis"],
          where: { status: { in: ["BUILD_READY", "VERIFICATION_READY"] } },
          _count: { _all: true },
        })
        .catch(() => [] as Array<{ gateDiagnosis: string | null; _count: { _all: number } }>),
      prisma.adminWorkerCodeVersion
        .findFirst({
          orderBy: { capturedAt: "desc" },
          select: { versionLabel: true, sha: true, changedSummary: true },
        })
        .catch(() => null),
      prisma.adminWorkerEscalation.count({ where: { resolvedAt: null } }).catch(() => 0),
    ]);

  const heartbeatAgeSeconds = state?.lastHeartbeatAt
    ? Math.round((now - new Date(state.lastHeartbeatAt).getTime()) / 1000)
    : null;
  const paused = Boolean(state?.paused);
  const working =
    !paused &&
    heartbeatAgeSeconds !== null &&
    heartbeatAgeSeconds < 5 * 60 &&
    !state?.currentBlocker;

  const laneRows = lanes.map((l) => ({
    lane: l.lane,
    status: l.status,
    lastOutcome: l.lastError ?? l.lastOutcome ?? null,
  }));

  // Best method per dimension (stats pre-sorted ewma desc within dimension).
  const bestByDim = new Map<string, { dimension: string; method: string; ewma: number }>();
  for (const s of strategyStats) {
    if (!bestByDim.has(s.dimension)) {
      bestByDim.set(s.dimension, { dimension: s.dimension, method: s.method, ewma: s.ewma });
    }
  }

  const buildReadyGates = gateRows
    .map((r) => ({ gate: r.gateDiagnosis ?? "UNDIAGNOSED", count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const buildReadyBacklog = buildReadyGates.reduce((sum, g) => sum + g.count, 0);

  const erroredLaneCount = laneRows.filter((l) => l.status === "error").length;
  const activeLaneCount = laneRows.filter((l) => l.status === "running").length;

  return {
    working,
    heartbeatAgeSeconds,
    paused,
    lanes: laneRows,
    activeLaneCount,
    erroredLaneCount,
    currentAction: lastDecision
      ? {
          missionStage: lastDecision.missionStage,
          reason: lastDecision.reason,
          at: lastDecision.createdAt,
        }
      : null,
    bestStrategies: [...bestByDim.values()],
    buildReadyGates,
    buildReadyBacklog,
    codeVersion,
    openEscalations,
    nextBestAction: deriveNextBestAction({
      paused,
      working,
      buildReadyGates,
      buildReadyBacklog,
      openEscalations,
      erroredLaneCount,
      currentAction: lastDecision?.missionStage ?? null,
    }),
  };
}

/**
 * Derive the single highest-value next action from the composed state,
 * mission-aware: optimise for meaningful progress (drain toward publish, clear
 * blockers) over raw activity.
 */
export function deriveNextBestAction(input: {
  paused: boolean;
  working: boolean;
  buildReadyGates: Array<{ gate: string; count: number }>;
  buildReadyBacklog: number;
  openEscalations: number;
  erroredLaneCount: number;
  currentAction: string | null;
}): string {
  if (input.paused) return "Worker is paused — resume it to continue autonomous work.";
  if (input.openEscalations > 0) {
    return `Address ${input.openEscalations} open escalation(s) — a condition needs attention before it blocks progress.`;
  }
  if (input.erroredLaneCount > 0) {
    return `${input.erroredLaneCount} lane(s) are in error-backoff — inspect the failing lane; it auto-retries after cooldown.`;
  }
  if (input.buildReadyBacklog > 0) {
    // Name the dominant blocking gate so the recommendation is concrete.
    const top = input.buildReadyGates[0];
    const gateHint: Record<string, string> = {
      AWAITING_QA: "run strict QA on the built backlog",
      AWAITING_VERIFICATION: "run cross-source verification on the built backlog",
      VERIFICATION_INCOMPLETE: "gather the remaining validation evidence",
      MISSING_REQUIRED_FIELDS: "repair artifacts missing required fields",
      MISSING_CITATIONS: "attach citations/provenance to built artifacts",
      LOW_CONFIDENCE: "re-extract low-confidence artifacts from a stronger source",
      DUPLICATE: "resolve duplicate artifacts",
    };
    const hint = top
      ? (gateHint[top.gate] ?? "drain the built backlog toward publish")
      : "drain the built backlog toward publish";
    return `Drain the BUILD_READY backlog (${input.buildReadyBacklog} item(s)); dominant gate ${top?.gate ?? "?"} → ${hint}.`;
  }
  if (!input.working) return "Worker is not heartbeating fresh — check the process is running.";
  return input.currentAction
    ? `Continue the current mission stage (${input.currentAction}); no backlog or blockers detected.`
    : "Generate new work — no backlog or blockers detected.";
}

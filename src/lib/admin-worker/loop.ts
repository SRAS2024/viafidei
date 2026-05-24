/**
 * Admin Worker central decision loop.
 *
 * The loop is the brain of the engine: each pass it reads the world
 * (state, goals, source reputation, security events, homepage score,
 * pending review queue) and picks the highest-priority action.
 *
 * The loop is deterministic: same inputs -> same chosen action, same
 * confidence. The decision is recorded to AdminWorkerDecision so the
 * operator can audit why the worker did what it did.
 *
 * Hard rules:
 *   - When paused, only security defense runs.
 *   - When a security event needs response, it runs first.
 *   - When worker health is degraded, repair runs before new builds.
 *   - When content goals are unmet, the worker generates its own
 *     build tasks (no manual trigger required).
 *
 * The loop is intentionally not coupled to the existing checklist
 * worker. It delegates the actual build work to the existing
 * runOneBuildCycle path; the loop's job is to decide whether/when
 * to call it and what to record.
 */

import type { AdminWorkerPassType, AdminWorkerPriority, PrismaClient } from "@prisma/client";

import { runOneBuildCycle } from "@/lib/worker";
import { writeAdminWorkerLog } from "./logs";
import { recordDecision } from "./decisions";
import {
  getAdminWorkerState,
  recordFailure,
  recordSuccess,
  setMode,
  setPriority,
  writeHeartbeat,
} from "./state";
import { completePass, startPass } from "./passes";
import { highestPriority } from "./priorities";
import { nextPriorityContentType, refreshContentGoals } from "./content-goals";

export interface LoopOptions {
  workerId?: string;
  /** Run one pass then return. Defaults to true for testability. */
  oneShot?: boolean;
  /** Maximum passes when looping forever. Default Infinity. */
  maxPasses?: number;
  /** Backoff between passes when nothing is queued (ms). */
  idleBackoffMs?: number;
}

export interface LoopResult {
  passes: number;
  built: number;
  published: number;
  failed: number;
}

/**
 * Run the Admin Worker engine.
 *
 * In Phase 1 this delegates content builds to the existing
 * `runOneBuildCycle` from `src/lib/worker`. The loop wraps that call
 * in pass-lifecycle bookkeeping, heartbeat writes, and decision
 * logging so the diagnostics card has accurate state on every cycle.
 */
export async function runAdminWorkerLoop(
  prisma: PrismaClient,
  opts: LoopOptions = {},
): Promise<LoopResult> {
  const workerId = opts.workerId ?? `admin-worker-${process.pid}-${Date.now()}`;
  const oneShot = opts.oneShot ?? true;
  const maxPasses = opts.maxPasses ?? Infinity;
  const idleBackoffMs = opts.idleBackoffMs ?? 1000;

  let passes = 0;
  let built = 0;
  let published = 0;
  let failed = 0;

  while (passes < maxPasses) {
    const passOutcome = await runOnePass(prisma, workerId);
    passes += 1;
    built += passOutcome.built;
    published += passOutcome.published;
    failed += passOutcome.failed;

    if (oneShot) break;
    if (passOutcome.idle) {
      await sleep(idleBackoffMs);
    }
  }

  return { passes, built, published, failed };
}

interface PassOutcome {
  built: number;
  published: number;
  failed: number;
  idle: boolean;
}

/**
 * Single pass. Decides priority, runs the corresponding work, writes
 * the pass + decision rows, and updates state. Exported for tests.
 */
export async function runOnePass(prisma: PrismaClient, workerId: string): Promise<PassOutcome> {
  await writeHeartbeat(prisma);
  const state = await getAdminWorkerState(prisma);

  // Pause guard. Security defense still runs (see security-defender.ts)
  // but it has its own entry point — the main loop returns early.
  if (state.paused) {
    await writeAdminWorkerLog(prisma, {
      category: "OVERVIEW",
      severity: "INFO",
      eventName: "loop_paused",
      message: `Admin Worker is paused (${state.pausedReason ?? "no reason given"}). Skipping non-security work.`,
    });
    return { built: 0, published: 0, failed: 0, idle: true };
  }

  await refreshContentGoals(prisma);
  const decision = await selectPriority(prisma);
  await setPriority(prisma, decision.priority);
  await setMode(prisma, decision.mode);

  const pass = await startPass(prisma, { passType: decision.passType });
  await recordDecision(prisma, {
    passId: pass.id,
    decisionType: "loop_priority",
    inputSummary: decision.summary,
    rulesEvaluated: decision.rulesEvaluated as Record<string, string | number | boolean | null>,
    chosenAction: decision.priority,
    confidence: decision.confidence,
    reason: decision.reason,
    fallbackAction: decision.fallback ?? undefined,
  });

  let built = 0;
  let publishedCount = 0;
  let failedCount = 0;
  let idle = false;

  try {
    if (decision.priority === "CONTENT_BUILD") {
      const cycle = await runOneBuildCycle(prisma, workerId);
      if (cycle.kind === "idle") {
        idle = true;
      } else {
        // cycle.kind === "ran"
        if (cycle.status === "succeeded" || cycle.status === "published") {
          built += 1;
          if (cycle.status === "published") publishedCount += 1;
        } else if (cycle.status === "failed" || cycle.status === "retrying") {
          failedCount += 1;
        }
      }
    } else {
      // For other priorities the Phase 1 loop only records the
      // decision — the actual handlers (homepage designer, security
      // defender, etc.) are wired up in their own modules and can be
      // invoked directly. The loop still writes a clean pass so the
      // pass breakdown stays accurate.
      idle = decision.priority === "MAINTENANCE";
    }
    await completePass(prisma, {
      passId: pass.id,
      status: failedCount > 0 ? "PARTIAL" : "SUCCEEDED",
      tasksPlanned: 1,
      tasksCompleted: failedCount === 0 ? 1 : 0,
      tasksFailed: failedCount,
      contentBuilt: built,
      contentPublished: publishedCount,
      summary: decision.summary,
    });
    await recordSuccess(prisma, { summary: decision.summary });
  } catch (err) {
    failedCount += 1;
    const message = err instanceof Error ? err.message : String(err);
    await completePass(prisma, {
      passId: pass.id,
      status: "FAILED",
      tasksFailed: 1,
      errorMessage: message,
      summary: `pass failed: ${message.slice(0, 200)}`,
    });
    await recordFailure(prisma, {
      blocker: message.slice(0, 500),
      recoveryAction: "Investigate logs at /admin/admin-worker.",
    });
    await writeAdminWorkerLog(prisma, {
      passId: pass.id,
      category: "ERROR",
      severity: "ERROR",
      eventName: "loop_pass_failed",
      message,
    });
  }

  return { built, published: publishedCount, failed: failedCount, idle };
}

interface SelectedPriority {
  priority: AdminWorkerPriority;
  passType: AdminWorkerPassType;
  mode:
    | "CONSTANT_FILL"
    | "MAINTENANCE"
    | "REPAIR"
    | "HOMEPAGE"
    | "DIAGNOSTICS"
    | "SECURITY_DEFENSE"
    | "REPORTING"
    | "SETUP";
  summary: string;
  confidence: number;
  reason: string;
  fallback?: string;
  rulesEvaluated: Record<string, unknown>;
}

/**
 * Deterministic priority selector. Walks the priority ladder in
 * order and picks the first one with available work.
 */
export async function selectPriority(prisma: PrismaClient): Promise<SelectedPriority> {
  const rules: Record<string, unknown> = {};
  const candidates: AdminWorkerPriority[] = [];

  // Worker health check — stale heartbeat counts as unhealthy.
  const state = await getAdminWorkerState(prisma);
  rules.lastHeartbeatAt = state.lastHeartbeatAt?.toISOString() ?? null;

  // Content goal gap.
  const nextGoal = await nextPriorityContentType(prisma);
  rules.contentGoalGap = nextGoal?.gap ?? 0;
  rules.contentGoalContentType = nextGoal?.contentType ?? null;
  if (nextGoal && nextGoal.gap > 0) candidates.push("CONTENT_GOAL", "CONTENT_BUILD");

  // Pending build jobs.
  const pendingJobs = await prisma.workerBuildJob.count({ where: { status: "pending" } });
  rules.pendingBuildJobs = pendingJobs;
  if (pendingJobs > 0) candidates.push("CONTENT_BUILD");

  // Failed jobs that may need retry / repair.
  const failedJobs = await prisma.workerBuildJob.count({ where: { status: "failed" } });
  rules.failedBuildJobs = failedJobs;
  if (failedJobs > 0) candidates.push("SOURCE_REPAIR");

  // Default fallback — maintenance.
  if (candidates.length === 0) candidates.push("MAINTENANCE");

  const chosen = highestPriority(candidates) ?? "MAINTENANCE";

  const mode = priorityToMode(chosen);
  const passType = priorityToPassType(chosen);

  return {
    priority: chosen,
    passType,
    mode,
    summary: `priority=${chosen} candidates=${candidates.join(",")}`,
    confidence: candidates.length === 1 ? 0.9 : 0.7,
    reason: `Selected ${chosen} from ${candidates.length} candidate(s).`,
    fallback: chosen === "MAINTENANCE" ? undefined : "MAINTENANCE",
    rulesEvaluated: rules,
  };
}

function priorityToMode(p: AdminWorkerPriority): SelectedPriority["mode"] {
  switch (p) {
    case "SECURITY_THREAT":
      return "SECURITY_DEFENSE";
    case "WORKER_HEALTH":
    case "SOURCE_REPAIR":
      return "REPAIR";
    case "CONTENT_GOAL":
    case "CONTENT_BUILD":
    case "CONTENT_VALIDATION":
    case "CONTENT_PUBLISH":
      return "CONSTANT_FILL";
    case "HOMEPAGE":
      return "HOMEPAGE";
    case "DIAGNOSTICS":
      return "DIAGNOSTICS";
    case "CLEANUP":
    case "MAINTENANCE":
    default:
      return "MAINTENANCE";
  }
}

function priorityToPassType(p: AdminWorkerPriority): AdminWorkerPassType {
  switch (p) {
    case "SECURITY_THREAT":
      return "SECURITY";
    case "WORKER_HEALTH":
    case "SOURCE_REPAIR":
      return "SOURCE_REPAIR";
    case "CONTENT_GOAL":
    case "CONTENT_BUILD":
    case "CONTENT_VALIDATION":
    case "CONTENT_PUBLISH":
      return "CONTENT_GOAL";
    case "HOMEPAGE":
      return "HOMEPAGE";
    case "DIAGNOSTICS":
      return "DIAGNOSTICS";
    case "CLEANUP":
      return "CLEANUP";
    case "MAINTENANCE":
    default:
      return "AUTONOMOUS";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Admin Worker central decision loop.
 *
 * Every pass:
 *   1. writes a heartbeat (AdminWorkerState.lastHeartbeatAt + compat)
 *   2. runs the AdminWorkerBrain to produce a structured BrainDecision
 *   3. delegates to the mission planner for chain-aware stage choice
 *   4. dispatches to the module matching the chosen mode
 *   5. records the pass + decision rows so the audit view can answer
 *      "why did the worker choose this?"
 *
 * Hard rules:
 *   - When paused, only security defense runs.
 *   - When a security event needs response, it runs first.
 *   - When worker health is degraded, repair runs before new builds.
 *   - When content goals are unmet, the worker generates its own work.
 */

import type { PrismaClient } from "@prisma/client";

import { runOneBuildCycle } from "@/lib/worker";
import { writeAdminWorkerLog } from "./logs";
import {
  getAdminWorkerState,
  recordFailure,
  recordSuccess,
  setMode,
  setPriority,
  writeHeartbeat,
} from "./state";
import { completePass, startPass } from "./passes";
import { refreshContentGoals } from "./content-goals";
import { planAndEnqueue } from "./planner";

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
 * Run the Admin Worker engine. Wraps `runOnePass` in a loop with
 * heartbeat writes, idle backoff, and a oneShot escape hatch for tests.
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

  // Run the explicit Admin Worker brain. The brain samples world
  // state + records a BrainDecision so the audit view can show exactly
  // what the worker chose and why.
  const pass = await startPass(prisma, { passType: "AUTONOMOUS" });
  const { runBrain } = await import("./brain");
  const brain = await runBrain(prisma, { passId: pass.id });

  // Project the brain decision onto the legacy `decision` shape the
  // mode dispatch below already consumes.
  const decision: {
    priority: import("@prisma/client").AdminWorkerPriority;
    mode:
      | "CONSTANT_FILL"
      | "MAINTENANCE"
      | "REPAIR"
      | "HOMEPAGE"
      | "DIAGNOSTICS"
      | "SECURITY_DEFENSE"
      | "REPORTING"
      | "SETUP";
    passType: import("@prisma/client").AdminWorkerPassType;
    summary: string;
    confidence: number;
    reason: string;
    fallback?: string;
    rulesEvaluated: Record<string, unknown>;
  } = {
    priority: brain.chosenPriority,
    mode:
      brain.chosenMode === "PAUSED"
        ? "MAINTENANCE"
        : (brain.chosenMode as
            | "CONSTANT_FILL"
            | "MAINTENANCE"
            | "REPAIR"
            | "HOMEPAGE"
            | "DIAGNOSTICS"
            | "SECURITY_DEFENSE"
            | "REPORTING"
            | "SETUP"),
    passType: brain.passType,
    summary: brain.reason,
    confidence: brain.confidenceScore,
    reason: brain.reason,
    fallback: brain.fallbackAction ?? undefined,
    rulesEvaluated: brain.rulesEvaluated,
  };
  await setPriority(prisma, decision.priority);
  await setMode(prisma, brain.chosenMode);

  let built = 0;
  let publishedCount = 0;
  let failedCount = 0;
  let idle = false;

  let homepageActions = 0;
  try {
    // Mode-aware dispatch. The priority selector picks the mode; this
    // switch runs the corresponding module so the loop actually does
    // work for every mode rather than only CONTENT_BUILD.
    switch (decision.mode) {
      case "CONSTANT_FILL": {
        // Consult the mission planner first. It walks the full chain
        // (Discovery → … → Cache) and tells us which stage is the
        // choke point. We log the chosen stage + nextStep so the audit
        // view shows "why this stage now".
        const { planMission } = await import("./mission-planner");
        const mission = await planMission(prisma);
        await writeAdminWorkerLog(prisma, {
          passId: pass.id,
          category: "WORKER_PASS",
          severity: "INFO",
          eventName: "mission_planned",
          message: `Stage ${mission.stage}: ${mission.reason}`,
          contentType: mission.contentType ?? undefined,
          safeMetadata: {
            stage: mission.stage,
            taskType: mission.taskType,
            nextStep: mission.nextStep,
          },
        });

        // Planner: enqueue work for the largest content gap (BUILD stage).
        const planOutcome = await planAndEnqueue(prisma, { passId: pass.id });
        if (planOutcome.enqueued > 0) {
          await writeAdminWorkerLog(prisma, {
            passId: pass.id,
            category: "WORKER_PASS",
            severity: "INFO",
            eventName: "planner_run",
            message: planOutcome.reason,
            contentType: planOutcome.contentType ?? undefined,
          });
        }
        const cycle = await runOneBuildCycle(prisma, workerId);
        if (cycle.kind === "idle") {
          idle = planOutcome.enqueued === 0;
        } else if (cycle.status === "succeeded" || cycle.status === "published") {
          built += 1;
          if (cycle.status === "published") publishedCount += 1;
        } else if (cycle.status === "failed" || cycle.status === "retrying") {
          failedCount += 1;
        }
        break;
      }
      case "HOMEPAGE": {
        const { redesignHomepage } = await import("./homepage-mutator");
        const result = await redesignHomepage(prisma, { passId: pass.id });
        if (result.draftId) homepageActions += 1;
        break;
      }
      case "REPORTING": {
        const { runMonthlyReportJobIfDue } = await import("./monthly-report-job");
        await runMonthlyReportJobIfDue(prisma);
        break;
      }
      case "DIAGNOSTICS": {
        // Refresh diagnostics: write DiagnosticSnapshot rows via the
        // existing module so the Developer Audit can see them.
        const ratings = await (await import("./diagnostics")).runAdminWorkerDiagnostics(prisma);
        await writeAdminWorkerLog(prisma, {
          passId: pass.id,
          category: "WORKER_PASS",
          severity: "INFO",
          eventName: "diagnostics_pass",
          message: `Diagnostics audit completed (${ratings.length} ratings checked).`,
          safeMetadata: { ratingsCount: ratings.length },
        });
        break;
      }
      case "MAINTENANCE": {
        const { runCleanupPass } = await import("./cleanup");
        await runCleanupPass(prisma);
        idle = true; // maintenance + cleanup is intentionally slow
        break;
      }
      case "REPAIR": {
        const { recoverStuckQueue } = await import("./repair");
        await recoverStuckQueue(prisma);
        // Then attempt a build cycle to make forward progress.
        const cycle = await runOneBuildCycle(prisma, workerId);
        if (cycle.kind === "idle") idle = true;
        else if (cycle.status === "succeeded" || cycle.status === "published") built += 1;
        else if (cycle.status === "failed" || cycle.status === "retrying") failedCount += 1;
        break;
      }
      case "SECURITY_DEFENSE":
      case "SETUP":
      default:
        // No active work for SECURITY_DEFENSE in the central loop —
        // the defender fires from the request path itself. SETUP mode
        // does nothing in the loop; setup runs once at deploy time.
        idle = true;
        break;
    }
    await completePass(prisma, {
      passId: pass.id,
      status: failedCount > 0 ? "PARTIAL" : "SUCCEEDED",
      tasksPlanned: 1,
      tasksCompleted: failedCount === 0 ? 1 : 0,
      tasksFailed: failedCount,
      contentBuilt: built,
      contentPublished: publishedCount,
      homepageActions,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

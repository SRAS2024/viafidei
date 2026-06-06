/**
 * Admin Worker central decision loop.
 *
 * Every pass:
 *   1. writes a heartbeat (AdminWorkerState.lastHeartbeatAt + compat)
 *   2. runs the AdminWorkerBrain to produce a structured BrainDecision
 *      with ranked alternatives (spec §1)
 *   3. delegates to the dispatcher to execute the chosen mission stage
 *      (spec §2 — the dispatcher replaces the old "merely log the
 *      mission plan" path with concrete stage execution)
 *   4. records the pass + decision rows so the audit view can answer
 *      "why did the worker choose this — and what happened next?"
 *
 * Hard rules:
 *   - When paused, only security defense runs.
 *   - When a security event needs response, it runs first.
 *   - When worker health is degraded, repair runs before new builds.
 *   - When content goals are unmet, the worker generates its own work.
 *   - The worker never stops at "planned" when work is available — the
 *     dispatcher always advances the chosen stage to a concrete result.
 */

import type { PrismaClient } from "@prisma/client";

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
import { refreshContentGoals, seedContentGoals } from "./content-goals";
import { executeMissionStage, type DispatchOutcome } from "./dispatcher";

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
 * Single pass. Decides what to do, dispatches the chosen stage, and
 * records the pass + decision rows. Exported for tests.
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

  // Seed content goals on first contact, then refresh from live counts.
  // seedContentGoals is idempotent (it skips content types that already
  // have a goal row), so calling it every pass is cheap and guarantees
  // the brain always sees real gaps to close — without it the worker
  // would idle forever thinking "all goals met" (spec §49-50, §66).
  await seedContentGoals(prisma).catch(() => 0);
  await refreshContentGoals(prisma);

  // Run the explicit Admin Worker brain. The brain ranks every
  // candidate action it can take right now and picks the highest-
  // scoring safe one. The decision (including ranked alternatives)
  // lands in AdminWorkerDecision for the audit view.
  const pass = await startPass(prisma, { passType: "AUTONOMOUS" });

  // Pre-decision intelligence: consult the permanent brain for which work to
  // prioritise next + a next-best-action. Recorded to the audit trail; the
  // TypeScript brain below remains the conductor. Best-effort, fail-open.
  try {
    const { adviseNextWork } = await import("./intelligence-advisory");
    await adviseNextWork(prisma, { passId: pass.id });
  } catch {
    // advisory only — never blocks the decision
  }

  const { runBrain } = await import("./brain");
  const brain = await runBrain(prisma, { passId: pass.id });

  await setPriority(prisma, brain.chosenPriority);
  await setMode(prisma, brain.chosenMode);

  // Log the brain decision + the top rejected alternatives so the
  // audit view always has a paper trail of "why this and not that".
  const topRejected = brain.rankedAlternatives.filter((a) => a !== brain.chosenAction).slice(0, 3);
  await writeAdminWorkerLog(prisma, {
    passId: pass.id,
    category: "WORKER_PASS",
    severity: "INFO",
    eventName: "brain_decided",
    message: `Brain chose ${brain.missionStage} (${brain.chosenMode}/${brain.chosenPriority}): ${brain.reason}`,
    contentType: brain.contentType ?? undefined,
    safeMetadata: {
      missionStage: brain.missionStage,
      chosenScore: brain.chosenAction.finalScore,
      explanation: brain.brainExplanation,
      brainFailure: brain.brainFailure,
      topRejected: topRejected.map((a) => ({
        missionStage: a.missionStage,
        score: a.finalScore,
        rejection: a.rejectionReason,
      })),
    },
  });

  let built = 0;
  let publishedCount = 0;
  let failedCount = 0;
  let idle = false;
  let dispatch: DispatchOutcome | null = null;

  try {
    dispatch = await executeMissionStage({
      prisma,
      workerId,
      passId: pass.id,
      decision: brain,
    });

    built += dispatch.built ?? 0;
    publishedCount += dispatch.published ?? 0;
    failedCount += dispatch.failed ?? 0;
    idle = dispatch.kind === "idle" || dispatch.kind === "skipped";

    await writeAdminWorkerLog(prisma, {
      passId: pass.id,
      category: "WORKER_PASS",
      severity: dispatch.kind === "failed" ? "ERROR" : "INFO",
      eventName: "stage_dispatched",
      message: `Stage ${dispatch.stage}: ${dispatch.summary}`,
      contentType: brain.contentType ?? undefined,
      safeMetadata: {
        kind: dispatch.kind,
        built: dispatch.built,
        published: dispatch.published,
        failed: dispatch.failed,
        rejected: dispatch.rejected,
        repairsPlanned: dispatch.repairsPlanned,
      },
    });

    await completePass(prisma, {
      passId: pass.id,
      status: failedCount > 0 ? "PARTIAL" : "SUCCEEDED",
      tasksPlanned: 1,
      tasksCompleted: failedCount === 0 ? 1 : 0,
      tasksFailed: failedCount,
      contentBuilt: built,
      contentPublished: publishedCount,
      homepageActions: dispatch.stage === "HOMEPAGE_WORK" ? 1 : 0,
      summary: `${brain.missionStage}: ${dispatch.summary}`,
    });
    await recordSuccess(prisma, { summary: dispatch.summary });
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

  // Post-pass intelligence: self-inspection + developer requests +
  // worker-IQ metrics via the Python brain. Best-effort and fail-open —
  // never breaks the loop, and a no-op when the brain is disabled/offline.
  try {
    const { runPostPassIntelligence } = await import("./intelligence-pass");
    await runPostPassIntelligence(prisma, { passId: pass.id, workerId });
  } catch {
    // ignore — intelligence is advisory and must not affect pass outcome
  }

  // Daily liturgical readings: keep the internal readings page current.
  // Throttled (≈once per 30 min/process) and fail-open; routes to review
  // rather than ever publishing uncertain readings.
  try {
    const { maybeRefreshDailyReadings } = await import("./daily-readings");
    await maybeRefreshDailyReadings(prisma, { passId: pass.id });
  } catch {
    // ignore — readings refresh is best-effort and must not affect the pass
  }

  // Maintenance intelligence: schema-awareness, UI-awareness, and content
  // custody. Each is throttled internally and fails open — advisory only.
  try {
    const { runSchemaAwareness, runUiAwareness, runCodeAwareness } = await import("./awareness");
    const { runCustodyPass } = await import("./custody");
    await runSchemaAwareness(prisma, { passId: pass.id });
    await runUiAwareness(prisma, { passId: pass.id });
    await runCodeAwareness(prisma, { passId: pass.id });
    await runCustodyPass(prisma, { passId: pass.id });
  } catch {
    // best-effort — maintenance intelligence must not affect the pass
  }

  return { built, published: publishedCount, failed: failedCount, idle };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

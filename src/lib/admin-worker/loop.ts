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

import { assertWorkerExecutionAllowed } from "./execution-context";
import { readExecutionStatus, renewExecutionLease } from "./execution-host";
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
  // Execution boundary (spec §1, §25): the loop only ever runs on the local
  // (MacBook) runtime. The production web service must never enter here.
  assertWorkerExecutionAllowed("run the Admin Worker loop");

  const workerId = opts.workerId ?? `admin-worker-${process.pid}-${Date.now()}`;
  const oneShot = opts.oneShot ?? true;
  const maxPasses = opts.maxPasses ?? Infinity;
  const idleBackoffMs = opts.idleBackoffMs ?? 1000;

  // Enable outbound egress through a proxy when the deployment provides one
  // (HTTPS_PROXY/HTTP_PROXY/ALL_PROXY). Idempotent + fail-open + a no-op when no
  // proxy is set. Without this, Node's fetch ignores the proxy and every
  // outbound request fails in a proxied environment — starving discovery,
  // extraction, and the Wikidata/Wikipedia structured ingest.
  try {
    const { installOutboundProxy } = await import("./outbound-network");
    const state = await installOutboundProxy();
    if (state.installed) {
      await writeAdminWorkerLog(prisma, {
        category: "OVERVIEW",
        severity: "INFO",
        eventName: "outbound_proxy_installed",
        message: `Outbound fetch routed through proxy ${state.proxyUrl ?? "?"} (${state.mode}).`,
        safeMetadata: { mode: state.mode, proxyUrl: state.proxyUrl },
      }).catch(() => undefined);
    }
  } catch {
    // fail-open — direct egress
  }

  let passes = 0;
  let built = 0;
  let published = 0;
  let failed = 0;

  while (passes < maxPasses) {
    // Sole-executor check (spec §25) + OFF-means-OFF check (spec §4). Both are
    // durable facts in Postgres, so a switch-off or a lease take-over stops the
    // loop on its next cycle no matter which runtime flipped it. Fail-open on a
    // transient DB blip: a read failure must not silently stop a healthy worker.
    if (!oneShot && opts.workerId) {
      const authority = await checkLoopAuthority(prisma, opts.workerId);
      if (!authority.ok) {
        await writeAdminWorkerLog(prisma, {
          category: "OVERVIEW",
          severity: "INFO",
          eventName: "loop_execution_authority_lost",
          message: `Admin Worker loop stopping: ${authority.reason}`,
        }).catch(() => undefined);
        break;
      }
    }

    passes += 1;
    try {
      const passOutcome = await runOnePass(prisma, workerId);
      built += passOutcome.built;
      published += passOutcome.published;
      failed += passOutcome.failed;

      if (oneShot) break;
      if (passOutcome.idle) {
        await sleep(idleBackoffMs);
      }
    } catch (err) {
      // A single pass throwing must NEVER kill the loop — that is exactly how
      // the process died in the field, orphaning a RUNNING pass and going
      // silent for 16h. runOnePass owns closing its own pass row (try/finally
      // above); here we just isolate the loop: count the failure, back off so a
      // hard-failing pass doesn't hot-loop the CPU/DB, and continue. In one-shot
      // (test) mode we surface the outcome and stop rather than spinning.
      failed += 1;
      console.error(`[admin-worker:${workerId}] pass ${passes} threw; continuing:`, err);
      if (oneShot) break;
      await sleep(idleBackoffMs);
    }
  }

  return { passes, built, published, failed };
}

/**
 * Is this runtime still allowed to keep looping? Returns ok=false only for a
 * definitive answer (switch OFF, or the lease now belongs to someone else) —
 * never for a transient database error.
 */
async function checkLoopAuthority(
  prisma: PrismaClient,
  workerId: string,
): Promise<{ ok: boolean; reason: string }> {
  try {
    const status = await readExecutionStatus(prisma);
    // An unreadable database is not a decision: keep working and try again on
    // the next pass (the lease TTL is generous enough to ride out a blip).
    if (!status.known) return { ok: true, reason: "" };
    if (!status.switch.on) {
      return { ok: false, reason: "the master switch is OFF (no cloud failover — spec §5)." };
    }
    const renewed = await renewExecutionLease(prisma, workerId);
    if (renewed === "lost") {
      return {
        ok: false,
        reason: `the execution lease is held by ${status.lease?.runtimeId ?? "another runtime"}.`,
      };
    }
    return { ok: true, reason: "" };
  } catch {
    return { ok: true, reason: "" };
  }
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
  assertWorkerExecutionAllowed("run an Admin Worker pass");
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

  // First priority is meeting content goals. Once EVERY goal's gap is closed,
  // the growth lanes (ingest/discovery) drop to a slow maintenance sweep so the
  // worker focuses on management + security instead of building past target at
  // full pace. If the count can't be read, assume goals are NOT met (keep
  // growing) — the safe default.
  const contentGoalsMet =
    (await prisma.contentGoal.count({ where: { gapCount: { gt: 0 } } }).catch(() => 1)) === 0;

  // Major-goal campaign: when a goal has a big enough gap to be "getting in the
  // way of sustainable progress" (PARISH's 200k today, then the next biggest),
  // the worker runs a campaign — DRAIN the in-flight funnel (no new discovery),
  // then SURGE ALL resources on that goal until its gap closes, then move to the
  // next biggest. SURGE forces the mission target onto the campaign goal
  // (nextPriorityContentType); DRAIN pauses the discovery lanes. Fail-open.
  const { evaluateMajorGoalCampaign } = await import("./major-goal-campaign");
  const campaign = await evaluateMajorGoalCampaign(prisma).catch(() => ({
    phase: "NORMAL" as const,
    majorType: null,
    majorGap: 0,
    builtFunnel: 0,
  }));
  if (campaign.phase !== "NORMAL") {
    await writeAdminWorkerLog(prisma, {
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "major_goal_campaign",
      message: `Major-goal campaign ${campaign.phase} on ${campaign.majorType} (gap ${campaign.majorGap}${campaign.phase === "DRAIN" ? `, draining ${campaign.builtFunnel} built artifact(s) first` : ", all resources allocated"}).`,
      contentType: campaign.majorType ?? undefined,
      safeMetadata: { ...campaign },
    }).catch(() => undefined);
  }

  // Run the Admin Worker brain pass. TypeScript generates + sub-scores the
  // candidate actions; the Python brain selects the final action from them
  // (see runBrain + pythonFinalSelector below). The decision (including
  // ranked alternatives) lands in AdminWorkerDecision for the audit view.
  const pass = await startPass(prisma, { passType: "AUTONOMOUS" });

  // Pass-critical accumulators. Declared before the try so the post-pass
  // supplementary section and the return can read them regardless of outcome.
  let built = 0;
  let publishedCount = 0;
  let failedCount = 0;
  let idle = false;
  let dispatch: DispatchOutcome | null = null;
  // Whether the Python final brain is active this pass — captured so the
  // post-pass supplementary section (which runs after the try) can gate
  // publishing steps on the safe-degraded contract.
  let activeMode = false;
  // Liveness guard: a pass row is created RUNNING and MUST reach a terminal
  // status before this function returns. `completed` flips true the moment a
  // terminal completePass runs (success OR failure path); the `finally` below
  // is the backstop that closes the row if any earlier code — the brain run,
  // the governor, a decision log, even the catch block itself — throws before
  // a terminal status is written. Without this, a crash orphaned the row as
  // RUNNING forever (the "Last pass … (status: RUNNING)" the audit flagged).
  let completed = false;

  try {
    // Supplementary pre-pass consultation: ask the Python brain to prioritise
    // unmet content goals and suggest a next-best-action, recorded to the audit
    // trail for the reasoning view. This is NOT the final decision — the Python
    // brain selects the final action via select_action below. Best-effort and
    // non-blocking.
    try {
      const { adviseNextWork } = await import("./intelligence-advisory");
      await adviseNextWork(prisma, { passId: pass.id });
    } catch {
      // supplementary only — never blocks the final decision
    }

    // The Python intelligence brain is the FINAL action selector. TypeScript
    // generates + sub-scores candidates (runBrain) and validates + executes
    // the Python choice; if the brain is unavailable/invalid the worker
    // enters safe degraded mode (PYTHON_BRAIN_UNAVAILABLE) — never a legacy
    // TS final brain.
    const { runBrain } = await import("./brain");
    const { pythonFinalSelector } = await import("./final-brain");
    const brain = await runBrain(prisma, {
      passId: pass.id,
      finalSelect: pythonFinalSelector(prisma),
    });
    activeMode = brain.finalBrain === "python";

    await setPriority(prisma, brain.chosenPriority);
    await setMode(prisma, brain.chosenMode);

    // Log the brain decision + the top rejected alternatives so the
    // audit view always has a paper trail of "why this and not that".
    const topRejected = brain.rankedAlternatives
      .filter((a) => a !== brain.chosenAction)
      .slice(0, 3);
    await writeAdminWorkerLog(prisma, {
      passId: pass.id,
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "brain_decided",
      message: `Admin Worker chose ${brain.missionStage} (${brain.chosenMode}/${brain.chosenPriority}): ${brain.reason}`,
      contentType: brain.contentType ?? undefined,
      safeMetadata: {
        missionStage: brain.missionStage,
        chosenScore: brain.chosenAction.finalScore,
        finalBrain: brain.finalBrain,
        degraded: brain.finalBrain === "degraded",
        explanation: brain.brainExplanation,
        brainFailure: brain.brainFailure,
        topRejected: topRejected.map((a) => ({
          missionStage: a.missionStage,
          score: a.finalScore,
          rejection: a.rejectionReason,
        })),
      },
    });

    // Pipeline governor (spec: "force productive forward movement; never fixate").
    // After the brain picks a stage and before dispatch, the governor reads the
    // exact per-stage outcome ledger over a short window: if the chosen content
    // stage has spun N+ passes with no forward progress, or content growth has
    // stalled despite an unmet gap, it overrides the stage choice with the
    // highest-priority productive downstream stage (draining toward publish), or a
    // terminal diagnostic when nothing downstream is making progress. It only
    // changes WHICH already-gated handler runs — every QA/publish gate is
    // unchanged — and it acts only in active mode, so it never introduces a
    // publishing path the brain wouldn't already take. Deterministic, fail-open,
    // default-on.
    const { evaluateGovernor, governorEnabled } = await import("./governor");
    if (governorEnabled()) {
      const verdict = await evaluateGovernor({ prisma, decision: brain }).catch(() => null);
      if (verdict?.intervene && verdict.forcedStage) {
        await writeAdminWorkerLog(prisma, {
          passId: pass.id,
          category: "WORKER_PASS",
          severity: "WARN",
          eventName: "governor_forced_stage",
          message: `Governor: ${brain.missionStage} → ${verdict.forcedStage} (${verdict.reason}).`,
          contentType: verdict.forcedContentType ?? brain.contentType ?? undefined,
          safeMetadata: {
            from: brain.missionStage,
            to: verdict.forcedStage,
            reason: verdict.reason,
            exhaustedEntityId: verdict.exhaustedEntityId,
          },
        }).catch(() => undefined);
        brain.missionStage = verdict.forcedStage;
        if (verdict.forcedContentType) brain.contentType = verdict.forcedContentType;
      }
    }

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

    // Content lanes (adaptive-worker Phase B). The curated/structured/liturgical
    // ingest, translation/review/pope enrichment, and discovery-seeder/parish/
    // always-on discovery workstreams now run as PARALLEL lanes inside this same
    // process instead of one-after-another — each fail-open and touching a
    // disjoint domain, so they're safe to run concurrently (double-publishing is
    // impossible via the PublishedContent unique constraint). All publish
    // content, so the whole group is gated on active/python mode (safe-degraded
    // contract). Their published totals count toward this pass.
    {
      const { runWorkerLanes } = await import("./lanes");
      const { CONTENT_LANES } = await import("./worker-lanes");
      const laneResult = await runWorkerLanes(prisma, CONTENT_LANES, {
        passId: pass.id,
        workerId,
        active: brain.finalBrain === "python",
        contentGoalsMet,
        campaignPhase: campaign.phase,
      });
      if (laneResult.published > 0) {
        publishedCount += laneResult.published;
        idle = false;
      }
    }

    // Best-effort: a blip writing this audit log must not send an
    // already-successful (possibly content-producing) dispatch into the catch
    // and get it mislabelled FAILED. The dispatch outcome is what matters here.
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
    }).catch(() => undefined);

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
    completed = true;
    await recordSuccess(prisma, { summary: dispatch.summary });
  } catch (err) {
    failedCount += 1;
    const message = err instanceof Error ? err.message : String(err);
    // Only write the FAILED terminal status if a terminal status hasn't
    // already been written (e.g. the pass SUCCEEDED and only a downstream
    // state write like recordSuccess threw — don't overwrite it with FAILED).
    // Set `completed` ONLY on a successful write, so a failed write here leaves
    // `completed` false and the `finally` below retries (and, failing that, the
    // startup reaper closes the row).
    if (!completed) {
      try {
        await completePass(prisma, {
          passId: pass.id,
          status: "FAILED",
          tasksFailed: 1,
          errorMessage: message,
          summary: `pass failed: ${message.slice(0, 200)}`,
        });
        completed = true;
      } catch {
        // leave completed=false — the finally backstop retries the close
      }
    }
    await recordFailure(prisma, {
      blocker: message.slice(0, 500),
      recoveryAction: "Investigate logs at /admin/admin-worker.",
    }).catch(() => undefined);
    await writeAdminWorkerLog(prisma, {
      passId: pass.id,
      category: "ERROR",
      severity: "ERROR",
      eventName: "loop_pass_failed",
      message,
    }).catch(() => undefined);
  } finally {
    // Backstop: guarantee the RUNNING row reaches a terminal status even if
    // both the try and the catch above threw before writing one. Without this,
    // a throw inside the catch (e.g. a DB blip during completePass) would leave
    // the pass RUNNING forever.
    if (!completed) {
      await completePass(prisma, {
        passId: pass.id,
        status: "FAILED",
        tasksFailed: 1,
        errorMessage: "pass did not reach a terminal status (unexpected error path)",
        summary: "pass failed: unexpected error path",
      }).catch(() => undefined);
    }
  }

  // Ops lanes (adaptive-worker Phase B). The BUILD_READY drain, daily-readings,
  // maintenance (schema/UI awareness + self-model + custody), reporting,
  // intelligence (post-pass analysis + lab + skill matrix + code-version — all
  // brain-calling work in ONE lane so it never issues concurrent brain calls),
  // and escalation now run as PARALLEL lanes inside this same process under a
  // global concurrency cap. Each lane is isolated (a failing lane never kills
  // the others — self-repair) and enters an error-backoff cooldown; each records
  // its live state. The drain self-gates its publish step on active mode.
  {
    const { runWorkerLanes, pruneUnknownLaneStates } = await import("./lanes");
    const { OPS_LANES, ALL_LANE_NAMES } = await import("./worker-lanes");
    const laneResult = await runWorkerLanes(prisma, OPS_LANES, {
      passId: pass.id,
      workerId,
      active: activeMode,
      contentGoalsMet,
      campaignPhase: campaign.phase,
    });
    publishedCount += laneResult.published;
    if (laneResult.published > 0 || laneResult.advanced > 0) idle = false;
    // Keep the live lane board honest: drop lane-state rows from any earlier
    // lane layout (ALL_LANE_NAMES covers both content + ops lanes) so the
    // dashboard only shows lanes that are actually running.
    await pruneUnknownLaneStates(prisma, ALL_LANE_NAMES).catch(() => 0);
  }

  return { built, published: publishedCount, failed: failedCount, idle };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  /** Initial backoff between passes when nothing is queued (ms); doubles per
   * consecutive idle pass up to `idleBackoffMaxMs`. Default
   * ADMIN_WORKER_IDLE_BACKOFF_MS or 15s. */
  idleBackoffMs?: number;
  /** Ceiling for the adaptive idle backoff (ms). Default
   * ADMIN_WORKER_IDLE_BACKOFF_MAX_MS or 120s. */
  idleBackoffMaxMs?: number;
  /** Background heartbeat/lease-renew cadence (ms). Default 20s. */
  heartbeatIntervalMs?: number;
}

export type LoopStopReason = "switch_off" | "lease_lost";

export interface LoopResult {
  passes: number;
  built: number;
  published: number;
  failed: number;
  /**
   * Set when the loop stopped on a DEFINITIVE authority answer (master switch
   * OFF, or the lease now belongs to another runtime). The supervisor treats
   * this as an intended stop — not a crash to restart — so the process can
   * release its lease, shut the brain down and exit.
   */
  stopReason?: LoopStopReason;
}

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Under the local host (scripts/local-worker-host.ts) the HOST owns the lease:
 * it renews with jitter on its own tick and stops this child when the lease is
 * lost, so the child rewriting the same row every pass and every 20s only
 * doubled the round trips against the remote database (audit LH-11). The host
 * sets this flag in the child's environment; a bare `npm run worker:local`
 * has no host and keeps renewing itself.
 */
export function leaseRenewedByHost(): boolean {
  return process.env.VIAFIDEI_LEASE_RENEWED_BY_HOST === "1";
}

// The pass currently in flight in this process (null between passes). Lets the
// SIGTERM handler close the row honestly ("stopped by operator") instead of
// orphaning it as RUNNING until the next boot's reaper.
let _currentPassId: string | null = null;

export function getCurrentPassId(): string | null {
  return _currentPassId;
}

/**
 * Close the in-flight pass (if any) as FAILED with the given reason. Used by
 * the process shutdown path; fail-open and idempotent.
 */
export async function abandonCurrentPass(prisma: PrismaClient, reason: string): Promise<boolean> {
  const passId = _currentPassId;
  if (!passId) return false;
  _currentPassId = null;
  try {
    await completePass(prisma, {
      passId,
      status: "FAILED",
      tasksFailed: 1,
      errorMessage: reason,
      summary: `pass abandoned: ${reason.slice(0, 200)}`,
    });
    return true;
  } catch {
    return false;
  }
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
  // Adaptive idle backoff. Every lane is throttled at >= 5 min anyway, so
  // re-running a pass 1s after an idle one only burned ~140 DB round trips of
  // bookkeeping per pass against the remote database. Start at 15s and double
  // per consecutive idle pass (to 120s); any real progress resets it.
  const idleBackoffStartMs = opts.idleBackoffMs ?? envInt("ADMIN_WORKER_IDLE_BACKOFF_MS", 15_000);
  const idleBackoffMaxMs = Math.max(
    idleBackoffStartMs,
    opts.idleBackoffMaxMs ?? envInt("ADMIN_WORKER_IDLE_BACKOFF_MAX_MS", 120_000),
  );
  // While the Python brain is degraded no content lane can run, so idling
  // faster than this just multiplies the (throttled) degraded-mode log rows.
  // An explicit 0 (tests / manual runs) disables the floor along with the rest.
  const degradedFloorMs =
    idleBackoffStartMs > 0 ? Math.min(idleBackoffMaxMs, Math.max(idleBackoffStartMs, 30_000)) : 0;
  let idleBackoffMs = idleBackoffStartMs;

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
  let stopReason: LoopStopReason | undefined;

  // Background heartbeat. The pass itself writes one heartbeat at its start,
  // but a pass legitimately runs 5-15 minutes (network-heavy lanes, a slow
  // dispatch), so every liveness consumer (diagnostics 5 min, command center
  // 10 min) rendered a healthy worker as dead — and in CLI mode the 90s lease
  // could be taken over mid-pass. Renew both on a timer independent of pass
  // progress; unref'd so it never keeps the process alive, cleared on exit.
  const heartbeatMs = opts.heartbeatIntervalMs ?? 20_000;
  let heartbeatTick: Promise<void> = Promise.resolve();
  const heartbeat =
    oneShot || heartbeatMs <= 0
      ? null
      : setInterval(() => {
          heartbeatTick = (async () => {
            await writeHeartbeat(prisma).catch(() => undefined);
            if (opts.workerId && !leaseRenewedByHost())
              await renewExecutionLease(prisma, opts.workerId).catch(() => undefined);
          })();
        }, heartbeatMs);
  heartbeat?.unref();

  try {
    while (passes < maxPasses) {
      // Sole-executor check (spec §25) + OFF-means-OFF check (spec §4). Both are
      // durable facts in Postgres, so a switch-off or a lease take-over stops the
      // loop on its next cycle no matter which runtime flipped it. Fail-open on a
      // transient DB blip: a read failure must not silently stop a healthy worker.
      if (!oneShot && opts.workerId) {
        const authority = await checkLoopAuthority(prisma, opts.workerId);
        if (!authority.ok) {
          stopReason = authority.stopReason;
          await writeAdminWorkerLog(prisma, {
            category: "OVERVIEW",
            severity: "INFO",
            eventName: "loop_execution_authority_lost",
            message: `Admin Worker loop stopping: ${authority.reason}`,
            safeMetadata: { stopReason },
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
          const floor = passOutcome.degraded ? degradedFloorMs : idleBackoffStartMs;
          await sleep(Math.max(floor, idleBackoffMs));
          idleBackoffMs = Math.min(idleBackoffMaxMs, Math.max(floor, idleBackoffMs) * 2);
        } else {
          idleBackoffMs = idleBackoffStartMs;
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
        idleBackoffMs = Math.min(idleBackoffMaxMs, Math.max(1, idleBackoffMs) * 2);
      }
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await heartbeatTick.catch(() => undefined);
  }

  return { passes, built, published, failed, ...(stopReason ? { stopReason } : {}) };
}

/**
 * Is this runtime still allowed to keep looping? Returns ok=false only for a
 * definitive answer (switch OFF, or the lease now belongs to someone else) —
 * never for a transient database error.
 */
async function checkLoopAuthority(
  prisma: PrismaClient,
  workerId: string,
): Promise<{ ok: boolean; reason: string; stopReason?: LoopStopReason }> {
  try {
    const status = await readExecutionStatus(prisma);
    // An unreadable database is not a decision: keep working and try again on
    // the next pass (the lease TTL is generous enough to ride out a blip).
    if (!status.known) return { ok: true, reason: "" };
    if (!status.switch.on) {
      return {
        ok: false,
        reason: "the master switch is OFF (no cloud failover — spec §5).",
        stopReason: "switch_off",
      };
    }
    // Host-supervised child: the lease row is the host's to renew, and the
    // host already stops this process when another runtime takes it. The read
    // above still catches OFF; the per-pass renew write is skipped entirely.
    if (leaseRenewedByHost()) return { ok: true, reason: "" };
    const renewed = await renewExecutionLease(prisma, workerId);
    if (renewed === "lost") {
      return {
        ok: false,
        reason: `the execution lease is held by ${status.lease?.runtimeId ?? "another runtime"}.`,
        stopReason: "lease_lost",
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
  /** True when the Python final brain was unavailable this pass. */
  degraded: boolean;
}

// Dispatch watchdog. executeMissionStage had no timeout at all: a discovery
// dispatch walks up to 20 hosts sequentially, each with 15s × 3 attempts plus an
// archive rescue, so one bad batch of hosts could hold the pass for far longer
// than every liveness cutoff. Bound it like the lanes are; on expiry the stage
// is recorded as failed so the governor/brain see it (the underlying promise
// may still finish in the background — its own network calls are bounded).
const DISPATCH_WATCHDOG_MS = 10 * 60 * 1000;

function withDispatchWatchdog<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`dispatch watchdog: stage exceeded ${ms}ms`)), ms);
  });
  return Promise.race([
    p.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    watchdog,
  ]);
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
    return { built: 0, published: 0, failed: 0, idle: true, degraded: false };
  }

  // Content goals: seed ONLY when the table is empty (one cheap count instead
  // of 15 upserts per pass — the worker boot seeds them normally), then refresh
  // from live counts ONCE for the whole pass (the brain's world sample and the
  // governor reuse this refresh below). Without goal rows the worker would idle
  // forever thinking "all goals met" (spec §49-50, §66).
  const goalRows = await prisma.contentGoal.count().catch(() => -1);
  if (goalRows === 0) await seedContentGoals(prisma).catch(() => 0);
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
  _currentPassId = pass.id;

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
    const { runBrain, sampleWorld } = await import("./brain");
    const { pythonFinalSelector } = await import("./final-brain");
    // ONE world sample per pass, shared by the brain and the governor (each
    // used to sample independently — ~30 queries and a goal refresh apiece).
    const world = await sampleWorld(prisma, { skipGoalRefresh: true });
    const brain = await runBrain(prisma, {
      passId: pass.id,
      finalSelect: pythonFinalSelector(prisma),
      world,
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
      const verdict = await evaluateGovernor({ prisma, decision: brain, world }).catch(() => null);
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

    const dispatchStartedAt = Date.now();
    const dispatchTimeoutMs = envInt("ADMIN_WORKER_DISPATCH_TIMEOUT_MS", DISPATCH_WATCHDOG_MS);
    try {
      dispatch = await withDispatchWatchdog(
        executeMissionStage({ prisma, workerId, passId: pass.id, decision: brain }),
        dispatchTimeoutMs,
      );
    } catch (err) {
      if (!(err instanceof Error && /dispatch watchdog/.test(err.message))) throw err;
      // Record the expiry as a real failed stage outcome so the brain's
      // reliability feedback and the governor's fixation check both see it.
      const { recordStageOutcome } = await import("./stage-outcomes");
      await recordStageOutcome(prisma, {
        passId: pass.id,
        stage: brain.missionStage,
        action: brain.chosenAction?.actionType ?? brain.missionStage,
        contentType: brain.contentType ?? null,
        result: "failed",
        resultType: "failure",
        failureReason: err.message,
        durationMs: Date.now() - dispatchStartedAt,
        confidenceBefore: brain.confidenceScore ?? null,
        actualOutcome: err.message,
        repairCreated: false,
        nextAction: brain.chosenAction?.fallbackAction ?? "re_plan",
      });
      dispatch = {
        stage: brain.missionStage,
        kind: "failed",
        summary: `${err.message} (the stage may still finish in the background)`,
        failed: 1,
      };
    }

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
    if (_currentPassId === pass.id) _currentPassId = null;
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

  return { built, published: publishedCount, failed: failedCount, idle, degraded: !activeMode };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    // Curated-knowledge ingest (supplementary, fail-open). The worker
    // publishes a bounded batch of its own hand-verified ground-truth
    // knowledge each pass through the REAL publish orchestrator, so content
    // grows across every type — the canonical "first-pass content source" —
    // even when live discovery/fetch is unavailable. Idempotent + bounded, so
    // it makes steady forward progress and becomes a cheap no-op once the
    // curated base is fully live. Counts toward the pass's published total.
    // Gated on PYTHON_FINAL_BRAIN_ACTIVE: curated ingest PUBLISHES content, so
    // it is new autonomous publishing and must NOT run in safe degraded mode
    // (PYTHON_BRAIN_UNAVAILABLE_SAFE_DEGRADED_MODE). When the final brain is
    // unavailable the worker only does security/diagnostics/reporting/
    // maintenance/repair — never new publishing.
    if (brain.finalBrain === "python") {
      try {
        const { runCuratedIngest } = await import("./curated-ingest");
        const ingest = await runCuratedIngest(prisma, { passId: pass.id });
        if (ingest.published > 0) {
          publishedCount += ingest.published;
          idle = false;
        }
      } catch {
        // best-effort — curated ingest must never break the pass
      }
    }

    // Structured-knowledge ingest: the keyless, deterministic procurement engine
    // that lifts the publish ceiling. Each pass it pulls a bounded batch from a
    // structured source (Wikidata + Wikipedia) and publishes the not-yet-live,
    // schema-valid records through the same real gate as everything else — from
    // a source with no ceiling. Gated like curated ingest (PUBLISHES content, so
    // it must not run in safe degraded mode) and best-effort so it never breaks
    // a pass.
    if (brain.finalBrain === "python") {
      try {
        const { runStructuredIngest } = await import("./structured/ingest");
        const structured = await runStructuredIngest(prisma, { passId: pass.id });
        if (structured.published > 0) {
          publishedCount += structured.published;
          idle = false;
        }
      } catch {
        // best-effort — structured ingest must never break the pass
      }
    }

    // Liturgical calendar ingest: the great feasts of the Lord + solemnities from
    // the open Liturgical Calendar API (keyless). Self-throttled (~daily), so
    // calling it every pass is cheap. Same publish gate as everything else.
    if (brain.finalBrain === "python") {
      try {
        const { runLiturgicalCalendarIngest } = await import("./liturgical-calendar-ingest");
        const lit = await runLiturgicalCalendarIngest(prisma);
        if (lit.published > 0) {
          publishedCount += lit.published;
          idle = false;
        }
      } catch {
        // best-effort — liturgical ingest must never break the pass
      }
    }

    // Prayer/litany translation backfill: fill Latin + Greek on every prayer
    // over time — canonical (keyless) first, then the AI/Google fallback for what
    // the corpus can't resolve (review-gated by default). Self-throttled (~hourly).
    if (brain.finalBrain === "python") {
      try {
        const { runPrayerTranslationBackfill } = await import("./prayer-translation-backfill");
        await runPrayerTranslationBackfill(prisma);
      } catch {
        // best-effort — translation backfill must never break the pass
      }
    }

    // Human-review auto-resolve: clear the review items the worker can safely
    // decide on its own (a redundant/moot translation proposal, or one the
    // canonical engine can now resolve authentically) so the queue doesn't pile
    // up waiting for a human. Genuine machine-only proposals are left for review.
    if (brain.finalBrain === "python") {
      try {
        const { runReviewAutoResolve } = await import("./human-review");
        await runReviewAutoResolve(prisma);
      } catch {
        // best-effort — review auto-resolve must never break the pass
      }
    }

    // Reconcile the pope catalogue so the count reflects the real line of Roman
    // Pontiffs exactly — unpublish antipope rows the earlier ingestor published,
    // and collapse duplicate rows for the same pontiff. Cheap + idempotent.
    if (brain.finalBrain === "python") {
      try {
        const { pruneAntipopeRecords, pruneDuplicatePopeRecords } = await import("./pope-cleanup");
        const prunedAnti = await pruneAntipopeRecords(prisma);
        const prunedDupes = await pruneDuplicatePopeRecords(prisma);
        if (prunedAnti.pruned > 0 || prunedDupes.pruned > 0) idle = false;
      } catch {
        // best-effort — cleanup must never break the pass
      }
    }

    // Structured discovery seeder: feed the live extraction pipeline with
    // authoritative source URLs for the content types that have no structured
    // ingestor (devotion, Marian title, apparition) — discovery only, every
    // candidate still faces extraction + verification + QA. Keyless,
    // self-throttled (~30 min). Best-effort so it never breaks a pass.
    if (brain.finalBrain === "python") {
      try {
        const { runDiscoverySeeder } = await import("./structured/discovery-seeder");
        await runDiscoverySeeder(prisma);
      } catch {
        // best-effort — discovery seeding must never break the pass
      }
    }

    // Keyless parish discovery (OpenStreetMap): grow the PARISH directory —
    // parishes, shrines, cathedrals, basilicas — every pass instead of only when
    // the brain happens to choose the parish stage. Free (Overpass), communion-
    // verified, schema-validated, and published through the real gate. Self-
    // throttled (~10 min for Overpass fair-use) and bounded; best-effort.
    if (brain.finalBrain === "python") {
      try {
        const { runOsmParishDiscovery } = await import("./parish-osm");
        const osm = await runOsmParishDiscovery(prisma, { brainActive: true });
        if (osm.published > 0) {
          publishedCount += osm.published;
          idle = false;
        }
      } catch {
        // best-effort — parish discovery must never break the pass
      }
    }

    // Always-on web discovery: run the full discovery orchestrator (all 8
    // methods, incl. open-web keyword search + cross-host crawl) EVERY pass
    // instead of only when the brain picks the DISCOVERY stage, so the worker is
    // constantly scanning for new sources and the fetch/extract pipeline never
    // starves for candidates. Throttled (~5 min, configurable) + fail-open;
    // surfaced URLs are unverified leads that still face the full pipeline
    // (classify → cross-source verify → strict QA → publish) before anything
    // goes public — scanning widens reach, never the accuracy bar.
    if (brain.finalBrain === "python") {
      try {
        const { runAlwaysOnDiscovery } = await import("./always-on-discovery");
        await runAlwaysOnDiscovery(prisma, { passId: pass.id });
      } catch {
        // best-effort — always-on discovery must never break the pass
      }
    }

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

  // Post-pass intelligence: self-inspection + developer requests +
  // worker-IQ metrics via the Python brain. Supplementary and non-blocking —
  // never breaks the loop, and a no-op when the brain is offline. (The final
  // action was already selected by the Python brain above.)
  try {
    const { runPostPassIntelligence } = await import("./intelligence-pass");
    await runPostPassIntelligence(prisma, { passId: pass.id, workerId });
  } catch {
    // ignore — post-pass analysis is supplementary and must not affect the pass
  }

  // Daily liturgical readings: keep the internal readings page current.
  // Throttled (≈once per 30 min/process) and fail-open; routes to review
  // rather than ever publishing uncertain readings.
  try {
    const { maybeRefreshDailyReadings, maybeBackfillDailyReadings } =
      await import("./daily-readings");
    // Register the worker's readings sources (the offline lectionary table +
    // any authoritative dataset configured via LECTIONARY_DATA_URL) so it can
    // acquire, store, and manage readings for every day it can reach.
    const { initReadingsSources } = await import("./readings-source");
    initReadingsSources();
    await maybeRefreshDailyReadings(prisma, { passId: pass.id });
    // Autonomously fill + re-verify the whole forward window (≈a liturgical
    // year): creates missing days, upgrades them to verified readings as
    // coverage grows, and self-corrects any drifted row. Throttled (~6h).
    await maybeBackfillDailyReadings(prisma, { passId: pass.id });
  } catch {
    // ignore — readings refresh is best-effort and must not affect the pass
  }

  // Maintenance intelligence: schema-awareness, UI-awareness, the unified
  // self-model (deep code awareness + self-upgrade requests), and content
  // custody. Each is throttled internally and non-blocking — supplementary
  // analyses that never affect the pass's final action.
  try {
    const { runSchemaAwareness, runUiAwareness } = await import("./awareness");
    const { runSelfModelPass } = await import("./self-model");
    const { runCustodyPass } = await import("./custody");
    await runSchemaAwareness(prisma, { passId: pass.id });
    await runUiAwareness(prisma, { passId: pass.id });
    await runSelfModelPass(prisma, { passId: pass.id });
    await runCustodyPass(prisma, { passId: pass.id });
  } catch {
    // best-effort — maintenance intelligence must not affect the pass
  }

  // Reporting pass: record a growth snapshot per content type + the source
  // coverage scorecard so the Developer Audit reflects live growth, and file
  // repair plans for any content type that has stalled (keeps pressure on the
  // types that are behind). Throttled (~hourly) and fail-open. Reporting +
  // maintenance only — safe to run regardless of brain mode.
  try {
    const { maybeRunReportingPass } = await import("./reporting-pass");
    await maybeRunReportingPass(prisma, { passId: pass.id });
  } catch {
    // best-effort — the reporting pass must never affect the pass
  }

  // Intelligence Laboratory: throttled, advisory self-evaluation (causal root
  // cause, architecture integrity, highest-leverage next change). Recorded to
  // the audit trail; never deploys code or publishes — recommendations flow
  // through developer requests + human review.
  try {
    const { maybeRunIntelligenceLabPass } = await import("./intelligence-lab");
    await maybeRunIntelligenceLabPass(prisma, { passId: pass.id });
  } catch {
    // best-effort — the lab pass must never affect the pass
  }

  // Certified Admin Skill Runtime: register the certified skills and refresh the
  // capability coverage matrix each pass, so the /admin/skills dashboard and the
  // Developer Audit report what the worker can actually do right now — and file a
  // developer request for every capability that has no certified skill yet.
  try {
    const { ensureSkillsRegistered, refreshCapabilityMatrix } = await import("./skills");
    ensureSkillsRegistered();
    await refreshCapabilityMatrix(prisma);
  } catch {
    // best-effort — the capability refresh must never affect the pass
  }

  return { built, published: publishedCount, failed: failedCount, idle };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

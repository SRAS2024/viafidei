/**
 * Pipeline governor — forces productive forward movement across the content
 * pipeline and stops the worker fixating on a non-productive stage.
 *
 * WHY THIS EXISTS. The brain's anti-fixation feedback (`applyExecutionFeedback`
 * in `brain.ts`) is *scoring-only and retrospective*: it can subtract points but
 * never disqualifies a stage, its "stuck" signal historically counted only
 * `no_op` outcomes (missing the `repair-planned` / `rejected` spins that
 * dominate real fixation — e.g. EXTRACTION repeatedly re-planning a poison read,
 * or CROSS_SOURCE_VERIFICATION whose sources are all down), and the
 * keyless-publishing stages (curated + structured ingest) are gated off exactly
 * when the brain is degraded. The net effect the operator sees: passes complete
 * but content doesn't move from ingestion/extraction into build → QA → publish →
 * verify.
 *
 * WHAT THIS DOES. After the brain picks a stage and just before dispatch, the
 * governor reads the exact per-stage outcome ledger
 * (`AdminWorkerStageOutcome`) over a short sliding window and asks one question:
 * "Has the chosen stage actually advanced anything recently, or is overall
 * content growth stalled?" If a governed content stage was chosen N+ times with
 * zero forward progress, OR there is an unmet content gap with zero content
 * advanced in the window, it intervenes:
 *
 *   1. Force the highest-priority DOWNSTREAM stage that has queued work and is
 *      itself making progress (publish-first: PUBLIC_PUBLISH → STRICT_QA →
 *      CROSS_SOURCE_VERIFICATION → … → SOURCE_FETCH), draining in-flight work
 *      toward published content.
 *   2. If nothing downstream is making progress, run a terminal diagnostic stage
 *      (REPAIR → REPORTING → MAINTENANCE) for this pass's main slot — one that
 *      can never itself loop into publishing — so the slot isn't wasted on the
 *      fixated stage. The keyless ground-truth ingest (curated + structured)
 *      already runs every active pass, so content keeps growing meanwhile.
 *
 * SAFETY. The governor only changes WHICH deterministic stage handler runs — it
 * never bypasses a gate. Forced PUBLIC_PUBLISH still publishes only QA_PASSED
 * artifacts through `evaluatePublishGate`; forced STRICT_QA still runs the full
 * quality gate. It acts ONLY when the brain is active
 * (PYTHON_FINAL_BRAIN_ACTIVE) and NEVER when paused, so it fully respects the
 * safe-degraded-mode contract — it introduces no new publishing path the brain
 * wouldn't already take in active mode. It never forces a stage that is itself
 * spinning, so it converges (down the ladder to a terminal diagnostic) rather
 * than oscillating. Deterministic (a pure function of the ledger + world),
 * fail-open (any error → no intervention), and env-toggleable (default ON).
 */

import type { PrismaClient } from "@prisma/client";

import { sampleWorld, type BrainMissionStage, type WorldState } from "./brain";

/** The content-pipeline stages the governor judges for fixation. Operational
 * stages (REPAIR, REPORTING, MAINTENANCE, SECURITY_DEFENSE, HOMEPAGE_WORK,
 * PAUSED) are intentionally excluded — their "productivity" is not measured by
 * content advancement, so they are never flagged as fixated. */
const GOVERNED_CONTENT_STAGES: ReadonlySet<BrainMissionStage> = new Set<BrainMissionStage>([
  "DISCOVERY",
  "CANDIDATE_PRIORITIZATION",
  "SOURCE_FETCH",
  "SOURCE_READ",
  "CLASSIFICATION",
  "EXTRACTION",
  "CHECKLIST_CREATION",
  "CITATION_CREATION",
  "PACKAGE_BUILD",
  "CROSS_SOURCE_VERIFICATION",
  "STRICT_QA",
  "PERSISTENCE",
  "PUBLIC_PUBLISH",
  "POST_PUBLISH_VERIFY",
]);

/** Downstream stages in publish-first priority, each paired with the WorldState
 * queue field that signals it has work to do. The governor forces the first
 * stage here that has queued work and is not itself fixated — pulling in-flight
 * artifacts toward published content. */
const DOWNSTREAM_LADDER: ReadonlyArray<[BrainMissionStage, keyof WorldState]> = [
  ["PUBLIC_PUBLISH", "artifactsAwaitingPublish"],
  ["STRICT_QA", "artifactsAwaitingQA"],
  ["CROSS_SOURCE_VERIFICATION", "artifactsAwaitingVerification"],
  ["POST_PUBLISH_VERIFY", "publishedButUnverified"],
  ["CHECKLIST_CREATION", "artifactsAwaitingChecklist"],
  ["CLASSIFICATION", "unclassifiedReads"],
  ["EXTRACTION", "readsAwaitingExtraction"],
  ["SOURCE_FETCH", "candidateUrlsAvailable"],
  ["CANDIDATE_PRIORITIZATION", "candidatesNeedingPrioritization"],
];

const DEFAULT_WINDOW_MIN = 15;
const DEFAULT_MIN_SAMPLES = 3;
const DEFAULT_MAX_ENTITY_RETRIES = 3;

/** Minimal ledger row the verdict needs (a subset of AdminWorkerStageOutcome). */
export interface GovernorOutcomeRow {
  stage: string;
  resultType: string;
  result: string;
  entityId: string | null;
}

export interface GovernorVerdict {
  /** True when the governor is overriding the brain's stage choice this pass. */
  intervene: boolean;
  /** The stage the governor judged fixated / the pass that stalled. */
  fixatedStage: BrainMissionStage | null;
  /** The stage to run instead (always set when intervene is true). */
  forcedStage: BrainMissionStage | null;
  /** Bias the forced stage toward this content type (the live largest gap). */
  forcedContentType: string | null;
  /** An entity (e.g. a poison source read) processed past the retry limit,
   * across any stage in the window — surfaced for the audit trail. */
  exhaustedEntityId: string | null;
  reason: string;
}

const NO_INTERVENTION: GovernorVerdict = {
  intervene: false,
  fixatedStage: null,
  forcedStage: null,
  forcedContentType: null,
  exhaustedEntityId: null,
  reason: "",
};

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default ON. Set ADMIN_WORKER_GOVERNOR_ENABLED=0/false/off/no to disable. */
export function governorEnabled(): boolean {
  const v = (process.env.ADMIN_WORKER_GOVERNOR_ENABLED ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

/** A row counts as forward progress when the stage advanced an item. resultType
 * is the canonical coarse bucket (advanced → "success"), so it is the single
 * source of truth. */
function isProductive(row: GovernorOutcomeRow): boolean {
  return row.resultType === "success";
}

/**
 * Pure, deterministic verdict from the recent outcome ledger + world counts.
 * Exported so it can be unit-tested with injected rows and no database.
 */
export function computeGovernorVerdict(args: {
  world: WorldState;
  chosenStage: BrainMissionStage;
  rows: GovernorOutcomeRow[];
  windowMinutes: number;
  minSamples: number;
  maxEntityRetries: number;
}): GovernorVerdict {
  const { world, chosenStage, rows, windowMinutes, minSamples, maxEntityRetries } = args;

  // Never intervene while paused — the loop's pause guard already returns early,
  // but this keeps the verdict correct for any direct caller.
  if (world.isPaused) return NO_INTERVENTION;

  const chosen = new Map<string, number>();
  const productive = new Map<string, number>();
  const entityNonAdvance = new Map<string, number>();
  let windowContentProductive = 0;

  for (const row of rows) {
    chosen.set(row.stage, (chosen.get(row.stage) ?? 0) + 1);
    const prod = isProductive(row);
    if (prod) productive.set(row.stage, (productive.get(row.stage) ?? 0) + 1);
    if (GOVERNED_CONTENT_STAGES.has(row.stage as BrainMissionStage) && prod) {
      windowContentProductive += 1;
    }
    // Track a poison entity across ALL stages in the window (a malformed source
    // read that never advances anywhere), not just the current stage.
    if (!prod && row.entityId) {
      entityNonAdvance.set(row.entityId, (entityNonAdvance.get(row.entityId) ?? 0) + 1);
    }
  }

  const isFixated = (stage: BrainMissionStage): boolean =>
    GOVERNED_CONTENT_STAGES.has(stage) &&
    (chosen.get(stage) ?? 0) >= minSamples &&
    (productive.get(stage) ?? 0) === 0;

  const fixatedChosen = isFixated(chosenStage);
  // Growth stall: there is content to build, the worker has had enough passes to
  // show output, yet nothing advanced — the worker is spinning overall.
  const growthStall =
    world.contentGoalGap > 0 && windowContentProductive === 0 && rows.length >= minSamples;

  if (!fixatedChosen && !growthStall) return NO_INTERVENTION;

  // Pick the highest-priority downstream stage with queued work that is itself
  // making progress (advanced ≥1 in the window) OR untried in the window — never
  // a stage that has only spun, so the governor converges down the ladder to a
  // terminal diagnostic rather than ping-ponging between two stuck stages.
  let forcedStage: BrainMissionStage | null = null;
  for (const [stage, field] of DOWNSTREAM_LADDER) {
    if (stage === chosenStage) continue;
    const queued = world[field];
    const productiveHere = (productive.get(stage) ?? 0) > 0;
    const untried = (chosen.get(stage) ?? 0) === 0;
    if (typeof queued === "number" && queued > 0 && (productiveHere || untried)) {
      forcedStage = stage;
      break;
    }
  }

  if (!forcedStage) {
    // Nothing downstream is making progress: run a terminal diagnostic for the
    // main slot (the keyless ground-truth ingest still runs this active pass).
    forcedStage = terminalStage(chosenStage, world);
  }

  let exhaustedEntityId: string | null = null;
  for (const [entityId, n] of entityNonAdvance) {
    if (n >= maxEntityRetries) {
      exhaustedEntityId = entityId;
      break;
    }
  }

  const reason = fixatedChosen
    ? `${chosenStage} chosen ${chosen.get(chosenStage) ?? 0}× with no forward progress in ${windowMinutes}m`
    : `growth stalled: gap ${world.contentGoalGap}, 0 content advanced in ${windowMinutes}m`;

  return {
    intervene: true,
    fixatedStage: chosenStage,
    forcedStage,
    forcedContentType: world.contentGoalContentType,
    exhaustedEntityId,
    reason,
  };
}

/** Terminal fallback that never loops into a publishing stage. */
function terminalStage(chosenStage: BrainMissionStage, world: WorldState): BrainMissionStage {
  if ((world.pendingRepairPlans > 0 || world.failedBuildJobs > 0) && chosenStage !== "REPAIR") {
    return "REPAIR";
  }
  if (chosenStage !== "REPORTING") return "REPORTING";
  return "MAINTENANCE";
}

export interface GovernorInput {
  prisma: PrismaClient;
  decision: { missionStage: BrainMissionStage; contentType?: string | null; finalBrain?: string };
  /** Provided by callers that already sampled it; re-sampled otherwise. */
  world?: WorldState;
  windowMinutes?: number;
  minSamples?: number;
  maxEntityRetries?: number;
  /** Test injection — bypasses the database read. */
  recentOutcomes?: GovernorOutcomeRow[];
}

/**
 * Evaluate the governor for the current pass. Reads the recent stage-outcome
 * ledger (or uses injected rows), samples the world if not supplied, and returns
 * a deterministic verdict. Fail-open: any error yields no intervention.
 */
export async function evaluateGovernor(input: GovernorInput): Promise<GovernorVerdict> {
  if (!governorEnabled()) return NO_INTERVENTION;
  // Act ONLY when the brain is active. In safe degraded mode the worker does no
  // new publishing by contract, so the governor must not force a content stage
  // or otherwise widen what the worker would do — it stays out entirely.
  if (input.decision.finalBrain !== undefined && input.decision.finalBrain !== "python") {
    return NO_INTERVENTION;
  }
  try {
    const windowMinutes =
      input.windowMinutes ?? envInt("ADMIN_WORKER_GOVERNOR_WINDOW_MIN", DEFAULT_WINDOW_MIN);
    const minSamples =
      input.minSamples ?? envInt("ADMIN_WORKER_GOVERNOR_MIN_SAMPLES", DEFAULT_MIN_SAMPLES);
    const maxEntityRetries =
      input.maxEntityRetries ??
      envInt("ADMIN_WORKER_GOVERNOR_MAX_ENTITY_RETRIES", DEFAULT_MAX_ENTITY_RETRIES);

    const world = input.world ?? (await sampleWorld(input.prisma));

    let rows = input.recentOutcomes;
    if (!rows) {
      const since = new Date(Date.now() - windowMinutes * 60_000);
      const raw = await input.prisma.adminWorkerStageOutcome
        .findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: 500,
          select: { stage: true, resultType: true, result: true, entityId: true },
        })
        .catch(() => [] as GovernorOutcomeRow[]);
      rows = raw as GovernorOutcomeRow[];
    }

    return computeGovernorVerdict({
      world,
      chosenStage: input.decision.missionStage,
      rows,
      windowMinutes,
      minSamples,
      maxEntityRetries,
    });
  } catch {
    return NO_INTERVENTION;
  }
}

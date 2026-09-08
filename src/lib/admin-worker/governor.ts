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
 * THE ESCAPE HATCH (the LOOPING escalation). Forcing a different stage keeps the
 * PASS productive but leaves the BLOCKED ITEM where it was, so a stage whose
 * source is exhausted (SOURCE_FETCH failing 62× on one content type with zero
 * successes) fixates again as soon as the window rolls. The governor therefore
 * also judges fixation PER CONTENT TYPE — a stage that advances SAINT but never
 * GUIDE is fixated for GUIDE — and, for the acquisition stages, performs a
 * `reroute_source` corrective: it reads the fetch ledger for the approved host
 * whose recent fetches ALL failed and boosts the best unfetched candidate of the
 * same content type on a DIFFERENT approved host, so the next acquisition pass
 * reads something new. No external key is involved. Every intervention records
 * its corrective (`reroute_source` / `drain_backlog` / `advance_stage` /
 * `diagnostic`) and what it achieved, so the escalation can be answered — and,
 * once the rerouted source advances, resolve itself.
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

/**
 * The stages that count as GENUINE forward movement toward published content —
 * the growth-stall check keys on these only. DISCOVERY and
 * CANDIDATE_PRIORITIZATION are top-of-funnel PREP: surfacing candidate URLs (or
 * scoring them) does not move a single item toward the public site. Counting
 * discovery as "productive" was the exact bug that froze the pipeline at 3403:
 * discovery "succeeds" every pass by surfacing candidates, so windowContent
 * Productive was never 0, `growthStall` never tripped, and the governor never
 * forced SOURCE_FETCH — the worker discovered forever while 600 candidates sat
 * unfetched and nothing published. Real progress = fetch → read → … → publish.
 */
const FORWARD_PROGRESS_STAGES: ReadonlySet<BrainMissionStage> = new Set<BrainMissionStage>(
  [...GOVERNED_CONTENT_STAGES].filter(
    // POST_PUBLISH_VERIFY re-checks content that is ALREADY public: a verify
    // "success" every pass (one live-page check from a ~3,400-item backlog)
    // does not move a single item toward NEW published content, so counting
    // it masked a growth stall exactly like discovery did.
    (s) => s !== "DISCOVERY" && s !== "CANDIDATE_PRIORITIZATION" && s !== "POST_PUBLISH_VERIFY",
  ),
);

/** Downstream stages in publish-first priority, each paired with the WorldState
 * queue field that signals it has work to do. The governor forces the first
 * stage here that has queued work and is not itself fixated — pulling in-flight
 * artifacts toward published content. */
const DOWNSTREAM_LADDER: ReadonlyArray<[BrainMissionStage, keyof WorldState]> = [
  ["PUBLIC_PUBLISH", "artifactsAwaitingPublish"],
  ["STRICT_QA", "artifactsAwaitingQA"],
  ["CROSS_SOURCE_VERIFICATION", "artifactsAwaitingVerification"],
  ["CHECKLIST_CREATION", "artifactsAwaitingChecklist"],
  ["CLASSIFICATION", "unclassifiedReads"],
  ["EXTRACTION", "readsAwaitingExtraction"],
  ["SOURCE_FETCH", "candidateUrlsAvailable"],
  ["CANDIDATE_PRIORITIZATION", "candidatesNeedingPrioritization"],
  // LAST, not fourth: its queue is every published-but-never-verified row
  // (thousands, drained one per pass and "productive" whenever the page is
  // reachable), so sitting above SOURCE_FETCH meant the governor forced it on
  // every intervention and the fetch ladder was never reached while hundreds of
  // candidates sat unfetched — the 3403 plateau. It is only a fallback once
  // nothing else downstream has work.
  ["POST_PUBLISH_VERIFY", "publishedButUnverified"],
];

/**
 * Stages whose fixation means "the SOURCE this item came from cannot carry it
 * any further" — a fetch that keeps failing, a read that yields nothing, an
 * extraction/checklist step whose provenance is incomplete. Forcing a different
 * stage keeps the PASS productive but leaves the blocked item exactly where it
 * was, so for these the escape is a different approved SOURCE: the governor
 * reroutes (boosting the best unfetched candidate of the same content type on a
 * different approved host) so the next acquisition pass reads something new.
 * This is the "worker finds its own way out" path the LOOPING escalation asks
 * for — no external API key is involved.
 */
const SOURCE_BLOCKED_STAGES: ReadonlySet<BrainMissionStage> = new Set<BrainMissionStage>([
  "SOURCE_FETCH",
  "SOURCE_READ",
  "EXTRACTION",
  "CHECKLIST_CREATION",
  "CITATION_CREATION",
]);

/** Ladder stages at or past the build gate: forcing one DRAINS work that is
 * already built rather than pulling new work into the funnel. Used only to
 * label the corrective honestly in the audit trail. */
const BACKLOG_DRAIN_STAGES: ReadonlySet<BrainMissionStage> = new Set<BrainMissionStage>([
  "PUBLIC_PUBLISH",
  "STRICT_QA",
  "CROSS_SOURCE_VERIFICATION",
]);

const DEFAULT_WINDOW_MIN = 15;
const DEFAULT_MIN_SAMPLES = 3;
const DEFAULT_MAX_ENTITY_RETRIES = 3;
/** Fetch attempts on one host, all failed, before it counts as "the blocked
 * source" the reroute should route away from. */
const HOST_FAILURE_STREAK = 2;
/** How far back the reroute looks for the host that is blocking a content type. */
const HOST_FAILURE_WINDOW_MS = 60 * 60_000;

/** Minimal ledger row the verdict needs (a subset of AdminWorkerStageOutcome). */
export interface GovernorOutcomeRow {
  stage: string;
  resultType: string;
  result: string;
  entityId: string | null;
  /** Optional: lets fixation be judged per CONTENT TYPE, not only per stage —
   * a stage that advances SAINT but never GUIDE is fixated for GUIDE. */
  contentType?: string | null;
}

/**
 * What the governor DID to break the fixation, recorded so the audit trail (and
 * the operator reading a LOOPING escalation) can see the worker's own way out:
 *
 *  - `reroute_source`  the blocked item's source is exhausted → an alternate
 *                      approved source of the same content type was boosted.
 *  - `drain_backlog`   already-built work was waiting → a publish-side stage ran.
 *  - `advance_stage`   the funnel had queued work → the next productive stage ran.
 *  - `diagnostic`      nothing productive had work → a terminal stage ran.
 */
export type GovernorCorrective =
  | "reroute_source"
  | "drain_backlog"
  | "advance_stage"
  | "diagnostic";

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
  /** The corrective the governor took out of the fixation (null when idle). */
  corrective: GovernorCorrective | null;
  /** The content type the fixation is scoped to — what a reroute reroutes. */
  blockedContentType: string | null;
  /** Filled by `evaluateGovernor` once the corrective has actually been
   * carried out (e.g. "rerouted SAINT from vatican.va to newadvent.org"). */
  correctiveDetail: string | null;
  reason: string;
}

const NO_INTERVENTION: GovernorVerdict = {
  intervene: false,
  fixatedStage: null,
  forcedStage: null,
  forcedContentType: null,
  exhaustedEntityId: null,
  corrective: null,
  blockedContentType: null,
  correctiveDetail: null,
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
  /** The content type the brain picked, when it named one. Enables the
   * per-content-type fixation check (a stage stuck only for SAINT). */
  chosenContentType?: string | null;
  rows: GovernorOutcomeRow[];
  windowMinutes: number;
  minSamples: number;
  maxEntityRetries: number;
}): GovernorVerdict {
  const { world, chosenStage, rows, windowMinutes, minSamples, maxEntityRetries } = args;
  const chosenContentType = args.chosenContentType ?? null;

  // Never intervene while paused — the loop's pause guard already returns early,
  // but this keeps the verdict correct for any direct caller.
  if (world.isPaused) return NO_INTERVENTION;

  const chosen = new Map<string, number>();
  const productive = new Map<string, number>();
  // Same two counts, keyed by stage AND content type. A stage that advances one
  // content type but has NEVER advanced another looks healthy stage-wide while
  // the second type loops forever — which is exactly the shape of the open
  // LOOPING escalation (SOURCE_FETCH, SAINT, 62 non-advancing runs).
  const chosenByType = new Map<string, number>();
  const productiveByType = new Map<string, number>();
  const entityNonAdvance = new Map<string, number>();
  let windowContentProductive = 0;

  const typeKey = (stage: string, contentType: string | null | undefined): string =>
    `${stage} ${contentType ?? ""}`;

  for (const row of rows) {
    chosen.set(row.stage, (chosen.get(row.stage) ?? 0) + 1);
    const tk = typeKey(row.stage, row.contentType);
    chosenByType.set(tk, (chosenByType.get(tk) ?? 0) + 1);
    const prod = isProductive(row);
    if (prod) {
      productive.set(row.stage, (productive.get(row.stage) ?? 0) + 1);
      productiveByType.set(tk, (productiveByType.get(tk) ?? 0) + 1);
    }
    // Only DOWNSTREAM advancement counts toward "content is moving". Discovery /
    // prioritization successes are excluded (see FORWARD_PROGRESS_STAGES) so a
    // discovery-only spin is correctly seen as a growth stall.
    if (FORWARD_PROGRESS_STAGES.has(row.stage as BrainMissionStage) && prod) {
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

  // Per-content-type fixation: N+ runs of this stage FOR THIS CONTENT TYPE with
  // zero successes. Only meaningful when the brain named a content type; the
  // stage-wide check above already covers the rest.
  const fixatedForType =
    chosenContentType != null &&
    GOVERNED_CONTENT_STAGES.has(chosenStage) &&
    (chosenByType.get(typeKey(chosenStage, chosenContentType)) ?? 0) >= minSamples &&
    (productiveByType.get(typeKey(chosenStage, chosenContentType)) ?? 0) === 0;

  const fixatedChosen = isFixated(chosenStage) || fixatedForType;
  // Real growth via ANY path. The structured / OSM / curated ingest LANES
  // publish straight to PublishedContent WITHOUT emitting mission-stage
  // outcomes, so their output never appears in `windowContentProductive` —
  // yet `world.timeSinceLastGrowthMs` (the age of the newest PublishedContent
  // row) does reflect them. If content actually published within the window,
  // the worker is NOT stalled; only its mission-pipeline slot is idle, which is
  // fine while the lanes carry growth. Without this guard the governor
  // force-redirected the web-extraction stage to a diagnostic on EVERY pass —
  // starving that pipeline (0 artifacts) and flooding the log with
  // "growth stalled" warnings — even as thousands of items published.
  const windowMs = windowMinutes * 60_000;
  const grewInWindow =
    world.timeSinceLastGrowthMs != null && world.timeSinceLastGrowthMs <= windowMs;
  // Growth stall: there is content to build, the worker has had enough passes to
  // show output, yet nothing advanced by ANY path — the worker is spinning.
  const growthStall =
    world.contentGoalGap > 0 &&
    windowContentProductive === 0 &&
    !grewInWindow &&
    rows.length >= minSamples;

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

  // Which escape this is, for the audit trail. A fixated ACQUISITION stage is
  // blocked on its source, so rerouting to an alternate approved source is the
  // corrective that actually unblocks the item — the forced stage below still
  // keeps THIS pass productive, but it is not what clears the fixation.
  const corrective: GovernorCorrective =
    fixatedChosen && SOURCE_BLOCKED_STAGES.has(chosenStage)
      ? "reroute_source"
      : forcedStage && BACKLOG_DRAIN_STAGES.has(forcedStage)
        ? "drain_backlog"
        : forcedStage
          ? "advance_stage"
          : "diagnostic";

  if (!forcedStage) {
    // Nothing downstream is making progress: run a terminal diagnostic for the
    // main slot (the keyless ground-truth ingest still runs this active pass).
    forcedStage = terminalStage(chosenStage, world, chosen);
  }

  let exhaustedEntityId: string | null = null;
  for (const [entityId, n] of entityNonAdvance) {
    if (n >= maxEntityRetries) {
      exhaustedEntityId = entityId;
      break;
    }
  }

  const reason = fixatedChosen
    ? `${chosenStage}${fixatedForType ? ` (${chosenContentType})` : ""} chosen ${
        fixatedForType
          ? (chosenByType.get(typeKey(chosenStage, chosenContentType)) ?? 0)
          : (chosen.get(chosenStage) ?? 0)
      }× with no forward progress in ${windowMinutes}m`
    : `growth stalled: gap ${world.contentGoalGap}, 0 content advanced in ${windowMinutes}m`;

  return {
    intervene: true,
    fixatedStage: chosenStage,
    forcedStage,
    forcedContentType: world.contentGoalContentType,
    exhaustedEntityId,
    corrective,
    // Reroute the type the stage is actually stuck on; fall back to the live
    // largest gap when the brain named none.
    blockedContentType: chosenContentType ?? world.contentGoalContentType,
    correctiveDetail: null,
    reason,
  };
}

/** Terminal fallback that never loops into a publishing stage. */
function terminalStage(
  chosenStage: BrainMissionStage,
  world: WorldState,
  chosen: Map<string, number>,
): BrainMissionStage {
  if ((world.pendingRepairPlans > 0 || world.failedBuildJobs > 0) && chosenStage !== "REPAIR") {
    return "REPAIR";
  }
  // REPORTING only pays off once per window: its growth snapshots and ratings
  // describe the same state until something changes. A fixation cycle recurs
  // every window, so forcing REPORTING each time re-ran the whole diagnostic
  // bundle for nothing. If REPORTING already ran in this window, fall through
  // to MAINTENANCE (cleanup, memory + reputation decay), which does different
  // work each time (DG-5).
  if (chosenStage !== "REPORTING" && (chosen.get("REPORTING") ?? 0) === 0) return "REPORTING";
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
  /** Set false to compute the verdict without performing the corrective
   * (the corrective writes: it boosts a candidate row). Default true. */
  applyCorrective?: boolean;
}

/**
 * The approved host that is currently BLOCKING a content type: the host whose
 * recent fetches all failed. Read from the fetch ledger rather than guessed, so
 * the reroute moves away from the source that is actually stuck.
 *
 * Fail-open: any error (or a caller whose Prisma client lacks the model) yields
 * null, and the reroute then simply picks the least-tried alternate host.
 */
async function blockingHostForContentType(
  prisma: PrismaClient,
  nowMs: number,
): Promise<string | null> {
  try {
    const since = new Date(nowMs - HOST_FAILURE_WINDOW_MS);
    const rows = await prisma.adminWorkerFetchResult.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { sourceHost: true, succeeded: true },
    });
    const failures = new Map<string, number>();
    const successes = new Set<string>();
    for (const r of rows as Array<{ sourceHost: string; succeeded: boolean }>) {
      if (r.succeeded) successes.add(r.sourceHost);
      else failures.set(r.sourceHost, (failures.get(r.sourceHost) ?? 0) + 1);
    }
    let worst: string | null = null;
    let worstCount = 0;
    for (const [host, n] of failures) {
      // Only a host with NO success in the window counts as blocking — a host
      // that still works sometimes must not be routed away from.
      if (successes.has(host) || n < HOST_FAILURE_STREAK) continue;
      if (n > worstCount) {
        worst = host;
        worstCount = n;
      }
    }
    return worst;
  } catch {
    return null;
  }
}

/**
 * Carry out the corrective and return a human-readable record of it. Only
 * `reroute_source` has a side effect; the other correctives ARE the forced
 * stage, which the caller runs. Fail-open — a failed reroute never blocks the
 * pass, it just says so in the audit trail.
 */
async function performCorrective(
  prisma: PrismaClient,
  verdict: GovernorVerdict,
): Promise<string | null> {
  if (verdict.corrective !== "reroute_source") {
    return verdict.forcedStage ? `forced ${verdict.forcedStage}` : null;
  }
  const contentType = verdict.blockedContentType;
  if (!contentType) return "no content type to reroute — forced stage only";
  try {
    const failedHost = await blockingHostForContentType(prisma, Date.now());
    const { rerouteToAlternateSource } = await import("./repair");
    const out = await rerouteToAlternateSource(prisma, {
      contentType,
      // "" matches no host, so with no identified blocker the reroute simply
      // picks the least-tried candidate of this type — still a change of source.
      failedHost: failedHost ?? "",
    });
    return out.reason;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
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
          select: {
            stage: true,
            resultType: true,
            result: true,
            entityId: true,
            contentType: true,
          },
        })
        .catch(() => [] as GovernorOutcomeRow[]);
      rows = raw as GovernorOutcomeRow[];
    }

    const verdict = computeGovernorVerdict({
      world,
      chosenStage: input.decision.missionStage,
      chosenContentType: input.decision.contentType ?? null,
      rows,
      windowMinutes,
      minSamples,
      maxEntityRetries,
    });

    // Carry out the escape and record it. The verdict alone only changes WHICH
    // stage runs this pass; a stage fixated on an exhausted source needs the
    // reroute to actually be performed, or the next pass finds the same block.
    if (verdict.intervene && (input.applyCorrective ?? true)) {
      return { ...verdict, correctiveDetail: await performCorrective(input.prisma, verdict) };
    }
    return verdict;
  } catch {
    return NO_INTERVENTION;
  }
}

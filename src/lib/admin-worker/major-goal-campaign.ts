/**
 * Major-goal campaign controller.
 *
 * When a content goal has a large enough gap to be "getting in the way of
 * sustainable progress", the worker treats it as a campaign rather than letting
 * it trickle behind everything else — and this is GENERIC, not tied to any one
 * type (saints today; church-history, prayers, etc. next). It applies only to
 * WEB-growable goals; the biggest gap overall (PARISH) grows on its own OSM lane
 * and is deliberately excluded (see below):
 *
 *   1. DRAIN  — first finish everything already built and waiting to publish
 *               (the funnel), taking on NO new WEB discovery, so nothing
 *               in-flight is abandoned. Bounded by a funnel-size threshold and
 *               an age cap so a stuck artifact can never pin the phase.
 *   2. SURGE  — once the funnel is clear, point ALL discovery + pipeline
 *               resources at the campaign goal until its gap is closed.
 *   3. NORMAL — when no goal has a campaign-sized gap, run the normal task queue
 *               (which itself de-ranks source-blocked types + rotates).
 *
 * The campaign goal is the unmet goal with the LARGEST absolute gap, as long as
 * that gap is at least ADMIN_WORKER_CAMPAIGN_MIN_GAP (default 1000) — so the
 * worker runs a full campaign for the big blockers (saints, then church
 * history, …) and finishes them one at a time, but does not launch a
 * heavyweight drain→surge for a handful of missing items (those are handled by
 * the normal rotation). Curated-built types (GUIDE, MARIAN_TITLE) AND
 * structured-feed-built types (PARISH) are never campaign targets — they grow
 * from the curated / OSM ingest lanes, not the web pipeline a surge drives, so
 * surging on them can't close their gap. PARISH in particular has by far the
 * largest gap (200k), so leaving it eligible pinned the campaign on PARISH
 * forever: the surge commandeered every web-pipeline resource for a goal the web
 * pipeline can't grow, the worker looped SOURCE_FETCH→EXTRACTION with 0 published
 * while its OSM lane was starved, and the gap never shrank so the campaign never
 * escaped (the recurring EXTRACTING_WITHOUT_PUBLISHING escalation). Excluding it
 * lets the campaign surge on the biggest WEB-growable gap while PARISH keeps
 * growing on its own OSM lane every pass.
 *
 * Channel-aware and time-boxed, so one goal cannot pin the web pipeline:
 *   - goals are ranked by the gap the WEB pipeline is needed for. A type whose
 *     structured (Wikidata) ingestor published within the last day — SAINT,
 *     which grows mostly from Wikidata — counts only
 *     ADMIN_WORKER_CAMPAIGN_STRUCTURED_WEIGHT (default 0.1) of its gap, since
 *     that lane is closing it every pass on its own, while PRAYER and NOVENA
 *     can only grow from the web. Once the structured channel stops publishing
 *     (its corpus is exhausted) the full gap counts again;
 *   - one type campaigns for at most ADMIN_WORKER_CAMPAIGN_MAX_SURGE_HOURS
 *     (default 6) at a stretch, then cools down for
 *     ADMIN_WORKER_CAMPAIGN_COOLDOWN_HOURS (default 6): the next campaign-sized
 *     goal, or the normal rotation, gets the pipeline meanwhile. The clock and
 *     the cool-downs live in one GENERIC AdminWorkerMemory row that only the
 *     loop writes (`record: true`); every other caller reads it;
 *   - during SURGE the mission target still yields to the normal rotation
 *     every few discovery decisions (see nextPriorityContentType).
 *
 * Everything here is fail-open: any error yields NORMAL so the worker never
 * wedges on the campaign layer, and only the loop's own evaluation writes.
 */

import type { PrismaClient } from "@prisma/client";

import { CURATED_BUILT_CONTENT_TYPES, STRUCTURED_BUILT_CONTENT_TYPES } from "./content-types";
import { writeAdminWorkerLog } from "./logs";

export type CampaignPhase = "DRAIN" | "SURGE" | "NORMAL";

export interface CampaignState {
  phase: CampaignPhase;
  /** The campaign goal's content type when a campaign is active, else null. */
  majorType: string | null;
  /** Remaining gap for the campaign goal. */
  majorGap: number;
  /** RECENT built artifacts still waiting to publish (the funnel drained in
   * phase 1) — see the age cap in evaluateMajorGoalCampaign. */
  builtFunnel: number;
  /** The gap the campaign was ranked on: the raw gap times its channel weight. */
  weightedGap?: number;
  /** Types whose campaign time ran out and are cooling down (not targets). */
  coolingDown?: string[];
}

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const HOUR_MS = 60 * 60 * 1000;
const STATE_KEY = "major-goal-campaign-state";

const NORMAL: CampaignState = { phase: "NORMAL", majorType: null, majorGap: 0, builtFunnel: 0 };

/** Share of a goal's gap that counts while a structured ingestor is closing it. */
export function structuredChannelWeight(): number {
  return Math.min(1, envInt("ADMIN_WORKER_CAMPAIGN_STRUCTURED_WEIGHT", 0.1));
}

// A type alias (not an interface) so the state is assignable to the Json column.
type CampaignMemory = {
  /** The type the campaign is on, and since when (epoch ms). */
  majorType: string | null;
  since: number | null;
  /** Content type → epoch ms its cool-down ends. */
  cooldowns: Record<string, number>;
};

async function readCampaignMemory(prisma: PrismaClient): Promise<CampaignMemory> {
  try {
    const row = await prisma.adminWorkerMemory.findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: STATE_KEY } },
      select: { memoryValue: true },
    });
    const v = (row?.memoryValue ?? {}) as Partial<CampaignMemory>;
    const cooldowns: Record<string, number> = {};
    for (const [type, until] of Object.entries(v.cooldowns ?? {})) {
      if (typeof until === "number") cooldowns[type] = until;
    }
    return {
      majorType: typeof v.majorType === "string" ? v.majorType : null,
      since: typeof v.since === "number" ? v.since : null,
      cooldowns,
    };
  } catch {
    return { majorType: null, since: null, cooldowns: {} };
  }
}

async function writeCampaignMemory(prisma: PrismaClient, memory: CampaignMemory): Promise<void> {
  try {
    await prisma.adminWorkerMemory.upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: STATE_KEY } },
      update: { memoryValue: memory, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: STATE_KEY,
        memoryValue: memory,
        lastUsedAt: new Date(),
      },
    });
  } catch {
    // fail-open: the cap is re-derived from the last state that did persist
  }
}

function sameMemory(a: CampaignMemory, b: CampaignMemory): boolean {
  const cool = (m: CampaignMemory) => JSON.stringify(Object.entries(m.cooldowns).sort());
  return a.majorType === b.majorType && a.since === b.since && cool(a) === cool(b);
}

/**
 * Decide the current campaign phase + goal. The unmet, web-growable goal with
 * the largest channel-weighted gap ≥ ADMIN_WORKER_CAMPAIGN_MIN_GAP that is not
 * cooling down becomes the campaign target; the worker DRAINs its built funnel,
 * then SURGEs on that goal until the gap closes or its time runs out, then the
 * next goal becomes the campaign (or NORMAL when every remaining gap is small).
 *
 * `record: true` (the loop, once per pass) persists the campaign clock and the
 * cool-downs; every other caller evaluates the same rules read-only.
 */
export async function evaluateMajorGoalCampaign(
  prisma: PrismaClient,
  opts: { record?: boolean; nowMs?: number } = {},
): Promise<CampaignState> {
  const minGap = envInt("ADMIN_WORKER_CAMPAIGN_MIN_GAP", 1000);
  const maxSurgeMs = envInt("ADMIN_WORKER_CAMPAIGN_MAX_SURGE_HOURS", 6) * HOUR_MS;
  const cooldownMs = envInt("ADMIN_WORKER_CAMPAIGN_COOLDOWN_HOURS", 6) * HOUR_MS;
  const now = opts.nowMs ?? Date.now();
  try {
    const goals = await prisma.contentGoal.findMany({
      where: { gapCount: { gte: minGap } },
      orderBy: { gapCount: "desc" },
    });
    // Skip curated-built AND structured-feed-built types — a web-pipeline surge
    // can't close their gap (they grow from the curated / OSM ingest lanes). The
    // campaign target must be a type the surge can actually advance, or the
    // worker loops the web pipeline on an ungrowable goal forever (PARISH).
    const webGoals = goals.filter(
      (g) =>
        !CURATED_BUILT_CONTENT_TYPES.has(g.contentType) &&
        !STRUCTURED_BUILT_CONTENT_TYPES.has(g.contentType),
    );

    // Weight each gap by the channel that can close it: a type a productive
    // structured ingestor is already growing needs the web far less.
    const { productiveStructuredTypes } = await import("./structured/ingest");
    const structured =
      webGoals.length > 0 ? await productiveStructuredTypes(prisma, now) : new Set<string>();
    const weight = structuredChannelWeight();
    const ranked = webGoals
      .map((goal) => ({
        goal,
        weighted: Math.round(goal.gapCount * (structured.has(goal.contentType) ? weight : 1)),
      }))
      .filter((r) => r.weighted >= minGap)
      .sort(
        (a, b) =>
          b.weighted - a.weighted ||
          b.goal.gapCount - a.goal.gapCount ||
          a.goal.priority - b.goal.priority,
      );

    // Time box: the type that has campaigned for maxSurgeMs cools down.
    const memory = await readCampaignMemory(prisma);
    const cooldowns: Record<string, number> = {};
    for (const [type, until] of Object.entries(memory.cooldowns)) {
      if (until > now) cooldowns[type] = until;
    }
    let capped: string | null = null;
    if (
      memory.majorType &&
      memory.since != null &&
      now - memory.since >= maxSurgeMs &&
      !(cooldowns[memory.majorType] > now)
    ) {
      cooldowns[memory.majorType] = now + cooldownMs;
      capped = memory.majorType;
    }
    const chosen = ranked.find((r) => !(cooldowns[r.goal.contentType] > now)) ?? null;
    const next: CampaignMemory = {
      majorType: chosen?.goal.contentType ?? null,
      since: chosen
        ? chosen.goal.contentType === memory.majorType && memory.since != null
          ? memory.since
          : now
        : null,
      cooldowns,
    };
    if (opts.record) {
      if (!sameMemory(memory, next)) await writeCampaignMemory(prisma, next);
      if (capped) {
        await writeAdminWorkerLog(prisma, {
          category: "WORKER_PASS",
          severity: "INFO",
          eventName: "major_goal_campaign_capped",
          message: `Major-goal campaign on ${capped} reached its ${maxSurgeMs / HOUR_MS} h limit; it cools down until ${new Date(cooldowns[capped]).toISOString()} while ${next.majorType ?? "the normal rotation"} gets the pipeline.`,
          contentType: capped,
          safeMetadata: { capped, until: cooldowns[capped], next: next.majorType },
        }).catch(() => undefined);
      }
    }
    const coolingDown = Object.keys(cooldowns);
    if (!chosen) return { ...NORMAL, ...(coolingDown.length > 0 ? { coolingDown } : {}) };
    const target = chosen.goal;

    // The funnel = work already built and waiting to publish. Drain THAT before
    // surging (so in-flight work is never abandoned); raw discovered candidates
    // are "new work", not funnel. Two bounds keep DRAIN from deadlocking the
    // campaign (a single artifact stuck at VERIFICATION_INCOMPLETE, or bouncing
    // BUILD_READY→NEEDS_REPAIR→BUILD_READY, used to pin DRAIN for days and pause
    // discovery every pass):
    //   - a THRESHOLD: a handful of built artifacts is not a backlog — the
    //     drain lane publishes them alongside discovery; and
    //   - an AGE CAP: only artifacts built within the last N hours count, so
    //     anything the drain has not cleared in that time stops holding the
    //     campaign back (it stays in the funnel and keeps being retried).
    const drainMinFunnel = envInt("ADMIN_WORKER_CAMPAIGN_DRAIN_MIN_FUNNEL", 25);
    const drainMaxHours = envInt("ADMIN_WORKER_CAMPAIGN_DRAIN_MAX_HOURS", 2);
    const freshSince = new Date(Date.now() - drainMaxHours * 60 * 60 * 1000);
    const builtFunnel = await prisma.adminWorkerPackageArtifact
      .count({
        where: {
          status: { in: ["BUILD_READY", "VERIFICATION_READY", "QA_PASSED"] },
          createdAt: { gte: freshSince },
        },
      })
      .catch(() => 0);

    return {
      phase: builtFunnel >= drainMinFunnel ? "DRAIN" : "SURGE",
      majorType: target.contentType,
      majorGap: target.gapCount,
      builtFunnel,
      weightedGap: chosen.weighted,
      ...(coolingDown.length > 0 ? { coolingDown } : {}),
    };
  } catch {
    return NORMAL;
  }
}

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
 * Everything here is read-only + fail-open: any error yields NORMAL so the
 * worker never wedges on the campaign layer.
 */

import type { PrismaClient } from "@prisma/client";

import { CURATED_BUILT_CONTENT_TYPES, STRUCTURED_BUILT_CONTENT_TYPES } from "./content-types";

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
}

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const NORMAL: CampaignState = { phase: "NORMAL", majorType: null, majorGap: 0, builtFunnel: 0 };

/**
 * Decide the current campaign phase + goal. The unmet, web-growable goal with
 * the largest absolute gap ≥ ADMIN_WORKER_CAMPAIGN_MIN_GAP becomes the campaign
 * target; the worker DRAINs its built funnel, then SURGEs on that goal until the
 * gap closes, then the next-biggest goal becomes the campaign (or NORMAL when
 * every remaining gap is small).
 */
export async function evaluateMajorGoalCampaign(prisma: PrismaClient): Promise<CampaignState> {
  const minGap = envInt("ADMIN_WORKER_CAMPAIGN_MIN_GAP", 1000);
  try {
    const goals = await prisma.contentGoal.findMany({
      where: { gapCount: { gte: minGap } },
      orderBy: { gapCount: "desc" },
    });
    // Skip curated-built AND structured-feed-built types — a web-pipeline surge
    // can't close their gap (they grow from the curated / OSM ingest lanes). The
    // campaign target must be a type the surge can actually advance, or the
    // worker loops the web pipeline on an ungrowable goal forever (PARISH).
    const target = goals.find(
      (g) =>
        !CURATED_BUILT_CONTENT_TYPES.has(g.contentType) &&
        !STRUCTURED_BUILT_CONTENT_TYPES.has(g.contentType),
    );
    if (!target) return NORMAL;

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
    };
  } catch {
    return NORMAL;
  }
}

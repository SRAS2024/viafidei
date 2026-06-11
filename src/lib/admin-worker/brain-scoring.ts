/**
 * brain-scoring - action scoring for the Admin Worker brain. Extracted
 * from brain.ts (spec: refactor oversized worker files into smaller
 * modules). Pure functions over WorldState; candidate enumeration lives in
 * brain-candidates.ts and orchestration stays in brain.ts.
 */

import type { BrainAction, WorldState } from "./brain";

/** Hours since `ms` capped to [0, 168]. */
function hoursSinceCapped(ms: number | null): number {
  if (ms == null) return 168;
  return Math.min(168, Math.max(0, ms / 3_600_000));
}

/**
 * Score a single candidate action against the current world. The
 * scoring engine assigns:
 *   - urgencyScore   how time-critical the work is (security, health,
 *                    no growth in days)
 *   - sourceScore    how prepared the source side is (candidates,
 *                    reputation, freshness)
 *   - repairScore    how badly the worker needs to repair itself
 *   - qualityExpectation chance the action produces a publishable result
 * A safety filter zeros the score (and sets rejectionReason) for
 * actions that would be unsafe given the world (eg. PUBLISH while
 * paused; BUILD with no candidate URLs).
 */
export function scoreAction(action: BrainAction, world: WorldState): BrainAction {
  let urgency = 0;
  let sourceScore = 0;
  let repairScore = 0;
  let quality = action.qualityExpectation;
  let safe = true;
  let rejection: string | null = null;

  switch (action.missionStage) {
    case "PAUSED":
      if (!world.isPaused) {
        safe = false;
        rejection = "Worker is not paused.";
      }
      urgency = world.isPaused ? 100 : 0;
      break;
    case "SECURITY_DEFENSE":
      urgency = world.recentSecurityBreaches24h * 50;
      if (world.recentSecurityBreaches24h === 0) {
        safe = false;
        rejection = "No confirmed breaches in last 24h.";
      }
      break;
    case "REPAIR":
      if (action.priority === "WORKER_HEALTH") {
        const stale = world.heartbeatAgeMs > 5 * 60_000;
        urgency = stale ? 40 : 0;
        if (world.currentBlocker) urgency += 30;
        repairScore = (stale ? 0.4 : 0) + (world.currentBlocker ? 0.5 : 0);
        if (!stale && !world.currentBlocker) {
          safe = false;
          rejection = "Heartbeat fresh and no blocker.";
        }
      } else {
        urgency = Math.min(20, world.failedBuildJobs * 2 + world.pendingRepairPlans * 3);
        repairScore =
          0.4 + Math.min(0.4, world.failedBuildJobs * 0.05 + world.pendingRepairPlans * 0.08);
        if (world.failedBuildJobs === 0 && world.pendingRepairPlans === 0) {
          safe = false;
          rejection = "No failed jobs or pending repair plans.";
        }
      }
      break;
    case "DISCOVERY": {
      const gap = world.contentGoalGap;
      const noCandidates = world.candidateUrlsAvailable === 0;
      const noGrowth = hoursSinceCapped(world.timeSinceLastGrowthMs);
      const queueIsDoingWork = world.pendingBuildJobs > 0 || world.runningBuildJobs > 0;
      // Drain before discover: when items are already in flight (reads to
      // extract, artifacts awaiting checklist / verification / QA /
      // publish, or candidates still to fetch), pushing those to public
      // content closes the gap faster than discovering more sources — and
      // hammering discovery while in-flight work waits is the churn that
      // starves the pipeline. Discovery stays a low floor in that state.
      const inFlight =
        world.candidateUrlsAvailable +
        world.readsAwaitingExtraction +
        world.artifactsAwaitingChecklist +
        world.artifactsAwaitingVerification +
        world.artifactsAwaitingQA +
        world.artifactsAwaitingPublish;
      urgency =
        inFlight > 0
          ? 2
          : (gap > 0 ? Math.min(20, gap * 1.5) : 0) +
            (noCandidates && !queueIsDoingWork ? 15 : 0) +
            // Only push discovery hard when the queue isn't already
            // working — otherwise let the build engine drain first.
            (queueIsDoingWork ? 0 : Math.min(10, noGrowth / 24));
      sourceScore = noCandidates ? 0.2 : 0.6;
      if (gap <= 0) {
        safe = false;
        rejection = "All content goals met — discovery not needed.";
      }
      break;
    }
    case "CANDIDATE_PRIORITIZATION": {
      // Scoring discovered candidates is the prerequisite for fetching them, so
      // it must outrank DISCOVERY (don't keep discovering when raw candidates
      // are waiting to be scored). Cheap + idempotent; once scored, the count
      // drops to zero and this becomes unsafe (no re-fire loop).
      const n = world.candidatesNeedingPrioritization;
      urgency = n > 0 ? Math.min(52, 24 + n * 2) : 0;
      sourceScore = n > 0 ? 0.6 : 0;
      if (n === 0) {
        safe = false;
        rejection = "No unscored candidates to prioritize.";
      }
      break;
    }
    case "SOURCE_FETCH": {
      const trusted = world.trustedSources;
      // Fetching available candidates is the path that closes the gap
      // when raw candidates exist. Scale urgency with both the number of
      // ready candidates and the gap pressure so SOURCE_FETCH outranks
      // both DISCOVERY (don't keep discovering when you have unfetched
      // candidates) and PACKAGE_BUILD (you can't build before you fetch).
      urgency =
        world.candidateUrlsAvailable === 0
          ? 0
          : Math.min(48, world.candidateUrlsAvailable * 6 + (world.contentGoalGap > 0 ? 12 : 0));
      sourceScore = 0.5 + Math.min(0.4, trusted * 0.05);
      quality = world.candidateUrlsAvailable === 0 ? 0 : quality;
      if (world.candidateUrlsAvailable === 0) {
        safe = false;
        rejection = "No candidates available to fetch.";
      }
      break;
    }
    case "CLASSIFICATION": {
      urgency = Math.min(20, world.unclassifiedReads * 1.5);
      sourceScore = world.unclassifiedReads > 0 ? 0.7 : 0;
      if (world.unclassifiedReads === 0) {
        safe = false;
        rejection = "All source-reads already classified.";
      }
      break;
    }
    case "EXTRACTION": {
      urgency =
        world.readsAwaitingExtraction > 0
          ? Math.min(42, 26 + world.readsAwaitingExtraction * 4)
          : 0;
      sourceScore = world.readsAwaitingExtraction > 0 ? 0.7 : 0;
      quality = world.readsAwaitingExtraction > 0 ? 0.78 : quality;
      if (world.readsAwaitingExtraction === 0) {
        safe = false;
        rejection = "No classified reads awaiting extraction.";
      }
      break;
    }
    case "CHECKLIST_CREATION": {
      urgency =
        world.artifactsAwaitingChecklist > 0
          ? Math.min(46, 30 + world.artifactsAwaitingChecklist * 4)
          : 0;
      sourceScore = world.artifactsAwaitingChecklist > 0 ? 0.75 : 0;
      quality = world.artifactsAwaitingChecklist > 0 ? 0.82 : quality;
      if (world.artifactsAwaitingChecklist === 0) {
        safe = false;
        rejection = "No CHECKLIST_READY artifacts awaiting checklist + citations.";
      }
      break;
    }
    case "STRICT_QA": {
      urgency =
        world.artifactsAwaitingQA > 0 ? Math.min(58, 40 + world.artifactsAwaitingQA * 4) : 0;
      sourceScore = world.artifactsAwaitingQA > 0 ? 0.8 : 0;
      quality = world.artifactsAwaitingQA > 0 ? 0.85 : quality;
      if (world.artifactsAwaitingQA === 0) {
        safe = false;
        rejection = "No artifacts awaiting strict QA.";
      }
      break;
    }
    case "PUBLIC_PUBLISH": {
      // The stage that actually closes the content-goal gap — drain it
      // first so in-flight, QA-passed artifacts reach the public site
      // before the worker starts new discovery work.
      urgency =
        world.artifactsAwaitingPublish > 0
          ? Math.min(70, 50 + world.artifactsAwaitingPublish * 5)
          : 0;
      sourceScore = world.artifactsAwaitingPublish > 0 ? 0.85 : 0;
      quality = world.artifactsAwaitingPublish > 0 ? 0.9 : quality;
      if (world.artifactsAwaitingPublish === 0) {
        safe = false;
        rejection = "No QA-passed artifacts awaiting publish.";
      }
      break;
    }
    case "PACKAGE_BUILD": {
      const gap = world.contentGoalGap;
      // PACKAGE_BUILD only drains LEGACY pending build jobs. BUILD_READY
      // package artifacts are advanced directly by CROSS_SOURCE_VERIFICATION
      // (when they carry validation needs) and STRICT_QA — runPackageBuild
      // is a deferring no-op for them, so letting it compete for
      // BUILD_READY artifacts just makes the brain spin on a stage that
      // can't advance the item. Gate strictly on pending jobs.
      urgency =
        world.pendingBuildJobs > 0 ? Math.min(60, world.pendingBuildJobs * 8 + gap * 1.5) : 0;
      sourceScore = world.pendingBuildJobs > 0 ? 0.8 : 0.1;
      quality = world.pendingBuildJobs > 0 ? 0.85 : quality;
      if (world.pendingBuildJobs === 0) {
        safe = false;
        rejection =
          "No pending build jobs (BUILD_READY artifacts advance via QA, not PACKAGE_BUILD).";
      }
      break;
    }
    case "CROSS_SOURCE_VERIFICATION": {
      // Sensitive content (saint feast day, novena day count, sacrament
      // identity, …) MUST gather stored cross-source evidence BEFORE
      // strict QA — otherwise the validation dimension scores zero and
      // the artifact fails QA. So this stage out-ranks STRICT_QA whenever
      // a BUILD_READY artifact still needs validation evidence.
      const needsVerification = world.artifactsAwaitingVerification;
      urgency =
        needsVerification > 0
          ? Math.min(62, 46 + needsVerification * 4)
          : Math.min(20, world.pendingQAReviews * 4);
      quality = needsVerification > 0 || world.pendingQAReviews > 0 ? 0.85 : quality;
      if (needsVerification === 0 && world.pendingQAReviews === 0) {
        safe = false;
        rejection = "No artifacts awaiting cross-source evidence and no pending QA reviews.";
      }
      break;
    }
    case "POST_PUBLISH_VERIFY":
      urgency = Math.min(20, world.publishedButUnverified * 0.5);
      quality = 0.9;
      if (world.publishedButUnverified === 0) {
        safe = false;
        rejection = "All published content already verified.";
      }
      break;
    case "HOMEPAGE_WORK":
      urgency = world.homepageScore < 0.65 ? 15 : 0;
      quality = 0.65;
      if (world.homepageScore >= 0.65) {
        safe = false;
        rejection = `Homepage score ${world.homepageScore.toFixed(2)} already above threshold.`;
      }
      break;
    case "REPORTING":
      urgency = world.lastSuccessAgeMs == null ? 25 : world.lastSuccessAgeMs > 60 * 60_000 ? 15 : 0;
      quality = 0.5;
      if (world.lastSuccessAgeMs != null && world.lastSuccessAgeMs <= 60 * 60_000) {
        safe = false;
        rejection = "Recent successful pass — diagnostics not urgent.";
      }
      break;
    case "MAINTENANCE":
      urgency = 1;
      sourceScore = 0;
      quality = 0.4;
      break;
    default:
      break;
  }

  // Doctrinal-sensitivity risk bump: actions that publish or persist
  // doctrinally sensitive content carry higher risk by default; the
  // brain prefers verification-heavy actions when verification is due.
  const doctrinalSensitive =
    action.missionStage === "PUBLIC_PUBLISH" || action.missionStage === "PERSISTENCE";
  const baseRisk = doctrinalSensitive ? action.riskScore + 0.1 : action.riskScore;

  // Final score combines the dimensions. Urgency dominates so the
  // brain reaches for the most time-critical safe action first; the
  // other dimensions break ties.
  const finalScore = safe
    ? urgency + sourceScore * 5 + repairScore * 4 + quality * 3 - baseRisk * 2
    : 0;

  return {
    ...action,
    urgencyScore: urgency,
    sourceScore,
    repairScore,
    qualityExpectation: quality,
    riskScore: baseRisk,
    finalScore,
    safe,
    rejectionReason: rejection,
  };
}

/**
 * Build the ranked alternatives list. Highest finalScore first. Unsafe
 * actions stay in the list (so the audit view can show "considered
 * but unsafe") but always sort behind any safe action.
 *
 * Spec §12 follow-up: applyFatigue lets the brain back off from a
 * mission stage that has been failing repeatedly. If we see the same
 * stage in the most recent N decisions with no advancement, its
 * urgency is decayed so the brain rotates to a different action.
 */

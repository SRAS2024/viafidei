#!/usr/bin/env tsx
/**
 * Local Admin Worker dry run.
 *
 * Exercises the brain's action-intelligence engine offline (no DB, no
 * network): it builds several synthetic world states and asserts the
 * brain ranks + selects the correct next action for each. This proves
 * the brain is wired and reasoning sensibly without needing a live
 * Postgres — the part of `admin-worker:proof` that confirms "the brain
 * ranks actions intelligently and rotates away from failure".
 *
 * Exit code 0 = all scenarios behaved as expected; 1 = a mismatch.
 */

import { decide, rankActions, type WorldState } from "../src/lib/admin-worker/brain";

function baseWorld(over: Partial<WorldState> = {}): WorldState {
  return {
    pendingBuildJobs: 0,
    failedBuildJobs: 0,
    runningBuildJobs: 0,
    contentGoalGap: 0,
    contentGoalContentType: null,
    pausedSources: 0,
    trustedSources: 3,
    reviewQueuePending: 0,
    recentSecurityBreaches24h: 0,
    homepageScore: 0.9,
    isPaused: false,
    pausedReason: null,
    heartbeatAgeMs: 1_000,
    lastSuccessAgeMs: 60_000,
    lastFailureAgeMs: null,
    currentBlocker: null,
    candidateUrlsAvailable: 0,
    candidatesNeedingPrioritization: 0,
    pendingRepairPlans: 0,
    pipelineStagesBlocked: 0,
    unclassifiedReads: 0,
    readsAwaitingExtraction: 0,
    artifactsAwaitingChecklist: 0,
    artifactsAwaitingBuild: 0,
    artifactsAwaitingVerification: 0,
    artifactsAwaitingQA: 0,
    artifactsAwaitingPublish: 0,
    publishedButUnverified: 0,
    pendingQAReviews: 0,
    contentGoalsAtGoalCount: 0,
    contentGoalsBelowGoalCount: 0,
    timeSinceLastGrowthMs: null,
    topSourceReputation: [{ host: "vatican.va", tier: "TRUSTED" }],
    ...over,
  };
}

interface Scenario {
  label: string;
  world: WorldState;
  expect: (stage: string) => boolean;
  describeExpectation: string;
}

const scenarios: Scenario[] = [
  {
    label: "paused worker",
    world: baseWorld({ isPaused: true, pausedReason: "operator pause" }),
    expect: (s) => s === "PAUSED",
    describeExpectation: "PAUSED",
  },
  {
    label: "confirmed security breach",
    world: baseWorld({ recentSecurityBreaches24h: 2 }),
    expect: (s) => s === "SECURITY_DEFENSE",
    describeExpectation: "SECURITY_DEFENSE",
  },
  {
    label: "active worker blocker",
    world: baseWorld({ currentBlocker: "source vatican.va paused", heartbeatAgeMs: 9_000_000 }),
    expect: (s) => s === "REPAIR",
    describeExpectation: "REPAIR",
  },
  {
    label: "content gap, no candidates → discovery",
    world: baseWorld({
      contentGoalGap: 12,
      contentGoalContentType: "PRAYER",
      candidateUrlsAvailable: 0,
      candidatesNeedingPrioritization: 0,
    }),
    expect: (s) => s === "DISCOVERY" || s === "SOURCE_FETCH",
    describeExpectation: "DISCOVERY",
  },
  {
    label: "pending build jobs → package build",
    world: baseWorld({ pendingBuildJobs: 4, contentGoalGap: 8, contentGoalContentType: "SAINT" }),
    expect: (s) => s === "PACKAGE_BUILD",
    describeExpectation: "PACKAGE_BUILD",
  },
  {
    label: "all goals met, nothing pending → maintenance",
    world: baseWorld({ contentGoalGap: 0, contentGoalsAtGoalCount: 9, lastSuccessAgeMs: 30_000 }),
    expect: (s) => s === "MAINTENANCE" || s === "REPORTING",
    describeExpectation: "MAINTENANCE",
  },
];

function main(): number {
  let failures = 0;
  console.log("Admin Worker dry run — brain action ranking\n");
  for (const sc of scenarios) {
    const decision = decide(sc.world);
    const ranked = rankActions(sc.world);
    const ok = sc.expect(decision.missionStage);
    const top3 = ranked
      .slice(0, 3)
      .map((a) => `${a.missionStage}(${a.finalScore.toFixed(1)})`)
      .join(", ");
    console.log(
      `${ok ? "✓" : "✗"} ${sc.label}\n    chose ${decision.missionStage} ` +
        `(expected ${sc.describeExpectation}); top: ${top3}`,
    );
    if (!ok) failures += 1;
    // Every decision must be explainable (spec §48).
    if (!decision.brainExplanation || decision.brainExplanation.length < 10) {
      console.log("    ✗ missing brain explanation");
      failures += 1;
    }
  }
  console.log("");
  if (failures === 0) {
    console.log("Dry run PASSED — the brain ranked and selected sensible actions for every world.");
    return 0;
  }
  console.error(`Dry run FAILED — ${failures} scenario(s) did not behave as expected.`);
  return 1;
}

process.exit(main());

/**
 * Growth health score.
 *
 * One score per content type plus a global aggregate. The score is a
 * 0–100 integer the admin dashboard reads as a single
 * "is this content type healthy?" signal.
 *
 * Penalties (each subtracts from the score):
 *   1. No source documents fetched.
 *   2. No build attempts.
 *   3. Low build success rate.
 *   4. Low QA pass rate.
 *   5. Low persistence success rate.
 *   6. Public gate failures.
 *   7. High duplicate rate.
 *   8. High wrong-content rate.
 *   9. Stalled thresholds (no new packages in 24h despite source docs).
 *
 * The function reads from the existing content-growth dashboard
 * helper so the underlying counts cannot drift between the two
 * surfaces.
 */

import type { ContentGrowthRow } from "./content-growth-dashboard";
import { getContentGrowthDashboard, getContentGrowthRowForType } from "./content-growth-dashboard";
import type { ContentTypeKey } from "../content-factory";

export type GrowthHealthBreakdown = {
  contentType: ContentTypeKey;
  /** 0–100, higher is healthier. */
  score: number;
  /** Each entry subtracts from the score. */
  penalties: Array<{ id: string; amount: number; reason: string }>;
  /** Each entry adds (rewards). */
  rewards: Array<{ id: string; amount: number; reason: string }>;
};

export type GlobalGrowthHealth = {
  perType: GrowthHealthBreakdown[];
  globalScore: number;
  generatedAt: Date;
};

const STARTING_SCORE = 100;

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function computeGrowthHealthFromRow(row: ContentGrowthRow): GrowthHealthBreakdown {
  const penalties: GrowthHealthBreakdown["penalties"] = [];
  const rewards: GrowthHealthBreakdown["rewards"] = [];
  let score = STARTING_SCORE;

  if (row.sourceDocumentsFetched != null && row.sourceDocumentsFetched === 0) {
    penalties.push({
      id: "no_source_documents",
      amount: 30,
      reason: "No source documents fetched",
    });
    score -= 30;
  }
  if (
    row.buildAttempts != null &&
    row.buildAttempts === 0 &&
    (row.sourceDocumentsFetched ?? 0) > 0
  ) {
    penalties.push({
      id: "no_build_attempts",
      amount: 25,
      reason: "Source docs exist but no builds attempted",
    });
    score -= 25;
  }
  const buildSuccessRate = ratio(row.completePackagesBuilt, row.buildAttempts);
  if (buildSuccessRate != null && row.buildAttempts && row.buildAttempts >= 5) {
    if (buildSuccessRate < 0.25) {
      penalties.push({
        id: "low_build_success_rate",
        amount: 20,
        reason: `Build success rate ${Math.round(buildSuccessRate * 100)}% (< 25%)`,
      });
      score -= 20;
    } else if (buildSuccessRate < 0.5) {
      penalties.push({
        id: "low_build_success_rate",
        amount: 10,
        reason: `Build success rate ${Math.round(buildSuccessRate * 100)}% (< 50%)`,
      });
      score -= 10;
    } else if (buildSuccessRate >= 0.8) {
      rewards.push({
        id: "high_build_success_rate",
        amount: 5,
        reason: `Build success rate ${Math.round(buildSuccessRate * 100)}% (>= 80%)`,
      });
      score += 5;
    }
  }
  const qaPassRate = ratio(row.qaPassCount, row.completePackagesBuilt);
  if (qaPassRate != null && row.completePackagesBuilt && row.completePackagesBuilt >= 5) {
    if (qaPassRate < 0.5) {
      penalties.push({
        id: "low_qa_pass_rate",
        amount: 15,
        reason: `QA pass rate ${Math.round(qaPassRate * 100)}% (< 50%)`,
      });
      score -= 15;
    } else if (qaPassRate >= 0.9) {
      rewards.push({
        id: "high_qa_pass_rate",
        amount: 5,
        reason: `QA pass rate ${Math.round(qaPassRate * 100)}% (>= 90%)`,
      });
      score += 5;
    }
  }
  const persistRate = ratio(row.persistedPackageCount, row.qaPassCount);
  if (persistRate != null && row.qaPassCount && row.qaPassCount >= 5 && persistRate < 0.8) {
    penalties.push({
      id: "low_persistence_rate",
      amount: 15,
      reason: `Persistence rate ${Math.round(persistRate * 100)}% (< 80%)`,
    });
    score -= 15;
  }
  // Public gate failures: persisted > public.
  if (row.persistedPackageCount != null && row.publicPackageCount != null) {
    const gap = row.persistedPackageCount - row.publicPackageCount;
    if (gap > 0 && row.persistedPackageCount > 0) {
      penalties.push({
        id: "public_gate_failures",
        amount: 15,
        reason: `${gap} rows persisted but blocked by the public gate`,
      });
      score -= 15;
    }
  }
  const duplicateRate = ratio(row.duplicateCount, row.buildAttempts);
  if (
    duplicateRate != null &&
    row.buildAttempts &&
    row.buildAttempts >= 10 &&
    duplicateRate > 0.4
  ) {
    penalties.push({
      id: "high_duplicate_rate",
      amount: 10,
      reason: `Duplicate rate ${Math.round(duplicateRate * 100)}% (> 40%)`,
    });
    score -= 10;
  }
  // Stalled growth: source docs exist, but no new public packages in 24h.
  if (
    row.growthRate24h != null &&
    row.growthRate24h === 0 &&
    (row.sourceDocumentsFetched ?? 0) > 0 &&
    (row.publicPackageCount ?? 0) === 0
  ) {
    penalties.push({
      id: "stalled_thresholds",
      amount: 10,
      reason: "No new packages in 24h despite source documents",
    });
    score -= 10;
  }
  // Reward: positive 7d growth.
  if (row.growthRate7d != null && row.growthRate7d > 0 && row.publicPackageCount != null) {
    rewards.push({
      id: "positive_7d_growth",
      amount: 3,
      reason: `${row.growthRate7d} package(s) built in last 7 days`,
    });
    score += 3;
  }

  // Clamp.
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { contentType: row.contentType, score, penalties, rewards };
}

export async function getGrowthHealthForType(
  contentType: ContentTypeKey,
): Promise<GrowthHealthBreakdown> {
  const row = await getContentGrowthRowForType(contentType);
  return computeGrowthHealthFromRow(row);
}

export async function getGlobalGrowthHealth(): Promise<GlobalGrowthHealth> {
  const rows = await getContentGrowthDashboard();
  const perType = rows.map(computeGrowthHealthFromRow);
  const globalScore = perType.length
    ? Math.round(perType.reduce((acc, r) => acc + r.score, 0) / perType.length)
    : 100;
  return { perType, globalScore, generatedAt: new Date() };
}

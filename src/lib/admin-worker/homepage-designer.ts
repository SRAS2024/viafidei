/**
 * Homepage designer. Scores the current homepage on 8 dimensions and,
 * when the score is below the redesign threshold, files a
 * HomepageWorkerDraft. Small high-confidence improvements may publish
 * automatically; major changes file for review.
 *
 * Phase 1 ships the scoring + draft surfaces. The actual homepage
 * mutator integrates with the existing homepage editor in Phase 2.
 */

import type {
  HomepageWorkerDraftMode,
  HomepageWorkerDraftStatus,
  PrismaClient,
} from "@prisma/client";

import { CONFIDENCE_THRESHOLDS } from "./decisions";

export const HOMEPAGE_REDESIGN_THRESHOLD = 0.65;

export interface HomepageScoreInputs {
  contentFreshnessScore: number;
  sectionBalanceScore: number;
  visualCompletenessScore: number;
  linkHealthScore: number;
  seasonalRelevanceScore: number;
  emptyStateAvoidanceScore: number;
  accessibilityScore: number;
  mobileReadinessScore: number;
}

export function computeHomepageFinalScore(inputs: HomepageScoreInputs): number {
  const weights = {
    contentFreshnessScore: 0.2,
    sectionBalanceScore: 0.15,
    visualCompletenessScore: 0.1,
    linkHealthScore: 0.15,
    seasonalRelevanceScore: 0.1,
    emptyStateAvoidanceScore: 0.15,
    accessibilityScore: 0.1,
    mobileReadinessScore: 0.05,
  };
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += weight * (inputs[key as keyof typeof weights] ?? 0);
  }
  return Math.max(0, Math.min(1, total));
}

export async function recordHomepageScore(
  prisma: PrismaClient,
  inputs: HomepageScoreInputs,
): Promise<{ id: string; finalScore: number }> {
  const finalScore = computeHomepageFinalScore(inputs);
  return prisma.homepageQualityScore.create({
    data: { ...inputs, finalScore },
    select: { id: true, finalScore: true },
  });
}

export interface DraftDecisionInputs {
  finalScore: number;
  mode: HomepageWorkerDraftMode;
  confidence: number;
  sectionsChanged: string[];
}

export function decideDraftStatus(inputs: DraftDecisionInputs): HomepageWorkerDraftStatus {
  // Full refreshes always go to review unless explicitly admin-requested.
  if (inputs.mode === "FULL_REFRESH") return "AWAITING_REVIEW";
  if (inputs.mode === "ADMIN_REQUESTED") return "AWAITING_REVIEW";
  // Section-deletion is risky; if any section is removed (heuristic:
  // sectionsChanged contains "deleted:") require review.
  if (inputs.sectionsChanged.some((s) => s.startsWith("deleted:"))) {
    return "AWAITING_REVIEW";
  }
  // Small high-confidence improvements may auto-publish.
  if (
    inputs.mode === "AUTOMATIC_SMALL" &&
    inputs.confidence >= CONFIDENCE_THRESHOLDS.homepageAutoPublish
  ) {
    return "AUTO_PUBLISHED";
  }
  return "PROPOSED";
}

export interface CreateDraftInput {
  passId?: string;
  mode: HomepageWorkerDraftMode;
  currentSnapshot: unknown;
  proposedSnapshot: unknown;
  reasonSummary: string;
  sectionsChanged: string[];
  confidence: number;
  finalScore: number;
}

export async function createHomepageDraft(
  prisma: PrismaClient,
  input: CreateDraftInput,
): Promise<{ id: string; status: HomepageWorkerDraftStatus }> {
  const status = decideDraftStatus({
    finalScore: input.finalScore,
    mode: input.mode,
    confidence: input.confidence,
    sectionsChanged: input.sectionsChanged,
  });
  const row = await prisma.homepageWorkerDraft.create({
    data: {
      passId: input.passId,
      mode: input.mode,
      currentSnapshot: input.currentSnapshot as object,
      proposedSnapshot: input.proposedSnapshot as object,
      reasonSummary: input.reasonSummary,
      sectionsChanged: input.sectionsChanged,
      confidence: input.confidence,
      status,
      publishedAt: status === "AUTO_PUBLISHED" ? new Date() : null,
    },
    select: { id: true, status: true },
  });
  return row;
}

/**
 * Homepage designer. Scores the current homepage on 8 dimensions and,
 * when the score is below the redesign threshold, files a
 * HomepageWorkerDraft. Small high-confidence improvements may publish
 * automatically; major changes file for review.
 *
 * The scoring + draft surfaces here feed homepage-mutator and the
 * homepage-publish-orchestrator, which integrate with the existing
 * homepage editor.
 */

import type {
  HomepageWorkerDraftMode,
  HomepageWorkerDraftStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { CONFIDENCE_THRESHOLDS } from "./decisions";

export const HOMEPAGE_REDESIGN_THRESHOLD = 0.65;

/** Statuses where a draft can still be previewed, edited, published, or
 *  discarded by the admin. AUTO_PUBLISHED / APPROVED / REJECTED /
 *  EXPIRED are terminal and no longer actionable. */
export const REVIEWABLE_DRAFT_STATUSES: readonly HomepageWorkerDraftStatus[] = [
  "PROPOSED",
  "AWAITING_REVIEW",
];

export function isReviewableDraftStatus(status: HomepageWorkerDraftStatus): boolean {
  return REVIEWABLE_DRAFT_STATUSES.includes(status);
}

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

/* ------------------------------------------------------------------ *
 * Draft review actions (admin preview → edit → publish / discard).
 *
 * The "Request Homepage Makeover" flow files an AWAITING_REVIEW draft
 * whose proposedSnapshot is a list of block snapshots. The admin can
 * preview it, make small edits, then publish (apply to the live
 * HomePage record) or discard. These helpers are pure DB operations so
 * they stay easy to unit-test; the API route layers auth + audit on top.
 * ------------------------------------------------------------------ */

/** A single proposed homepage block, as stored in `proposedSnapshot`. */
export interface HomepageBlockSnapshot {
  blockKey: string;
  blockType: string;
  sortOrder: number;
  configJson: unknown;
}

/** Defensive parse of a `proposedSnapshot` JSON value into typed blocks.
 *  Drops anything that does not at least have a blockKey + blockType. */
export function readSnapshotBlocks(snapshot: unknown): HomepageBlockSnapshot[] {
  if (!Array.isArray(snapshot)) return [];
  const out: HomepageBlockSnapshot[] = [];
  for (const raw of snapshot) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    if (typeof b.blockKey !== "string" || typeof b.blockType !== "string") continue;
    out.push({
      blockKey: b.blockKey,
      blockType: b.blockType,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
      configJson: b.configJson ?? {},
    });
  }
  return out;
}

export async function getHomepageDraft(prisma: PrismaClient, id: string) {
  return prisma.homepageWorkerDraft.findUnique({ where: { id } });
}

export interface SaveDraftEditsResult {
  saved: boolean;
  status: HomepageWorkerDraftStatus;
  reason?: string;
}

/** Persist admin edits to a draft's proposed featured blocks. Only the
 *  featured-* blocks the preview surfaces are stored; non-featured
 *  blocks are left to the live homepage's static sections and are not
 *  applied, so storing featured-only here is lossless for publishing. */
export async function saveHomepageDraftEdits(
  prisma: PrismaClient,
  id: string,
  proposedSnapshot: unknown,
): Promise<SaveDraftEditsResult> {
  const draft = await prisma.homepageWorkerDraft.findUnique({ where: { id } });
  if (!draft) return { saved: false, status: "EXPIRED", reason: "not_found" };
  if (!isReviewableDraftStatus(draft.status)) {
    return { saved: false, status: draft.status, reason: `draft is ${draft.status}` };
  }
  const blocks = readSnapshotBlocks(proposedSnapshot).map((b, i) => ({ ...b, sortOrder: i }));
  await prisma.homepageWorkerDraft.update({
    where: { id },
    data: { proposedSnapshot: blocks as unknown as Prisma.InputJsonValue },
  });
  return { saved: true, status: draft.status };
}

export interface ApplyDraftResult {
  applied: boolean;
  status: HomepageWorkerDraftStatus;
  blocksWritten: number;
  reason?: string;
}

/**
 * Publish a draft: apply its proposed featured blocks to the live
 * HomePage record and mark the draft APPROVED. Non-featured blocks
 * (hero, mission) are left untouched — the makeover only owns the
 * featured rails — so this is non-destructive to the hand-edited
 * homepage. Runs in a transaction so the homepage can never be left in
 * a half-applied state.
 */
export async function applyHomepageDraft(
  prisma: PrismaClient,
  id: string,
): Promise<ApplyDraftResult> {
  const draft = await prisma.homepageWorkerDraft.findUnique({ where: { id } });
  if (!draft) return { applied: false, status: "EXPIRED", blocksWritten: 0, reason: "not_found" };
  if (!isReviewableDraftStatus(draft.status)) {
    return {
      applied: false,
      status: draft.status,
      blocksWritten: 0,
      reason: `draft is ${draft.status}`,
    };
  }

  const proposedFeatured = readSnapshotBlocks(draft.proposedSnapshot).filter((b) =>
    b.blockType.startsWith("featured-"),
  );

  // Ensure the canonical homepage record exists.
  let page = await prisma.homePage.findUnique({
    where: { slug: "homepage" },
    include: { blocks: true },
  });
  if (!page) {
    page = await prisma.homePage.create({
      data: { slug: "homepage", title: "Via Fidei", status: "PUBLISHED" },
      include: { blocks: true },
    });
  }
  const pageId = page.id;

  // Keep all non-featured blocks; the new featured blocks slot in after
  // them so the [pageId, sortOrder] unique constraint can never collide.
  const maxKeepOrder = page.blocks
    .filter((b) => !b.blockType.startsWith("featured-"))
    .reduce((m, b) => Math.max(m, b.sortOrder), -1);

  await prisma.$transaction(async (tx) => {
    await tx.homePageBlock.deleteMany({
      where: { pageId, blockType: { startsWith: "featured-" } },
    });
    for (let i = 0; i < proposedFeatured.length; i++) {
      const b = proposedFeatured[i];
      await tx.homePageBlock.create({
        data: {
          pageId,
          blockKey: b.blockKey,
          blockType: b.blockType,
          sortOrder: maxKeepOrder + 1 + i,
          configJson: (b.configJson ?? {}) as Prisma.InputJsonValue,
        },
      });
    }
    await tx.homePage.update({
      where: { id: pageId },
      data: { status: "PUBLISHED", version: { increment: 1 } },
    });
    await tx.homepageWorkerDraft.update({
      where: { id },
      data: { status: "APPROVED", publishedAt: new Date() },
    });
  });

  return { applied: true, status: "APPROVED", blocksWritten: proposedFeatured.length };
}

export interface DiscardDraftResult {
  discarded: boolean;
  status: HomepageWorkerDraftStatus;
  reason?: string;
}

/** Discard a draft: mark it REJECTED. Leaves the live homepage alone. */
export async function discardHomepageDraft(
  prisma: PrismaClient,
  id: string,
): Promise<DiscardDraftResult> {
  const draft = await prisma.homepageWorkerDraft.findUnique({ where: { id } });
  if (!draft) return { discarded: false, status: "EXPIRED", reason: "not_found" };
  if (!isReviewableDraftStatus(draft.status)) {
    return { discarded: false, status: draft.status, reason: `draft is ${draft.status}` };
  }
  await prisma.homepageWorkerDraft.update({ where: { id }, data: { status: "REJECTED" } });
  return { discarded: true, status: "REJECTED" };
}

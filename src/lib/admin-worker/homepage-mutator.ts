/**
 * Homepage redesign mutator (spec section 10).
 *
 * Builds a proposed homepage snapshot from currently published content
 * and existing HomePageBlock rows. The mutator never invents block
 * types — it only re-orders, re-fills, and (with high confidence)
 * adds blocks from the existing supported set.
 *
 * Outputs a `HomepageWorkerDraft` row via the existing designer.
 * Auto-publishes only small high-confidence changes; everything else
 * routes to review.
 */

import type {
  ChecklistContentType,
  HomePageBlock,
  HomepageWorkerDraftMode,
  PrismaClient,
} from "@prisma/client";

import {
  createHomepageDraft,
  recordHomepageScore,
  HOMEPAGE_REDESIGN_THRESHOLD,
  computeHomepageFinalScore,
} from "./homepage-designer";
import { writeAdminWorkerLog } from "./logs";

/** Supported block types — the mutator refuses to invent any type
 *  outside this list, per spec ("not invent unsupported components"). */
const SUPPORTED_BLOCK_TYPES = new Set([
  "hero",
  "mission",
  "featured-prayers",
  "featured-saints",
  "featured-devotions",
  "featured-novenas",
  "featured-apparitions",
  "featured-sacraments",
  "featured-history",
  "today",
  "footer-card",
] as const);

type FeaturedBlockSpec = {
  blockKey: string;
  blockType: string;
  contentType: ChecklistContentType;
  desiredCount: number;
};

const FEATURED_SLOTS: readonly FeaturedBlockSpec[] = [
  {
    blockKey: "featured-prayers",
    blockType: "featured-prayers",
    contentType: "PRAYER",
    desiredCount: 4,
  },
  {
    blockKey: "featured-saints",
    blockType: "featured-saints",
    contentType: "SAINT",
    desiredCount: 4,
  },
  {
    blockKey: "featured-devotions",
    blockType: "featured-devotions",
    contentType: "DEVOTION",
    desiredCount: 3,
  },
  {
    blockKey: "featured-novenas",
    blockType: "featured-novenas",
    contentType: "NOVENA",
    desiredCount: 3,
  },
];

interface BlockSnapshot {
  blockKey: string;
  blockType: string;
  sortOrder: number;
  configJson: unknown;
}

function toSnapshot(block: HomePageBlock): BlockSnapshot {
  return {
    blockKey: block.blockKey,
    blockType: block.blockType,
    sortOrder: block.sortOrder,
    configJson: block.configJson,
  };
}

function blocksDiff(
  before: readonly BlockSnapshot[],
  after: readonly BlockSnapshot[],
): { added: string[]; removed: string[]; updated: string[] } {
  const beforeKeys = new Set(before.map((b) => b.blockKey));
  const afterKeys = new Set(after.map((b) => b.blockKey));
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  for (const a of after) {
    if (!beforeKeys.has(a.blockKey)) {
      added.push(`added:${a.blockKey}`);
    } else {
      const prior = before.find((b) => b.blockKey === a.blockKey);
      if (prior && JSON.stringify(prior.configJson) !== JSON.stringify(a.configJson)) {
        updated.push(`updated:${a.blockKey}`);
      }
    }
  }
  for (const b of before) {
    if (!afterKeys.has(b.blockKey)) removed.push(`deleted:${b.blockKey}`);
  }
  return { added, removed, updated };
}

export interface RedesignResult {
  draftId: string | null;
  status: string | null;
  finalScore: number;
  qualityScoreId: string | null;
  sectionsChanged: string[];
  reasonSummary: string;
}

/**
 * Score the homepage from live data, then — if the score is below the
 * redesign threshold — build a proposed homepage by refilling
 * featured slots from the most recently published content of each
 * type. Records a quality score row + (when proposed) a draft row.
 */
export async function redesignHomepage(
  prisma: PrismaClient,
  opts: {
    passId?: string;
    mode?: HomepageWorkerDraftMode;
    /** Optional override for the redesign threshold (tests). */
    redesignThreshold?: number;
  } = {},
): Promise<RedesignResult> {
  const homepage = await prisma.homePage
    .findUnique({ where: { slug: "homepage" }, include: { blocks: true } })
    .catch(() => null);

  const currentBlocks: BlockSnapshot[] = (homepage?.blocks ?? [])
    .filter((b) => SUPPORTED_BLOCK_TYPES.has(b.blockType as never))
    .map(toSnapshot);

  // Compute current homepage quality score from live signals.
  const publishedByType = await prisma.publishedContent.groupBy({
    by: ["contentType"],
    where: { isPublished: true },
    _count: true,
  });
  const totalPublished = publishedByType.reduce((s, r) => s + (r._count as number), 0);
  const haveAtLeastOneOf = new Set(publishedByType.map((r) => r.contentType));

  const featuredKeys = currentBlocks
    .filter((b) => b.blockType.startsWith("featured-"))
    .map((b) => b.blockKey);
  const seasonalScore = computeSeasonalRelevance();
  const balanceScore =
    FEATURED_SLOTS.length === 0
      ? 1
      : FEATURED_SLOTS.filter((s) => featuredKeys.includes(s.blockKey)).length /
        FEATURED_SLOTS.length;

  const score = computeHomepageFinalScore({
    contentFreshnessScore: Math.min(1, totalPublished / 30),
    sectionBalanceScore: balanceScore,
    visualCompletenessScore: currentBlocks.length >= 4 ? 1 : currentBlocks.length / 4,
    linkHealthScore: 1,
    seasonalRelevanceScore: seasonalScore,
    emptyStateAvoidanceScore: featuredKeys.length > 0 ? 1 : 0,
    accessibilityScore: 1,
    mobileReadinessScore: 1,
  });
  const qualityRow = await recordHomepageScore(prisma, {
    contentFreshnessScore: Math.min(1, totalPublished / 30),
    sectionBalanceScore: balanceScore,
    visualCompletenessScore: currentBlocks.length >= 4 ? 1 : currentBlocks.length / 4,
    linkHealthScore: 1,
    seasonalRelevanceScore: seasonalScore,
    emptyStateAvoidanceScore: featuredKeys.length > 0 ? 1 : 0,
    accessibilityScore: 1,
    mobileReadinessScore: 1,
  });

  const threshold = opts.redesignThreshold ?? HOMEPAGE_REDESIGN_THRESHOLD;
  if (score >= threshold) {
    return {
      draftId: null,
      status: "no_redesign_needed",
      finalScore: score,
      qualityScoreId: qualityRow.id,
      sectionsChanged: [],
      reasonSummary: `Homepage score ${score.toFixed(2)} >= threshold ${threshold.toFixed(2)}.`,
    };
  }

  // Build a proposed homepage: keep existing supported blocks, refill
  // featured slots for content types we actually have published.
  const proposed: BlockSnapshot[] = [];
  for (const block of currentBlocks) {
    if (block.blockType.startsWith("featured-")) continue;
    proposed.push({ ...block });
  }

  let sortOrder = proposed.length;
  for (const slot of FEATURED_SLOTS) {
    if (!haveAtLeastOneOf.has(slot.contentType)) continue;
    const items = await prisma.publishedContent.findMany({
      where: { contentType: slot.contentType, isPublished: true },
      orderBy: { publishedAt: "desc" },
      take: slot.desiredCount,
      select: { slug: true, title: true, publishedAt: true },
    });
    if (items.length === 0) continue;
    proposed.push({
      blockKey: slot.blockKey,
      blockType: slot.blockType,
      sortOrder: sortOrder++,
      configJson: {
        heading: humanLabel(slot.blockKey),
        items: items.map((i) => ({ slug: i.slug, title: i.title })),
        refreshedAt: new Date().toISOString(),
      },
    });
  }

  // Diff for the draft + confidence calculation.
  const diff = blocksDiff(currentBlocks, proposed);
  const sectionsChanged = [...diff.added, ...diff.updated, ...diff.removed];

  // Confidence: high when we're just refreshing existing featured
  // blocks; lower when we're adding new sections or removing any.
  let confidence = 0.7;
  if (diff.removed.length > 0) confidence = 0.5;
  if (diff.added.length === 0 && diff.removed.length === 0) confidence = 0.95;
  if (diff.added.length > 2) confidence = 0.6;

  const mode = opts.mode ?? deriveMode(diff);

  const draft = await createHomepageDraft(prisma, {
    passId: opts.passId,
    mode,
    currentSnapshot: currentBlocks,
    proposedSnapshot: proposed,
    reasonSummary:
      `Homepage score ${score.toFixed(2)} below threshold ${threshold.toFixed(2)}. ` +
      `Proposed ${diff.added.length} added, ${diff.updated.length} refreshed, ` +
      `${diff.removed.length} removed.`,
    sectionsChanged,
    confidence,
    finalScore: score,
  });

  await writeAdminWorkerLog(prisma, {
    passId: opts.passId ?? null,
    category: "HOMEPAGE",
    severity: "INFO",
    eventName: `homepage_draft_${draft.status.toLowerCase()}`,
    message: `Homepage draft ${draft.id} (${draft.status}): ${sectionsChanged.length} section change(s).`,
    safeMetadata: {
      qualityScoreId: qualityRow.id,
      finalScore: score,
      mode,
      confidence,
      sectionsChanged,
    },
    relatedEntityId: draft.id,
  });

  return {
    draftId: draft.id,
    status: draft.status,
    finalScore: score,
    qualityScoreId: qualityRow.id,
    sectionsChanged,
    reasonSummary: `Drafted ${draft.status} change set (confidence ${confidence.toFixed(2)}).`,
  };
}

function deriveMode(diff: {
  added: string[];
  removed: string[];
  updated: string[];
}): HomepageWorkerDraftMode {
  if (diff.removed.length > 0) return "FULL_REFRESH";
  if (diff.added.length > 0) return "CONTENT_GAP_REPAIR";
  if (diff.updated.length > 0) return "AUTOMATIC_SMALL";
  return "SEASONAL_REFRESH";
}

function humanLabel(blockKey: string): string {
  return blockKey
    .replace(/^featured-/, "Featured ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Lightweight seasonal-relevance score using the calendar month. The
 * spec only requires "seasonal Catholic calendar context", not a
 * complete liturgical-year engine; this scaffolding can be replaced
 * with a real liturgical calendar in Phase 5+.
 */
function computeSeasonalRelevance(date = new Date()): number {
  const month = date.getMonth() + 1;
  // Advent + Christmas + Epiphany (Dec, Jan) get a small boost.
  if (month === 12 || month === 1) return 1;
  // Lent + Easter season approximations (Mar, Apr, May).
  if (month >= 3 && month <= 5) return 0.95;
  // Marian months (Oct, May).
  if (month === 10) return 0.9;
  return 0.7;
}

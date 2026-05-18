/**
 * Public display verification.
 *
 * After persistBuiltPackage() writes a row, the strict public query
 * MUST be able to see it. If it can't, the public render gate has
 * failed silently — the row is in the database but unreachable by
 * the public site.
 *
 * `verifyPublicDisplay` re-queries the canonical strict-public
 * where-clause for the (contentType, slug) pair. If the row is not
 * visible, the helper logs a public-gate-failure event and (when
 * configured) enqueues a content_revalidate so strict QA can
 * inspect the row and either flag it correctly or delete it.
 *
 * The function is read-then-act: it never mutates the row directly
 * (the strict cleanup pass is the only authorized mutator). It only
 * verifies + enqueues a revalidation when needed.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

export type PublicDisplayVerificationResult = {
  contentType: string;
  slug: string;
  visible: boolean;
  reasons: string[];
};

const MODEL_FOR_TYPE: Record<string, string> = {
  Prayer: "prayer",
  Saint: "saint",
  MarianApparition: "marianApparition",
  Parish: "parish",
  Devotion: "devotion",
  Novena: "devotion",
  Sacrament: "spiritualLifeGuide",
  Rosary: "devotion",
  Consecration: "spiritualLifeGuide",
  SpiritualGuidance: "spiritualLifeGuide",
  Liturgy: "liturgyEntry",
  LiturgyEntry: "liturgyEntry",
  History: "liturgyEntry",
};

/**
 * Verify the row is visible via the strict public query. Returns
 * `visible: false` with explicit reasons when the row exists but is
 * not visible, or when the row does not exist at all.
 */
export async function verifyPublicDisplay(input: {
  contentType: string;
  slug: string;
}): Promise<PublicDisplayVerificationResult> {
  const reasons: string[] = [];
  const model = MODEL_FOR_TYPE[input.contentType];
  if (!model) {
    reasons.push(`no_public_model_for_${input.contentType}`);
    return { contentType: input.contentType, slug: input.slug, visible: false, reasons };
  }
  const delegate = (
    prisma as unknown as Record<
      string,
      {
        findFirst: (a: { where: unknown; select?: unknown }) => Promise<unknown | null>;
      }
    >
  )[model];
  if (!delegate) {
    reasons.push(`prisma_missing_model_${model}`);
    return { contentType: input.contentType, slug: input.slug, visible: false, reasons };
  }
  // Pass 1: strict-public-where match.
  const visibleRow = await delegate
    .findFirst({
      where: { slug: input.slug, ...STRICT_PUBLIC_WHERE_CLAUSE },
      select: { id: true },
    })
    .catch((e) => {
      reasons.push(`strict_query_failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    });
  if (visibleRow) {
    return { contentType: input.contentType, slug: input.slug, visible: true, reasons: [] };
  }
  // Pass 2: explain why the strict pass missed.
  const anyRow = (await delegate.findFirst({ where: { slug: input.slug } }).catch(() => null)) as {
    id: string;
    status?: string;
    publicRenderReady?: boolean;
    isThresholdEligible?: boolean;
    archivedAt?: Date | null;
  } | null;
  if (!anyRow) {
    reasons.push("row_does_not_exist");
    return { contentType: input.contentType, slug: input.slug, visible: false, reasons };
  }
  if (anyRow.status !== "PUBLISHED") reasons.push(`status_is_${anyRow.status ?? "unknown"}`);
  if (anyRow.publicRenderReady !== true) reasons.push("publicRenderReady_false");
  if (anyRow.isThresholdEligible !== true) reasons.push("isThresholdEligible_false");
  if (anyRow.archivedAt) reasons.push("archived");
  if (reasons.length === 0) reasons.push("strict_query_failed_unknown_reason");
  return { contentType: input.contentType, slug: input.slug, visible: false, reasons };
}

/**
 * Verify display + enqueue a strict revalidation when the row is
 * persisted but invisible. The user-visible automatic recovery path
 * for the "persisted but public gates failed" pipeline-broken-here
 * entry.
 */
export async function verifyPublicDisplayAndRepair(input: {
  contentType: string;
  slug: string;
}): Promise<PublicDisplayVerificationResult> {
  const result = await verifyPublicDisplay(input);
  if (result.visible) return result;
  logger.warn("content-factory.public_display_failed", {
    contentType: input.contentType,
    slug: input.slug,
    reasons: result.reasons,
  });
  // Trigger strict revalidation. The cleanup loop will either fix
  // the flags (when the row passes its contract) or delete the row
  // with a precise log entry.
  try {
    const { autoEnqueueRenderGateCleanup } = await import("../ingestion/queue/auto-cleanup");
    await autoEnqueueRenderGateCleanup({
      contentType: input.contentType,
      slug: input.slug,
    });
  } catch (e) {
    logger.warn("content-factory.revalidation_enqueue_failed", {
      contentType: input.contentType,
      slug: input.slug,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return result;
}

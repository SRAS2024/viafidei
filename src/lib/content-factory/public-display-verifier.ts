/**
 * Public display verification.
 *
 * After persistBuiltPackage() writes a row, the strict public query
 * MUST be able to see it, it MUST sit under the correct tab, and it
 * MUST carry the correct content type + subtype. If any of those
 * fail, the public render gate has failed silently.
 *
 * `verifyPublicDisplay` re-queries the canonical strict-public
 * where-clause and reports a per-check breakdown:
 *
 *   - publicQuery        — the strict public query finds the row
 *   - correctTab         — the content type maps to a public tab
 *   - detailPage         — the detail page's slug query finds the row
 *   - thresholdEligible  — the row counts toward content thresholds
 *   - correctContentType — a row exists in the expected table
 *   - correctSubtype     — the row's subtype discriminator is correct
 *
 * `verifyPublicDisplayAndRepair` additionally runs the repair
 * actions when the row is persisted but not displayed: a strict
 * revalidation (render-gate cleanup) plus a cache / search / sitemap
 * tag revalidation.
 *
 * The function is read-then-act: it never mutates the row directly.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";
import { CONTENT_TYPE_TO_TAB } from "../cache/tags";

export type PublicDisplayChecks = {
  publicQuery: boolean;
  correctTab: boolean;
  detailPage: boolean;
  thresholdEligible: boolean;
  correctContentType: boolean;
  correctSubtype: boolean;
};

export type PublicDisplayVerificationResult = {
  contentType: string;
  slug: string;
  visible: boolean;
  reasons: string[];
  checks: PublicDisplayChecks;
  /** Public tab the content type should appear under. */
  expectedTab: string | null;
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

type PublicRow = {
  id: string;
  status?: string;
  publicRenderReady?: boolean;
  isThresholdEligible?: boolean;
  archivedAt?: Date | null;
  subtype?: string | null;
  sacramentKey?: string | null;
  historyType?: string | null;
};

/** Whether the row's subtype discriminator matches the requested content type. */
function subtypeOk(contentType: string, row: PublicRow): boolean {
  switch (contentType) {
    case "Novena":
      return row.subtype === "Novena";
    case "Rosary":
      return row.subtype === "Rosary";
    case "Consecration":
      return row.subtype === "Consecration";
    case "Devotion":
      return row.subtype == null;
    case "Sacrament":
      return typeof row.sacramentKey === "string" && row.sacramentKey.length > 0;
    case "SpiritualGuidance":
      return row.sacramentKey == null && row.subtype !== "Rosary" && row.subtype !== "Consecration";
    case "History":
      return typeof row.historyType === "string" && row.historyType.length > 0;
    case "Liturgy":
      return row.historyType == null;
    default:
      // Prayer, Saint, MarianApparition, Parish — no subtype discriminator.
      return true;
  }
}

function tabFor(contentType: string): string | null {
  return CONTENT_TYPE_TO_TAB[contentType as keyof typeof CONTENT_TYPE_TO_TAB] ?? null;
}

/**
 * Verify the row is visible via the strict public query and carries
 * the correct tab placement, threshold flag and subtype.
 */
export async function verifyPublicDisplay(input: {
  contentType: string;
  slug: string;
}): Promise<PublicDisplayVerificationResult> {
  const reasons: string[] = [];
  const expectedTab = tabFor(input.contentType);
  const blankChecks: PublicDisplayChecks = {
    publicQuery: false,
    correctTab: expectedTab != null,
    detailPage: false,
    thresholdEligible: false,
    correctContentType: false,
    correctSubtype: false,
  };

  const model = MODEL_FOR_TYPE[input.contentType];
  if (!model) {
    reasons.push(`no_public_model_for_${input.contentType}`);
    return { ...input, visible: false, reasons, checks: blankChecks, expectedTab };
  }
  const delegate = (
    prisma as unknown as Record<
      string,
      { findFirst: (a: { where: unknown; select?: unknown }) => Promise<unknown | null> }
    >
  )[model];
  if (!delegate) {
    reasons.push(`prisma_missing_model_${model}`);
    return { ...input, visible: false, reasons, checks: blankChecks, expectedTab };
  }

  // Pass 1: strict-public-where match (the live tab / detail / search query).
  const visibleRow = await delegate
    .findFirst({
      where: { slug: input.slug, ...STRICT_PUBLIC_WHERE_CLAUSE },
      select: { id: true },
    })
    .catch((e) => {
      reasons.push(`strict_query_failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    });

  // Pass 2: the full row, for tab / threshold / subtype checks.
  const anyRow = (await delegate
    .findFirst({ where: { slug: input.slug } })
    .catch(() => null)) as PublicRow | null;

  const checks: PublicDisplayChecks = {
    publicQuery: visibleRow != null,
    correctTab: expectedTab != null,
    detailPage: visibleRow != null,
    thresholdEligible: anyRow?.isThresholdEligible === true,
    correctContentType: anyRow != null,
    correctSubtype: anyRow != null ? subtypeOk(input.contentType, anyRow) : false,
  };

  if (visibleRow) {
    return { ...input, visible: true, reasons: [], checks, expectedTab };
  }

  // Not visible — explain precisely.
  if (!anyRow) {
    reasons.push("row_does_not_exist");
    return { ...input, visible: false, reasons, checks, expectedTab };
  }
  if (anyRow.status !== "PUBLISHED") reasons.push(`status_is_${anyRow.status ?? "unknown"}`);
  if (anyRow.publicRenderReady !== true) reasons.push("publicRenderReady_false");
  if (anyRow.isThresholdEligible !== true) reasons.push("isThresholdEligible_false");
  if (anyRow.archivedAt) reasons.push("archived");
  if (!checks.correctSubtype) reasons.push("wrong_subtype");
  if (!checks.correctTab) reasons.push("no_tab_mapping");
  if (reasons.length === 0) reasons.push("strict_query_failed_unknown_reason");
  return { ...input, visible: false, reasons, checks, expectedTab };
}

/**
 * Verify display + run the repair actions when the row is persisted
 * but not displayed:
 *   - strict revalidation (render-gate cleanup)
 *   - cache + search + sitemap tag revalidation
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

  // Repair 1: strict revalidation — the cleanup loop fixes the flags
  // or deletes the row with a precise log entry.
  try {
    const { autoEnqueueRenderGateCleanup } = await import("../ingestion/queue/auto-cleanup");
    await autoEnqueueRenderGateCleanup({ contentType: input.contentType, slug: input.slug });
  } catch (e) {
    logger.warn("content-factory.revalidation_enqueue_failed", {
      contentType: input.contentType,
      slug: input.slug,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Repair 2: cache / search / sitemap tag revalidation, so a stale
  // cache is never the reason a persisted package is not displayed.
  try {
    const { revalidateForRow } = await import("../cache/revalidate");
    await revalidateForRow({
      reason: "package_updated",
      contentType: input.contentType,
      slug: input.slug,
    });
  } catch (e) {
    logger.warn("content-factory.repair_revalidate_failed", {
      contentType: input.contentType,
      slug: input.slug,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return result;
}
